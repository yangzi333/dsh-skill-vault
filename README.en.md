# dsh-skill-vault

A read-only skill inventory + a curated skill library for **DeepSeek Harness (DSH)**.

The panel adds a sidebar entry that aggregates every skill source DSH can see
(`user-dsh`, `user-agents`, `project-*`, `preset:*`, `plugin:*`, bundled `app.asar`
skills), groups them by category titles you control, and lets you harvest a copy
into your own library — **without editing a single source skill**.

## What it does

| Area | Capability |
|---|---|
| All skills | Aggregate 6 source kinds; group by 9 built-in categories + your own titles; collapsible groups; search; per-card checkbox; tags for duplicate / disabled / invalid frontmatter / builtin-not-copyable |
| Selection bar | Harvest selected, save selection as a bundle, deselect, **move into a category title** (auto-harvest if not in library, move if it is), **paste into a skill root** |
| Library | Category-title manager (add custom titles, delete empty custom ones); re-categorize any item via a dropdown; take an item out of the library |
| Bundles | Save a named set of skills to `<library>/.library/bundles/*.json`, then harvest the whole bundle in one action |
| Tasks | Download (`.zip` / `.tar.gz` / `.md` / local path) with live progress; cancel at checkpoints; retry remaining items; remove records; auto-clear on finish |
| Live calls | Which skill the model is loading **right now** (wraps `skills.get()`), with scope/cwd, 60-second TTL |
| Safety | Sources are read-only (tests compare `sha256 + mtime`); the only write target is the library; duplicate names never overwrite; every root write needs an explicit switch; 10-minute undo stack; audit log |

## Install (DSH desktop)

```powershell
dsh-skill-vault\install.cmd
# restart DeepSeek Harness afterwards; verify: http://127.0.0.1:59893/skill-vault/ping
```

The installer copies the plugin, registers it in the profile `package.json`
(with a backup), runs `pnpm install` (falling back to the bundled pnpm) and
verifies the `node_modules` link before exiting.

## Tests

```powershell
node tests/run-tests.mjs        # 180 host + 118 client assertions
```

CI runs the same entry on Ubuntu/Windows × Node 20/22.

## Endpoints (23)

`ping`, `catalog`, `library`, `tasks`, `tasks/cancel`, `tasks/retry`, `tasks/clear`,
`download`, `harvest`, `harvest-batch`, `bundles`, `categories`, `categories/remove`,
`paste`, `move`, `remove`, `takeout` (legacy alias), `settings`, `audit`, `undo`,
`stream` (SSE), `invocations`, `reveal`.

All endpoints enforce a same-origin check (`sec-fetch-site` / `origin` / `Host`),
cap request bodies at 1 MiB and whitelist skill names.

## Notes

- Targets DSH `0.2.x`; it relies on documented-ish internals (`skills` service,
  `ctx.slots`, `webServer.register`), so a DSH major bump may need a patch.
- Writing into skill roots is **off by default** — enable it in the Tasks tab.
- The library lives at `<DSH_HOME>/skill-library/` and is never auto-loaded by DSH;
  use “paste into root” when you actually want a skill to go live.

License: MIT.
