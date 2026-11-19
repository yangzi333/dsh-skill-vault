# Changelog

## 3.0.3 — 2026-11-18

- `repository` / `homepage` / `bugs` 指向真实个人仓库 `github.com/yangzi333/dsh-skill-vault`（原先指向占位组织）。

## 3.0.2 — 2026-11-18

- `package.json` 的 `repository` / `homepage` / `bugs` 从占位改成真实地址
  （`git+https://github.com/omdsh-dev/dsh-skill-vault.git`），npm 页面不再指向 404。
- 发到别的组织/账号时只需改这三行（`name` 也要跟着改，否则 npm 会撞名）。

## 3.0.1 — 2026-11-18

发布前脱敏：

- `lib/index.js` 里的**具体技能名表**换成词形正则（红队 23 个名字 → `scan|recon|tunnel|proxy-pool|…`；
  方法论 3 个名字 → `evolve|dsh-doc`），源码里不再出现任何私有技能名。
- 第三方插件名从分类兜底里移除（改用 `plugin:<包>` 前缀 + 词形规则）。
- 测试夹具、README 示例统一改成中性名（`demo-adult` / `rev-demo` / `browser-demo` / `demo-video`）。
- 结果：`grep` 私有名全为 0 命中；分类效果不变（真实机器 52 条仍按原分布落位）。

## 3.0.0 — 2026-11-18

补齐发布前的五个缺口：

- **调用监控带会话信息**：记录 `skills.get(name, { scope, cwd })` 里的作用域与工作目录，面板上以灰底小标签显示。
- **实时改为 SSE**：新增 `GET /skill-vault/stream`（`text/event-stream`，1 秒一帧，推 `tasks` + `invocations`）；
  前端优先用 `EventSource`，环境里没有就自动退回 1.2 秒轮询。
- **写技能根默认关闭**：`settings.allowRootWrites` 默认 `false`，`POST /paste` 在关闭时返回 403；
  面板「下载任务」页提供开关。
- **10 分钟撤销栈**：移出库 / 改分类 / 剪切到根 / 删除分类都会入栈（`GET /undo`、`POST /undo`），
  被移出库的内容先挪进 `.library/undo-bin/`，10 分钟内可以「撤销上一步」搬回来，超时自动清理。
- **审计日志**：所有写操作与设置变更追加到 `<库根>/.library/audit.log`，面板可查看（`GET /audit`）。
- **工程外壳**：`LICENSE`（MIT）、`README.en.md`、本 CHANGELOG、`.github/workflows/test.yml`（Ubuntu/Windows × Node 20/22）、
  `tests/run-tests.mjs`（纯 Node 入口），`package.json` 补 `repository` / `homepage` / `bugs` / `keywords` / `files` / `engines`。

## 2.2.0

- 新增「调用监控」大项：包装 `skills.get()`，实时显示正在加载的技能、结束状态、60 秒 TTL、byName 统计。

## 2.1.0

- 「全部技能」选择条新增「移到分类」：未入库先收录、已入库直接移动；修掉自建分类被自动分类顶掉的问题。

## 2.0.0

- 下拉统一黑底白字；技能根下拉显示大标题（路径放进 `title`）；「我的库」新增分类标题管理（自建/删除）；ensureLibrary 不再覆盖自建标题。

## 1.9.0

- 库内技能也能勾选；选择条新增「插入到根」（默认剪切、可选保留副本），根下拉只列可写根。

## 1.8.0

- 库内条目可改分类（卡片下拉 → `POST /move`）。

## 1.7.0

- 分类大标题可折叠，含「全部展开 / 全部收起」。

## 1.6.0

- 任务记录可选保留或删除：单条移除、清除已完成、完成后自动清除。

## 1.5.0

- 「移出库」取代回收区：删库内副本，「全部技能」里回到「收录到库」。

## 1.4.x

- 取出 + 回收区；修复宿主旧版本导致的 405（版本不一致提示 + 空响应诊断）。

## 1.3.x

- 续跑未完成项；已入库技能可勾选；绿标可点即勾选。

## 1.2.0

- 取消语义：排队中立即取消，运行中在检查点停下，已完成的子项保留。

## 1.1.0

- 多选批量收录 + 技能包（保存 / 一键整包收录）。

## 1.0.0

- 首个版本：只读盘点、按分类收纳、下载入口、实时任务进度。
