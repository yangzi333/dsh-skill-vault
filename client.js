window.__ModuleLoader__.load({
  id: "dsh-skill-vault",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const h = react.createElement;

    const NS = "skillVault";
    const PANEL_ID = "skillvault";
    const API = "/skill-vault";
    /** client 半版本：与 catalog 里的 hostVersion 比对，不一致说明宿主没重启。 */
    const CLIENT_VERSION = "3.0.3";

    // ---------- 字典 ----------
    const zh = {
      panel: "技能库",
      title: "技能库",
      subtitle: "只读盘点全部技能 · 按功能分类收纳 · 下载入口 · 实时进度",
      readOnly: "对技能源只读",
      refresh: "刷新",
      search: "搜索名称 / 描述 / 来源…",
      tabAll: "全部技能",
      tabLibrary: "我的库",
      tabTasks: "下载任务",
      tabInvocations: "调用监控",
      invActive: "调用中",
      invEmpty: "当前没有正在调用的技能",
      invRecent: "最近调用",
      invNoRecent: "暂无最近记录",
      invElapsed: "已跑 {s}s",
      invDuration: "耗时 {s}s",
      invStatusDone: "完成",
      invStatusMiss: "未命中",
      invStatusError: "出错",
      invStats: "调用中 {active} · 记录 {tracked} · 结束后 60 秒自动清理",
      installTitle: "下载并入库",
      installHint: "填一个 http(s) 链接（.zip / .tar.gz / .md）或本地路径，落进库的分类目录；源技能不会被改动。",
      urlPlaceholder: "https://… 或 C:\\path\\to\\skill-dir",
      nameOptional: "重命名（留空用 frontmatter 的 name）",
      categoryAuto: "自动分类",
      download: "开始",
      cancel: "取消",
      harvest: "收录到库",
      harvesting: "收录中…",
      inLibrary: "已入库",
      inLibraryHint: "点一下勾选/取消（用来存技能包）",
      notHarvestable: "内置不可收录",
      enabled: "已启用",
      disabled: "已禁用",
      builtin: "内置",
      duplicate: "重名",
      unparseable: "frontmatter 不合规",
      emptyAll: "没有扫描到技能",
      emptyLibrary: "库里还没有技能。用「下载并入库」或从上面任意一张卡点「收录到库」。",
      emptyTasks: "没有下载任务",
      emptyFiltered: "没有匹配项",
      loading: "加载中…",
      failed: "操作失败：",
      renderError: "面板渲染出错：{msg}",
      needTarget: "先填链接或路径",
      started: "任务已创建",
      done: "入库成功：{name}",
      tasksActive: "{n} 个任务进行中",
      libraryRoot: "库根",
      skillsRoot: "技能根（不动它）",
      stage: "阶段",
      noDesc: "（无描述）",
      stats: "共 {total} 个技能 · 启用 {enabled} · 库内 {library} · 重名 {duplicates}",
      tabBundles: "技能包",
      tabTrash: "回收区",
      takeout: "移出库",
      takeoutConfirm: "把「{name}」从库里移出？（只删库内副本，源技能不受影响；移出后可在「全部技能」里重新收录）",
      takeoutDone: "已移出库：{name}",
      restore: "放回",
      restoreDone: "已放回：{name}",
      trashEmpty: "回收区是空的",
      trashMovedAt: "取出于 {at}",
      trashOrphan: "文件已不在",
      selectedCount: "已选 {n} 个",
      harvestSelected: "收录所选",
      saveAsBundle: "存为技能包",
      clearSel: "取消选择",
      unselect: "取消选择",
      cancelTask: "取消",
      canceling: "取消中…",
      canceled: "已取消",
      retry: "重跑未完成",
      retried: "已创建续跑任务",
      clearRecord: "移除记录",
      moveHint: "改分类：选另一个目录即可移动这个库内副本",
      moved: "已移到 {dir}",
      categoryManager: "分类标题",
      categoryHint: "标题就是库里的目录名；自建的标题清空后可以删掉",
      categoryPlaceholder: "新标题名字，例如「我的常用」",
      categoryAdd: "新增标题",
      categoryCustom: "自建",
      categoryRemove: "删除",
      categoryNeedName: "先写个标题名字",
      categoryAdded: "已新增标题：{dir}",
      categoryRemoved: "已删除标题：{dir}",
      categoryRemoveConfirm: "删除标题「{dir}」？（只有空标题才能删）",
      pasteTo: "插入到根",
      moveToCategory: "移到分类",
      moveCategoryHint: "把选中的技能收进/挪到某个分类标题里（未入库的会先收录，已入库的直接移动）",
      pickCategory: "选一个分类标题…",
      movedToCategory: "已把 {n} 个技能放到「{dir}」",
      pasteRoot: "选一个技能根…",
      pasteKeep: "保留库内副本",
      pasted: "已插入 {n} 个到 {root}",
      pasteHint: "把选中的库内副本剪切/复制进技能根（目标已有同名会拒绝，绝不覆盖）",
      pasteNeedLibrary: "请先在「我的库」或已入库的卡片里选技能",
      pastePickRoot: "先选一个技能根",
      expandGroup: "展开",
      collapseGroup: "收起",
      expandAll: "全部展开",
      collapseAll: "全部收起",
      clearFinished: "清除已完成",
      autoClear: "完成后自动清除记录",
      cleared: "已清理 {n} 条记录",
      settingsSaved: "设置已保存",
      allowRoot: "允许写入技能根",
      auditLog: "操作日志",
      auditEmpty: "还没有操作记录",
      undoLast: "撤销上一步",
      undone: "已撤销：{what}",
      invScope: "作用域 {scope}",
      allInLibrary: "所选的 {n} 个技能都已在库里，不需要再收录（可以「存为技能包」）",
      skipInLibrary: "其中 {n} 个已入库，收录时自动跳过",
      selectAll: "全选当前结果",
      bundleNamePlaceholder: "技能包名（如 reverse-trio）",
      bundleSaved: "已保存技能包 {name}（{n} 个技能）",
      batchStarted: "已创建批量任务：{n} 个技能",
      bundleEmpty: "还没有技能包。勾选若干技能后点「存为技能包」。",
      bundleApply: "一键收录整包",
      bundleItems: "{n} 个技能",
      bundleBuiltAt: "创建于 {at}",
      unknown: "待确认",
      versionMismatch: "面板 {client} 与宿主 {host} 版本不一致：新加的端点要等宿主重启才生效。请重启 DeepSeek Harness。",
    };
    const en = {
      panel: "Skill Vault",
      title: "Skill Vault",
      subtitle: "Read-only inventory · categorized library · download entry · live progress",
      readOnly: "sources are read-only",
      refresh: "Refresh",
      search: "Search name / description / source…",
      tabAll: "All skills",
      tabLibrary: "Library",
      tabTasks: "Tasks",
      tabInvocations: "Live calls",
      invActive: "Calling",
      invEmpty: "No skill is being called right now",
      invRecent: "Recent calls",
      invNoRecent: "No recent calls",
      invElapsed: "{s}s elapsed",
      invDuration: "{s}s",
      invStatusDone: "done",
      invStatusMiss: "miss",
      invStatusError: "error",
      invStats: "{active} calling · {tracked} tracked · auto-cleared 60s after finish",
      installTitle: "Download into library",
      installHint: "An http(s) URL (.zip / .tar.gz / .md) or a local path. Source skills are never modified.",
      urlPlaceholder: "https://… or C:\\path\\to\\skill-dir",
      nameOptional: "Rename (defaults to frontmatter name)",
      categoryAuto: "Auto category",
      download: "Start",
      cancel: "Cancel",
      harvest: "Harvest",
      harvesting: "Harvesting…",
      inLibrary: "in library",
      inLibraryHint: "Click to select/deselect (for bundles)",
      notHarvestable: "builtin, not copyable",
      enabled: "enabled",
      disabled: "disabled",
      builtin: "builtin",
      duplicate: "duplicate",
      unparseable: "bad frontmatter",
      emptyAll: "No skills found",
      emptyLibrary: "Library is empty. Download something or harvest a card above.",
      emptyTasks: "No tasks",
      emptyFiltered: "No matches",
      loading: "Loading…",
      failed: "Failed: ",
      renderError: "Render error: {msg}",
      needTarget: "URL or path required",
      started: "Task created",
      done: "Installed: {name}",
      tasksActive: "{n} running",
      libraryRoot: "library",
      skillsRoot: "skills root (untouched)",
      stage: "stage",
      noDesc: "(no description)",
      stats: "{total} skills · {enabled} enabled · {library} in library · {duplicates} duplicates",
      tabBundles: "Bundles",
      tabTrash: "Trash",
      takeout: "Remove from library",
      takeoutConfirm: "Remove \"{name}\" from the library? (library copy only; source skill untouched)",
      takeoutDone: "Removed from library: {name}",
      restore: "Restore",
      restoreDone: "Restored: {name}",
      trashEmpty: "Trash is empty",
      trashMovedAt: "moved {at}",
      trashOrphan: "file missing",
      selectedCount: "{n} selected",
      harvestSelected: "Harvest selected",
      saveAsBundle: "Save as bundle",
      clearSel: "Deselect all",
      unselect: "Deselect",
      cancelTask: "Cancel",
      canceling: "Cancelling…",
      canceled: "Canceled",
      retry: "Retry remaining",
      retried: "Retry task created",
      clearRecord: "Remove record",
      moveHint: "Re-categorize: pick another folder to move this library copy",
      moved: "Moved to {dir}",
      categoryManager: "Category titles",
      categoryHint: "A title is just a folder name; custom titles can be deleted once empty",
      categoryPlaceholder: "New title, e.g. \"my-favorites\"",
      categoryAdd: "Add title",
      categoryCustom: "custom",
      categoryRemove: "Delete",
      categoryNeedName: "Title name required",
      categoryAdded: "Title added: {dir}",
      categoryRemoved: "Title removed: {dir}",
      categoryRemoveConfirm: "Delete title \"{dir}\"? (only empty titles can be deleted)",
      pasteTo: "Paste into root",
      moveToCategory: "Move to category",
      moveCategoryHint: "Put selected skills into a category title (auto-harvest if not in library, move if it is)",
      pickCategory: "Pick a category title…",
      movedToCategory: "Moved {n} skill(s) into \"{dir}\"",
      pasteRoot: "Pick a skill root…",
      pasteKeep: "Keep library copy",
      pasted: "Pasted {n} into {root}",
      pasteHint: "Move/copy selected library items into a skill root (existing names are refused, never overwritten)",
      pasteNeedLibrary: "Select skills that are already in the library",
      pastePickRoot: "Pick a skill root first",
      expandGroup: "Expand",
      collapseGroup: "Collapse",
      expandAll: "Expand all",
      collapseAll: "Collapse all",
      clearFinished: "Clear finished",
      autoClear: "Auto-remove records when finished",
      cleared: "Removed {n} records",
      settingsSaved: "Settings saved",
      allowRoot: "Allow writing into skill roots",
      auditLog: "Audit log",
      auditEmpty: "No operations yet",
      undoLast: "Undo last",
      undone: "Undone: {what}",
      invScope: "scope {scope}",
      allInLibrary: "All {n} selected skills are already in the library (use \"Save as bundle\")",
      skipInLibrary: "{n} already in library will be skipped",
      selectAll: "Select all results",
      bundleNamePlaceholder: "Bundle name (e.g. reverse-trio)",
      bundleSaved: "Saved bundle {name} ({n} skills)",
      batchStarted: "Batch task created: {n} skills",
      bundleEmpty: "No bundles yet. Select skills, then \"Save as bundle\".",
      bundleApply: "Harvest whole bundle",
      bundleItems: "{n} skills",
      bundleBuiltAt: "created {at}",
      unknown: "unknown",
      versionMismatch: "Panel {client} vs host {host} mismatch: new endpoints need a host restart. Please restart DeepSeek Harness.",
    };

    function fill(text, params) {
      if (!params) return text;
      return text.replace(/\{(\w+)\}/g, (whole, key) => (params[key] === undefined ? whole : String(params[key])));
    }
    function makeT(rawT) {
      return function t(key, params) {
        try {
          if (typeof rawT === "function") {
            const value = rawT(key, params);
            if (typeof value === "string" && value.length > 0 && value !== key) return fill(value, params);
          }
        } catch { /* ignore */ }
        const fallback = zh[key] === undefined ? String(key) : zh[key];
        return fill(fallback, params);
      };
    }

    // ---------- HTTP ----------
    async function readJson(response) {
      const text = await response.text();
      let data = null;
      if (text === "") {
        // 空响应基本只有一种情况：这个路径根本没有对应端点，被 SPA 兜底按非 GET 拒了
        if (response.status === 405) {
          throw new Error("宿主缺少这个端点（HTTP 405）——插件宿主半还是旧版本，重启 DeepSeek Harness 后再试");
        }
        if (response.status === 404) {
          throw new Error("宿主没有这个端点（HTTP 404）——插件没装好或需要重启 DSH");
        }
        throw new Error(`空响应（HTTP ${response.status}）`);
      }
      try { data = JSON.parse(text); } catch {
        throw new Error(`响应不是 JSON（HTTP ${response.status}）：${text.slice(0, 120)}`);
      }
      if (!data || data.ok !== true) throw new Error((data && data.error) || `HTTP ${response.status}`);
      return data;
    }
    function apiGet(path) {
      return fetch(API + path, { cache: "no-store", credentials: "same-origin" }).then(readJson);
    }
    function apiPost(path, body) {
      return fetch(API + path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      }).then(readJson);
    }

    // ---------- 样式 ----------
    const BORDER = "var(--dsw-alias-border-l3, #3a3a3a)";
    const TEXT = "var(--dsw-alias-label-primary, #e9e9e9)";
    const BG = "var(--dsw-alias-bg-base, #1b1b1b)";
    const ST = {
      root: { padding: "16px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflowY: "auto", color: TEXT, fontSize: "14px" },
      head: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" },
      title: { margin: 0, fontSize: "16px", fontWeight: 600, lineHeight: 1.3 },
      sub: { fontSize: "12px", opacity: 0.62, marginTop: "2px" },
      actions: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" },
      btn: { cursor: "pointer", border: `1px solid ${BORDER}`, borderRadius: "8px", background: "transparent", color: "inherit", font: "inherit", fontSize: "13px", padding: "6px 12px", lineHeight: 1.4 },
      btnPrimary: { cursor: "pointer", border: `1px solid ${BORDER}`, borderRadius: "8px", background: "var(--dsw-alias-button-elevated-fill, #2a2a2a)", color: "inherit", font: "inherit", fontSize: "13px", padding: "6px 12px", lineHeight: 1.4 },
      btnTiny: { cursor: "pointer", border: `1px solid ${BORDER}`, borderRadius: "6px", background: "transparent", color: "inherit", font: "inherit", fontSize: "12px", padding: "3px 8px", lineHeight: 1.4 },
      chip: { fontSize: "11.5px", padding: "2px 8px", borderRadius: "999px", border: `1px solid ${BORDER}`, opacity: 0.85 },
      tabs: { display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: `1px solid ${BORDER}`, paddingBottom: "8px" },
      tab: { cursor: "pointer", border: "none", background: "transparent", color: "inherit", font: "inherit", fontSize: "13px", padding: "4px 10px", borderRadius: "8px", opacity: 0.65 },
      tabActive: { cursor: "pointer", border: `1px solid ${BORDER}`, background: "var(--dsw-alias-button-elevated-fill, #2a2a2a)", color: "inherit", font: "inherit", fontSize: "13px", padding: "4px 10px", borderRadius: "8px", opacity: 1 },
      input: { width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "8px", color: "inherit", font: "inherit", fontSize: "13px", padding: "8px 10px" },
      select: {
        background: "#1b1b1b",
        color: "#e9e9e9",
        border: `1px solid ${BORDER}`,
        borderRadius: "8px",
        font: "inherit",
        fontSize: "13px",
        padding: "7px 8px",
        colorScheme: "dark",
      },
      option: { background: "#1b1b1b", color: "#e9e9e9" },
      err: { border: "1px solid #a33", borderRadius: "8px", padding: "10px 12px", color: "#ff8f8f", fontSize: "12.5px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
      card: { border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" },
      cardTop: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
      name: { fontWeight: 600, fontSize: "13.5px", wordBreak: "break-all" },
      desc: { fontSize: "12.5px", opacity: 0.8, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" },
      meta: { fontSize: "11.5px", opacity: 0.5, wordBreak: "break-all" },
      group: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" },
      groupHead: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" },
      groupTitle: { fontSize: "13px", fontWeight: 600 },
      groupNote: { fontSize: "11.5px", opacity: 0.55 },
      bar: { height: "6px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" },
      barFill: { height: "100%", background: "linear-gradient(90deg,#4a7dff,#6cc98f)", width: "0%" },
      warn: { border: "1px solid #b8860b", borderRadius: "8px", padding: "8px 12px", color: "#ffd479", fontSize: "12.5px", lineHeight: 1.5 },
      empty: { padding: "26px 12px", textAlign: "center", opacity: 0.62, fontSize: "13px", lineHeight: 1.6 },
      overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "16px" },
      modal: { width: "100%", maxWidth: "560px", background: BG, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", color: TEXT },
      modalTitle: { margin: 0, fontSize: "15px", fontWeight: 600 },
      hint: { fontSize: "12px", opacity: 0.62, lineHeight: 1.55 },
      modalActions: { display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" },
      toast: { position: "fixed", left: "50%", bottom: "48px", transform: "translateX(-50%)", background: "rgba(24,24,24,0.95)", color: "#fff", border: "1px solid #444", borderRadius: "999px", padding: "8px 16px", fontSize: "13px", zIndex: 70, maxWidth: "80vw" },
    };

    // ---------- 图标 ----------
    function VaultIcon(props) {
      const size = props && typeof props.size === "number" ? props.size : 16;
      return h("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true",
      },
        h("rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }),
        h("path", { d: "M3.5 9.5h17" }),
        h("path", { d: "M8 13.5h3M8 16.5h6" }),
        h("circle", { cx: 17, cy: 14, r: 2 })
      );
    }

    // ---------- 卡片 ----------
    function SkillCard(props) {
      const skill = props.skill || {};
      const t = props.t;
      const tags = [];
      if (skill.kind === "builtin") tags.push(t("builtin"));
      if (skill.enabled === false) tags.push(t("disabled"));
      if (skill.duplicate) tags.push(t("duplicate"));
      if (skill.parseable === false) tags.push(t("unparseable"));

      return h("div", { style: ST.card },
        h("div", { style: ST.cardTop },
          props.selectable ? h("input", {
            type: "checkbox",
            "data-role": "select-skill",
            checked: !!props.checked,
            style: { cursor: "pointer", margin: 0 },
            onChange: () => props.onSelect(skill),
          }) : null,
          h("span", { style: ST.name }, skill.name || "?"),
          h("span", { style: ST.chip }, skill.source || "?"),
          tags.map((tag, index) => h("span", { key: `tag${index}`, style: Object.assign({}, ST.chip, { opacity: 0.7 }) }, tag)),
          h("span", { style: { marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" } },
            props.showMove && Array.isArray(props.categories) && props.categories.length > 0
              ? h("select", {
                  "data-role": "skill-category",
                  style: Object.assign({}, ST.select, { fontSize: "12px", padding: "3px 6px", maxWidth: "180px" }),
                  value: (skill.category && skill.category.dir) || "",
                  disabled: !!props.busy,
                  onChange: (e) => props.onMove(skill, e.target.value),
                },
                  props.categories.map((category) => h("option", { key: category.id || category.dir, value: category.dir, style: ST.option }, category.dir))
                )
              : null,
            props.showTakeout && props.onTakeout
              ? h("button", {
                  style: Object.assign({}, ST.btnTiny, { borderColor: "#a33", color: "#ff9a9a" }),
                  disabled: !!props.busy,
                  onClick: () => props.onTakeout(skill),
                }, t("takeout"))
              : null,
            props.checked ? h("button", {
              style: ST.btnTiny,
              disabled: !!props.busy,
              onClick: () => props.onSelect(skill),
            }, t("unselect")) : null,
            skill.harvestable === false
              ? h("span", { style: Object.assign({}, ST.chip, { opacity: 0.6 }) }, t("notHarvestable"))
              : skill.inLibrary
                // 绿标本身也是勾选入口：点它 = 勾上/取消（用来把已入库的技能编进技能包）
                ? h("button", {
                    type: "button",
                    title: t("inLibraryHint"),
                    style: Object.assign({}, ST.chip, {
                      color: "#6cc98f",
                      cursor: props.selectable === false ? "default" : "pointer",
                      background: "transparent",
                      font: "inherit",
                      padding: "2px 8px",
                    }),
                    disabled: props.selectable === false,
                    onClick: () => { if (props.selectable !== false) props.onSelect(skill); },
                  }, t("inLibrary"))
                : h("button", {
                    style: ST.btnTiny,
                    disabled: !!props.busy,
                    onClick: () => props.onHarvest(skill),
                  }, props.busyName === skill.name ? t("harvesting") : t("harvest"))
          )
        ),
        h("p", { style: ST.desc }, skill.description || t("noDesc")),
        h("div", { style: ST.meta }, `${skill.category ? skill.category.dir : "?"} · ${skill.path || ""}`)
      );
    }

    function TaskRow(props) {
      const task = props.task || {};
      const t = props.t;
      const percent = Math.max(0, Math.min(100, Number(task.percent) || 0));
      const color = task.status === "failed" ? "#ff8f8f" : task.status === "done" ? "#6cc98f" : "#e9e9e9";
      const items = Array.isArray(task.items) ? task.items : [];
      const doneItems = items.filter((item) => item.status === "done").length;
      const failedItems = items.filter((item) => item.status === "failed");
      return h("div", { style: ST.card },
        h("div", { style: ST.cardTop },
          h("span", { style: ST.name }, task.name || task.label || task.url || "?"),
          h("span", { style: Object.assign({}, ST.chip, { color }) }, `${task.status} · ${task.stage || ""}`),
          items.length > 0 ? h("span", { style: ST.chip }, `${doneItems}/${items.length}`) : null,
          task.bytes > 0 ? h("span", { style: ST.chip }, `${Math.round(task.bytes / 1024)} KB${task.total > 0 ? ` / ${Math.round(task.total / 1024)} KB` : ""}`) : null,
          task.status === "running" || task.status === "pending"
            ? h("span", { style: { marginLeft: "auto" } },
                h("button", {
                  style: Object.assign({}, ST.btnTiny, { borderColor: "#a33", color: "#ff9a9a" }),
                  onClick: () => props.onCancel(task),
                }, task.cancelRequested ? t("canceling") : t("cancelTask"))
              )
            : h("span", { style: { marginLeft: "auto", display: "flex", gap: "6px" } },
                (task.status === "canceled" || task.status === "failed" || items.some((item) => item.status === "skipped" || item.status === "failed"))
                  ? h("button", { style: ST.btnTiny, onClick: () => props.onRetry(task) }, t("retry"))
                  : null,
                h("button", { style: ST.btnTiny, onClick: () => props.onClearTask(task) }, t("clearRecord"))
              )
        ),
        h("div", { style: ST.bar }, h("div", { style: Object.assign({}, ST.barFill, { width: `${percent}%`, background: task.status === "failed" ? "#a33" : undefined }) })),
        task.error ? h("div", { style: ST.err }, task.error) : null,
        failedItems.length > 0 ? h("div", { style: ST.meta }, failedItems.map((item) => `${item.name}：${item.error}`).join("；")) : null,
        h("div", { style: ST.meta }, `${task.category || "—"} · ${task.url || task.label || ""}`)
      );
    }

    // ---------- 主面板 ----------
    function VaultPage(props) {
      const safe = props || {};
      const t = makeT(safe.t);

      const [state, setState] = react.useState(null);
      const [tasks, setTasksArr] = react.useState([]);
      const [invocations, setInvocations] = react.useState({ active: [], recent: [], stats: { active: 0, tracked: 0 } });
      const [busy, setBusy] = react.useState(false);
      const [busyName, setBusyName] = react.useState("");
      const [error, setError] = react.useState("");
      const [toast, setToast] = react.useState("");
      const [tab, setTab] = react.useState("all");
      const [query, setQuery] = react.useState("");
      const [installOpen, setInstallOpen] = react.useState(false);
      const [installTarget, setInstallTarget] = react.useState("");
      const [installName, setInstallName] = react.useState("");
      const [installCategory, setInstallCategory] = react.useState("");
      const [selected, setSelected] = react.useState({});
      const [collapsed, setCollapsed] = react.useState({});
      const [pasteRoot, setPasteRoot] = react.useState("");
      const [pasteKeep, setPasteKeep] = react.useState(false);
      const [pasteCategory, setPasteCategory] = react.useState("");
      const [auditEntries, setAuditEntries] = react.useState(null);
      const [newCategory, setNewCategory] = react.useState("");
      const [bundleName, setBundleName] = react.useState("");

      const refresh = react.useCallback(() => {
        setError("");
        return apiGet("/catalog?refresh=1")
          .then((data) => setState(data))
          .catch((e) => setError(String((e && e.message) || e)));
      }, []);

      const refreshTasks = react.useCallback(() => {
        return apiGet("/tasks")
          .then((data) => setTasksArr(Array.isArray(data.tasks) ? data.tasks : []))
          .catch(() => {});
      }, []);

      const refreshInvocations = react.useCallback(() => {
        return apiGet("/invocations")
          .then((data) => setInvocations({
            active: Array.isArray(data.active) ? data.active : [],
            recent: Array.isArray(data.recent) ? data.recent : [],
            stats: data.stats || { active: 0, tracked: 0 },
          }))
          .catch(() => {});
      }, []);

      react.useEffect(() => { refresh(); refreshTasks(); refreshInvocations(); }, [refresh, refreshTasks, refreshInvocations]);

      // 实时：优先 SSE（一条长连接推 tasks + invocations）；环境里没有 EventSource 就退回轮询
      react.useEffect(() => {
        const apply = (data) => {
          if (data === null || typeof data !== "object") return;
          if (Array.isArray(data.tasks)) setTasksArr(data.tasks);
          if (data.invocations && typeof data.invocations === "object") {
            setInvocations({
              active: Array.isArray(data.invocations.active) ? data.invocations.active : [],
              recent: Array.isArray(data.invocations.recent) ? data.invocations.recent : [],
              stats: data.invocations.stats || { active: 0, tracked: 0 },
            });
          }
        };
        if (typeof EventSource === "function") {
          let source = null;
          try { source = new EventSource(API + "/stream"); } catch { source = null; }
          if (source !== null) {
            source.onmessage = (event) => { try { apply(JSON.parse(event.data)); } catch { /* ignore */ } };
            return () => { try { source.close(); } catch { /* ignore */ } };
          }
        }
        const timer = setInterval(() => { refreshTasks(); refreshInvocations(); }, 1200);
        return () => clearInterval(timer);
      }, [refreshTasks, refreshInvocations]);

      // 任务由 running → done 时刷一次目录
      react.useEffect(() => {
        const finished = tasks.filter((task) => task.status === "done").length;
        if (finished > 0 && finished !== lastDoneCount) {
          lastDoneCount = finished;
          const latest = tasks.find((task) => task.status === "done");
          if (latest) {
            notify(t("done", { name: latest.name || latest.label || "" }));
          }
          refresh();
        }
      }, [tasks, refresh]);

      function notify(message) {
        setToast(message);
        try { setTimeout(() => setToast(""), 2600); } catch { /* ignore */ }
      }

      function onHarvest(skill) {
        setBusy(true);
        setBusyName(skill.name);
        setError("");
        apiPost("/harvest", { skillPath: skill.path, category: skill.category ? skill.category.dir : undefined })
          .then(() => { notify(t("started")); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => { setBusy(false); setBusyName(""); });
      }

      function toggleGroup(dir) {
        setCollapsed((prev) => Object.assign({}, prev, { [dir]: !prev[dir] }));
      }

      function setAllGroups(dirs, value) {
        const next = {};
        for (const dir of dirs) next[dir] = value;
        setCollapsed(next);
      }

      function moveSelectedToCategory() {
        const items = selectedList();
        if (items.length === 0) { setError(t("pasteNeedLibrary")); return; }
        if (String(pasteCategory || "").trim() === "") { setError(t("pickCategory")); return; }
        const libRoot = (state && state.libraryRoot) || "";
        setBusy(true);
        setError("");
        (async () => {
          let moved = 0;
          let harvested = 0;
          const failures = [];
          for (const skill of items) {
            const inLibrary = skill.inLibrary === true || (libRoot !== "" && String(skill.path || "").startsWith(libRoot));
            try {
              if (inLibrary) {
                await apiPost("/move", { path: skill.path, toCategoryDir: pasteCategory });
                moved += 1;
              } else {
                await apiPost("/harvest", { skillPath: skill.path, category: pasteCategory, name: skill.name });
                harvested += 1;
              }
            } catch (e) {
              failures.push(`${skill.name}：${String((e && e.message) || e)}`);
            }
          }
          setSelected({});
          notify(t("movedToCategory", { n: moved + harvested, dir: pasteCategory }));
          if (failures.length > 0) setError(failures.join("；"));
          await refresh();
          await refreshTasks();
        })().catch((e) => setError(String((e && e.message) || e))).then(() => setBusy(false));
      }

      function pasteSelected() {
        const libRoot = (state && state.libraryRoot) || "";
        const items = selectedList().filter((skill) => skill.inLibrary === true
          || (libRoot !== "" && String(skill.path || "").startsWith(libRoot)));
        if (items.length === 0) { setError(t("pasteNeedLibrary")); return; }
        if (String(pasteRoot || "").trim() === "") { setError(t("pastePickRoot")); return; }
        setBusy(true);
        setError("");
        (async () => {
          let done = 0;
          const failures = [];
          for (const skill of items) {
            try {
              await apiPost("/paste", { path: skill.path, root: pasteRoot, copy: pasteKeep });
              done += 1;
            } catch (e) {
              failures.push(`${skill.name}：${String((e && e.message) || e)}`);
            }
          }
          setSelected({});
          notify(t("pasted", { n: done, root: pasteRoot }));
          if (failures.length > 0) setError(failures.join("；"));
          await refresh();
        })().catch((e) => setError(String((e && e.message) || e))).then(() => setBusy(false));
      }

      function onAddCategory() {
        const title = String(newCategory || "").trim();
        if (title === "") { setError(t("categoryNeedName")); return; }
        setBusy(true);
        setError("");
        apiPost("/categories", { dir: title })
          .then(() => { setNewCategory(""); notify(t("categoryAdded", { dir: title })); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      function onRemoveCategory(dir, count) {
        let ok = true;
        try {
          if (typeof globalThis !== "undefined" && typeof globalThis.confirm === "function") {
            ok = globalThis.confirm(t("categoryRemoveConfirm", { dir }));
          }
        } catch { ok = true; }
        if (!ok) return;
        setBusy(true);
        setError("");
        apiPost("/categories/remove", { dir })
          .then(() => { notify(t("categoryRemoved", { dir })); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      function toggleSelect(skill) {
        setSelected((prev) => {
          const next = Object.assign({}, prev);
          if (next[skill.path]) delete next[skill.path];
          else next[skill.path] = skill;
          return next;
        });
      }

      function selectedList() {
        return Object.keys(selected || {}).map((key) => selected[key]);
      }

      function harvestSelected() {
        const picked = selectedList();
        const items = picked
          .filter((skill) => skill.inLibrary !== true)
          .map((skill) => ({
            skillPath: skill.path,
            category: skill.category ? skill.category.dir : undefined,
            name: skill.name,
          }));
        if (items.length === 0) { setError(t("allInLibrary", { n: picked.length })); return; }
        setBusy(true);
        setError("");
        apiPost("/harvest-batch", { items })
          .then(() => { setSelected({}); setTab("tasks"); notify(t("batchStarted", { n: items.length })); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      function saveSelectionAsBundle() {
        const items = selectedList().map((skill) => ({
          name: skill.name,
          source: skill.source,
          path: skill.path,
          category: skill.category ? skill.category.dir : "",
        }));
        if (items.length === 0) return;
        const name = String(bundleName || "").trim() || `bundle-${items.length}`;
        setBusy(true);
        setError("");
        apiPost("/bundles", { name, items })
          .then(() => { notify(t("bundleSaved", { name, n: items.length })); setBundleName(""); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      function applyBundle(bundle) {
        setBusy(true);
        setError("");
        apiPost("/harvest-batch", { bundle: bundle.name })
          .then(() => { setTab("tasks"); notify(t("batchStarted", { n: bundle.items.length })); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      function onMove(skill, toCategoryDir) {
        const current = skill.category ? skill.category.dir : "";
        if (toCategoryDir === current) return;
        setBusy(true);
        setError("");
        apiPost("/move", { path: skill.path, toCategoryDir })
          .then(() => { notify(t("moved", { dir: toCategoryDir })); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      function onCancelTask(task) {
        setError("");
        apiPost("/tasks/cancel", { id: task.id })
          .then(() => { notify(t("canceled")); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function onRetryTask(task) {
        setError("");
        apiPost("/tasks/retry", { id: task.id })
          .then(() => { notify(t("retried")); setTab("tasks"); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function onClearTask(task) {
        setError("");
        apiPost("/tasks/clear", { ids: [task.id] })
          .then((data) => { notify(t("cleared", { n: data.removed })); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function onClearFinished() {
        setError("");
        apiPost("/tasks/clear", {})
          .then((data) => { notify(t("cleared", { n: data.removed })); return refreshTasks(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function toggleAllowRoot(next) {
        setError("");
        apiPost("/settings", { allowRootWrites: !!next })
          .then(() => { notify(t("settingsSaved")); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function loadAudit() {
        if (auditEntries !== null) { setAuditEntries(null); return; }
        setError("");
        apiGet("/audit?limit=50")
          .then((data) => setAuditEntries(Array.isArray(data.entries) ? data.entries : []))
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function onUndo() {
        setError("");
        apiPost("/undo", {})
          .then((data) => { notify(t("undone", { what: data.description || data.action })); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function toggleAutoClear(next) {        setError("");
        apiPost("/settings", { autoClearTasks: !!next })
          .then(() => { notify(t("settingsSaved")); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)));
      }

      function onTakeout(skill) {
        let ok = true;
        try {
          if (typeof globalThis !== "undefined" && typeof globalThis.confirm === "function") {
            ok = globalThis.confirm(t("takeoutConfirm", { name: skill.name }));
          }
        } catch { ok = true; }
        if (!ok) return;
        setBusy(true);
        setError("");
        apiPost("/remove", { path: skill.path, name: skill.name })
          .then(() => { notify(t("takeoutDone", { name: skill.name })); return refresh(); })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }


      function doInstall() {
        const target = String(installTarget || "").trim();
        if (target === "") { setError(t("needTarget")); return; }
        const isUrl = /^https?:\/\//i.test(target);
        setBusy(true);
        setError("");
        const payload = {
          url: isUrl ? target : undefined,
          path: isUrl ? undefined : target,
          name: String(installName || "").trim() || undefined,
          category: String(installCategory || "").trim() || undefined,
        };
        apiPost("/download", payload)
          .then(() => {
            setInstallOpen(false);
            setInstallTarget("");
            setInstallName("");
            setTab("tasks");
            notify(t("started"));
            return refreshTasks();
          })
          .catch((e) => setError(String((e && e.message) || e)))
          .then(() => setBusy(false));
      }

      try {
        const data = state || {};
        const skills = Array.isArray(data.skills) ? data.skills : [];
        const library = Array.isArray(data.library) ? data.library : [];
        const categories = Array.isArray(data.categories) ? data.categories : [];
        const stats = data.stats || { total: 0, enabled: 0, library: 0, duplicates: 0 };
        const activeTasks = tasks.filter((task) => task.status === "running" || task.status === "pending");
        const settings = data.settings || {};
        const selCount = Object.keys(selected || {}).length;
        const writableRoots = (Array.isArray(data.roots) ? data.roots : []).filter((root) => root && root.writable === true);
        const selInLibrary = Object.keys(selected || {}).filter((key) => selected[key] && selected[key].inLibrary === true).length;

        const needle = String(query || "").trim().toLowerCase();
        const matches = (item) => needle === ""
          || String(item.name || "").toLowerCase().includes(needle)
          || String(item.description || "").toLowerCase().includes(needle)
          || String(item.source || "").toLowerCase().includes(needle);

        const grouped = (items) => {
          const map = new Map();
          for (const item of items) {
            const dir = item.category ? item.category.dir : "99-未分类";
            if (!map.has(dir)) map.set(dir, { dir, note: item.category ? item.category.note : "", items: [] });
            map.get(dir).items.push(item);
          }
          return [...map.values()].sort((a, b) => a.dir.localeCompare(b.dir));
        };

        const renderGroups = (items, kind) => {
          if (items.length === 0) return null;
          return grouped(items).map((group) => {
            const isCollapsed = !!(collapsed && collapsed[group.dir]);
            return h("div", { key: `${kind}:${group.dir}`, style: ST.group },
              // 大标题 = 折叠开关：点一下收起/展开该分类
              h("button", {
                type: "button",
                title: isCollapsed ? t("expandGroup") : t("collapseGroup"),
                "aria-expanded": isCollapsed ? "false" : "true",
                onClick: () => toggleGroup(group.dir),
                style: Object.assign({}, ST.groupHead, {
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  font: "inherit",
                  padding: "4px 0",
                  width: "100%",
                  textAlign: "left",
                }),
              },
                h("span", { style: Object.assign({}, ST.groupTitle, { minWidth: "1.2em" }) }, isCollapsed ? "▸" : "▾"),
                h("span", { style: ST.groupTitle }, group.dir),
                h("span", { style: ST.groupNote }, group.note || ""),
                h("span", { style: ST.chip }, String(group.items.length)),
                h("span", { style: Object.assign({}, ST.groupNote, { marginLeft: "auto" }) }, isCollapsed ? t("expandGroup") : t("collapseGroup"))
              ),
              isCollapsed ? null : group.items.map((item) => h(SkillCard, {
                key: `${kind}:${item.id || item.name}:${item.path}`,
                skill: item,
                t,
                busy,
                busyName,
                onHarvest,
                selectable: kind === "lib" ? true : item.harvestable !== false,
                showTakeout: kind === "lib",
                showMove: kind === "lib",
                categories,
                onMove,
                onTakeout,
                checked: !!(selected && selected[item.path]),
                onSelect: toggleSelect,
              }))
            );
          });
        };

        let body;
        if (state === null) {
          body = h("div", { style: ST.empty }, t("loading"));
        } else if (tab === "invocations") {
          const active = Array.isArray(invocations.active) ? invocations.active : [];
          const recent = Array.isArray(invocations.recent) ? invocations.recent : [];
          const invStats = invocations.stats || { active: 0, tracked: 0 };
          const callCard = (item, isActive) => h("div", { key: `inv:${item.id}`, style: ST.card },
            h("div", { style: ST.cardTop },
              h("span", { style: ST.name }, item.name || "?"),
              h("span", {
                style: Object.assign({}, ST.chip, {
                  color: isActive ? "#ffd479" : item.status === "error" ? "#ff8f8f" : item.status === "miss" ? "#999" : "#6cc98f",
                }),
              }, isActive ? t("invActive") : item.status === "error" ? t("invStatusError") : item.status === "miss" ? t("invStatusMiss") : t("invStatusDone")),
              h("span", { style: ST.chip }, isActive
                ? t("invElapsed", { s: Math.round(((item.elapsedMs || 0) / 1000) * 10) / 10 })
                : t("invDuration", { s: Math.round(((item.durationMs || 0) / 1000) * 10) / 10 })),
              item.scope ? h("span", { style: Object.assign({}, ST.chip, { opacity: 0.75 }) }, t("invScope", { scope: item.scope })) : null,
              item.cwd ? h("span", { style: Object.assign({}, ST.chip, { opacity: 0.55 }) }, item.cwd) : null
            )
          );
          body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
              h("span", { style: Object.assign({}, ST.chip, { color: "#ffd479" }) }, t("invStats", { active: invStats.active ?? active.length, tracked: invStats.tracked ?? 0 })),
              h("button", { style: Object.assign({}, ST.btnTiny, { marginLeft: "auto" }), onClick: refreshInvocations }, t("refresh"))
            ),
            h("div", { style: ST.groupHead },
              h("span", { style: ST.groupTitle }, t("invActive")),
              h("span", { style: ST.chip }, String(active.length))
            ),
            active.length === 0
              ? h("div", { style: ST.empty }, t("invEmpty"))
              : h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, active.map((item) => callCard(item, true))),
            h("div", { style: ST.groupHead },
              h("span", { style: ST.groupTitle }, t("invRecent")),
              h("span", { style: ST.chip }, String(recent.length))
            ),
            recent.length === 0
              ? h("div", { style: ST.empty }, t("invNoRecent"))
              : h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, recent.map((item) => callCard(item, false)))
          );
        } else if (tab === "tasks") {
          const finishedCount = tasks.filter((task) => task.status === "done" || task.status === "failed" || task.status === "canceled").length;
          body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } },
              h("span", { style: ST.chip }, `${finishedCount}/${tasks.length}`),
              h("label", { style: { display: "flex", gap: "6px", alignItems: "center", fontSize: "12.5px", cursor: "pointer" } },
                h("input", {
                  type: "checkbox",
                  "data-role": "auto-clear",
                  checked: !!(settings && settings.autoClearTasks),
                  style: { cursor: "pointer", margin: 0 },
                  onChange: (e) => toggleAutoClear(e.target.checked),
                }),
                t("autoClear")
              ),
              h("label", { style: { display: "flex", gap: "6px", alignItems: "center", fontSize: "12.5px", cursor: "pointer" } },
                h("input", {
                  type: "checkbox",
                  "data-role": "allow-root",
                  checked: !!(settings && settings.allowRootWrites),
                  style: { cursor: "pointer", margin: 0 },
                  onChange: (e) => toggleAllowRoot(e.target.checked),
                }),
                t("allowRoot")
              ),
              h("button", { style: ST.btnTiny, onClick: loadAudit }, t("auditLog")),
              h("button", {
                style: Object.assign({}, ST.btnTiny, { marginLeft: "auto" }),
                disabled: busy || finishedCount === 0,
                onClick: onClearFinished,
              }, `${t("clearFinished")} (${finishedCount})`)
            ),
            auditEntries !== null
              ? h("div", { style: ST.card },
                  h("div", { style: ST.cardTop },
                    h("span", { style: ST.groupTitle }, t("auditLog")),
                    h("span", { style: ST.chip }, String(auditEntries.length)),
                    h("span", { style: { marginLeft: "auto" } }, h("button", { style: ST.btnTiny, onClick: () => setAuditEntries(null) }, t("close")))
                  ),
                  h("div", { style: { display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto" } },
                    auditEntries.length === 0
                      ? h("div", { style: ST.meta }, t("auditEmpty"))
                      : auditEntries.map((entry) => h("div", { key: `${entry.at}:${entry.action}`, style: ST.meta }, `${String(entry.at).slice(0, 19).replace("T", " ")} · ${entry.action} · ${JSON.stringify(entry.detail)}`))
                  )
                )
              : null,
            tasks.length === 0
              ? h("div", { style: ST.empty }, t("emptyTasks"))
              : h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, tasks.map((task) => h(TaskRow, {
                  key: task.id,
                  task,
                  t,
                  onCancel: onCancelTask,
                  onRetry: onRetryTask,
                  onClearTask,
                })))
          );
        } else if (tab === "bundles") {
          const bundles = Array.isArray(data.bundles) ? data.bundles : [];
          body = bundles.length === 0
            ? h("div", { style: ST.empty }, t("bundleEmpty"))
            : h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, bundles.map((bundle) => h("div", { key: `bundle:${bundle.name}`, style: ST.card },
                h("div", { style: ST.cardTop },
                  h("span", { style: ST.name }, bundle.name),
                  h("span", { style: ST.chip }, t("bundleItems", { n: bundle.items.length })),
                  h("span", { style: ST.chip }, t("bundleBuiltAt", { at: String(bundle.createdAt || "").slice(0, 19).replace("T", " ") })),
                  h("span", { style: { marginLeft: "auto" } },
                    h("button", { style: ST.btnTiny, disabled: busy, onClick: () => applyBundle(bundle) }, t("bundleApply"))
                  )
                ),
                h("div", { style: ST.meta }, bundle.items.map((item) => item.name).join(" · "))
              )));
        } else if (tab === "library") {
          const items = library.filter(matches);
          const manager = h("div", { style: ST.card },
            h("div", { style: ST.cardTop },
              h("span", { style: ST.groupTitle }, t("categoryManager")),
              h("span", { style: ST.groupNote }, t("categoryHint"))
            ),
            h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
              h("input", {
                style: Object.assign({}, ST.input, { maxWidth: "240px" }),
                type: "text",
                value: newCategory,
                placeholder: t("categoryPlaceholder"),
                onChange: (e) => setNewCategory(e.target.value),
                onKeyDown: (e) => { if (e.key === "Enter") onAddCategory(); },
              }),
              h("button", { style: ST.btnTiny, disabled: busy, onClick: onAddCategory }, t("categoryAdd"))
            ),
            h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" } },
              categories.map((category) => {
                const count = typeof category.count === "number" ? category.count : 0;
                const removable = category.builtin !== true && count === 0;
                return h("span", { key: `cat:${category.dir}`, style: Object.assign({}, ST.chip, { display: "inline-flex", gap: "6px", alignItems: "center" }) },
                  `${category.dir} (${count})`,
                  category.builtin === true ? null : h("span", { style: { opacity: 0.6 } }, t("categoryCustom")),
                  removable
                    ? h("button", {
                        style: Object.assign({}, ST.btnTiny, { padding: "0 6px", fontSize: "11px" }),
                        disabled: busy,
                        onClick: () => onRemoveCategory(category.dir, count),
                      }, t("categoryRemove"))
                    : null
                );
              })
            )
          );
          body = library.length === 0
            ? h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, manager, h("div", { style: ST.empty }, t("emptyLibrary")))
            : items.length === 0
              ? h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, manager, h("div", { style: ST.empty }, t("emptyFiltered")))
              : h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, manager, renderGroups(items, "lib"));
        } else {
          const items = skills.filter(matches);
          body = skills.length === 0
            ? h("div", { style: ST.empty }, t("emptyAll"))
            : items.length === 0
              ? h("div", { style: ST.empty }, t("emptyFiltered"))
              : h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, renderGroups(items, "all"));
        }

        const installModal = installOpen ? h("div", { style: ST.overlay, onClick: () => setInstallOpen(false) },
          h("div", { style: ST.modal, onClick: (e) => e.stopPropagation() },
            h("h3", { style: ST.modalTitle }, t("installTitle")),
            h("div", { style: ST.hint }, t("installHint")),
            h("input", {
              style: ST.input, type: "text", value: installTarget,
              placeholder: t("urlPlaceholder"),
              onChange: (e) => setInstallTarget(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter") doInstall(); },
            }),
            h("input", {
              style: ST.input, type: "text", value: installName,
              placeholder: t("nameOptional"),
              onChange: (e) => setInstallName(e.target.value),
            }),
            h("select", {
              style: ST.select, value: installCategory,
              onChange: (e) => setInstallCategory(e.target.value),
            },
              h("option", { value: "" }, t("categoryAuto")),
              categories.map((category) => h("option", { key: category.id, value: category.dir }, category.dir))
            ),
            h("div", { style: ST.modalActions },
              h("button", { style: ST.btn, disabled: busy, onClick: () => setInstallOpen(false) }, t("cancel")),
              h("button", { style: ST.btnPrimary, disabled: busy, onClick: doInstall }, t("download"))
            )
          )
        ) : null;

        return h("div", { style: ST.root },
          h("div", { style: ST.head },
            h("div", null,
              h("h2", { style: ST.title }, t("title")),
              h("div", { style: ST.sub }, t("subtitle"))
            ),
            h("div", { style: ST.actions },
              h("span", { style: Object.assign({}, ST.chip, { color: "#6cc98f" }) }, t("readOnly")),
              activeTasks.length > 0 ? h("span", { style: Object.assign({}, ST.chip, { color: "#ffd479" }) }, t("tasksActive", { n: activeTasks.length })) : null,
              (Array.isArray(data.undo) && data.undo.length > 0)
                ? h("button", { style: Object.assign({}, ST.btn, { borderColor: "#b8860b", color: "#ffd479" }), disabled: busy, onClick: onUndo, title: data.undo[0].description || "" }, t("undoLast"))
                : null,
              h("button", { style: ST.btn, disabled: busy, onClick: () => { refresh(); refreshTasks(); } }, t("refresh")),
              h("button", {
                style: ST.btnPrimary,
                onClick: () => { setError(""); setInstallTarget(""); setInstallName(""); setInstallCategory(""); setInstallOpen(true); },
              }, t("installTitle"))
            )
          ),
          h("div", { style: ST.meta },
            `${t("stats", stats)} · ${t("libraryRoot")}：${data.libraryRoot || "?"} · ${t("skillsRoot")}：${joinHint(data)}`
          ),
          (() => {
            const hostVersion = data.hostVersion || data.version || "";
            if (hostVersion === "") return null;
            if (hostVersion === CLIENT_VERSION) return null;
            return h("div", { style: ST.warn }, t("versionMismatch", { host: hostVersion, client: CLIENT_VERSION }));
          })(),
          h("div", { style: ST.tabs },
            h("button", { style: tab === "all" ? ST.tabActive : ST.tab, onClick: () => setTab("all") }, `${t("tabAll")} (${skills.length})`),
            h("button", { style: tab === "library" ? ST.tabActive : ST.tab, onClick: () => setTab("library") }, `${t("tabLibrary")} (${library.length})`),
            h("button", { style: tab === "bundles" ? ST.tabActive : ST.tab, onClick: () => setTab("bundles") }, `${t("tabBundles")} (${Array.isArray(data.bundles) ? data.bundles.length : 0})`),
            h("button", { style: tab === "tasks" ? ST.tabActive : ST.tab, onClick: () => setTab("tasks") }, `${t("tabTasks")} (${tasks.length})`),
            h("button", { style: tab === "invocations" ? ST.tabActive : ST.tab, onClick: () => setTab("invocations") }, `${t("tabInvocations")} (${(invocations.stats && invocations.stats.active) || 0})`)
          ),
          tab === "tasks" ? null : h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
            h("input", {
              style: ST.input, type: "text", value: query,
              placeholder: t("search"),
              onChange: (e) => setQuery(e.target.value),
            }),
            h("button", {
              style: ST.btnTiny,
              onClick: () => setAllGroups(grouped(tab === "library" ? library.filter(matches) : skills.filter(matches)).map((group) => group.dir), false),
            }, t("expandAll")),
            h("button", {
              style: ST.btnTiny,
              onClick: () => setAllGroups(grouped(tab === "library" ? library.filter(matches) : skills.filter(matches)).map((group) => group.dir), true),
            }, t("collapseAll"))
          ),
          selCount > 0 ? h("div", { style: ST.card },
            h("div", { style: ST.cardTop },
              h("span", { style: ST.chip, id: "selCount" }, t("selectedCount", { n: selCount })),
              selInLibrary > 0 ? h("span", { style: Object.assign({}, ST.chip, { color: "#6cc98f" }) }, t("skipInLibrary", { n: selInLibrary })) : null,
              h("input", {
                style: Object.assign({}, ST.input, { maxWidth: "260px" }),
                type: "text", value: bundleName,
                placeholder: t("bundleNamePlaceholder"),
                onChange: (e) => setBundleName(e.target.value),
              }),
              h("span", { style: { marginLeft: "auto", display: "flex", gap: "6px", flexWrap: "wrap" } },
                h("button", { style: ST.btnPrimary, disabled: busy, onClick: harvestSelected }, t("harvestSelected")),
                h("button", { style: ST.btn, disabled: busy, onClick: saveSelectionAsBundle }, t("saveAsBundle")),
                h("button", { style: ST.btn, disabled: busy, onClick: () => setSelected({}) }, t("clearSel"))
              )
            ),
            h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "8px" } },
              h("span", { style: ST.groupNote }, t("moveCategoryHint")),
              h("select", {
                "data-role": "pick-category",
                style: Object.assign({}, ST.select, { maxWidth: "240px" }),
                value: pasteCategory,
                onChange: (e) => setPasteCategory(e.target.value),
              },
                h("option", { value: "", style: ST.option }, t("pickCategory")),
                categories.map((category) => h("option", { key: `paste:${category.dir}`, value: category.dir, style: ST.option }, `${category.dir}${typeof category.count === "number" ? ` (${category.count})` : ""}`))
              ),
              h("button", { style: Object.assign({}, ST.btnTiny, { borderColor: "#6cc98f", color: "#9fe6b5" }), disabled: busy, onClick: moveSelectedToCategory }, t("moveToCategory"))
            ),
            h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "8px" } },
              h("span", { style: ST.groupNote }, t("pasteHint")),
              h("select", {
                "data-role": "pick-root",
                style: Object.assign({}, ST.select, { maxWidth: "240px" }),
                value: pasteRoot,
                onChange: (e) => setPasteRoot(e.target.value),
              },
                h("option", { value: "", style: ST.option }, t("pasteRoot")),
                writableRoots.map((root) => h("option", {
                  key: root.label,
                  value: root.path,
                  title: root.path,
                  style: ST.option,
                }, root.title || root.label))
              ),
              h("label", { style: { display: "flex", gap: "6px", alignItems: "center", fontSize: "12.5px", cursor: "pointer" } },
                h("input", { type: "checkbox", checked: pasteKeep, style: { cursor: "pointer", margin: 0 }, onChange: (e) => setPasteKeep(!!e.target.checked) }),
                t("pasteKeep")
              ),
              h("button", { style: Object.assign({}, ST.btnTiny, { borderColor: "#4a7dff" }), disabled: busy, onClick: pasteSelected }, t("pasteTo"))
            )
          ) : null,
          error ? h("div", { style: ST.err }, t("failed") + error) : null,
          body,
          installModal,
          toast ? h("div", { style: ST.toast }, toast) : null
        );
      } catch (e) {
        const message = String((e && e.message) || e);
        return h("div", { style: Object.assign({}, ST.root) },
          h("div", { style: ST.err }, t("renderError", { msg: message }))
        );
      }
    }

    // 模块级状态：记录"上次看到的已完成任务数"，避免每次渲染都触发刷新
    let lastDoneCount = 0;
    function joinHint(data) {
      const roots = Array.isArray(data.roots) ? data.roots : [];
      const userRoot = roots.find((root) => root.label === "user-dsh");
      return userRoot ? userRoot.path : "?";
    }

    const inject = ["slots", "locale", "remote"];

    function apply(ctx) {
      try {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-skill-vault: dictionaries");
      } catch { /* ignore */ }

      let t;
      try { t = makeT(ctx.locale.bind(NS)); } catch { t = makeT(null); }

      try {
        ctx.slots.inject("main", () => ctx.slots.register({
          name: "main",
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, VaultPage));
      } catch (e) {
        try { console.error("[dsh-skill-vault] main panel registration failed", e); } catch { /* ignore */ }
      }

      try {
        ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 7,
          locale: NS,
          label: () => t("panel"),
        }, VaultIcon));
      } catch (e) {
        try { console.error("[dsh-skill-vault] sidebar registration failed", e); } catch { /* ignore */ }
      }
    }

    exports.name = "dsh-skill-vault";
    exports.inject = inject;
    exports.apply = apply;
    exports.PANEL_ID = PANEL_ID;
    return module.exports;
  },
});
