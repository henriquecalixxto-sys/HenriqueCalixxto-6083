/**
 * Prints the production configuration verdict without starting the server.
 * Exit code 1 when any fatal check fails, so it can gate a deploy.
 *
 *   bun run security:config
 *   NODE_ENV=production bun run security:config   # simulate the prod verdict
 */
import { runConfigChecks } from "../lib/env-guard";

const checks = runConfigChecks();
const fatal = checks.filter((c) => !c.ok && c.severity === "fatal");
const warn = checks.filter((c) => !c.ok && c.severity === "warn");

console.log("==========================================");
console.log(` Configuration check (NODE_ENV=${process.env.NODE_ENV ?? "undefined"})`);
console.log("==========================================");
for (const c of checks) {
  const tag = c.ok ? "PASS" : c.severity === "fatal" ? "FAIL" : "WARN";
  console.log(`  ${tag}  ${c.label}${c.ok ? "" : ` — ${c.detail}`}`);
}
console.log("");
console.log(`PASS: ${checks.filter((c) => c.ok).length}   WARN: ${warn.length}   FAIL: ${fatal.length}`);
console.log("==========================================");
if (fatal.length) console.log("A production boot would be REFUSED until the FAIL items are resolved.");
process.exit(fatal.length ? 1 : 0);
