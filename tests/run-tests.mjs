/**
 * 纯 Node 测试入口（CI / 没有 DSH 的环境也能跑）。
 *   node tests/run-tests.mjs
 * 两边任一失败都以非 0 退出。
 *
 * 注意：用 stdio: "inherit" 而不是管道——受限沙箱里子进程无法开命名管道。
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const suites = [
  ["host", join(here, "vault-host-test.mjs")],
  ["client", join(here, "vault-client-test.mjs")],
];

let failed = 0;
for (const [label, file] of suites) {
  process.stdout.write(`\n==== ${label} half ====\n`);
  const result = spawnSync(process.execPath, [file], { stdio: "inherit" });
  if (result.status !== 0) {
    failed += 1;
    process.stdout.write(`\n[x] ${label} suite failed (exit ${result.status})\n`);
  }
}

process.stdout.write(failed === 0 ? "\n[ok] all suites passed\n" : `\n[x] ${failed} suite(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
