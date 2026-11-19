// dsh-skill-vault · host half
//
// 只读技能总管：把散落在各处的技能聚合成一份目录，按功能分类，
// 提供一个"库"目录收纳副本 + 一个下载/收录入口 + 实时任务进度。
//
// ★ 硬约束：绝不修改任何技能。
//   - 对技能源只做 readdir / readFile / stat / copy（源的一侧永远是只读）
//   - 唯一的写点 = <库根>，每次写入前 assertInsideLibrary()
//   - 不提供 delete / rename / 改 frontmatter 的端点，一行都没有
//
// 库根：<DSH_HOME>/skill-library/  （与 <DSH_HOME>/skills 完全分离，
//       所以库里的东西不会自动进 DSH 的技能目录，也不会影响正在跑的技能）

import { promises as fs } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { join, basename, dirname, resolve, isAbsolute, sep, extname } from "node:path";
import os from "node:os";
import { extractArchive } from "./archive.js";

export const name = "dsh-skill-vault";
export const inject = ["webServer", "skills"];

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TASKS = 40;
/** 宿主半版本：client 会用 catalog 里的 hostVersion 与自己的版本比对，不一致就提示重启。 */
const VERSION = "3.0.3";

const log = (...args) => { try { console.log("[dsh-skill-vault]", ...args); } catch { /* ignore */ } };

// ---------- 路径 ----------

function dshHome() {
  const env = process.env.DSH_HOME;
  if (typeof env === "string" && env.trim() !== "") return resolve(env.trim());
  return join(os.homedir(), ".dsh");
}
function libraryRoot() { return join(dshHome(), "skill-library"); }
function tmpRoot() { return join(libraryRoot(), ".tmp"); }

function isInside(parent, child) {
  const norm = (p) => (process.platform === "win32" ? resolve(p).toLowerCase() : resolve(p));
  const base = norm(parent);
  const full = norm(child);
  return full === base || full.startsWith(base.endsWith(sep) ? base : base + sep);
}
/** 唯一写点守卫：任何写操作前必须过这一关。 */
function assertInsideLibrary(target) {
  const root = libraryRoot();
  if (!isInside(root, target)) throw httpError(400, `拒绝写入库外的路径：${target}`);
  return target;
}

// ---------- 分类 ----------

const CATEGORIES = [
  {
    id: "redteam", dir: "02-红队演练", note: "信息收集、漏洞扫描与利用、内网横向、隧道与代理、WebShell 工具",
    // 词形规则优先：名字里带 scan / recon / tunnel / shell 的先归红队，免得被"逆向"描述抢走
    match: [
      /红队|渗透|内网|横向|抓漏|打点/,
      /(^|[\s\-_])(scan|recon|correlation|pipeline|fingerprint|bruteforce|nuclei|fscan|gogo|credential|lateral|tunnel|proxy-pool|webshell|shell|redteam|webbridge|deepseek-re|browser-automation)([\s\-_]|$)/,
    ],
  },
  {
    id: "security-reverse", dir: "01-安全与逆向", note: "逆向分析：静态/动态、脱壳、协议还原、保护对抗、证据链",
    match: [/^rev[-_]/, /rev(unpack|verify|protocol|evidence|dispatch)/i, /逆向|脱壳|反编译/],
  },
  {
    id: "narrative", dir: "03-成人写作", note: "成人向虚构叙事模板、世界观、分级描写参数库",
    match: [/adult|nsfw|18\+|叙事模板|萝莉/],
  },
  {
    id: "creative", dir: "04-内容创作", note: "视频/图像生成流水线、Office 文档产物（docx/pptx/xlsx）、PDF 处理",
    match: [/comfy|minimax|video|i2v|office|docx|pptx|xlsx|pdf|document|slide|spreadsheet/],
  },
  {
    id: "browser", dir: "05-浏览器与自动化", note: "浏览器操作、表单驱动、页面取证、截图",
    match: [/browser|pilot|screenshot|playwright|selenium/],
  },
  {
    id: "meta", dir: "06-方法论与自进化", note: "提示词内核、账本自进化、DSH 自身文档、技能库与预设构建",
    match: [/evolve|skill[-_]?vault|kernel|prompt-?inject|dsh-doc/],

  },
  {
    id: "system", dir: "07-系统与排障", note: "沙箱、权限、ACL、环境与进程诊断",
    match: [/diagnose|sandbox|acl|permission/],
  },
  {
    id: "visual", dir: "08-视觉与识图", note: "多模态识图、OCR、图表与截图理解",
    match: [/vision|ocr|multimodal|识图/],
  },
  {
    id: "other", dir: "99-未分类", note: "未命中任何规则时落到这里，可手工在 categories 里加规则",
    match: [],
  },
];
const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

// ---------- 审计日志 + 10 分钟撤销栈 ----------

const UNDO_TTL_MS = 10 * 60 * 1000;
const UNDO_MAX = 30;
const undoStack = [];
let undoSeq = 0;

function auditFile() { return join(libraryRoot(), ".library", "audit.log"); }
function undoBinDir() { return join(libraryRoot(), ".library", "undo-bin"); }

async function audit(action, detail) {
  try {
    const target = auditFile();
    assertInsideLibrary(target);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.appendFile(target, `${new Date().toISOString()}\t${action}\t${JSON.stringify(detail ?? {})}\n`, "utf8");
  } catch { /* 日志失败不影响主流程 */ }
}

async function readAudit(limit = 100) {
  try {
    const text = await fs.readFile(auditFile(), "utf8");
    return text.trim().split("\n").filter(Boolean).slice(-limit).reverse().map((line) => {
      const [at, action, rest] = line.split("\t");
      let detail = {};
      try { detail = JSON.parse(rest ?? "{}"); } catch { detail = { raw: rest }; }
      return { at, action, detail };
    });
  } catch { return []; }
}

function pushUndo(entry) {
  undoStack.unshift({ id: `u${Date.now().toString(36)}${(undoSeq += 1).toString(36)}`, at: Date.now(), ...entry });
  while (undoStack.length > UNDO_MAX) undoStack.pop();
}

/** 清理超过 10 分钟的撤销项，连同它的暂存目录。 */
async function pruneUndo() {
  const now = Date.now();
  for (let index = undoStack.length - 1; index >= 0; index -= 1) {
    const entry = undoStack[index];
    if (now - entry.at <= UNDO_TTL_MS) continue;
    undoStack.splice(index, 1);
    if (typeof entry.stashDir === "string") await fs.rm(entry.stashDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function undoList() {
  await pruneUndo();
  return undoStack.map((entry) => ({ id: entry.id, at: entry.at, action: entry.action, description: entry.description, expiresInMs: Math.max(0, UNDO_TTL_MS - (Date.now() - entry.at)) }));
}

/** 撤销一条（默认最近一条）。 */
async function undoOne(id) {
  await pruneUndo();
  if (undoStack.length === 0) throw httpError(404, "没有可撤销的操作（撤销窗口 10 分钟）");
  const index = id === undefined || id === "" ? 0 : undoStack.findIndex((entry) => entry.id === id);
  if (index === -1) throw httpError(404, `没有这条撤销记录：${id}`);
  const entry = undoStack[index];
  if (Date.now() - entry.at > UNDO_TTL_MS) throw httpError(410, "这条操作超过 10 分钟，撤销窗口已过期");

  if (entry.kind === "move") {
    if (!existsSync(entry.to)) throw httpError(410, `原目标已不存在：${entry.to}`);
    if (existsSync(entry.from)) throw httpError(409, `原位已被占用：${entry.from}`);
    await fs.mkdir(dirname(entry.from), { recursive: true });
    await fs.rename(entry.to, entry.from);
  } else if (entry.kind === "stash") {
    if (!existsSync(entry.stashPath)) throw httpError(410, "暂存的文件已经不在（可能超过 10 分钟被清理）");
    if (existsSync(entry.from)) throw httpError(409, `原位已被占用：${entry.from}`);
    await fs.mkdir(dirname(entry.from), { recursive: true });
    await fs.rename(entry.stashPath, entry.from);
    await fs.rm(entry.stashDir, { recursive: true, force: true }).catch(() => {});
  } else if (entry.kind === "delete") {
    if (!existsSync(entry.path)) throw httpError(410, "要撤销的新建项已经不在了");
    await fs.rm(entry.path, { recursive: true, force: true });
  } else {
    throw httpError(400, `不认识的撤销类型：${entry.kind}`);
  }

  undoStack.splice(index, 1);
  cache.at = 0;
  await audit("undo", { kind: entry.kind, description: entry.description, from: entry.from, to: entry.to ?? entry.path });
  return { ok: true, id: entry.id, action: entry.action, description: entry.description };
}

// ---------- 调用监控（模型正在调用哪个 skill） ----------

const invocations = [];
const MAX_INVOCATIONS = 60;
/** 已结束的记录留 60 秒（让用户看到"刚结束"），之后自动清理。 */
const FINISHED_TTL_MS = 60 * 1000;
let invocationSeq = 0;

function pruneInvocations() {
  const now = Date.now();
  for (let index = invocations.length - 1; index >= 0; index -= 1) {
    const item = invocations[index];
    if (item.status === "running") continue;
    if (now - (item.endedAt ?? item.startedAt) > FINISHED_TTL_MS) invocations.splice(index, 1);
  }
  while (invocations.length > MAX_INVOCATIONS) invocations.pop();
}

function startInvocation(label, meta) {
  pruneInvocations();
  const item = {
    id: `inv${Date.now().toString(36)}${(invocationSeq += 1).toString(36)}`,
    name: String(label ?? "?"),
    status: "running",
    startedAt: Date.now(),
    endedAt: 0,
    durationMs: 0,
    scope: meta?.scope ?? "",
    cwd: meta?.cwd ?? "",
  };
  invocations.unshift(item);
  return item;
}

function finishInvocation(item, status) {
  if (item === null || item === undefined) return;
  item.endedAt = Date.now();
  item.durationMs = item.endedAt - item.startedAt;
  item.status = status;
}

/**
 * 挂钩技能注册表：模型通过 skill 工具取技能体时会走 registry.get(name)，
 * 在这里记录"谁在被调用 / 何时开始 / 是否结束"，结束 60 秒后自动清理。
 */
function installInvocationTracker(ctx) {
  let registry = null;
  try { registry = ctx.get("skills"); } catch { registry = null; }
  if (registry === null || registry === undefined || typeof registry.get !== "function") return () => {};
  if (registry.__skillVaultInvocationPatched === true) return () => {};
  const original = registry.get.bind(registry);
  registry.__skillVaultInvocationPatched = true;
  registry.get = async function skillVaultTrackedGet(skillName, options) {
    // 尽力从 options 里取作用域/工作目录，让「是谁在调」有据可查
    let meta = { scope: "", cwd: "" };
    try {
      if (options !== null && typeof options === "object") {
        if (options.scope !== undefined && options.scope !== null) meta.scope = String(options.scope).slice(0, 12);
        if (typeof options.cwd === "string") meta.cwd = options.cwd;
      }
    } catch { /* ignore */ }
    const item = startInvocation(skillName, meta);
    try {
      const result = await original(skillName, options);
      finishInvocation(item, result === undefined ? "miss" : "done");
      return result;
    } catch (error) {
      finishInvocation(item, "error");
      throw error;
    }
  };
  return () => {
    registry.get = original;
    registry.__skillVaultInvocationPatched = false;
  };
}

function invocationSnapshot() {
  pruneInvocations();
  const now = Date.now();
  const active = invocations.filter((item) => item.status === "running");
  const recent = invocations.filter((item) => item.status !== "running").slice(0, 20);
  const byName = {};
  for (const item of invocations) byName[item.name] = (byName[item.name] ?? 0) + 1;
  return {
    active: active.map((item) => ({ ...item, elapsedMs: now - item.startedAt })),
    recent,
    stats: { active: active.length, tracked: invocations.length, byName, finishedTtlMs: FINISHED_TTL_MS },
  };
}

// ---------- 分类：内置 9 个 + 用户自建（存在 <库根>/.library/categories.json） ----------

/** 读自定义分类（用户自取的标题）。 */
async function readCustomCategories() {
  try {
    const parsed = JSON.parse(await fs.readFile(join(libraryRoot(), ".library", "categories.json"), "utf8"));
    const list = Array.isArray(parsed?.categories) ? parsed.categories : [];
    return list
      .filter((item) => item && typeof item.dir === "string" && item.dir.trim() !== "")
      .map((item) => ({ id: item.id ?? "custom", dir: item.dir, note: item.note ?? "", builtin: item.builtin === true }));
  } catch { return []; }
}

/** 全部分类（内置在前，自定义在后，去重）。 */
async function allCategories() {
  const custom = await readCustomCategories();
  const merged = [];
  const seen = new Set();
  for (const category of CATEGORIES) {
    seen.add(category.dir);
    merged.push({ id: category.id, dir: category.dir, note: category.note, builtin: true });
  }
  for (const category of custom) {
    if (seen.has(category.dir)) continue;
    seen.add(category.dir);
    merged.push({ id: category.id ?? "custom", dir: category.dir, note: category.note, builtin: false });
  }
  return merged;
}

async function writeCustomCategories(list) {
  const target = join(libraryRoot(), ".library", "categories.json");
  assertInsideLibrary(target);
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ version: 1, categories: list }, null, 2) + "\n", "utf8");
}

/** 新建一个分类标题。 */
async function addCategory({ dir, note }) {
  const title = String(dir ?? "").trim();
  if (title === "") throw httpError(400, "分类名不能为空");
  if (title.length > 40) throw httpError(400, "分类名最长 40 个字符");
  if (/[\\/:*?"<>|]/.test(title) || title.includes("..")) throw httpError(400, `分类名里不能有这些字符：\\ / : * ? " < > | 或 ..`);
  const merged = await allCategories();
  if (merged.some((category) => category.dir === title)) throw httpError(409, `已经有这个分类：${title}`);
  const list = await readCustomCategories();
  list.push({ id: `custom-${title.replace(/\s+/g, "-")}`, dir: title, note: String(note ?? "").slice(0, 200), builtin: false });
  await writeCustomCategories(list);
  const target = join(libraryRoot(), title);
  assertInsideLibrary(target);
  await fs.mkdir(target, { recursive: true });
  const notePath = join(target, "_说明.md");
  if (!existsSync(notePath)) {
    await fs.writeFile(notePath, categoryReadme({ id: "custom", dir: title, note: String(note ?? "") || "用户自定义分类目录" }), "utf8");
  }
  cache.at = 0;
  return { ok: true, dir: title, note: String(note ?? "") };
}

/** 删除一个分类标题：只有用户自建、且目录为空（除 _说明.md）才允许。 */
async function removeCategory({ dir }) {
  const title = String(dir ?? "").trim();
  if (title === "") throw httpError(400, "需要 dir");
  const merged = await allCategories();
  const found = merged.find((category) => category.dir === title);
  if (found === undefined) throw httpError(404, `没有这个分类：${title}`);
  if (found.builtin) throw httpError(400, `内置分类不能删除：${title}（可以先把它下面清空，再自建同名分类）`);

  const target = join(libraryRoot(), title);
  assertInsideLibrary(target);
  let entries = [];
  try { entries = await fs.readdir(target); } catch { entries = []; }
  const leftovers = entries.filter((name) => name !== "_说明.md" && !name.startsWith("."));
  if (leftovers.length > 0) {
    throw httpError(409, `分类「${title}」下面还有 ${leftovers.length} 项，先清空再删（${leftovers.slice(0, 5).join(" / ")}）`);
  }
  const stashDir = join(undoBinDir(), `c${Date.now().toString(36)}${(undoSeq += 1).toString(36)}`);
  assertInsideLibrary(stashDir);
  await fs.mkdir(stashDir, { recursive: true });
  const stashPath = join(stashDir, title);
  await fs.rename(target, stashPath);
  pushUndo({ kind: "stash", action: "删除分类", description: `分类「${title}」`, from: target, stashDir, stashPath });
  await audit("category-remove", { dir: title, stashPath });
  const list = (await readCustomCategories()).filter((category) => category.dir !== title);
  await writeCustomCategories(list);
  cache.at = 0;
  return { ok: true, dir: title };
}

// 来源兜底：预设/插件的根意味着什么，只在名字与描述都没命中时使用
const SOURCE_HINT = [
  { test: /^preset:reverse/i, id: "security-reverse" },
  { test: /^preset:redteam/i, id: "redteam" },
  { test: /^plugin:dsh-pilot/i, id: "browser" },
  { test: /^plugin:browser-skill/i, id: "browser" },


];

/**
 * 分类：名字精确表 → 名字/描述正则 → 来源兜底 → 未分类。
 * 注意不要用 `^(a|b)$` 去匹配"名字 + 描述"拼起来的串，那样永远不命中。
 */
function classify(input = {}) {
  const name = String(input.name ?? "");
  const hay = `${name}\n${input.description ?? ""}`;
  for (const category of CATEGORIES) {
    if (category.names && category.names.includes(name)) return category;
  }
  for (const category of CATEGORIES) {
    if (category.match.length === 0) continue;
    if (category.match.some((re) => re.test(hay))) return category;
  }
  const source = String(input.hint ?? input.source ?? "");
  for (const hint of SOURCE_HINT) {
    if (hint.test.test(source)) return CATEGORY_BY_ID.get(hint.id) ?? CATEGORIES[CATEGORIES.length - 1];
  }
  return CATEGORIES[CATEGORIES.length - 1];
}

// ---------- frontmatter ----------

function frontmatterLines(text) {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return m === null ? null : m[1].split(/\r?\n/);
}
function field(lines, key) {
  const re = new RegExp("^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[ \\t]*:");
  const at = lines.findIndex((line) => re.test(line));
  if (at === -1) return undefined;
  const head = lines[at].replace(re, "").trim();
  if (head !== "" && !/^[>|][+-]?$/.test(head)) return head.replace(/^["']/, "").replace(/["']$/, "").trim();
  const out = [];
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") { out.push(""); continue; }
    if (!/^[ \t]/.test(line)) break;
    out.push(line.trim());
  }
  return (head.startsWith("|") ? out.join("\n") : out.join(" ")).replace(/[ \t]+/g, " ").trim();
}
function parseSkillText(text) {
  const lines = frontmatterLines(text);
  if (lines === null) return null;
  const skillName = field(lines, "name");
  const description = field(lines, "description");
  if (typeof skillName !== "string" || !NAME_RE.test(skillName)) return null;
  if (typeof description !== "string") return null;
  return { name: skillName, description };
}

// ---------- 来源根 ----------

function projectRoot() {
  return process.cwd();
}

function sourceRoots() {
  const home = dshHome();
  const roots = [
    { label: "user-dsh", path: join(home, "skills"), note: "用户技能根（DSH 原生 user-dsh）", writable: true },
    { label: "user-agents", path: join(os.homedir(), ".agents", "skills"), note: "用户 agents 根", writable: true },
    { label: "project-dsh", path: join(projectRoot(), ".dsh", "skills"), note: "当前工作区的项目根", writable: true },
    { label: "project-agents", path: join(projectRoot(), ".agents", "skills"), note: "当前工作区的 agents 根", writable: true },
  ];
  // <DSH_HOME>/<预设名>/skills ：红队 / 逆向等预设自己的技能根
  try {
    for (const entry of readdirSync(home, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const candidate = join(home, entry.name, "skills");
      if (existsSync(candidate)) roots.push({ label: `preset:${entry.name}`, path: candidate, note: `预设「${entry.name}」的技能根`, writable: true });
    }
  } catch { /* ignore */ }
  return roots;
}

/** 插件里自带的技能（node_modules/<pkg>/skills、<pkg>/skill、@scope/<pkg>/skills）。 */
async function pluginRoots() {
  const roots = [];
  const profiles = join(dshHome(), "profiles");
  let profileDirs = [];
  try { profileDirs = await fs.readdir(profiles, { withFileTypes: true }); } catch { return roots; }
  for (const profile of profileDirs) {
    if (!profile.isDirectory() || profile.name.startsWith(".")) continue;
    const modules = join(profiles, profile.name, "node_modules");
    let entries = [];
    try { entries = await fs.readdir(modules, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      const packages = [];
      if (entry.name.startsWith("@")) {
        let scoped = [];
        try { scoped = await fs.readdir(join(modules, entry.name), { withFileTypes: true }); } catch { continue; }
        for (const child of scoped) if (child.isDirectory()) packages.push(join(modules, entry.name, child.name));
      } else {
        packages.push(join(modules, entry.name));
      }
      for (const pkg of packages) {
        for (const sub of ["skills", "skill"]) {
          const candidate = join(pkg, sub);
          if (existsSync(candidate)) {
            roots.push({
              label: `plugin:${basename(pkg)}`,
              path: candidate,
              note: `插件 ${basename(pkg)} 自带技能`,
            });
          }
        }
      }
    }
  }
  return roots;
}

/** 内置在 app.asar 里的技能（只读展示，能读到时才可收录）。 */
const BUILTIN = [
  { name: "office", description: "Office 总路由：加载后启用 office_render / office_convert / office_recalculate", asset: "dsh/node_modules/@deepseek-ai/dsh-skill-office/assets/office" },
  { name: "office-docx", description: "Word 文档读写校验", asset: "dsh/node_modules/@deepseek-ai/dsh-skill-office/assets/office-docx" },
  { name: "office-pptx", description: "PowerPoint 演示文稿读写校验", asset: "dsh/node_modules/@deepseek-ai/dsh-skill-office/assets/office-pptx" },
  { name: "office-xlsx", description: "Excel 工作簿与公式", asset: "dsh/node_modules/@deepseek-ai/dsh-skill-office/assets/office-xlsx" },
  { name: "diagnose-windows-sandbox-acl", description: "Windows 沙箱 ACL 拒绝诊断与修复", asset: "dsh/node_modules/@deepseek-ai/dsh-sandbox-windows-acl/assets/diagnose-windows-sandbox-acl" },
  { name: "dsh-doc", description: "DSH 自身文档（插件/预设/工具/Cordis API）", asset: "dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/dsh-doc" },
];

function asarRoot() {
  const candidates = [];
  try { if (typeof process.resourcesPath === "string") candidates.push(process.resourcesPath); } catch { /* ignore */ }
  if (typeof process.execPath === "string") {
    candidates.push(join(dirname(process.execPath), "resources"));
    candidates.push(join(dirname(dirname(process.execPath)), "resources"));
  }
  candidates.push("G:/Deepseek Harness/resources");
  for (const base of candidates) {
    const archive = join(base, "app.asar");
    if (existsSync(archive)) return archive;
  }
  return null;
}

// ---------- 扫描 ----------

async function scanRoot(root) {
  const out = [];
  let entries = [];
  try { entries = await fs.readdir(root.path, { withFileTypes: true }); } catch { return out; }
  const collect = async (dir, kind, enabled, relPath) => {
    const skillFile = kind === "directory" ? join(dir, "SKILL.md") : dir;
    let text = "";
    try { text = await fs.readFile(skillFile, "utf8"); } catch { return; }
    const meta = parseSkillText(text);
    let stat = null;
    try { stat = await fs.stat(kind === "directory" ? dir : skillFile); } catch { /* ignore */ }
    out.push({
      name: meta?.name ?? basename(relPath, ".md"),
      description: meta?.description ?? "",
      rawName: basename(relPath, ".md"),
      parseable: meta !== null,
      kind,
      enabled,
      source: root.label,
      sourceNote: root.note,
      path: kind === "directory" ? dir : skillFile,
      size: stat?.size ?? 0,
      mtime: stat?.mtimeMs ?? 0,
    });
  };
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (existsSync(join(root.path, entry.name, "SKILL.md"))) await collect(join(root.path, entry.name), "directory", true, entry.name);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      await collect(join(root.path, entry.name), "file", true, entry.name);
    }
  }
  // 禁用态（技能板的 .disabled/ 约定，只读展示）
  const disabledDir = join(root.path, ".disabled");
  if (existsSync(disabledDir)) {
    let drows = [];
    try { drows = await fs.readdir(disabledDir, { withFileTypes: true }); } catch { drows = []; }
    for (const entry of drows) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory() && existsSync(join(disabledDir, entry.name, "SKILL.md"))) {
        await collect(join(disabledDir, entry.name), "directory", false, entry.name);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        await collect(join(disabledDir, entry.name), "file", false, entry.name);
      }
    }
  }
  return out;
}

async function scanLibrary() {
  const root = libraryRoot();
  const out = [];
  let dirs = [];
  try { dirs = await fs.readdir(root, { withFileTypes: true }); } catch { return out; }
  for (const categoryDir of dirs) {
    if (!categoryDir.isDirectory() || categoryDir.name.startsWith(".")) continue;
    const categoryPath = join(root, categoryDir.name);
    const category = CATEGORIES.find((item) => item.dir === categoryDir.name)
      ?? { id: "other", dir: categoryDir.name, note: "自定义分类目录" };
    let entries = [];
    try { entries = await fs.readdir(categoryPath, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const full = join(categoryPath, entry.name);
      if (entry.isDirectory()) {
        const skillFile = join(full, "SKILL.md");
        if (!existsSync(skillFile)) continue;
        const meta = parseSkillText(await fs.readFile(skillFile, "utf8").catch(() => ""));
        const stat = await fs.stat(full).catch(() => null);
        out.push({
          name: meta?.name ?? entry.name,
          description: meta?.description ?? "",
          kind: "directory",
          category: { id: category.id, dir: category.dir, note: category.note },
          path: full,
          size: stat?.size ?? 0,
          mtime: stat?.mtimeMs ?? 0,
        });
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const meta = parseSkillText(await fs.readFile(full, "utf8").catch(() => ""));
        const stat = await fs.stat(full).catch(() => null);
        out.push({
          name: meta?.name ?? basename(entry.name, ".md"),
          description: meta?.description ?? "",
          kind: "file",
          category: { id: category.id, dir: category.dir, note: category.note },
          path: full,
          size: stat?.size ?? 0,
          mtime: stat?.mtimeMs ?? 0,
        });
      }
    }
  }
  return out;
}

let cache = { at: 0, skills: [] };
const CACHE_MS = 4000;

async function catalog(force = false) {
  if (!force && Date.now() - cache.at < CACHE_MS) return cache.skills;
  const skills = [];
  const roots = sourceRoots();
  for (const root of await pluginRoots()) roots.push(root);
  for (const root of roots) skills.push(...await scanRoot(root));
  for (const builtin of BUILTIN) {
    skills.push({
      name: builtin.name,
      description: builtin.description,
      rawName: builtin.name,
      parseable: true,
      kind: "builtin",
      enabled: true,
      // 内置技能住在 app.asar 里：可以展示，但不能按路径复制
      harvestable: false,
      source: "builtin:app.asar",
      sourceNote: "随 DSH 发行包内置（只读展示，不可收录）",
      path: builtin.asset,
      size: 0,
      mtime: 0,
    });
  }
  const library = await scanLibrary();
  const libraryNames = new Set(library.map((item) => item.name));
  const counts = new Map();
  for (const skill of skills) counts.set(skill.name, (counts.get(skill.name) ?? 0) + 1);
  for (const skill of skills) {
    const category = classify({ name: skill.name, description: skill.description, hint: skill.source });
    skill.category = { id: category.id, dir: category.dir, note: category.note };
    skill.inLibrary = libraryNames.has(skill.name);
    skill.duplicate = (counts.get(skill.name) ?? 0) > 1;
    if (skill.harvestable === undefined) {
      // 内置（asar）与 frontmatter 不合规的技能都无法按路径复制进库，只做展示
      skill.harvestable = skill.kind !== "builtin" && skill.parseable !== false;
    }
    skill.id = `${skill.name}@${skill.source}@${skill.path}`;
  }
  skills.sort((a, b) => {
    if (a.category.dir !== b.category.dir) return a.category.dir.localeCompare(b.category.dir);
    return a.name.localeCompare(b.name);
  });
  cache = { at: Date.now(), skills };
  return skills;
}

// ---------- 库骨架 ----------

const ROOT_README = `# 技能库（dsh-skill-library）

这是 **dsh-skill-vault** 插件用来"收纳"技能的目录，**与 DSH 的技能根无关**：
放在这里的技能不会自动被加载，也不会改动 \`~/.dsh/skills\` 里的任何文件。
本插件对所有技能源都是**只读**的，唯一的写点就是本目录。

## 分类目录用途

| 目录 | 用途 |
|---|---|
| 01-安全与逆向 | 逆向分析：静态/动态、脱壳、协议还原、保护对抗、证据链 |
| 02-红队演练 | 信息收集、漏洞扫描与利用、内网横向、隧道与代理、WebShell 工具 |
| 03-成人写作 | 成人向虚构叙事模板、世界观、分级描写参数库 |
| 04-内容创作 | 视频/图像生成流水线、Office 文档产物、PDF 处理 |
| 05-浏览器与自动化 | 浏览器操作、表单驱动、页面取证、截图 |
| 06-方法论与自进化 | 提示词内核、账本自进化、DSH 自身文档、预设构建 |
| 07-系统与排障 | 沙箱、权限、ACL、环境与进程诊断 |
| 08-视觉与识图 | 多模态识图、OCR、图表理解 |
| 99-未分类 | 未命中规则时落到这里 |

## 约定

- 每个分类目录下的 \`_说明.md\` 是该类的用途注释（由插件生成，勿删）。
- 每个技能占一个子目录（含 \`SKILL.md\`）或一个扁平 \`<name>.md\`。
- 收纳时 **只复制、不改写**：frontmatter 原样保留，源技能文件一个字节都不动。
- 想删除库里的副本，直接用文件管理器删——插件本身不提供删除端点。
`;

function categoryReadme(category) {
  return `# ${category.dir}

${category.note}

- 本目录由 dsh-skill-vault 自动创建，分类 id：\`${category.id}\`
- 收纳进来的技能放在这里的子目录（含 SKILL.md）或 \`<name>.md\`
- 插件只读源技能、只写本目录；不会改动 DSH 的技能根
`;
}

async function ensureLibrary() {
  const root = libraryRoot();
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(tmpRoot(), { recursive: true });
  const readme = join(root, "README.md");
  if (!existsSync(readme)) await fs.writeFile(readme, ROOT_README, "utf8");
  for (const category of CATEGORIES) {
    const dir = join(root, category.dir);
    await fs.mkdir(dir, { recursive: true });
    const note = join(dir, "_说明.md");
    if (!existsSync(note)) await fs.writeFile(note, categoryReadme(category), "utf8");
  }
  const manifest = join(root, ".library", "categories.json");
  await fs.mkdir(dirname(manifest), { recursive: true });
  if (!existsSync(manifest)) {
    await fs.writeFile(manifest, JSON.stringify({
      version: 2,
      generatedAt: new Date().toISOString(),
      categories: CATEGORIES.map(({ id, dir, note }) => ({ id, dir, note, builtin: true })),
    }, null, 2) + "\n", "utf8");
  } else {
    // 已存在：补回被手删的内置分类，保留用户自建的标题
    const list = await readCustomCategories();
    const dirs = new Set(list.map((category) => category.dir));
    let changed = false;
    for (const category of CATEGORIES) {
      if (dirs.has(category.dir)) continue;
      list.push({ id: category.id, dir: category.dir, note: category.note, builtin: true });
      changed = true;
    }
    for (const category of list) {
      if (category.builtin === false) await fs.mkdir(join(root, category.dir), { recursive: true }).catch(() => {});
    }
    if (changed) await writeCustomCategories(list);
  }
}

// ---------- 任务 ----------

const tasks = [];
let taskSeq = 0;

function pushTask(fields) {
  const task = {
    id: `t${Date.now().toString(36)}${(taskSeq += 1).toString(36)}`,
    label: "",
    url: "",
    status: "pending",
    stage: "排队",
    bytes: 0,
    total: 0,
    percent: 0,
    category: "",
    name: "",
    error: "",
    cancelRequested: false,
    startedAt: Date.now(),
    finishedAt: 0,
    ...fields,
  };
  tasks.unshift(task);
  while (tasks.length > MAX_TASKS) tasks.pop();
  return task;
}

/** 请求取消：运行中的任务在下一个检查点自行停下，排队中的直接判取消。 */
function cancelTask(id) {  const task = tasks.find((item) => item.id === id);
  if (task === undefined) throw httpError(404, `没有这个任务：${id}`);
  if (task.status === "done" || task.status === "failed" || task.status === "canceled") {
    return { ok: true, id, status: task.status, noop: true };
  }
  task.cancelRequested = true;
  if (task.status === "pending") {
    task.status = "canceled";
    task.stage = "已取消";
    task.finishedAt = Date.now();
  } else {
    task.stage = "取消中…";
  }
  return { ok: true, id, status: task.status };
}

function isCanceled(task) {
  return task !== undefined && task !== null && task.cancelRequested === true;
}

// ---------- 设置（存在库内 .library/settings.json） ----------

function settingsFile() { return join(libraryRoot(), ".library", "settings.json"); }

async function readSettings() {
  try {
    const parsed = JSON.parse(await fs.readFile(settingsFile(), "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

async function writeSettings(patch) {
  const current = await readSettings();
  const next = { ...current, ...patch };
  const target = settingsFile();
  assertInsideLibrary(target);
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

/**
 * 清理任务记录。
 * - 只删已经结束的任务（done / failed / canceled）；还有在跑的就拒绝
 * - ids 省略 = 清掉所有已结束的记录
 */
async function clearTasks(ids) {
  const finished = new Set(["done", "failed", "canceled"]);
  const wanted = Array.isArray(ids) && ids.length > 0 ? new Set(ids) : null;
  const active = tasks.filter((task) => (wanted === null || wanted.has(task.id)) && !finished.has(task.status));
  if (active.length > 0) {
    throw httpError(409, `还有 ${active.length} 个任务没结束（先取消或等它跑完）：${active.map((task) => task.id).join(", ")}`);
  }
  const before = tasks.length;
  for (let i = tasks.length - 1; i >= 0; i -= 1) {
    const task = tasks[i];
    if (wanted !== null && !wanted.has(task.id)) continue;
    if (wanted === null && !finished.has(task.status)) continue;
    tasks.splice(i, 1);
  }
  return { ok: true, removed: before - tasks.length, remaining: tasks.length };
}

/**
 * 重跑 / 续跑：把原任务里还没成功的部分交给一个新任务。
 * 批量任务只挑 status !== done 的子项；下载任务按原 url / path 重来。
 */
function retryTask(id, options = {}) {
  const original = tasks.find((item) => item.id === id);
  if (original === undefined) throw httpError(404, `没有这个任务：${id}`);
  const payload = original.payload;
  if (payload === null || payload === undefined) throw httpError(400, "这个任务没有可重跑的载荷");

  const wantsAll = options.all === true;
  if (Array.isArray(original.items) && original.items.length > 0) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const remaining = original.items
      .map((row, index) => ({ row, item: items[index] }))
      .filter(({ row, item }) => item !== undefined && (wantsAll || row.status !== "done"))
      .map(({ item }) => item);
    if (remaining.length === 0) throw httpError(400, "没有未完成或失败的子项可重跑");
    const baseLabel = typeof payload.label === "string" && payload.label !== "" ? payload.label : "批量收录";
    return startHarvestBatch({ items: remaining, label: `${baseLabel}（续跑 ${remaining.length}）` });
  }

  if (typeof payload.bundle === "string" && Array.isArray(payload.items)) {
    if (wantsAll) return startHarvestBatch({ items: payload.items, label: payload.bundle });
    return startHarvestBatch({ items: payload.items, label: `${payload.bundle}（续）` });
  }

  if (typeof payload.url === "string" || typeof payload.path === "string") {
    const task = startDownload({ url: payload.url, path: payload.path, name: payload.name, category: payload.category });
    return task;
  }
  throw httpError(400, "这个任务的载荷类型不支持重跑");
}
function updateTask(task, patch) {
  Object.assign(task, patch);
  if (task.total > 0) task.percent = Math.min(100, Math.round((task.bytes / task.total) * 100));
  if (task.status === "done" || task.status === "failed") task.finishedAt = Date.now();
}

// ---------- 下载 / 收录 ----------

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function fetchToFile(url, task) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw httpError(502, `下载失败 HTTP ${response.status}`);
  const total = Number(response.headers.get("content-length") ?? 0) || 0;
  updateTask(task, { total });
  const fileName = basename(new URL(url).pathname) || "download.bin";
  const target = join(tmpRoot(), task.id, fileName);
  await fs.mkdir(dirname(target), { recursive: true });
  const handle = await fs.open(target, "w");
  try {
    if (response.body === null) {
      await handle.write(await response.arrayBuffer());
    } else {
      const reader = response.body.getReader();
      for (;;) {
        if (isCanceled(task)) {
          const canceled = httpError(499, "已取消");
          canceled.canceled = true;
          throw canceled;
        }
        const { done, value } = await reader.read();
        if (done) break;
        await handle.write(value);
        updateTask(task, { bytes: task.bytes + value.length, stage: "下载中" });
      }
    }
  } finally {
    await handle.close();
  }
  return target;
}

/** 在解包目录里找一个技能根（含 SKILL.md 的目录），最多下探 3 层。 */
async function findSkillDir(dir, depth = 0) {
  if (depth > 3) return null;
  if (existsSync(join(dir, "SKILL.md"))) return dir;
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    candidates.push(join(dir, entry.name));
  }
  for (const candidate of candidates) {
    const hit = await findSkillDir(candidate, depth + 1);
    if (hit !== null) return hit;
  }
  return null;
}

/** 把来源（目录 / .md / 解包出来的树）落进库的对应分类。只复制，不改内容。 */
async function installIntoLibrary({ sourcePath, isDirectory, nameHint, categoryHint, task }) {
  updateTask(task, { stage: "校验" });
  let meta = null;
  let skillFile = sourcePath;
  if (isDirectory) {
    const candidate = await findSkillDir(sourcePath);
    if (candidate === null) throw httpError(400, "包里没有找到 SKILL.md");
    skillFile = join(candidate, "SKILL.md");
    sourcePath = candidate;
  } else if (!sourcePath.toLowerCase().endsWith(".md")) {
    throw httpError(400, "只支持 SKILL.md / *.md / .zip / .tar.gz");
  }
  const text = await fs.readFile(skillFile, "utf8");
  meta = parseSkillText(text);
  if (meta === null) throw httpError(400, "技能的 frontmatter 不合规（需要 name + description，name 为 kebab-case）");

  const skillName = (nameHint && NAME_RE.test(nameHint)) ? nameHint : meta.name;
  // 分类：显式指定时优先（内置或用户自建标题都接受），否则按规则自动分类
  let category = null;
  if (categoryHint !== undefined && categoryHint !== "") {
    const known = (await allCategories()).find((item) => item.dir === categoryHint || item.id === categoryHint);
    if (known !== undefined) {
      category = { id: known.id, dir: known.dir, note: known.note };
    } else if (!categoryHint.includes("/") && !categoryHint.includes("\\") && !categoryHint.includes("..")) {
      // 库下已存在的自定义目录也认
      category = { id: "custom", dir: categoryHint, note: "" };
    }
  }
  if (category === null) {
    const auto = classify({ name: skillName, description: meta.description, hint: basename(dirname(sourcePath)) });
    category = { id: auto.id, dir: auto.dir, note: auto.note };
  }

  updateTask(task, { stage: "入库", name: skillName, category: category.dir });
  const targetDir = join(libraryRoot(), category.dir, skillName);
  assertInsideLibrary(targetDir);
  if (existsSync(targetDir)) throw httpError(409, `库里已经有同名技能：${category.dir}/${skillName}`);
  await fs.mkdir(dirname(targetDir), { recursive: true });
  if (isDirectory) {
    await fs.cp(sourcePath, targetDir, { recursive: true });
  } else {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourcePath, join(targetDir, "SKILL.md"));
  }
  return { name: skillName, category: category.dir, path: targetDir };
}

async function runTask(task, work) {
  updateTask(task, { status: "running" });
  try {
    const result = await work();
    if (isCanceled(task)) {
      updateTask(task, { status: "canceled", stage: result && result.stage ? result.stage : "已取消" });
    } else {
      updateTask(task, { status: "done", stage: "完成", percent: 100, ...result });
    }
  } catch (error) {
    if (isCanceled(task) || error?.canceled === true) {
      updateTask(task, { status: "canceled", stage: "已取消", error: "" });
    } else {
      updateTask(task, { status: "failed", stage: "失败", error: String(error?.message ?? error) });
    }
  } finally {
    const scratch = join(tmpRoot(), task.id);
    await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
    cache.at = 0;
    // 用户可在面板里选择"完成后自动清除记录"
    try {
      const settings = await readSettings();
      if (settings.autoClearTasks === true) {
        const at = tasks.indexOf(task);
        if (at !== -1) tasks.splice(at, 1);
      }
    } catch { /* 设置读不到就保留记录 */ }
  }
}

/** 下载入口：url 或本地路径 → 库。 */
function startDownload({ url, path, name, category }) {
  const label = url || path;
  if (typeof label !== "string" || label.trim() === "") throw httpError(400, "需要 url 或 path");
  const task = pushTask({ label: label.trim(), url: url ?? "", name: name ?? "", category: category ?? "", stage: "排队", payload: { url, path, name, category } });
  void runTask(task, async () => {
    let localFile = null;
    let localDir = null;
    if (typeof path === "string" && path.trim() !== "") {
      let source = path.trim();
      if (source.startsWith("~/") || source.startsWith("~\\")) source = join(os.homedir(), source.slice(2));
      else if (!isAbsolute(source)) source = resolve(source);
      const stat = await fs.stat(source).catch(() => null);
      if (stat === null) throw httpError(404, `路径不存在：${source}`);
      if (stat.isDirectory()) {
        localDir = source;
        updateTask(task, { stage: "复制目录", total: 0, percent: 0 });
      } else {
        localFile = source;
        updateTask(task, { total: stat.size, bytes: stat.size, stage: "读取文件" });
      }
    } else {
      localFile = await fetchToFile(url, task);
    }

    if (localDir !== null) {
      return await installIntoLibrary({ sourcePath: localDir, isDirectory: true, nameHint: name, categoryHint: category, task });
    }
    const lower = localFile.toLowerCase();
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
      return await installIntoLibrary({ sourcePath: localFile, isDirectory: false, nameHint: name, categoryHint: category, task });
    }
    updateTask(task, { stage: "解包" });
    const extractDir = join(tmpRoot(), task.id, "extract");
    await fs.mkdir(extractDir, { recursive: true });
    await extractArchive(localFile, extractDir);
    return await installIntoLibrary({ sourcePath: extractDir, isDirectory: true, nameHint: name, categoryHint: category, task });
  });
  return task;
}

/** 收录入口：把目录里已有的某个技能复制进库（源只读）。 */
function startHarvest({ skillPath, name, category }) {
  if (typeof skillPath !== "string" || skillPath.trim() === "") throw httpError(400, "需要 skillPath");
  const source = resolve(skillPath.trim());
  if (isInside(libraryRoot(), source)) throw httpError(400, "来源已经在库里了");
  if (!existsSync(source)) throw httpError(404, `路径不存在：${source}`);
  const task = pushTask({ label: source, name: name ?? "", url: "", category: category ?? "", stage: "排队", kind: "harvest", payload: { skillPath: source, name, category } });
  void runTask(task, async () => {
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      return await installIntoLibrary({ sourcePath: source, isDirectory: true, nameHint: name, categoryHint: category, task });
    }
    return await installIntoLibrary({ sourcePath: source, isDirectory: false, nameHint: name, categoryHint: category, task });
  });
  return task;
}

/**
 * 批量收录：一个任务里串行处理多个技能，逐条记录成功/失败。
 * 一个"任务需要多个技能"的场景就是靠它一次备齐。
 */
function startHarvestBatch({ items, label }) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, "items 不能为空");
  if (items.length > 200) throw httpError(400, "一次最多收录 200 个技能");
  const rows = items.map((item) => ({
    name: item.name || basename(String(item.skillPath ?? "")) || "?",
    path: String(item.skillPath ?? ""),
    status: "pending",
    error: "",
  }));
  const task = pushTask({
    label: label ? `技能包：${label}` : `${items.length} 个技能`,
    stage: "排队",
    kind: "batch",
    total: items.length,
    bytes: 0,
    items: rows,
    payload: { items, label: label ?? "" },
  });
  void runTask(task, async () => {
    let done = 0;
    const failures = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const row = rows[index];
      if (isCanceled(task)) {
        row.status = "skipped";
        row.error = "已取消";
        continue;
      }
      row.status = "running";
      updateTask(task, { stage: `收录 ${index + 1}/${items.length}：${row.name}`, bytes: done, percent: Math.round((index / items.length) * 100) });
      try {
        const source = resolve(String(item.skillPath ?? "").trim());
        if (!existsSync(source)) throw httpError(404, `路径不存在：${source}`);
        const stat = await fs.stat(source);
        await installIntoLibrary({
          sourcePath: source,
          isDirectory: stat.isDirectory(),
          nameHint: item.name,
          categoryHint: item.category,
          task,
        });
        row.status = "done";
        done += 1;
      } catch (error) {
        row.status = "failed";
        row.error = String(error?.message ?? error);
        failures.push(`${row.name}：${row.error}`);
      }
      updateTask(task, { bytes: done, percent: Math.round(((index + 1) / items.length) * 100) });
    }
    if (done === 0) throw httpError(400, `全部失败：${failures.join("；")}`);
    return {
      stage: failures.length === 0 ? `全部完成（${done}）` : `完成 ${done}/${items.length}，失败 ${failures.length}`,
      items: rows,
      failed: failures,
    };
  });
  return task;
}

/** 根的可读标题（下拉里显示成"大标题"而不是一串路径）。 */
function rootTitle(label) {
  if (label === "user-dsh") return "用户技能根";
  if (label === "user-agents") return "用户 agents 根";
  if (label === "project-dsh") return "当前项目技能根";
  if (label === "project-agents") return "当前项目 agents 根";
  if (label.startsWith("preset:")) return `预设「${label.slice(7)}」`;
  if (label.startsWith("plugin:")) return `插件 ${label.slice(7)}`;
  return label;
}

// ---------- 插入到根（把库内副本"剪切/复制"进某个技能根） ----------

/** 让技能注册表丢掉缓存（watcher 通常会自己刷，这里是兜底）。 */
async function invalidateSkills(ctx) {
  try {
    const registry = ctx.get("skills");
    if (registry && typeof registry.invalidateCache === "function") registry.invalidateCache();
  } catch { /* ignore */ }
}

/**
 * 把库内副本放进某个技能根，像剪切粘贴一样。
 * - 源必须在库内（库外一律 400）
 * - 目标根必须是可写根（user-dsh / user-agents / project-* / preset:*），plugin 根与 asar 不动
 * - 目标已存在同名 → 409，绝不覆盖
 * @param options.copy true = 保留库内副本（复制）；false/缺省 = 剪切（移动）
 */
async function pasteIntoRoot({ path: targetPath, root, name, copy }) {
  const library = libraryRoot();
  if (typeof targetPath !== "string" || targetPath.trim() === "") throw httpError(400, "需要 path");
  const source = resolve(targetPath.trim());
  if (!isInside(library, source)) throw httpError(400, `只能搬运库内的条目：${source}`);
  if (!existsSync(source)) throw httpError(404, `库里没有这个条目：${source}`);

  if (typeof root !== "string" || root.trim() === "") throw httpError(400, "需要 root");
  const wanted = resolve(root.trim());
  const known = sourceRoots().find((item) => {
    const a = process.platform === "win32" ? resolve(item.path).toLowerCase() : resolve(item.path);
    const b = process.platform === "win32" ? wanted.toLowerCase() : wanted;
    return a === b;
  });
  if (known === undefined) throw httpError(400, `不是可写的技能根：${root}（可用：${sourceRoots().map((item) => item.label).join(" / ")}）`);
  if (known.writable !== true) throw httpError(400, `这个根不允许写入：${known.label}`);

  const itemName = typeof name === "string" && name.trim() !== "" ? name.trim() : basename(source);
  if (itemName.includes("..") || itemName.includes("/") || itemName.includes("\\")) throw httpError(400, `名字不合法：${itemName}`);
  const destination = join(wanted, itemName);
  if (existsSync(destination)) throw httpError(409, `目标根里已有同名条目：${destination}`);

  await fs.mkdir(wanted, { recursive: true });
  const stat = await fs.stat(source);
  if (copy === true) {
    if (stat.isDirectory()) await fs.cp(source, destination, { recursive: true });
    else await fs.copyFile(source, destination);
    pushUndo({ kind: "delete", action: "复制到根", description: `${itemName} 复制到 ${known.label}`, path: destination });
  } else {
    try {
      await fs.rename(source, destination);
    } catch {
      // 跨盘时 rename 会 EXDEV：退化成复制 + 删除
      if (stat.isDirectory()) await fs.cp(source, destination, { recursive: true });
      else await fs.copyFile(source, destination);
      await fs.rm(source, { recursive: true, force: true });
    }
    pushUndo({ kind: "move", action: "剪切到根", description: `${itemName} → ${known.label}`, from: source, to: destination });
  }
  await audit("paste", { from: source, to: destination, root: known.label, mode: copy === true ? "copy" : "move" });
  cache.at = 0;
  return {
    ok: true,
    name: itemName.replace(/\.md$/i, ""),
    root: known.label,
    rootPath: wanted,
    path: destination,
    mode: copy === true ? "copy" : "move",
  };
}

// ---------- 改分类（把库内副本挪到另一个分类目录） ----------

/**
 * 把库内某个技能挪到另一个分类目录。只动库内副本，源技能不受影响。
 * @param options.path 现有条目的绝对路径（优先）
 * @param options.name + options.categoryDir 用来定位现有条目
 * @param options.toCategoryDir 目标分类目录名（必须是已登记分类，或库根下的已有目录）
 */
async function moveInLibrary({ path: targetPath, name, categoryDir, toCategoryDir }) {
  const library = libraryRoot();
  if (typeof toCategoryDir !== "string" || toCategoryDir.trim() === "") throw httpError(400, "需要 toCategoryDir");
  const destDir = toCategoryDir.trim();
  if (destDir.includes("..") || destDir.includes("/") || destDir.includes("\\")) {
    throw httpError(400, `目标分类名不合法：${destDir}`);
  }
  const known = (await allCategories()).some((category) => category.dir === destDir);
  const destRoot = join(library, destDir);
  if (!known && !existsSync(destRoot)) {
    throw httpError(400, `未知分类目录：${destDir}（可用：${CATEGORIES.map((category) => category.dir).join(" / ")}）`);
  }

  let target = "";
  if (typeof targetPath === "string" && targetPath.trim() !== "") {
    target = resolve(targetPath.trim());
  } else {
    if (typeof name !== "string" || name.trim() === "") throw httpError(400, "需要 path 或 name");
    target = resolve(join(library, categoryDir ?? "", name));
  }
  if (!isInside(library, target)) throw httpError(400, `只允许操作库内路径：${target}`);
  if (resolve(target) === resolve(library)) throw httpError(400, "不能移动整库");
  if (!existsSync(target)) throw httpError(404, `库里没有这个条目：${target}`);

  const itemName = basename(target);
  const destination = join(library, destDir, itemName);
  assertInsideLibrary(destination);
  if (resolve(destination) === resolve(target)) {
    return { ok: true, name: itemName.replace(/\.md$/i, ""), from: target, to: destination, noop: true };
  }
  if (existsSync(destination)) throw httpError(409, `目标分类里已有同名条目：${destination}`);

  await fs.mkdir(join(library, destDir), { recursive: true });
  // 保证目标分类目录里有 _说明.md（自定义目录也补一份）
  const note = join(library, destDir, "_说明.md");
  if (!existsSync(note)) {
    const category = CATEGORIES.find((item) => item.dir === destDir);
    await fs.writeFile(note, categoryReadme(category ?? { id: "custom", dir: destDir, note: "用户自定义分类目录" }), "utf8").catch(() => {});
  }
  await fs.rename(target, destination);
  pushUndo({ kind: "move", action: "改分类", description: `${itemName} → ${destDir}`, from: target, to: destination });
  await audit("move", { from: target, to: destination });
  cache.at = 0;
  return { ok: true, name: itemName.replace(/\.md$/i, ""), from: target, to: destination, category: destDir };
}

// ---------- 移出库（从库里删除副本；源技能一律不动） ----------

/**
 * 移出库：删除库内某个技能副本。
 * - 只允许操作库根内的路径，越界直接 400
 * - 删掉之后「全部技能」里该技能会重新变成「可收录」，最右侧回到「收录到库」
 * - 绝不触碰任何技能源（~/.dsh/skills、预设根、插件目录都只读）
 */
async function removeFromLibrary({ path: targetPath, name, categoryDir }) {
  const library = libraryRoot();
  let target = "";
  if (typeof targetPath === "string" && targetPath.trim() !== "") {
    target = resolve(targetPath.trim());
  } else {
    if (typeof name !== "string" || name.trim() === "") throw httpError(400, "需要 path 或 name");
    target = resolve(join(library, categoryDir ?? "", name));
  }
  if (!isInside(library, target)) throw httpError(400, `只允许操作库内路径：${target}`);
  if (resolve(target) === resolve(library)) throw httpError(400, "不能整库删除");
  if (!existsSync(target)) throw httpError(404, `库里没有这个条目：${target}`);

  const stat = await fs.stat(target);
  const itemName = basename(target);
  // 不真删：挪进撤销暂存区，10 分钟内可以「撤销」搬回来
  const stashDir = join(undoBinDir(), `s${Date.now().toString(36)}${(undoSeq += 1).toString(36)}`);
  assertInsideLibrary(stashDir);
  await fs.mkdir(stashDir, { recursive: true });
  const stashPath = join(stashDir, itemName);
  await fs.rename(target, stashPath);
  pushUndo({ kind: "stash", action: "移出库", description: `${itemName} 移出库`, from: target, stashDir, stashPath });
  await audit("remove", { from: target, stashPath });

  // 顺手清理空掉的分类目录（只清一层，且不碰 _说明.md 以外的内容）
  try {
    const parent = dirname(target);
    if (isInside(library, parent) && resolve(parent) !== resolve(library)) {
      const rest = await fs.readdir(parent);
      const meaningful = rest.filter((entry) => entry !== "_说明.md" && !entry.startsWith("."));
      if (meaningful.length === 0) {
        for (const junk of rest) {
          if (junk === "_说明.md") continue;
          await fs.rm(join(parent, junk), { recursive: true, force: true }).catch(() => {});
        }
      }
    }
  } catch { /* 清理失败不影响主操作 */ }

  cache.at = 0;
  return {
    ok: true,
    name: typeof name === "string" && name !== "" ? name : itemName.replace(/\.md$/i, ""),
    item: itemName,
    kind: stat.isDirectory() ? "directory" : "file",
    removedFrom: target,
  };
}

// ---------- 技能包（一组技能的清单） ----------

function bundlesDir() { return join(libraryRoot(), ".library", "bundles"); }

function bundleFile(bundleName) {
  const safe = String(bundleName).trim().replace(/[\\/:*?"<>|]+/g, "_").slice(0, 64);
  if (safe === "") throw httpError(400, "技能包名不能为空");
  return join(bundlesDir(), `${safe}.json`);
}

async function listBundles() {
  const out = [];
  let entries = [];
  try { entries = await fs.readdir(bundlesDir(), { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(join(bundlesDir(), entry.name), "utf8"));
      out.push({
        name: parsed.name ?? basename(entry.name, ".json"),
        createdAt: parsed.createdAt ?? "",
        note: parsed.note ?? "",
        items: Array.isArray(parsed.items) ? parsed.items : [],
        file: entry.name,
      });
    } catch { /* 坏文件跳过，不抛 */ }
  }
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return out;
}

async function saveBundle({ name: bundleName, note, items }) {
  if (typeof bundleName !== "string" || bundleName.trim() === "") throw httpError(400, "需要技能包名");
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, "技能包至少要有一个技能");
  const cleaned = items.map((item) => ({
    name: String(item.name ?? basename(String(item.path ?? ""))),
    source: String(item.source ?? ""),
    path: String(item.path ?? ""),
    category: String(item.category ?? ""),
  }));
  const target = bundleFile(bundleName);
  assertInsideLibrary(target);
  await fs.mkdir(dirname(target), { recursive: true });
  const payload = {
    version: 1,
    name: bundleName.trim(),
    note: typeof note === "string" ? note.slice(0, 200) : "",
    createdAt: new Date().toISOString(),
    items: cleaned,
  };
  await fs.writeFile(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return { ok: true, name: payload.name, count: cleaned.length, file: target };
}

// ---------- HTTP ----------

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}
function headerOf(request, key) {
  const value = request.headers[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function allowRequest(request, response) {
  const deny = () => {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("cross-origin request rejected");
  };
  if (headerOf(request, "sec-fetch-site").toLowerCase() === "cross-site") { deny(); return false; }
  const origin = headerOf(request, "origin").trim();
  if (origin === "null") { deny(); return false; }
  if (origin === "") return true;
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { deny(); return false; }
  if (headerOf(request, "host").trim().toLowerCase() !== originHost.toLowerCase()) { deny(); return false; }
  return true;
}
function readBody(request) {
  return new Promise((settle, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > 1024 * 1024) { reject(httpError(413, "请求体过大")); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) { settle({}); return; }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        settle(parsed !== null && typeof parsed === "object" ? parsed : {});
      } catch (error) { reject(httpError(400, `JSON 解析失败：${String(error?.message ?? error)}`)); }
    });
    request.on("error", reject);
  });
}
function queryOf(request) {
  try { return new URL(request.url ?? "/", "http://localhost").searchParams; } catch { return new URLSearchParams(); }
}

function mountRoutes(ctx) {
  ctx.inject(["webServer"], (host) => {
    host.effect(() => {
      const disposers = [];
      const route = (path, methods, handler) => {
        const allowed = Array.isArray(methods) ? methods : [methods];
        const dispose = host.webServer.register({
          kind: "exact",
          path,
          handler: async (request, response) => {
            if (!allowRequest(request, response)) return;
            if (!allowed.includes(request.method)) {
              response.writeHead(405, { allow: allowed.join(", ") });
              response.end();
              return;
            }
            try { await handler(request, response); } catch (error) {
              sendJson(response, Number(error?.status) || 500, { ok: false, error: String(error?.message ?? error) });
            }
          },
        });
        if (typeof dispose === "function") disposers.push(dispose);
      };

      route("/skill-vault/ping", "GET", async (_request, response) => {
        const home = dshHome();
        const resource = asarRoot();
        sendJson(response, 200, {
          ok: true,
          version: VERSION,
          hostVersion: VERSION,
          dshHome: home,
          libraryRoot: libraryRoot(),
          skillsRoot: join(home, "skills"),
          categories: (await allCategories()).map(({ dir, builtin }) => ({ dir, builtin })),
          readOnlySources: true,
        });
      });

      route("/skill-vault/catalog", "GET", async (request, response) => {
        const force = queryOf(request).get("refresh") === "1";
        await ensureLibrary();
        const skills = await catalog(force);
        const library = await scanLibrary();
        const roots = [...sourceRoots(), ...(await pluginRoots()).map((item) => ({ ...item, writable: false }))]
          .map(({ label, path, note, writable }) => ({ label, title: rootTitle(label), path, note, writable: writable === true }));
        const categories = await allCategories();
        const counts = new Map();
        for (const entry of library) {
          const dir = entry.category ? entry.category.dir : "";
          counts.set(dir, (counts.get(dir) ?? 0) + 1);
        }
        sendJson(response, 200, {
          ok: true,
          version: VERSION,
          hostVersion: VERSION,
          libraryRoot: libraryRoot(),
          categories: categories.map((category) => ({ ...category, count: counts.get(category.dir) ?? 0 })),
          roots,
          skills,
          library,
          bundles: await listBundles(),
          settings: await readSettings(),
          undo: await undoList(),
          stats: {
            total: skills.length,
            enabled: skills.filter((skill) => skill.enabled).length,
            library: library.length,
            duplicates: skills.filter((skill) => skill.duplicate).length,
            unparseable: skills.filter((skill) => !skill.parseable).length,
          },
        });
      });

      route("/skill-vault/library", "GET", async (_request, response) => {
        await ensureLibrary();
        sendJson(response, 200, { ok: true, libraryRoot: libraryRoot(), skills: await scanLibrary() });
      });

      route("/skill-vault/tasks", "GET", async (_request, response) => {
        sendJson(response, 200, { ok: true, tasks });
      });

      // 取消任务：排队中的立刻取消，运行中的在下一个检查点停下（已完成的子项保留）
      route("/skill-vault/tasks/cancel", "POST", async (request, response) => {
        const body = await readBody(request);
        if (typeof body.id !== "string" || body.id === "") throw httpError(400, "需要 id");
        sendJson(response, 200, cancelTask(body.id));
      });

      // 重跑 / 续跑：默认只补没成功的子项；all=true 则整批重来
      route("/skill-vault/tasks/retry", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        if (typeof body.id !== "string" || body.id === "") throw httpError(400, "需要 id");
        const task = retryTask(body.id, { all: body.all === true });
        sendJson(response, 202, { ok: true, taskId: task.id, task });
      });

      route("/skill-vault/download", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const task = startDownload({ url: body.url, path: body.path, name: body.name, category: body.category });
        sendJson(response, 202, { ok: true, taskId: task.id, task });
      });

      route("/skill-vault/harvest", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const task = startHarvest({ skillPath: body.skillPath ?? body.path, name: body.name, category: body.category });
        sendJson(response, 202, { ok: true, taskId: task.id, task });
      });

      // 批量收录：items=[{skillPath,category?,name?}] 或 bundle=<包名>
      route("/skill-vault/harvest-batch", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        let items = Array.isArray(body.items) ? body.items : null;
        let label = typeof body.label === "string" ? body.label : "";
        if (Array.isArray(body.names) && body.names.length > 0) {
          const all = await catalog(true);
          const wanted = new Set(body.names);
          items = all.filter((skill) => wanted.has(skill.name) && !skill.inLibrary).map((skill) => ({
            skillPath: skill.path,
            category: skill.category ? skill.category.dir : undefined,
            name: skill.name,
          }));
        }
        if (items === null && typeof body.bundle === "string") {
          const bundle = (await listBundles()).find((item) => item.name === body.bundle);
          if (bundle === undefined) throw httpError(404, `没有这个技能包：${body.bundle}`);
          items = bundle.items.map((item) => ({ skillPath: item.path, category: item.category, name: item.name }));
          label = bundle.name;
        }
        if (!Array.isArray(items) || items.length === 0) throw httpError(400, "没有可收录的技能（items / names / bundle 至少要给一个）");
        const task = startHarvestBatch({ items, label });
        sendJson(response, 202, { ok: true, taskId: task.id, task });
      });

      route("/skill-vault/bundles", ["GET", "POST"], async (request, response) => {
        await ensureLibrary();
        if (request.method === "GET") {
          sendJson(response, 200, { ok: true, bundles: await listBundles() });
          return;
        }
        const body = await readBody(request);
        const result = await saveBundle({ name: body.name, note: body.note, items: body.items });
        sendJson(response, 200, { ok: true, ...result });
      });

      // 分类标题管理：新增自定义标题 / 删除空的标题
      route("/skill-vault/categories", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const result = await addCategory({ dir: body.dir, note: body.note });
        sendJson(response, 200, { ok: true, ...result, categories: await allCategories() });
      });

      route("/skill-vault/categories/remove", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const result = await removeCategory({ dir: body.dir });
        sendJson(response, 200, { ok: true, ...result, categories: await allCategories() });
      });

      // 插入到根：把库内副本剪切/复制进某个技能根（默认关闭，需要在设置里开启）
      route("/skill-vault/paste", "POST", async (request, response) => {
        await ensureLibrary();
        const settings = await readSettings();
        if (settings.allowRootWrites !== true) {
          throw httpError(403, "写入技能根的开关是关着的：请先在「下载任务」页勾选「允许写入技能根」");
        }
        const body = await readBody(request);
        const result = await pasteIntoRoot({ path: body.path, root: body.root, name: body.name, copy: body.copy === true });
        await invalidateSkills(ctx);
        sendJson(response, 200, result);
      });

      // 改分类：把库内副本挪到另一个分类目录
      route("/skill-vault/move", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const result = await moveInLibrary({
          path: body.path,
          name: body.name,
          categoryDir: body.categoryDir,
          toCategoryDir: body.toCategoryDir,
        });
        sendJson(response, 200, result);
      });

      // 移出库：删除库内副本。删完「全部技能」里该技能回到「收录到库」状态。
      route("/skill-vault/remove", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const result = await removeFromLibrary({ path: body.path, name: body.name, categoryDir: body.categoryDir });
        sendJson(response, 200, result);
      });

      // 兼容旧客户端（1.4.x 叫 takeout）：语义已改为"移出库"，不再进回收区
      route("/skill-vault/takeout", "POST", async (request, response) => {
        await ensureLibrary();
        const body = await readBody(request);
        const result = await removeFromLibrary({ path: body.path, name: body.name, categoryDir: body.categoryDir });
        sendJson(response, 200, { ...result, deprecated: "takeout 已改名为 remove（直接删除库内副本）" });
      });

      // 清理已结束的任务记录（传 ids 只删指定几条）
      route("/skill-vault/tasks/clear", "POST", async (request, response) => {
        const body = await readBody(request);
        sendJson(response, 200, await clearTasks(body.ids));
      });

      // 设置：autoClearTasks = 完成后自动删记录；allowRootWrites = 允许往技能根写入（默认关）
      route("/skill-vault/settings", ["GET", "POST"], async (request, response) => {
        await ensureLibrary();
        if (request.method === "GET") {
          sendJson(response, 200, { ok: true, settings: await readSettings() });
          return;
        }
        const body = await readBody(request);
        const patch = {};
        if (typeof body.autoClearTasks === "boolean") patch.autoClearTasks = body.autoClearTasks;
        if (typeof body.allowRootWrites === "boolean") patch.allowRootWrites = body.allowRootWrites;
        if (Object.keys(patch).length === 0) throw httpError(400, "没有可写的设置项");
        const settings = await writeSettings(patch);
        await audit("settings", patch);
        sendJson(response, 200, { ok: true, settings });
      });

      route("/skill-vault/audit", "GET", async (request, response) => {
        await ensureLibrary();
        const limit = Number(queryOf(request).get("limit") ?? 100) || 100;
        sendJson(response, 200, { ok: true, entries: await readAudit(Math.min(500, Math.max(1, limit))) });
      });

      route("/skill-vault/undo", ["GET", "POST"], async (request, response) => {
        await ensureLibrary();
        if (request.method === "GET") {
          sendJson(response, 200, { ok: true, entries: await undoList() });
          return;
        }
        const body = await readBody(request);
        sendJson(response, 200, await undoOne(body.id));
      });

      // SSE：一条长连接推任务 + 调用快照（1 秒一次），前端不上 EventSource 时仍走轮询
      route("/skill-vault/stream", "GET", async (request, response) => {
        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });
        const send = () => {
          try {
            response.write(`data: ${JSON.stringify({ ok: true, at: Date.now(), tasks, invocations: invocationSnapshot() })}\n\n`);
          } catch { /* 连接已断 */ }
        };
        send();
        const timer = setInterval(send, 1000);
        const stop = () => { clearInterval(timer); try { response.end(); } catch { /* ignore */ } };
        request.on("close", stop);
        request.on("error", stop);
        return new Promise(() => {}); // 保持连接，不结束这个 handler
      });

      route("/skill-vault/invocations", "GET", async (_request, response) => {
        sendJson(response, 200, { ok: true, ...invocationSnapshot() });
      });

      route("/skill-vault/reveal", "GET", async (request, response) => {
        // 只回报库根与分类目录的绝对路径，前端拿去展示（不打开资源管理器）
        const query = queryOf(request);
        const dir = query.get("dir") ?? "";
        const target = dir === "" ? libraryRoot() : join(libraryRoot(), dir);
        assertInsideLibrary(target);
        sendJson(response, 200, { ok: true, path: target, exists: existsSync(target) });
      });

      return () => { for (const dispose of disposers.reverse()) { try { dispose(); } catch { /* ignore */ } } };
    });
  });
}

export function apply(ctx) {
  log("apply: mounting /skill-vault/* endpoints (read-only sources)");
  void ensureLibrary().catch((error) => log("ensureLibrary failed:", String(error?.message ?? error)));
  mountRoutes(ctx);
  // 调用监控：挂钩技能注册表
  try {
    ctx.effect(() => installInvocationTracker(ctx), "dsh-skill-vault: invocation tracker");
  } catch (error) {
    log("invocation tracker unavailable:", String(error?.message ?? error));
  }
}

export const __internals = {
  CATEGORIES,
  parseSkillText,
  classify,
  catalog,
  scanLibrary,
  ensureLibrary,
  startDownload,
  startHarvest,
  startHarvestBatch,
  cancelTask,
  retryTask,
  listBundles,
  saveBundle,
  removeFromLibrary,
  moveInLibrary,
  addCategory,
  removeCategory,
  allCategories,
  invocations,
  startInvocation,
  finishInvocation,
  invocationSnapshot,
  installInvocationTracker,
  audit,
  readAudit,
  undoList,
  undoOne,
  pasteIntoRoot,
  clearTasks,
  readSettings,
  writeSettings,
  libraryRoot,
  dshHome,
  assertInsideLibrary,
  tasks,
};
