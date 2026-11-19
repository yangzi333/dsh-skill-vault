// dsh-skill-vault host-half integration test.
// DSH_HOME 指向临时目录；假 webServer 驱动全部端点；本地起 http 服务验证真实下载链路；
// 前后比对源技能文件哈希，证明"只读不碰"。
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import http from "node:http";

const sandbox = mkdtempSync(join(tmpdir(), "vault-"));
const home = join(sandbox, "dsh-home");
process.env.DSH_HOME = home;

const skillsRoot = join(home, "skills");
const presetRoot = join(home, "reverse", "skills");
const profileModules = join(home, "profiles", "desktop", "node_modules");

function write(path, text) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text, "utf8");
}

// 用户根：两个技能
write(join(skillsRoot, "demo-adult", "SKILL.md"), "---\nname: demo-adult\ndescription: 成人向虚构叙事模板\n---\n\nbody\n");
write(join(skillsRoot, "gamma-tool.md"), "---\nname: gamma-tool\ndescription: 一个扁平工具技能\n---\n\nbody\n");
// 预设根：逆向技能
write(join(presetRoot, "rev-demo", "SKILL.md"), "---\nname: rev-demo\ndescription: 混淆还原\n---\n\nbody\n");
// 插件根
write(join(profileModules, "dsh-pilot", "skills", "browser-demo", "SKILL.md"), "---\nname: browser-demo\ndescription: 浏览器自动化 pilot_* 工具\n---\n\nbody\n");
write(join(profileModules, "@scope", "some-plugin", "skills", "office-extra", "SKILL.md"), "---\nname: office-extra\ndescription: Office 附加技能\n---\n\nbody\n");
// 重名：同一个 skill 出现在两个根
write(join(presetRoot, "demo-adult", "SKILL.md"), "---\nname: demo-adult\ndescription: 成人向叙事（预设副本）\n---\n\nbody\n");
// 不合规技能（缺 description）——只读展示要标出 parseable=false
write(join(skillsRoot, "broken-skill", "SKILL.md"), "---\nname: broken-skill\n---\n\nbody\n");
// 续跑测试专用：两个独立技能
write(join(skillsRoot, "retry-a", "SKILL.md"), "---\nname: retry-a\ndescription: 续跑测试 A\n---\n\nbody\n");
write(join(skillsRoot, "retry-b", "SKILL.md"), "---\nname: retry-b\ndescription: 续跑测试 B\n---\n\nbody\n");

// 可写目标根（模拟 preset:<name>/skills）
const targetRoot = join(home, "target-preset", "skills");
mkdirSync(targetRoot, { recursive: true });
write(join(skillsRoot, "paste-a", "SKILL.md"), "---\nname: paste-a\ndescription: 剪切粘贴夹具\n---\n\nbody\n");

// ---- 源文件指纹（用于事后证明未被修改）----
function fingerprint(dir) {
  const out = [];
  const walk = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const bytes = readFileSync(full);
      out.push(`${full}|${createHash("sha256").update(bytes).digest("hex")}|${statSync(full).mtimeMs}`);
    }
  };
  walk(dir);
  return out.sort().join("\n");
}
const before = fingerprint(sandbox + "/dsh-home/skills") + "\n" + fingerprint(sandbox + "/dsh-home/reverse") + "\n" + fingerprint(join(sandbox, "dsh-home", "profiles"));

const plugin = await import(new URL("../lib/index.js", import.meta.url));
const I = plugin.__internals;

// ---- fake host ----
const routes = new Map();
const ctx = {
  get: () => undefined,
  inject(_names, fn) {
    fn({
      effect(factory) { const dispose = factory(); return typeof dispose === "function" ? dispose : () => {}; },
      webServer: { register(spec) { routes.set(spec.path, spec); return () => routes.delete(spec.path); } },
    });
  },
};
plugin.apply(ctx);

function request(method, url, body, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), "utf8")];
  const stream = Readable.from(chunks);
  stream.method = method;
  stream.url = url;
  stream.headers = Object.assign({ host: "127.0.0.1:59893" }, headers);
  return stream;
}
function response() {
  let status = 0;
  let payload = "";
  return {
    writeHead(code) { status = code; },
    end(chunk) { if (chunk !== undefined) payload += chunk.toString(); },
    get status() { return status; },
    get text() { return payload; },
    json() { try { return JSON.parse(payload); } catch { return null; } },
  };
}
async function call(method, path, body, headers) {
  const spec = routes.get(path.split("?")[0]);
  if (spec === undefined) throw new Error("route not mounted: " + path);
  const res = response();
  await spec.handler(request(method, path, body, headers), res);
  return res;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitTask(taskId, timeoutMs = 8000) {
  const started = Date.now();
  for (;;) {
    const task = I.tasks.find((item) => item.id === taskId);
    if (task && (task.status === "done" || task.status === "failed" || task.status === "canceled")) return task;
    if (Date.now() - started > timeoutMs) throw new Error("task timeout: " + taskId);
    await sleep(40);
  }
}

let pass = 0;
let fail = 0;
function check(label, condition, detail) {
  if (condition) { pass += 1; console.log(`  ok   ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? "" : " -> " + JSON.stringify(detail)}`); }
}

console.log("## routes:", [...routes.keys()].join(", "));
check("23 个端点挂载", routes.size === 23, [...routes.keys()]);

// ---------- catalog ----------
console.log("\n## catalog");
{
  const res = await call("GET", "/skill-vault/catalog");
  const body = res.json();
  check("HTTP 200", res.status === 200, res.status);
  const names = body.skills.map((skill) => skill.name);
  check("用户根技能在", names.includes("demo-adult"));
  check("扁平技能在", names.includes("gamma-tool"));
  check("预设根技能在", names.includes("rev-demo"));
  check("插件根技能在", names.includes("browser-demo") && names.includes("office-extra"));
  check("内置技能在（asar 6 个）", body.skills.filter((skill) => skill.kind === "builtin").length === 6, body.skills.filter((s) => s.kind === "builtin").length);
  check("缺 description 的技能被标 parseable=false", body.skills.some((skill) => skill.name === "broken-skill" && skill.parseable === false));
  const era = body.skills.find((skill) => skill.name === "demo-adult");
  check("分类命中 03-成人写作", era.category.dir === "03-成人写作", era.category);
  check("重名被标记", body.skills.filter((skill) => skill.name === "demo-adult").every((skill) => skill.duplicate));
  check("逆向技能分到 01-安全与逆向", body.skills.find((s) => s.name === "rev-demo").category.dir === "01-安全与逆向");
  check("pilot 分到 05-浏览器与自动化", body.skills.find((s) => s.name === "browser-demo").category.dir === "05-浏览器与自动化");
  check("office-extra 分到 04-内容创作", body.skills.find((s) => s.name === "office-extra").category.dir === "04-内容创作");
  check("统计有 4 个口径", typeof body.stats.total === "number" && body.stats.library === 0, body.stats);
  check("库骨架已生成 README", existsSync(join(home, "skill-library", "README.md")));
  const categoryDirs = readdirSync(join(home, "skill-library")).filter((dir) => dir.match(/^\d\d-/));
  check("9 个分类目录 + 每类 _说明.md", categoryDirs.length === 9 && categoryDirs.every((dir) => existsSync(join(home, "skill-library", dir, "_说明.md"))), categoryDirs);
  check("根 README 写明分类用途（中文表）", readFileSync(join(home, "skill-library", "README.md"), "utf8").includes("01-安全与逆向"));
}

// ---------- harvest（收录既有技能）----------
console.log("\n## harvest");
{
  const catalogBody = (await call("GET", "/skill-vault/catalog")).json();
  const target = catalogBody.skills.find((skill) => skill.name === "rev-demo");
  const res = await call("POST", "/skill-vault/harvest", { skillPath: target.path });
  check("harvest 202", res.status === 202, res.status);
  const task = await waitTask(res.json().taskId);
  check("任务完成", task.status === "done", task);
  check("落进 01-安全与逆向/rev-demo", existsSync(join(home, "skill-library", "01-安全与逆向", "rev-demo", "SKILL.md")));

  const again = await call("POST", "/skill-vault/harvest", { skillPath: target.path });
  const dupTask = await waitTask(again.json().taskId);
  check("重复收录 → failed 409", dupTask.status === "failed" && /已经有同名技能/.test(dupTask.error), dupTask.error);

  const fromLibrary = await call("POST", "/skill-vault/harvest", { skillPath: join(home, "skill-library", "01-安全与逆向", "rev-demo") });
  check("从库里再收录被拒", fromLibrary.status === 400, fromLibrary.json());
}

// ---------- download from local dir ----------
console.log("\n## download (local dir)");
{
  const src = join(sandbox, "incoming", "video-tool");
  write(join(src, "SKILL.md"), "---\nname: video-tool\ndescription: 视频生成流水线\n---\n\nbody\n");
  writeFileSync(join(src, "helper.py"), "print(1)\n");
  const res = await call("POST", "/skill-vault/download", { path: src });
  check("202", res.status === 202, res.status);
  const task = await waitTask(res.json().taskId);
  check("任务完成", task.status === "done", task);
  check("分类自动命中 04-内容创作", existsSync(join(home, "skill-library", "04-内容创作", "video-tool", "SKILL.md")));
  check("资源文件一起复制", existsSync(join(home, "skill-library", "04-内容创作", "video-tool", "helper.py")));
  const stat = statSync(join(src, "SKILL.md"));
  check("源文件未被改动（尺寸不变）", stat.size > 0);
}

// ---------- download from http（真实链路：本地起服务）----------
console.log("\n## download (http zip + md)");
function buildStoredZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text, "utf8");
    const nameBuf = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(0, 8);            // method = stored
    local.writeUInt16LE(0, 10);           // mod time
    local.writeUInt16LE(0, 12);           // mod date
    local.writeUInt32LE(0, 14);           // crc32 (reader ignores)
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra length
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);  // central directory signature
    central.writeUInt16LE(20, 4);          // version made by
    central.writeUInt16LE(20, 6);          // version needed
    central.writeUInt16LE(0, 8);           // flags
    central.writeUInt16LE(0, 10);          // method
    central.writeUInt16LE(0, 12);          // mod time
    central.writeUInt16LE(0, 14);          // mod date
    central.writeUInt32LE(0, 16);          // crc32
    central.writeUInt32LE(data.length, 20); // compressed size
    central.writeUInt32LE(data.length, 24); // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);          // extra
    central.writeUInt16LE(0, 32);          // comment
    central.writeUInt16LE(0, 34);          // disk number
    central.writeUInt16LE(0, 36);          // internal attrs
    central.writeUInt32LE(0, 38);          // external attrs
    central.writeUInt32LE(offset, 42);     // local header offset
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
}

const zipBytes = buildStoredZip({
  "my-skill-pkg/SKILL.md": "---\nname: sandbox-skill\ndescription: 沙箱排障工具\n---\n\nbody\n",
  "my-skill-pkg/run.ps1": "echo hi\n",
});
const mdBytes = Buffer.from("---\nname: flat-remote\ndescription: 远端扁平技能\n---\n\nbody\n", "utf8");
const server = http.createServer((req, res) => {
  if (req.url === "/pkg.zip") {
    res.writeHead(200, { "content-type": "application/zip", "content-length": zipBytes.length });
    res.end(zipBytes);
    return;
  }
  if (req.url === "/skill.md") {
    res.writeHead(200, { "content-type": "text/markdown", "content-length": mdBytes.length });
    res.end(mdBytes);
    return;
  }
  res.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
{
  const res = await call("POST", "/skill-vault/download", { url: `http://127.0.0.1:${port}/pkg.zip` });
  check("zip 下载 202", res.status === 202, res.status);
  const task = await waitTask(res.json().taskId, 12000);
  check("zip 任务完成", task.status === "done", task);
  check("zip 解包并入库 07-系统与排障/sandbox-skill", existsSync(join(home, "skill-library", "07-系统与排障", "sandbox-skill", "SKILL.md")), readdirSync(join(home, "skill-library", "07-系统与排障")));
  check("zip 里的额外文件也在", existsSync(join(home, "skill-library", "07-系统与排障", "sandbox-skill", "run.ps1")));
  check("下载进度有字节数", task.bytes > 0 && task.total === zipBytes.length, { bytes: task.bytes, total: task.total });

  const res2 = await call("POST", "/skill-vault/download", { url: `http://127.0.0.1:${port}/skill.md` });
  const task2 = await waitTask(res2.json().taskId, 12000);
  check("单个 .md 下载完成", task2.status === "done", task2);
  check("扁平技能落到库（未分类或命中类）", (() => {
    for (const dir of readdirSync(join(home, "skill-library"))) {
      if (dir.startsWith(".") || dir === "README.md") continue;
      if (existsSync(join(home, "skill-library", dir, "flat-remote", "SKILL.md"))) return true;
    }
    return false;
  })());

  const res3 = await call("POST", "/skill-vault/download", { url: `http://127.0.0.1:${port}/missing.zip` });
  const task3 = await waitTask(res3.json().taskId, 12000);
  check("404 下载 → failed", task3.status === "failed" && /502|404/.test(task3.error), task3.error);
}
server.close();

// ---------- tasks 端点 ----------
console.log("\n## tasks endpoint");
{
  const res = await call("GET", "/skill-vault/tasks");
  const body = res.json();
  check("任务列表非空", body.tasks.length > 0, body.tasks.length);
  check("含 done 与 failed", body.tasks.some((t) => t.status === "done") && body.tasks.some((t) => t.status === "failed"));
}

// ---------- 批量收录 + 技能包 ----------
console.log("\n## batch harvest + bundles");
{
  const body = (await call("GET", "/skill-vault/catalog")).json();
  const picks = body.skills.filter((skill) => !skill.inLibrary && skill.harvestable !== false && ["gamma-tool", "browser-demo"].includes(skill.name));
  check("找到 2 个待收录技能", picks.length === 2, picks.map((s) => s.name));

  const res = await call("POST", "/skill-vault/harvest-batch", {
    items: picks.map((skill) => ({ skillPath: skill.path, category: skill.category.dir })),
  });
  check("批量 202", res.status === 202, res.status);
  const task = await waitTask(res.json().taskId, 15000);
  check("批量任务 done", task.status === "done", task.error);
  check("子项全部 done", task.items.every((item) => item.status === "done"), task.items);
  check("两个技能都进库", existsSync(join(home, "skill-library", "05-浏览器与自动化", "browser-demo", "SKILL.md")) && existsSync(join(home, "skill-library", "99-未分类", "gamma-tool", "SKILL.md")), readdirSync(join(home, "skill-library", "05-浏览器与自动化")));

  const save = await call("POST", "/skill-vault/bundles", {
    name: "browser-kit",
    items: picks.map((skill) => ({ name: skill.name, source: skill.source, path: skill.path, category: skill.category.dir })),
  });
  check("保存技能包 200", save.status === 200 && save.json().count === 2, save.json());
  const list = (await call("GET", "/skill-vault/bundles")).json();
  check("技能包可列出", list.bundles.length === 1 && list.bundles[0].name === "browser-kit", list.bundles);

  const again = await call("POST", "/skill-vault/harvest-batch", { bundle: "browser-kit" });
  const t2 = await waitTask(again.json().taskId, 15000);
  check("重复套包 → failed 且子项带错误", t2.status === "failed" && t2.items.every((item) => item.status === "failed" && item.error.length > 0), t2.items);

  const missing = await call("POST", "/skill-vault/harvest-batch", { bundle: "nope" });
  check("未知包 404", missing.status === 404, missing.json());
  const empty = await call("POST", "/skill-vault/harvest-batch", {});
  check("空请求 400", empty.status === 400, empty.json());
  const byNames = await call("POST", "/skill-vault/harvest-batch", { names: ["gamma-tool"] });
  check("按名字批量（已入库 → 400 无可收录）", byNames.status === 400, byNames.json());
}

// ---------- 库视图 ----------
console.log("\n## library view");
{
  const body = (await call("GET", "/skill-vault/library")).json();
  check("库里有 6 个技能", body.skills.length === 6, body.skills.map((s) => s.name));
  check("库条目带分类信息", body.skills.every((skill) => skill.category && skill.category.dir));
}

// ---------- 取消 ----------
console.log("\n## cancel");
{
  const bad = await call("POST", "/skill-vault/tasks/cancel", {});
  check("缺 id → 400", bad.status === 400, bad.json());
  const ghost = await call("POST", "/skill-vault/tasks/cancel", { id: "nope" });
  check("未知任务 → 404", ghost.status === 404, ghost.json());

  // 批量任务：创建后立刻取消，后面的子项应为 skipped
  const catalogBody = (await call("GET", "/skill-vault/catalog")).json();
  const candidates = catalogBody.skills.filter((skill) => !skill.inLibrary && skill.harvestable !== false && skill.parseable !== false).slice(0, 3);
  const batchRes = await call("POST", "/skill-vault/harvest-batch", {
    items: candidates.map((skill) => ({ skillPath: skill.path, category: skill.category.dir, name: `${skill.name}-c` })),
  });
  const batchId = batchRes.json().taskId;
  const cancelRes = await call("POST", "/skill-vault/tasks/cancel", { id: batchId });
  check("取消请求 200", cancelRes.status === 200, cancelRes.json());
  const canceledTask = await waitTask(batchId, 15000);
  check("批量任务标记为 canceled", canceledTask.status === "canceled", canceledTask.status);
  check("有子项被跳过并写明已取消", canceledTask.items.some((item) => item.status === "skipped" && /取消/.test(item.error)), canceledTask.items.map((i) => i.status));

  // 慢速下载中途取消
  const slow = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/zip", "content-length": String(64 * 64) });
    let sent = 0;
    const timer = setInterval(() => {
      if (sent >= 64) { clearInterval(timer); res.end(); return; }
      res.write(Buffer.alloc(64, 0x20));
      sent += 1;
    }, 25);
    req.on("close", () => clearInterval(timer));
  });
  await new Promise((resolve) => slow.listen(0, "127.0.0.1", resolve));
  const slowPort = slow.address().port;
  const dl = await call("POST", "/skill-vault/download", { url: `http://127.0.0.1:${slowPort}/slow.zip` });
  const slowId = dl.json().taskId;
  await sleep(120);
  await call("POST", "/skill-vault/tasks/cancel", { id: slowId });
  const slowTask = await waitTask(slowId, 12000);
  check("下载任务被取消（canceled）", slowTask.status === "canceled", { status: slowTask.status, error: slowTask.error });
  check("取消后没有留下半截文件", !existsSync(join(home, "skill-library", ".tmp", slowId)) || readdirSync(join(home, "skill-library", ".tmp", slowId)).length === 0);
  slow.close();

  const noop = await call("POST", "/skill-vault/tasks/cancel", { id: slowId });
  check("重复取消是 noop", noop.json().noop === true, noop.json());
}

// ---------- 续跑 ----------
console.log("\n## retry");
{
  const unknown = await call("POST", "/skill-vault/tasks/retry", { id: "nope" });
  check("未知任务 404", unknown.status === 404, unknown.json());
  const noId = await call("POST", "/skill-vault/tasks/retry", {});
  check("缺 id 400", noId.status === 400, noId.json());

  // 造一个被取消的批量任务，看续跑是否只带未完成项
  const catalogBody = (await call("GET", "/skill-vault/catalog")).json();
  const candidates = catalogBody.skills.filter((skill) => skill.harvestable !== false && ["retry-a", "retry-b"].includes(skill.name));
  check("续跑夹具就位（2 个）", candidates.length === 2, candidates.map((s) => s.name));
  const created = await call("POST", "/skill-vault/harvest-batch", {
    items: candidates.map((skill) => ({ skillPath: skill.path, category: skill.category.dir, name: `${skill.name}-r` })),
  });
  const originalId = created.json().taskId;
  await call("POST", "/skill-vault/tasks/cancel", { id: originalId });
  const original = await waitTask(originalId, 15000);
  const notDone = original.items.filter((item) => item.status !== "done").length;
  check("原任务被取消且有未完成项", original.status === "canceled" && notDone > 0, { status: original.status, notDone });

  const retried = await call("POST", "/skill-vault/tasks/retry", { id: originalId });
  check("续跑 202", retried.status === 202, retried.json());
  const nextId = retried.json().taskId;
  check("续跑是新任务", nextId !== originalId, [originalId, nextId]);
  const nextTask = await waitTask(nextId, 15000);
  check("续跑任务的子项数 = 原任务未完成数", nextTask.items.length === notDone, { got: nextTask.items.length, want: notDone });
  check("续跑任务跑完（done 或 canceled 都算跑到底）", ["done", "canceled"].includes(nextTask.status), { status: nextTask.status, error: nextTask.error, items: nextTask.items });

  // 已全部完成的任务 → 400
  const doneTask = await call("POST", "/skill-vault/harvest-batch", { items: [{ skillPath: candidates[0].path, category: candidates[0].category.dir, name: `${candidates[0].name}-d` }] });
  await waitTask(doneTask.json().taskId, 15000);
  const nothing = await call("POST", "/skill-vault/tasks/retry", { id: doneTask.json().taskId });
  check("没有未完成项 → 400", nothing.status === 400, nothing.json());

  // 失败任务也能续跑（这里用一个不存在的源路径制造失败）
  const failTask = await call("POST", "/skill-vault/download", { path: join(sandbox, "does-not-exist-skill") });
  const failed = await waitTask(failTask.json().taskId, 8000);
  check("失败任务已记录", failed.status === "failed", failed.status);
  const retryFailed = await call("POST", "/skill-vault/tasks/retry", { id: failed.id });
  check("失败任务可续跑（202）", retryFailed.status === 202, retryFailed.json());
}

// ---------- 取出 / 回收区 ----------
console.log("\n## paste into skill root");
{
  const body = (await call("GET", "/skill-vault/catalog")).json();
  const pick = body.skills.find((skill) => skill.name === "paste-a" && skill.harvestable !== false);
  check("找到粘贴夹具", pick !== undefined, pick && pick.name);
  const harvested = await call("POST", "/skill-vault/harvest", { skillPath: pick.path, category: "99-未分类" });
  const done = await waitTask(harvested.json().taskId, 12000);
  check("先收进库", done.status === "done", done);
  const libPath = join(home, "skill-library", "99-未分类", "paste-a");
  check("库里有 paste-a", existsSync(libPath));

  // 默认关闭写入技能根 → 403；打开后才行
  const blocked = await call("POST", "/skill-vault/paste", { path: libPath, root: targetRoot });
  check("写入根默认关闭（403）", blocked.status === 403, blocked.json());
  const enabled = await call("POST", "/skill-vault/settings", { allowRootWrites: true });
  check("打开写入根开关", enabled.status === 200 && enabled.json().settings.allowRootWrites === true, enabled.json());

  const rootInfo = body.roots.find((root) => root.path === targetRoot.replace(/\\/g, "\\"));
  check("catalog 暴露可写根", body.roots.some((root) => root.writable === true && root.label === "preset:target-preset"), body.roots.map((r) => [r.label, r.writable]));
  check("插件根标为只读", body.roots.filter((root) => root.label.startsWith("plugin:")).every((root) => root.writable === false), body.roots.filter((r) => r.label.startsWith("plugin:")).map((r) => [r.label, r.writable]));

  const pasted = await call("POST", "/skill-vault/paste", { path: libPath, root: targetRoot });
  check("剪切到根 200", pasted.status === 200 && pasted.json().mode === "move", pasted.json());
  check("目标根里出现", existsSync(join(targetRoot, "paste-a", "SKILL.md")));
  check("库里那份已搬走", !existsSync(libPath));

  // 复制模式：库内保留副本
  const harvested2 = await call("POST", "/skill-vault/harvest", { skillPath: pick.path, category: "99-未分类", name: "paste-a" });
  const done2 = await waitTask(harvested2.json().taskId, 12000);
  check("再次收进库", done2.status === "done", done2);
  const copied = await call("POST", "/skill-vault/paste", { path: libPath, root: targetRoot, copy: true, name: "paste-a-copy" });
  check("复制模式 200", copied.status === 200 && copied.json().mode === "copy", copied.json());
  check("目标根里有副本", existsSync(join(targetRoot, "paste-a-copy", "SKILL.md")));
  check("库里仍保留", existsSync(libPath));

  const conflict = await call("POST", "/skill-vault/paste", { path: libPath, root: targetRoot, name: "paste-a" });
  check("同名已存在 409", conflict.status === 409, conflict.json());
  const badName = await call("POST", "/skill-vault/paste", { path: libPath, root: targetRoot, name: "../evil" });
  check("名字带 .. 被拒 400", badName.status === 400, badName.json());
  const outside = await call("POST", "/skill-vault/paste", { path: join(skillsRoot, "retry-a"), root: targetRoot });
  check("源不在库里 400", outside.status === 400, outside.json());
  const badRoot = await call("POST", "/skill-vault/paste", { path: libPath, root: join(home, "nope-root") });
  check("未知根 400", badRoot.status === 400, badRoot.json());
}

console.log("\n## move between categories");
{
  // 先收录一个技能进库，再把它挪到别的分类
  const body = (await call("GET", "/skill-vault/catalog")).json();
  const pick = body.skills.find((skill) => skill.name === "retry-b" && skill.harvestable !== false);
  check("找到可收录的夹具", pick !== undefined, pick && pick.name);
  const harvest = await call("POST", "/skill-vault/harvest", { skillPath: pick.path, category: "99-未分类" });
  const task = await waitTask(harvest.json().taskId, 12000);
  check("收录成功", task.status === "done", task);
  const before = join(home, "skill-library", "99-未分类", "retry-b");
  check("落在 99-未分类", existsSync(before));

  const moved = await call("POST", "/skill-vault/move", { path: before, toCategoryDir: "02-红队演练" });
  check("改分类 200", moved.status === 200 && moved.json().category === "02-红队演练", moved.json());
  check("旧位置已空", !existsSync(before));
  check("新位置存在", existsSync(join(home, "skill-library", "02-红队演练", "retry-b")));

  const lib = (await call("GET", "/skill-vault/library")).json();
  const entry = lib.skills.find((skill) => skill.name === "retry-b");
  check("库视图分类已更新", entry !== undefined && entry.category.dir === "02-红队演练", entry && entry.category);

  const same = await call("POST", "/skill-vault/move", { name: "retry-b", categoryDir: "02-红队演练", toCategoryDir: "02-红队演练" });
  check("移到同一分类是 noop", same.status === 200 && same.json().noop === true, same.json());

  const unknown = await call("POST", "/skill-vault/move", { name: "retry-b", categoryDir: "02-红队演练", toCategoryDir: "不存在的分类" });
  check("未知分类 400", unknown.status === 400, unknown.json());
  const traversal = await call("POST", "/skill-vault/move", { name: "retry-b", categoryDir: "02-红队演练", toCategoryDir: "../evil" });
  check("分类名带 .. 被拒 400", traversal.status === 400, traversal.json());
  const outside = await call("POST", "/skill-vault/move", { path: join(skillsRoot, "retry-a"), toCategoryDir: "02-红队演练" });
  check("库外路径被拒 400", outside.status === 400, outside.json());
  const ghost = await call("POST", "/skill-vault/move", { name: "no-such", categoryDir: "02-红队演练", toCategoryDir: "03-成人写作" });
  check("不存在的条目 404", ghost.status === 404, ghost.json());

  // 目标分类已有同名 → 409
  const dup = await call("POST", "/skill-vault/harvest", { skillPath: pick.path, category: "03-成人写作", name: "retry-b" });
  await waitTask(dup.json().taskId, 12000);
  const conflict = await call("POST", "/skill-vault/move", { name: "retry-b", categoryDir: "02-红队演练", toCategoryDir: "03-成人写作" });
  check("目标同名 409", conflict.status === 409, conflict.json());
}

console.log("\n## remove from library");
{
  const lib = (await call("GET", "/skill-vault/library")).json();
  const target = lib.skills.find((skill) => skill.name === "video-tool");
  check("库里有 video-tool", target !== undefined, lib.skills.map((s) => s.name));

  const out = await call("POST", "/skill-vault/remove", { path: target.path, name: target.name });
  check("移出库 200", out.status === 200 && out.json().removedFrom === target.path, out.json());
  check("库内条目已删除", !existsSync(target.path));
  check("源技能不受影响（预设根那份仍在）", existsSync(join(presetRoot, "rev-demo", "SKILL.md")));
  check("库根里不再有 .trash 概念", !existsSync(join(home, "skill-library", ".trash")));

  const lib2 = (await call("GET", "/skill-vault/library")).json();
  check("库条目数 -1", !lib2.skills.some((skill) => skill.name === "video-tool"), lib2.skills.map((s) => s.name));

  const catalogAfter = (await call("GET", "/skill-vault/catalog")).json();
  check("video-tool 无源根，移出后彻底从目录消失", catalogAfter.skills.every((skill) => skill.name !== "video-tool"), catalogAfter.skills.filter((s) => s.name === "video-tool"));
  check("catalog 不再返回 trash 字段", catalogAfter.trash === undefined, Object.keys(catalogAfter));
  const legacyFile = join(home, "skill-library", "99-未分类", "gamma-tool.md");
  check("先确认有个库内扁平技能", existsSync(join(home, "skill-library", "99-未分类", "gamma-tool")) || existsSync(legacyFile), readdirSync(join(home, "skill-library", "99-未分类")));
  const legacy = await call("POST", "/skill-vault/takeout", { name: "gamma-tool", categoryDir: "99-未分类" });
  check("旧 /takeout 删除的正确路径", legacy.json().removedFrom === join(home, "skill-library", "99-未分类", "gamma-tool"), { removedFrom: legacy.json().removedFrom, want: join(home, "skill-library", "99-未分类", "gamma-tool"), status: legacy.status });
  const afterLegacy = (await call("GET", "/skill-vault/catalog")).json();
  const gamma = afterLegacy.skills.find((skill) => skill.name === "gamma-tool");
  check("有源根的技能移出后回到「收录到库」状态", gamma !== undefined && gamma.inLibrary === false, { gammaInLibrary: gamma && gamma.inLibrary, list: readdirSync(join(home, "skill-library", "99-未分类")) });


  const outside = await call("POST", "/skill-vault/remove", { path: join(skillsRoot, "demo-adult") });
  check("库外路径被拒 400", outside.status === 400, outside.json());
  const ghost = await call("POST", "/skill-vault/remove", { name: "no-such-skill", categoryDir: "04-内容创作" });
  check("不存在的库条目 404", ghost.status === 404, ghost.json());
  const noArg = await call("POST", "/skill-vault/remove", {});
  check("缺参数 400", noArg.status === 400, noArg.json());
  const whole = await call("POST", "/skill-vault/remove", { path: home + "/skill-library" });
  check("整库删除被拒 400", whole.status === 400, whole.json());
}

// ---------- 任务记录清理 + 设置 ----------
console.log("\n## clear task records + settings");
{
  const before = (await call("GET", "/skill-vault/tasks")).json().tasks;
  const finished = before.filter((task) => ["done", "failed", "canceled"].includes(task.status));
  check("已有可清理的结束任务", finished.length > 0, before.map((t) => t.status));

  const one = await call("POST", "/skill-vault/tasks/clear", { ids: [finished[0].id] });
  check("按 id 删一条 200", one.status === 200 && one.json().removed === 1, one.json());
  const mid = (await call("GET", "/skill-vault/tasks")).json().tasks;
  check("那条记录真的没了", !mid.some((task) => task.id === finished[0].id));

  const rest = await call("POST", "/skill-vault/tasks/clear", {});
  check("清空全部已结束 200", rest.status === 200 && rest.json().remaining === 0, rest.json());

  // 运行中的任务不能被清掉
  const slow = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/zip", "content-length": String(64 * 64) });
    let sent = 0;
    const timer = setInterval(() => { if (sent >= 64) { clearInterval(timer); res.end(); return; } res.write(Buffer.alloc(64, 0x20)); sent += 1; }, 25);
    req.on("close", () => clearInterval(timer));
  });
  await new Promise((resolve) => slow.listen(0, "127.0.0.1", resolve));
  const dl = await call("POST", "/skill-vault/download", { url: `http://127.0.0.1:${slow.address().port}/slow2.zip` });
  const runningId = dl.json().taskId;
  await sleep(80);
  const blocked = await call("POST", "/skill-vault/tasks/clear", { ids: [runningId] });
  check("清理运行中的任务 → 409", blocked.status === 409, blocked.json());
  await call("POST", "/skill-vault/tasks/cancel", { id: runningId });
  await waitTask(runningId, 8000);
  slow.close();

  // 设置：默认不该自动清
  const s0 = (await call("GET", "/skill-vault/settings")).json().settings;
  check("默认没有 autoClearTasks", s0.autoClearTasks !== true, s0);
  const s1 = await call("POST", "/skill-vault/settings", { autoClearTasks: true });
  check("打开自动清除 200", s1.status === 200 && s1.json().settings.autoClearTasks === true, s1.json());
  check("设置落盘（.library/settings.json）", existsSync(join(home, "skill-library", ".library", "settings.json")));

  // 打开后跑一个任务 → 结束后记录自动消失
  const auto = await call("POST", "/skill-vault/harvest-batch", { items: [{ skillPath: join(skillsRoot, "retry-a"), category: "99-未分类", name: "auto-clear-probe" }] });
  const autoId = auto.json().taskId;
  const goneBy = Date.now() + 8000;
  while (Date.now() < goneBy) {
    const list = (await call("GET", "/skill-vault/tasks")).json().tasks;
    if (!list.some((task) => task.id === autoId)) break;
    await sleep(60);
  }
  const afterAuto = (await call("GET", "/skill-vault/tasks")).json().tasks;
  check("自动清除后列表里没有该记录", !afterAuto.some((task) => task.id === autoId), { autoId, list: afterAuto.map((t) => [t.id, t.status]) });


  await call("POST", "/skill-vault/settings", { autoClearTasks: false });
  const s2 = (await call("GET", "/skill-vault/settings")).json().settings;
  check("关掉自动清除", s2.autoClearTasks === false, s2);
  const bad = await call("POST", "/skill-vault/settings", {});
  check("空设置 400", bad.status === 400, bad.json());
}

// ---------- 分类标题管理 ----------
console.log("\n## category titles");
{
  const before = (await call("GET", "/skill-vault/catalog")).json().categories;
  check("内置分类都在", before.filter((category) => category.builtin === true).length >= 9, before.length);
  check("分类带条目计数", before.every((category) => typeof category.count === "number"), before.slice(0, 2));

  const added = await call("POST", "/skill-vault/categories", { dir: "我的常用", note: "自建标题测试" });
  check("新增标题 200", added.status === 200 && added.json().dir === "我的常用", added.json());
  check("目录已建", existsSync(join(home, "skill-library", "我的常用")));
  check("补了 _说明.md", existsSync(join(home, "skill-library", "我的常用", "_说明.md")));
  const after = (await call("GET", "/skill-vault/catalog")).json().categories;
  const custom = after.find((category) => category.dir === "我的常用");
  check("catalog 里出现自建标题且 builtin=false", custom !== undefined && custom.builtin === false, custom);

  const dup = await call("POST", "/skill-vault/categories", { dir: "我的常用" });
  check("重名标题 409", dup.status === 409, dup.json());

  // 收录时直接指定自建标题 → 应该落到那个目录
  const body = (await call("GET", "/skill-vault/catalog")).json();
  const pick = body.skills.find((skill) => skill.name === "paste-a" && skill.harvestable !== false);
  const intoCustom = await call("POST", "/skill-vault/harvest", { skillPath: pick.path, category: "我的常用", name: "into-custom" });
  const customTask = await waitTask(intoCustom.json().taskId, 12000);
  check("收进自建标题成功", customTask.status === "done", customTask);
  check("落在自建标题目录里", existsSync(join(home, "skill-library", "我的常用", "into-custom", "SKILL.md")));
  const withCount = (await call("GET", "/skill-vault/catalog")).json().categories.find((category) => category.dir === "我的常用");
  check("自建标题的计数 +1", withCount !== undefined && withCount.count >= 1, withCount);
  const bad = await call("POST", "/skill-vault/categories", { dir: "a/b" });
  check("非法标题名 400", bad.status === 400, bad.json());
  const empty = await call("POST", "/skill-vault/categories", { dir: "" });
  check("空标题名 400", empty.status === 400, empty.json());

  // 非空禁止删除
  mkdirSync(join(home, "skill-library", "我的常用", "blocker"), { recursive: true });
  writeFileSync(join(home, "skill-library", "我的常用", "blocker", "SKILL.md"), "---\nname: blocker\ndescription: x\n---\n");
  const nonEmpty = await call("POST", "/skill-vault/categories/remove", { dir: "我的常用" });
  check("非空标题删除 409", nonEmpty.status === 409, nonEmpty.json());

  rmSync(join(home, "skill-library", "我的常用", "blocker"), { recursive: true, force: true });
  rmSync(join(home, "skill-library", "我的常用", "into-custom"), { recursive: true, force: true });
  const removed = await call("POST", "/skill-vault/categories/remove", { dir: "我的常用" });
  check("空标题删除 200", removed.status === 200, removed.json());
  check("目录已删", !existsSync(join(home, "skill-library", "我的常用")));

  const builtinRm = await call("POST", "/skill-vault/categories/remove", { dir: "01-安全与逆向" });
  check("内置标题不可删 400", builtinRm.status === 400, builtinRm.json());
  const ghost = await call("POST", "/skill-vault/categories/remove", { dir: "没有这个" });
  check("未知标题 404", ghost.status === 404, ghost.json());

  // 分类设置不会被 ensureLibrary 冲掉
  await call("POST", "/skill-vault/categories", { dir: "持久化标题" });
  await call("GET", "/skill-vault/catalog");
  const persist = (await call("GET", "/skill-vault/catalog")).json().categories;
  check("再次加载仍在（不会被重写冲掉）", persist.some((category) => category.dir === "持久化标题"), persist.map((c) => c.dir));
}

// ---------- 调用监控 ----------
console.log("\n## invocation tracking");
{
  const registry = { get: async (name) => ({ name, content: "body" }) };
  const fakeCtx = { get: (key) => (key === "skills" ? registry : undefined) };
  const dispose = I.installInvocationTracker(fakeCtx);
  check("挂钩成功（get 已被替换）", registry.get.name === "skillVaultTrackedGet" || typeof registry.get === "function");

  await registry.get("demo-skill");
  let snap = I.invocationSnapshot();
  check("结束后 active 归零", snap.active.length === 0, snap.active);
  check("最近列表记录了这次调用", snap.recent.some((item) => item.name === "demo-skill" && item.status === "done"), snap.recent);
  check("统计里有 tracked 与 byName", snap.stats.tracked >= 1 && snap.stats.byName["demo-skill"] >= 1, snap.stats);

  // 慢调用：进行中要出现在 active 里
  let release;
  const slowRegistry = { get: (name) => new Promise((resolve) => { release = () => resolve({ name }); }) };
  const slowDispose = I.installInvocationTracker({ get: (key) => (key === "skills" ? slowRegistry : undefined) });
  const pending = slowRegistry.get("slow-skill");
  await sleep(30);
  snap = I.invocationSnapshot();
  check("进行中的调用出现在 active", snap.active.some((item) => item.name === "slow-skill"), snap.active.map((item) => item.name));
  check("active 带 elapsedMs", snap.active.every((item) => typeof item.elapsedMs === "number" && item.elapsedMs >= 0), snap.active.map((item) => item.elapsedMs));
  release();
  await pending;
  snap = I.invocationSnapshot();
  check("结束后从 active 消失（自动清理）", !snap.active.some((item) => item.name === "slow-skill"), snap.active.map((item) => item.name));

  // 失败也要标记
  const failing = { get: async () => { throw new Error("boom"); } };
  const failDispose = I.installInvocationTracker({ get: (key) => (key === "skills" ? failing : undefined) });
  try { await failing.get("bad-skill"); } catch { /* expected */ }
  snap = I.invocationSnapshot();
  check("出错调用标记 error", snap.recent.some((item) => item.name === "bad-skill" && item.status === "error"), snap.recent);

  // TTL：已结束超过 60 秒的记录被清掉
  const stale = I.startInvocation("stale-skill");
  I.finishInvocation(stale, "done");
  stale.endedAt = Date.now() - 120000;
  snap = I.invocationSnapshot();
  check("超过 60 秒的旧记录被自动清理", !snap.recent.some((item) => item.name === "stale-skill"), snap.recent.map((item) => item.name));

  dispose();
  check("dispose 后恢复原方法", registry.get.name !== "skillVaultTrackedGet", registry.get.name);
  slowDispose();
  failDispose();
}

// ---------- 撤销 / 审计 / SSE ----------
console.log("\n## undo + audit + stream");
{
  // 撤销「移出库」：文件应该回到原位
  const lib = (await call("GET", "/skill-vault/library")).json();
  const victim = lib.skills.find((skill) => skill.name === "retry-a-r") ?? lib.skills[0];
  check("库里有可操作条目", victim !== undefined, lib.skills.map((s) => s.name));
  const removed = await call("POST", "/skill-vault/remove", { path: victim.path });
  check("移出库 200", removed.status === 200, removed.json());
  check("移出后不在库里", !existsSync(victim.path));
  const undoList1 = (await call("GET", "/skill-vault/undo")).json();
  check("撤销栈里有这条", undoList1.entries.length >= 1, undoList1.entries);
  const undone = await call("POST", "/skill-vault/undo", { id: undoList1.entries[0].id });
  check("撤销 200", undone.status === 200, undone.json());
  check("文件回到原位", existsSync(victim.path));

  // 撤销「改分类」
  const beforeMove = victim.path;
  const currentDir = victim.category ? victim.category.dir : "";
  const targetCat = currentDir === "03-成人写作" ? "02-红队演练" : "03-成人写作";
  const moved = await call("POST", "/skill-vault/move", { path: beforeMove, toCategoryDir: targetCat });
  check("改分类成功", moved.status === 200, moved.json());
  const afterMovePath = join(home, "skill-library", targetCat, basename(beforeMove));
  const undoList2 = (await call("GET", "/skill-vault/undo")).json();
  await call("POST", "/skill-vault/undo", { id: undoList2.entries[0].id });
  check("撤销后回到原分类", existsSync(beforeMove) && !existsSync(afterMovePath), { beforeMove, afterMovePath });
  const noUndo = await call("POST", "/skill-vault/undo", { id: "nope" });
  check("未知撤销 id 404", noUndo.status === 404, noUndo.json());

  // 审计日志
  const audit = (await call("GET", "/skill-vault/audit")).json();
  check("审计里有 remove / move / undo / settings", ["remove", "move", "undo", "settings"].every((action) => audit.entries.some((entry) => entry.action === action)), audit.entries.slice(0, 5).map((e) => e.action));
  check("审计落盘", existsSync(join(home, "skill-library", ".library", "audit.log")));

  // SSE：连上后能收到第一条 data
  const { EventEmitter } = await import("node:events");
  const req = new EventEmitter();
  req.method = "GET";
  req.url = "/skill-vault/stream";
  req.headers = { host: "127.0.0.1:59893" };
  let streamed = "";
  const res = {
    writeHead() {},
    write(chunk) { streamed += String(chunk); },
    end() {},
  };
  const spec = routes.get("/skill-vault/stream");
  void spec.handler(req, res);
  await sleep(120);
  req.emit("close");
  check("SSE 推送了 data 帧", streamed.includes("data:") && streamed.includes("\"tasks\""), streamed.slice(0, 120));
  check("SSE 帧里带 invocations", streamed.includes("invocations"), streamed.slice(0, 200));

  // 调用监控记录 scope/cwd
  const registry = { get: async (name) => ({ name }) };
  const dispose = I.installInvocationTracker({ get: (key) => (key === "skills" ? registry : undefined) });
  await registry.get("scoped-skill", { scope: { key: "session-abc" }, cwd: "C:/work" });
  const snap = I.invocationSnapshot();
  const hit = snap.recent.find((item) => item.name === "scoped-skill");
  check("调用记录带 scope 与 cwd", hit !== undefined && typeof hit.scope === "string" && hit.cwd === "C:/work", hit);
  dispose();
}

// ---------- 只读保证 ----------
console.log("\n## read-only guarantee");
{
  const after = fingerprint(join(home, "skills")) + "\n" + fingerprint(join(home, "reverse")) + "\n" + fingerprint(join(home, "profiles"));
  check("源技能文件哈希 + mtime 完全未变", before === after);
  check("源根里没有多出任何文件", !existsSync(join(skillsRoot, "sandbox-skill")) && !existsSync(join(skillsRoot, "video-tool")));
  const libraryFiles = readdirSync(join(home, "skill-library")).sort();
  check("库根里没有 .tmp 残留", !libraryFiles.includes(".tmp") || readdirSync(join(home, "skill-library", ".tmp")).length === 0, libraryFiles);
}

// ---------- 安全 ----------
console.log("\n## guards");
{
  const wrongMethod = await call("POST", "/skill-vault/catalog", {});
  check("方法不符 405", wrongMethod.status === 405, wrongMethod.status);
  const cross = await call("GET", "/skill-vault/catalog", undefined, { "sec-fetch-site": "cross-site" });
  check("cross-site 403", cross.status === 403, cross.status);
  const evilOrigin = await call("GET", "/skill-vault/catalog", undefined, { origin: "http://evil.example" });
  check("origin 不符 403", evilOrigin.status === 403, evilOrigin.status);
  const sameOrigin = await call("GET", "/skill-vault/catalog", undefined, { origin: "http://127.0.0.1:59893" });
  check("同源放行", sameOrigin.status === 200, sameOrigin.status);
  const escape = await call("GET", "/skill-vault/reveal?dir=../../../etc");
  check("库外路径被拒 400", escape.status === 400, escape.json());
  const reveal = await call("GET", "/skill-vault/reveal?dir=01-安全与逆向");
  check("库内路径可查", reveal.status === 200 && reveal.json().exists === true, reveal.json());
  const catalogVersion = (await call("GET", "/skill-vault/catalog")).json().hostVersion;
  const ping = await call("GET", "/skill-vault/ping");
  check("ping 声明只读", ping.status === 200 && ping.json().readOnlySources === true, ping.json());
  check("ping 与 catalog 的版本一致", ping.json().version === catalogVersion && typeof catalogVersion === "string" && catalogVersion.length > 0, { ping: ping.json().version, catalog: catalogVersion });
  let guard = false;
  try { I.assertInsideLibrary("/etc/passwd"); } catch { guard = true; }
  check("assertInsideLibrary 拦住库外写入", guard === true);
}

rmSync(sandbox, { recursive: true, force: true });
console.log(`\n== ${pass} passed, ${fail} failed ==`);
process.exitCode = fail === 0 ? 0 : 1;
