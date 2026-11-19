// dsh-skill-vault client-half smoke test：假 loader + 最小 hook 运行时 + 受控定时器。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const CLIENT = fileURLToPath(new URL("../client.js", import.meta.url));
const code = readFileSync(CLIENT, "utf8");

// ---------- 最小 React ----------
let hookStates = [];
let hookDeps = [];
let hookCbs = [];
let hookIndex = 0;
let pendingEffects = [];

const shallowEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  Fragment: "Fragment",
  createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity) }; },
  useState(initial) {
    const i = hookIndex++;
    if (!(i in hookStates)) hookStates[i] = typeof initial === "function" ? initial() : initial;
    return [hookStates[i], (next) => { hookStates[i] = typeof next === "function" ? next(hookStates[i]) : next; }];
  },
  useEffect(fn, deps) {
    const i = hookIndex++;
    if (!(i in hookDeps) || !shallowEqual(hookDeps[i], deps)) { hookDeps[i] = deps; pendingEffects.push(fn); }
  },
  useCallback(fn) {
    const i = hookIndex++;
    if (!(i in hookCbs)) hookCbs[i] = fn;
    return hookCbs[i];
  },
};

// ---------- 受控定时器 ----------
const intervals = [];
let timerSeq = 0;
globalThis.setInterval = (fn, ms) => { intervals.push({ id: ++timerSeq, fn, ms }); return timerSeq; };
globalThis.clearInterval = (id) => { const at = intervals.findIndex((t) => t.id === id); if (at !== -1) intervals.splice(at, 1); };
globalThis.setTimeout = () => { return 1; };
globalThis.clearTimeout = () => {};

// ---------- 假 loader ----------
let captured = null;
globalThis.window = { __ModuleLoader__: { load(spec) { captured = spec; } } };
vm.runInThisContext(code, { filename: "client.js" });
const mod = captured.factory((id) => {
  if (id === "react") return react;
  if (id === "react/jsx-runtime") return { jsx: (t, p) => react.createElement(t, p), jsxs: (t, p) => react.createElement(t, p) };
  throw new Error("unexpected require: " + id);
});

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? "" : " -> " + JSON.stringify(detail)}`); }
}

console.log("## module shape");
check("id", captured.id === "dsh-skill-vault", captured.id);
check("PANEL_ID", mod.PANEL_ID === "skillvault", mod.PANEL_ID);
check("inject 无 directoryPicker（不需要）", JSON.stringify(mod.inject) === JSON.stringify(["slots", "locale", "remote"]), mod.inject);

// ---------- 假 fetch ----------
const calls = [];
let catalogMode = "ok";
let invFixture = { active: [], recent: [], stats: { active: 0, tracked: 0 } };
let taskList = [];
const CATALOG = {
  ok: true,
  libraryRoot: "C:/h/skill-library",
  categories: [
    { id: "security-reverse", dir: "01-安全与逆向", note: "逆向分析", builtin: true, count: 1 },
    { id: "narrative", dir: "03-成人写作", note: "成人向叙事", builtin: true, count: 1 },
    { id: "other", dir: "99-未分类", note: "兜底", builtin: true, count: 0 },
    { id: "custom-我的常用", dir: "我的常用", note: "", builtin: false, count: 0 },
  ],
  roots: [{ label: "user-dsh", title: "用户技能根", path: "C:/h/skills", note: "用户根", writable: true }, { label: "plugin:x", title: "插件 x", path: "C:/h/nm/x/skills", note: "插件根", writable: false }],
  skills: [
    { id: "a", name: "rev-x", description: "脱壳", source: "preset:reverse", kind: "directory", enabled: true, parseable: true, inLibrary: false, duplicate: false, path: "C:/h/reverse/skills/rev-x", category: { id: "security-reverse", dir: "01-安全与逆向", note: "逆向分析" } },
    { id: "b", name: "demo-adult", description: "成人叙事", source: "user-dsh", kind: "directory", enabled: true, parseable: true, inLibrary: true, duplicate: false, path: "C:/h/skills/demo-adult", category: { id: "narrative", dir: "03-成人写作", note: "成人向叙事" } },
    { id: "c", name: "office", description: "Office 路由", source: "builtin:app.asar", kind: "builtin", enabled: true, parseable: true, harvestable: false, inLibrary: false, duplicate: false, path: "asar/office", category: { id: "other", dir: "99-未分类", note: "兜底" } },
  ],
  library: [
    { name: "demo-adult", description: "成人叙事", kind: "directory", path: "C:/h/skill-library/03-成人写作/demo-adult", category: { id: "narrative", dir: "03-成人写作", note: "成人向叙事" } },
  ],
  settings: { autoClearTasks: false, allowRootWrites: false },
  undo: [{ id: "u1", at: Date.now(), action: "移出库", description: "demo-adult 移出库", expiresInMs: 600000 }],
  bundles: [
    { name: "reverse-trio", createdAt: "2026-11-18T10:00:00Z", note: "", items: [{ name: "rev-x", source: "preset:reverse", path: "C:/h/reverse/skills/rev-x", category: "01-安全与逆向" }] },
  ],
  stats: { total: 3, enabled: 3, library: 1, duplicates: 0, unparseable: 0 },
};
globalThis.fetch = async (url, options = {}) => {
  const path = url.split("?")[0];
  calls.push({ url, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined });
  const ok = (payload) => ({ status: 200, text: async () => JSON.stringify(payload) });
  if (path.endsWith("/catalog")) {
    if (catalogMode === "fail") return { status: 500, text: async () => JSON.stringify({ ok: false, error: "catalog boom" }) };
    return ok(CATALOG);
  }
  if (path.endsWith("/tasks/cancel")) return ok({ ok: true, id: "t1", status: "canceled" });
  if (path.endsWith("/tasks/retry")) return ok({ ok: true, taskId: "tr", task: { id: "tr" } });
  if (path.endsWith("/remove")) return ok({ ok: true, name: "demo-adult", removedFrom: "C:/h/skill-library/03-成人写作/demo-adult" });
  if (path.endsWith("/tasks/clear")) return ok({ ok: true, removed: 1, remaining: 0 });
  if (path.endsWith("/settings")) return ok({ ok: true, settings: { autoClearTasks: true, allowRootWrites: true } });
  if (path.endsWith("/audit")) return ok({ ok: true, entries: [{ at: "2026-11-18T14:00:00Z", action: "move", detail: { from: "a", to: "b" } }] });
  if (path.endsWith("/undo")) return ok({ ok: true, description: "demo-adult 移出库", action: "移出库" });
  if (path.endsWith("/categories/remove")) return ok({ ok: true, dir: "我的常用", categories: CATALOG.categories });
  if (path.endsWith("/categories")) return ok({ ok: true, dir: "新标题", categories: CATALOG.categories });
  if (path.endsWith("/move")) return ok({ ok: true, name: "demo-adult", category: "01-安全与逆向" });
  if (path.endsWith("/paste")) return ok({ ok: true, name: "demo-adult", mode: "move", root: "user-dsh" });

  if (path.endsWith("/tasks")) return ok({ ok: true, tasks: taskList });
  if (path.endsWith("/invocations")) return ok({ ok: true, ...invFixture });
  if (path.endsWith("/harvest-batch")) return ok({ ok: true, taskId: "tb", task: { id: "tb" } });
  if (path.endsWith("/bundles")) return ok({ ok: true, bundles: CATALOG.bundles, name: "kit", count: 2 });
  if (path.endsWith("/harvest")) return ok({ ok: true, taskId: "t1", task: { id: "t1" } });
  if (path.endsWith("/download")) return ok({ ok: true, taskId: "t2", task: { id: "t2" } });
  return { status: 404, text: async () => JSON.stringify({ ok: false, error: "no route" }) };
};

// ---------- 假 ctx ----------
const registered = { locale: [], slots: [] };
const ctx = {
  effect(factory) { return factory(); },
  locale: {
    register(ns, dict) { registered.locale.push({ ns, dict }); return () => {}; },
    bind(ns) { return (key) => `L:${ns}:${key}`; },
  },
  remote: {},
  slots: {
    inject(_slot, callback) { callback(); },
    register(options, component) { registered.slots.push({ slot: options.name, options, component }); return () => {}; },
  },
};
mod.apply(ctx);

console.log("\n## registration");
const main = registered.slots.find((r) => r.slot === "main");
const side = registered.slots.find((r) => r.slot === "sidebar.panellist");
check("两个槽位", registered.slots.length === 2, registered.slots.map((r) => r.slot));
check("main key = skillvault", main.options.key === "skillvault", main.options.key);
check("sidebar id === main key", side.options.id === main.options.key);
check("sidebar order = 7", side.options.order === 7, side.options.order);
check("label 可求值", side.options.label() === "L:skillVault:panel", side.options.label());
check("zh/en 字典", !!registered.locale[0].dict.zh && !!registered.locale[0].dict.en);

// ---------- 渲染 ----------
const injected = main.options.inject();
function expand(node) {
  if (node === null || node === undefined) return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === "function") {
    const resume = hookIndex;
    hookIndex = 0;
    const out = node.type(node.props);
    hookIndex = resume;
    return expand(out);
  }
  if (node.type === undefined) return node;
  return { type: node.type, props: node.props, children: (node.children || []).map(expand) };
}
function render() {
  hookIndex = 0;
  pendingEffects = [];
  const raw = main.component(Object.assign({}, injected));
  return { tree: expand(raw), effects: pendingEffects };
}
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
function walk(node, out = []) {
  if (node === null || node === undefined) return out;
  if (typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) { for (const child of node) walk(child, out); return out; }
  if (node.type !== undefined) out.push(node);
  for (const child of node.children || []) walk(child, out);
  return out;
}
function textOf(node) {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.children || []);
}
const text = (tree) => textOf(tree);
const button = (tree, label) => walk(tree).find((n) => n.type === "button" && textOf(n) === label);
const buttonStarts = (tree, prefix) => walk(tree).find((n) => n.type === "button" && textOf(n).startsWith(prefix));

console.log("\n## first render");
let view = render();
check("首屏 loading", text(view.tree).includes("L:skillVault:loading"), text(view.tree).slice(0, 80));
check("挂载时拉 catalog + tasks", view.effects.length >= 2, view.effects.length);
view.effects.forEach((fn) => fn());
await flush();
view = render();

console.log("\n## catalog render");
check("顶部只读徽标", text(view.tree).includes("L:skillVault:readOnly"));
check("统计行含 3 个技能", text(view.tree).includes("3"), text(view.tree).slice(0, 200));
check("按分类分组（逆向）", text(view.tree).includes("01-安全与逆向"));
check("按分类分组（成人）", text(view.tree).includes("03-成人写作"));
check("内置技能标注", text(view.tree).includes("L:skillVault:builtin"));
check("已入库标记", text(view.tree).includes("L:skillVault:inLibrary"));
check("tab 计数正确", text(view.tree).includes("L:skillVault:tabAll (3)") || text(view.tree).includes("(3)"), "tabs");
const harvestBtns = walk(view.tree).filter((n) => n.type === "button" && (textOf(n) === "L:skillVault:harvest" || textOf(n) === "L:skillVault:harvesting"));
check("可收录项有「收录」按钮（1 个，内置不可收录）", harvestBtns.length === 1, harvestBtns.length);

console.log("\n## harvest click");
harvestBtns[0].props.onClick();
await flush();
const harvestCall = calls.find((c) => c.url.endsWith("/harvest"));
check("发出 /harvest", harvestCall !== undefined, calls.map((c) => c.url));
check("带 skillPath 与分类", typeof harvestCall.body.skillPath === "string" && /技能|reverse/.test(harvestCall.body.skillPath + (harvestCall.body.category || "")), harvestCall.body);
view = render();

console.log("\n## deselect + task cancel");
{
  view = render();
  const boxes = walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill");
  boxes[0].props.onChange();
  view = render();
  check("选中后操作条出现取消选择", button(view.tree, "L:skillVault:clearSel") !== undefined && text(view.tree).includes("L:skillVault:selectedCount"));

  const unselectBtns = walk(view.tree).filter((n) => n.type === "button" && textOf(n) === "L:skillVault:unselect");
  check("已选卡片上出现「取消选择」", unselectBtns.length === 1, unselectBtns.length);
  unselectBtns[0].props.onClick();
  view = render();
  check("点卡片上的取消选择后操作条消失", !text(view.tree).includes("L:skillVault:selectedCount"));

  // 再选一次，用操作条上的「取消选择」整体清空
  walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill")[0].props.onChange();
  view = render();
  button(view.tree, "L:skillVault:clearSel").props.onClick();
  view = render();
  check("操作条「取消选择」清空全部", !text(view.tree).includes("L:skillVault:selectedCount"));

  // 任务取消
  taskList = [{ id: "t9", label: "batch", name: "pkg", status: "running", stage: "收录 1/3", items: [{ name: "a", status: "running", error: "" }], percent: 33, bytes: 1, total: 3, error: "" }];
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabTasks").props.onClick();
  view = render();
  const cancelBtn = button(view.tree, "L:skillVault:cancelTask");
  check("运行中任务有取消按钮", cancelBtn !== undefined);
  const beforeCancel = calls.length;
  cancelBtn.props.onClick();
  await flush();
  const cancelCall = calls.slice(beforeCancel).find((c) => c.url.endsWith("/tasks/cancel"));
  check("取消发 /tasks/cancel 带 id", cancelCall !== undefined && cancelCall.body.id === "t9", cancelCall && cancelCall.body);
  view = render();
  check("取消后弹提示", text(view.tree).includes("L:skillVault:canceled"), text(view.tree).slice(0, 160));

  taskList = [];
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();

  // 取消后可以重跑未完成项
  taskList = [{ id: "tc", label: "batch", status: "canceled", stage: "已取消", percent: 40, bytes: 1, total: 3, error: "", items: [{ name: "a", status: "done", error: "" }, { name: "b", status: "skipped", error: "已取消" }] }];
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabTasks").props.onClick();
  view = render();
  const retryBtn = button(view.tree, "L:skillVault:retry");
  check("已取消任务有「重跑未完成」", retryBtn !== undefined);
  const beforeRetry = calls.length;
  retryBtn.props.onClick();
  await flush();
  const retryCall = calls.slice(beforeRetry).find((c) => c.url.endsWith("/tasks/retry"));
  check("重跑发 /tasks/retry 带 id", retryCall !== undefined && retryCall.body.id === "tc", retryCall && retryCall.body);
  view = render();
  check("重跑后弹提示", text(view.tree).includes("L:skillVault:retried"), text(view.tree).slice(0, 160));

  taskList = [];
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();

  console.log("\n## 任务记录清理 + 自动清除开关");
  taskList = [
    { id: "ta", label: "batch", status: "done", stage: "完成", percent: 100, bytes: 1, total: 1, error: "", items: [{ name: "a", status: "done", error: "" }] },
    { id: "tb", label: "batch2", status: "canceled", stage: "已取消", percent: 0, bytes: 0, total: 1, error: "", items: [{ name: "b", status: "skipped", error: "已取消" }] },
  ];
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabTasks").props.onClick();
  view = render();
  check("任务页有「清除已完成」", buttonStarts(view.tree, "L:skillVault:clearFinished") !== undefined);
  check("任务页有自动清除复选框", walk(view.tree).some((n) => n.type === "input" && n.props["data-role"] === "auto-clear"));

  const beforeClearOne = calls.length;
  button(view.tree, "L:skillVault:clearRecord").props.onClick();
  await flush();
  const clearOne = calls.slice(beforeClearOne).find((c) => c.url.endsWith("/tasks/clear"));
  check("移除记录发 /tasks/clear 带 ids", clearOne !== undefined && Array.isArray(clearOne.body.ids) && clearOne.body.ids.length === 1, clearOne && clearOne.body);

  view = render();
  const beforeClearAll = calls.length;
  buttonStarts(view.tree, "L:skillVault:clearFinished").props.onClick();
  await flush();
  const clearAll = calls.slice(beforeClearAll).find((c) => c.url.endsWith("/tasks/clear"));
  check("清除已完成发空 body", clearAll !== undefined && clearAll.body.ids === undefined, clearAll && clearAll.body);

  view = render();
  const autoBox = walk(view.tree).find((n) => n.type === "input" && n.props["data-role"] === "auto-clear");
  check("自动清除开关渲染", autoBox !== undefined);
  const beforeSettings = calls.length;
  autoBox.props.onChange({ target: { checked: true } });
  await flush();
  const settingsCall = calls.slice(beforeSettings).find((c) => c.url.endsWith("/settings"));
  check("开关发 /settings autoClearTasks", settingsCall !== undefined && settingsCall.body.autoClearTasks === true, settingsCall && settingsCall.body);

  taskList = [];
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
  view = render();
}

console.log("\n## 分类标题管理 + 根下拉显示标题");
{
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabLibrary").props.onClick();
  view = render();
  check("我的库有「分类标题」管理区", text(view.tree).includes("L:skillVault:categoryManager"), text(view.tree).slice(0, 160));
  const newCatInput = walk(view.tree).find((n) => n.type === "input" && typeof n.props.placeholder === "string" && n.props.placeholder.startsWith("L:skillVault:categoryPlaceholder"));
  check("有新增标题输入框", newCatInput !== undefined);
  newCatInput.props.onChange({ target: { value: "新标题" } });
  view = render();
  const beforeAdd = calls.length;
  button(view.tree, "L:skillVault:categoryAdd").props.onClick();
  await flush();
  const addCall = calls.slice(beforeAdd).find((c) => c.url.endsWith("/categories"));
  check("新增标题发 /categories", addCall !== undefined && addCall.body.dir === "新标题", addCall && addCall.body);

  view = render();
  const removeBtns = walk(view.tree).filter((n) => n.type === "button" && textOf(n) === "L:skillVault:categoryRemove");
  check("空的自建标题才有删除按钮（1 个）", removeBtns.length === 1, removeBtns.length);
  const beforeRemove = calls.length;
  removeBtns[0].props.onClick();
  await flush();
  const removeCall = calls.slice(beforeRemove).find((c) => c.url.endsWith("/categories/remove"));
  check("删除标题发 /categories/remove", removeCall !== undefined && removeCall.body.dir === "我的常用", removeCall && removeCall.body);

  view = render();
  const libBox = walk(view.tree).find((n) => n.props && n.props["data-role"] === "select-skill");
  libBox.props.onChange();
  view = render();
  const rootSelect = walk(view.tree).find((n) => n.type === "select" && n.props["data-role"] === "pick-root");
  const optionTexts = (rootSelect.children || []).map((c) => textOf(c));
  check("根下拉显示大标题而不是路径", optionTexts.includes("L:skillVault:pasteRoot") && optionTexts.some((text) => text === "用户技能根"), optionTexts);
  check("根下拉不显示路径串", !optionTexts.some((text) => text.includes("C:/h/skills")), optionTexts);
  const pasteSelectStyle = rootSelect.props.style || {};
  check("下拉是深色（黑底）", pasteSelectStyle.background === "#1b1b1b" && pasteSelectStyle.color === "#e9e9e9", pasteSelectStyle);
  if (button(view.tree, "L:skillVault:clearSel")) button(view.tree, "L:skillVault:clearSel").props.onClick();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
  view = render();
}

console.log("\n## 全部技能里直接移到分类（剪切）");
{
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
  view = render();
  const boxes = walk(view.tree).filter((n) => n.props && n.props["data-role"] === "select-skill");
  check("全部技能里有可勾选的卡", boxes.length >= 2, boxes.length);
  boxes[0].props.onChange();
  view = render();
  walk(view.tree).filter((n) => n.props && n.props["data-role"] === "select-skill")[1].props.onChange();
  view = render();
  const catSelect = walk(view.tree).find((n) => n.type === "select" && n.props["data-role"] === "pick-category");
  check("选择条里有分类标题下拉", catSelect !== undefined);
  const labels = (catSelect.children || []).map((c) => textOf(c));
  check("分类下拉列出已有标题", labels.some((text) => text.includes("01-安全与逆向")), labels);
  check("分类下拉含自建标题", labels.some((text) => text.includes("我的常用")), labels);
  catSelect.props.onChange({ target: { value: "我的常用" } });
  view = render();
  const before = calls.length;
  button(view.tree, "L:skillVault:moveToCategory").props.onClick();
  await flush();
  const batchCalls = calls.slice(before);
  const harvested = batchCalls.filter((c) => c.url.endsWith("/harvest"));
  const moved = batchCalls.filter((c) => c.url.endsWith("/move"));
  check("未入库的发 /harvest 带分类", harvested.length === 1 && harvested[0].body.category === "我的常用", harvested.map((c) => c.body));
  check("已入库的发 /move 带目标分类", moved.length === 1 && moved[0].body.toCategoryDir === "我的常用", moved.map((c) => c.body));
  view = render();
  if (button(view.tree, "L:skillVault:clearSel")) button(view.tree, "L:skillVault:clearSel").props.onClick();
  view = render();
}

console.log("\n## 调用监控");
{
  invFixture = {
    active: [{ id: "i1", name: "demo-video", status: "running", startedAt: Date.now() - 4200, elapsedMs: 4200 }],
    recent: [{ id: "i0", name: "demo-evolve", status: "done", startedAt: Date.now() - 9000, endedAt: Date.now() - 8000, durationMs: 1000 }],
    stats: { active: 1, tracked: 2, byName: { "demo-video": 1, "demo-evolve": 1 } },
  };
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  const invTab = buttonStarts(view.tree, "L:skillVault:tabInvocations");
  check("有调用监控 tab", invTab !== undefined, textOf(invTab || { children: [] }));
  invTab.props.onClick();
  view = render();
  check("显示调用中的技能", text(view.tree).includes("demo-video"));
  check("显示 elapsed 秒数", text(view.tree).includes("L:skillVault:invElapsed"), text(view.tree).slice(0, 200));
  check("最近列表含已结束调用", text(view.tree).includes("demo-evolve") && text(view.tree).includes("L:skillVault:invStatusDone"));
  check("统计行显示调用中/记录", text(view.tree).includes("L:skillVault:invStats"), text(view.tree).slice(0, 160));

  invFixture = { active: [], recent: [], stats: { active: 0, tracked: 0 } };
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  check("没有调用时显示空态", text(view.tree).includes("L:skillVault:invEmpty"), text(view.tree).slice(0, 200));
  check("最近为空也有空态", text(view.tree).includes("L:skillVault:invNoRecent"));

  buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
  view = render();
}

console.log("\n## 安全开关 / 审计 / 撤销");
{
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabTasks").props.onClick();
  view = render();
  const allowBox = walk(view.tree).find((n) => n.props && n.props["data-role"] === "allow-root");
  check("任务页有「允许写入技能根」开关", allowBox !== undefined);
  check("默认关闭", allowBox.props.checked === false);
  const beforeAllow = calls.length;
  allowBox.props.onChange({ target: { checked: true } });
  await flush();
  const allowCall = calls.slice(beforeAllow).find((c) => c.url.endsWith("/settings"));
  check("切换开关发 /settings allowRootWrites", allowCall !== undefined && allowCall.body.allowRootWrites === true, allowCall && allowCall.body);

  view = render();
  const beforeAudit = calls.length;
  button(view.tree, "L:skillVault:auditLog").props.onClick();
  await flush();
  view = render();
  check("点操作日志发 /audit", calls.slice(beforeAudit).some((c) => c.url.includes("/audit")));
  check("审计条目渲染出来", text(view.tree).includes("move") && text(view.tree).includes("a"), text(view.tree).slice(0, 200));

  view = render();
  const undoBtn = button(view.tree, "L:skillVault:undoLast");
  check("头部有「撤销上一步」", undoBtn !== undefined);
  const beforeUndo = calls.length;
  undoBtn.props.onClick();
  await flush();
  const undoCall = calls.slice(beforeUndo).find((c) => c.url.endsWith("/undo"));
  check("撤销发 /undo", undoCall !== undefined, undoCall && undoCall.url);

  // 调用监控显示 scope
  invFixture = {
    active: [{ id: "i2", name: "scoped-skill", status: "running", startedAt: Date.now() - 1200, elapsedMs: 1200, scope: "sess-abc", cwd: "C:/work" }],
    recent: [],
    stats: { active: 1, tracked: 1 },
  };
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabInvocations").props.onClick();
  view = render();
  check("调用卡显示作用域", text(view.tree).includes("L:skillVault:invScope"), text(view.tree).slice(0, 600));
  check("调用卡显示 cwd", text(view.tree).includes("C:/work"));
  invFixture = { active: [], recent: [], stats: { active: 0, tracked: 0 } };
  intervals[intervals.length - 1].fn();
  await flush();
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
  view = render();
}

console.log("\n## 分类折叠");
{
  const cards = (tree) => walk(tree).filter((n) => n.type === "div" && n.props.style && n.props.style.borderRadius === "10px");
  const groupBtn = (tree, dir) => walk(tree).find((n) => n.type === "button" && textOf(n).includes(dir));
  check("分类标题是按钮（可折叠）", groupBtn(view.tree, "03-成人写作") !== undefined);
  check("默认展开（3 张卡）", cards(view.tree).length === 3, cards(view.tree).length);

  groupBtn(view.tree, "03-成人写作").props.onClick();
  view = render();
  check("点标题收起该组（剩 2 张卡）", cards(view.tree).length === 2, cards(view.tree).length);
  check("收起后标题显示 ▸", text(groupBtn(view.tree, "03-成人写作")).includes("▸"), text(groupBtn(view.tree, "03-成人写作")).slice(0, 40));

  groupBtn(view.tree, "03-成人写作").props.onClick();
  view = render();
  check("再点一次展开回来", cards(view.tree).length === 3, cards(view.tree).length);

  button(view.tree, "L:skillVault:collapseAll").props.onClick();
  view = render();
  check("全部收起 → 0 张卡", cards(view.tree).length === 0, cards(view.tree).length);
  button(view.tree, "L:skillVault:expandAll").props.onClick();
  view = render();
  check("全部展开 → 3 张卡", cards(view.tree).length === 3, cards(view.tree).length);
}

console.log("\n## multi-select + bundle save + batch harvest");
{
  view = render();
  const boxes = walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill");
  check("可收录卡片都有复选框（含已入库共 2 个）", boxes.length === 2, boxes.length);
  boxes[0].props.onChange();
  view = render();
  walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill")[1].props.onChange();
  view = render();
  check("选中后出现操作条", text(view.tree).includes("L:skillVault:selectedCount"), text(view.tree).slice(0, 140));
  check("已入库项被选中时提示会跳过", text(view.tree).includes("L:skillVault:skipInLibrary"), text(view.tree).slice(0, 200));

  // 绿标「已入库」本身可点 = 勾选/取消
  const libChip = walk(view.tree).find((n) => n.type === "button" && textOf(n) === "L:skillVault:inLibrary");
  check("「已入库」绿标是按钮", libChip !== undefined);
  const beforeChip = walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill" && n.props.checked).length;
  libChip.props.onClick();
  view = render();
  const afterChip = walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill" && n.props.checked).length;
  check("点绿标可取消勾选", afterChip === beforeChip - 1, { beforeChip, afterChip });

  const nameInput = walk(view.tree).find((n) => n.type === "input" && n.props.type === "text" && typeof n.props.placeholder === "string" && n.props.placeholder.startsWith("L:skillVault:bundleNamePlaceholder"));
  check("有技能包命名输入框", nameInput !== undefined);
  nameInput.props.onChange({ target: { value: "rev-kit" } });
  // 只选已入库的那一个 → 收录所选给出明确提示，不发请求
  view = render();
  button(view.tree, "L:skillVault:clearSel").props.onClick();
  view = render();
  const boxesAgain = walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill");
  const inLibBox = boxesAgain[1];
  inLibBox.props.onChange();
  view = render();
  const beforeNoop = calls.length;
  button(view.tree, "L:skillVault:harvestSelected").props.onClick();
  await flush();
  view = render();
  check("只选已入库时给出提示且不发批量请求", text(view.tree).includes("L:skillVault:allInLibrary") && calls.slice(beforeNoop).every((c) => !c.url.endsWith("/harvest-batch")), text(view.tree).slice(0, 200));
  button(view.tree, "L:skillVault:clearSel").props.onClick();
  view = render();

  // 为存包重新选两个（含已入库那个）
  const boxesForBundle = walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill");
  boxesForBundle[0].props.onChange();
  view = render();
  walk(view.tree).filter((n) => n.type === "input" && n.props.type === "checkbox" && n.props["data-role"] === "select-skill")[1].props.onChange();
  view = render();
  const beforeSave = calls.length;
  button(view.tree, "L:skillVault:saveAsBundle").props.onClick();
  await flush();
  const saveCall = calls.slice(beforeSave).find((c) => c.url.endsWith("/bundles") && c.method === "POST");
  check("保存技能包 POST /bundles", saveCall !== undefined && saveCall.body.name === "rev-kit", saveCall && saveCall.body);
  check("技能包带 2 个 item", saveCall.body.items.length === 2, saveCall.body.items && saveCall.body.items.length);

  view = render();
  const beforeBatch = calls.length;
  button(view.tree, "L:skillVault:harvestSelected").props.onClick();
  await flush();
  const batchCall = calls.slice(beforeBatch).find((c) => c.url.endsWith("/harvest-batch"));
  check("批量发 /harvest-batch", batchCall !== undefined, calls.slice(beforeBatch).map((c) => c.url));
  check("已入库的被跳过，只发 1 个", batchCall.body.items.length === 1 && typeof batchCall.body.items[0].skillPath === "string", batchCall.body.items);

  view = render();
  buttonStarts(view.tree, "L:skillVault:tabBundles").props.onClick();
  view = render();
  check("技能包 tab 列出包名", text(view.tree).includes("reverse-trio"));
  const beforeApply = calls.length;
  button(view.tree, "L:skillVault:bundleApply").props.onClick();
  await flush();
  const applyCall = calls.slice(beforeApply).find((c) => c.url.endsWith("/harvest-batch"));
  check("一键收录整包发 bundle 名", applyCall !== undefined && applyCall.body.bundle === "reverse-trio", applyCall && applyCall.body);

  view = render();
  buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
  view = render();
}

console.log("\n## search");
const search = walk(view.tree).find((n) => n.type === "input" && typeof n.props.placeholder === "string" && n.props.placeholder.startsWith("L:skillVault:search"));
check("有搜索框", search !== undefined);
search.props.onChange({ target: { value: "office" } });
view = render();
check("过滤后只剩 office", text(view.tree).includes("office") && !text(view.tree).includes("rev-x"));

console.log("\n## library tab & tasks tab");
search.props.onChange({ target: { value: "" } });
view = render();
buttonStarts(view.tree, "L:skillVault:tabLibrary").props.onClick();
view = render();
check("库 tab 显示库内条目", text(view.tree).includes("03-成人写作") && !text(view.tree).includes("L:skillVault:emptyLibrary"));

// 改分类下拉
const mover = walk(view.tree).find((n) => n.type === "select" && n.props["data-role"] === "skill-category");
check("库卡片有分类下拉", mover !== undefined);
check("下拉值 = 当前分类", mover.props.value === "03-成人写作", mover && mover.props.value);
check("下拉含所有分类选项", mover.children.length >= 3, mover.children.length);
const beforeMove = calls.length;
mover.props.onChange({ target: { value: "01-安全与逆向" } });
await flush();
const moveCall = calls.slice(beforeMove).find((c) => c.url.endsWith("/move"));
check("改分类发 /move", moveCall !== undefined && moveCall.body.toCategoryDir === "01-安全与逆向" && /skill-library/.test(moveCall.body.path), moveCall && moveCall.body);

// 库内技能也能被选中 → 像剪切一样插入到某个根
{
  const libBoxes = walk(view.tree).filter((n) => n.type === "input" && n.props["data-role"] === "select-skill");
  check("我的库卡片也有复选框（可选中）", libBoxes.length >= 1, libBoxes.length);
  libBoxes[0].props.onChange();
  view = render();
  check("库内选中后出现选择条", text(view.tree).includes("L:skillVault:selectedCount"), text(view.tree).slice(0, 120));
  const rootSelect = walk(view.tree).find((n) => n.type === "select" && n.props["data-role"] === "pick-root");
  check("选择条里有技能根下拉", rootSelect !== undefined);
  const options = (rootSelect.children || []).map((c) => c.props && c.props.value);
  check("下拉只列可写根", options.includes("C:/h/skills") && !options.includes("C:/h/nm/x/skills"), options);
  rootSelect.props.onChange({ target: { value: "C:/h/skills" } });
  view = render();
  const beforePaste = calls.length;
  button(view.tree, "L:skillVault:pasteTo").props.onClick();
  await flush();
  const pasteCall = calls.slice(beforePaste).find((c) => c.url.endsWith("/paste"));
  check("插入发 /paste 带 path+root", pasteCall !== undefined && pasteCall.body.root === "C:/h/skills" && /skill-library/.test(pasteCall.body.path), pasteCall && pasteCall.body);
  check("默认是剪切（copy 未设置）", pasteCall.body.copy === undefined || pasteCall.body.copy === false, pasteCall.body.copy);
  view = render();
  if (button(view.tree, "L:skillVault:clearSel")) button(view.tree, "L:skillVault:clearSel").props.onClick();
  view = render();
}

// 移出库（我的库里的操作）→ 全部技能里恢复成「收录到库」
view = render();
const takeBtn = button(view.tree, "L:skillVault:takeout");
check("库卡片有「移出库」按钮", takeBtn !== undefined);
const beforeTake = calls.length;
takeBtn.props.onClick();
await flush();
const takeCall = calls.slice(beforeTake).find((c) => c.url.endsWith("/remove"));
check("移出库发 /remove 带库内路径", takeCall !== undefined && /skill-library/.test(takeCall.body.path), takeCall && takeCall.body);
view = render();
check("移出后没有回收区 tab", !text(view.tree).includes("L:skillVault:tabTrash"));

view = render();
buttonStarts(view.tree, "L:skillVault:tabAll").props.onClick();
view = render();

taskList = [
  { id: "t1", label: "https://x/pkg.zip", name: "sandbox-skill", status: "running", stage: "下载中", bytes: 512, total: 1024, percent: 50, category: "07-系统与排障", error: "" },
];
const tick = intervals[intervals.length - 1];
check("注册了轮询定时器（1200ms）", tick !== undefined && tick.ms === 1200, tick && tick.ms);
tick.fn();
await flush();
view = render();
buttonStarts(view.tree, "L:skillVault:tabTasks").props.onClick();
view = render();
check("任务 tab 显示运行中的任务", text(view.tree).includes("sandbox-skill") && text(view.tree).includes("running"));
check("进度条宽度按百分比", walk(view.tree).some((n) => n.props.style && typeof n.props.style.width === "string" && n.props.style.width === "50%"), "width 50%");
check("头部显示进行中徽标", text(view.tree).includes("L:skillVault:tasksActive"), text(view.tree).slice(0, 160));

console.log("\n## done transition → refresh + toast");
const beforeCatalog = calls.filter((c) => c.url.includes("/catalog")).length;
taskList = [{ id: "t1", label: "x", name: "sandbox-skill", status: "done", stage: "完成", bytes: 1024, total: 1024, percent: 100, category: "07-系统与排障", error: "" }];
intervals[intervals.length - 1].fn();
await flush();
view = render();
view.effects.forEach((fn) => fn());
await flush();
view = render();
check("任务完成后重新拉 catalog", calls.filter((c) => c.url.includes("/catalog")).length > beforeCatalog);
check("弹出完成 toast", text(view.tree).includes("L:skillVault:done"), text(view.tree).slice(0, 200));

console.log("\n## install modal");
button(view.tree, "L:skillVault:installTitle").props.onClick();
view = render();
const urlInput = walk(view.tree).find((n) => n.type === "input" && typeof n.props.placeholder === "string" && n.props.placeholder.startsWith("L:skillVault:urlPlaceholder"));
check("弹窗有 URL/路径输入", urlInput !== undefined);
check("弹窗有分类下拉", walk(view.tree).some((n) => n.type === "select"));
urlInput.props.onChange({ target: { value: "https://example.com/skill-v1.zip" } });
view = render();
button(view.tree, "L:skillVault:download").props.onClick();
await flush();
const dl = calls.find((c) => c.url.endsWith("/download"));
check("URL 走 url 字段", dl !== undefined && dl.body.url === "https://example.com/skill-v1.zip", dl && dl.body);

console.log("\n## path variant");
view = render();
button(view.tree, "L:skillVault:installTitle").props.onClick();
view = render();
walk(view.tree).find((n) => n.type === "input" && typeof n.props.placeholder === "string" && n.props.placeholder.startsWith("L:skillVault:urlPlaceholder")).props.onChange({ target: { value: "C:\\skills\\local-skill" } });
view = render();
const beforePath = calls.length;
button(view.tree, "L:skillVault:download").props.onClick();
await flush();
const dl2 = calls.slice(beforePath).find((c) => c.url.endsWith("/download"));
check("本地路径走 path 字段", dl2 !== undefined && dl2.body.path === "C:\\skills\\local-skill", dl2 && dl2.body);

console.log("\n## 版本不一致 / 405 诊断");
{
  // 宿主版本与面板版本不一致 → 顶部黄色提示
  CATALOG.hostVersion = "1.4.0";
  view = render();
  button(view.tree, "L:skillVault:refresh").props.onClick();
  await flush();
  view = render();
  view.effects.forEach((fn) => fn());
  await flush();
  view = render();
  check("版本不一致时提示重启", text(view.tree).includes("L:skillVault:versionMismatch"), text(view.tree).slice(0, 200));
  delete CATALOG.hostVersion;

  // 405 空响应（宿主是旧版本，端点不存在）→ 明确提示重启，而不是"响应不是 JSON"
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const path = url.split("?")[0];
    if (path.endsWith("/remove")) return { status: 405, text: async () => "" };
    return realFetch(url, options);
  };
  view = render();
  buttonStarts(view.tree, "L:skillVault:tabLibrary").props.onClick();
  view = render();
  button(view.tree, "L:skillVault:takeout").props.onClick();
  await flush();
  view = render();
  check("405 空响应给出重启提示", text(view.tree).includes("重启 DeepSeek Harness"), text(view.tree).slice(0, 260));
  globalThis.fetch = realFetch;
}

console.log("\n## error state");
catalogMode = "fail";
view = render();
button(view.tree, "L:skillVault:refresh").props.onClick();
await flush();
view = render();
check("失败显示错误条", text(view.tree).includes("L:skillVault:failed") && text(view.tree).includes("catalog boom"), text(view.tree).slice(0, 200));
catalogMode = "ok";

console.log("\n## resilience");
let threw = false;
try {
  hookStates = []; hookDeps = []; hookCbs = [];
  const fresh = render();
  fresh.effects.forEach((fn) => fn());
  await flush();
  const again = render();
  check("重置后仍能渲染出树", typeof again.tree === "object" && again.tree.type === "div");
} catch (error) { threw = true; console.log("  threw:", String(error && error.message)); }
check("渲染不抛错", threw === false);

for (const t of intervals) globalThis.clearInterval(t.id);
console.log(`\n== ${pass} passed, ${fail} failed ==`);
process.exitCode = fail === 0 ? 0 : 1;
