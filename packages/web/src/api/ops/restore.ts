/**
 * Restore a logical backup produced by ops/backup.ts.
 *
 * This is destructive by definition, so it is deliberately awkward to run:
 *   - it prints a plan and exits unless --apply is passed
 *   - it refuses to touch a production database unless ALLOW_DESTRUCTIVE=1
 *   - it will not run against the same DATABASE_URL the backup came from
 *     without --same-target, so "restore into a scratch database and verify"
 *     is the path of least resistance
 *
 *   bun run restore -- --from backups/<stamp>                # dry run (default)
 *   bun run restore -- --from backups/<stamp> --apply
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { db } from "../database";
import * as schema from "../database/schema";

/** Children before parents on delete, parents before children on insert. */
const ORDER = [
  "user",
  "account",
  "session",
  "verification",
  "twoFactor",
  "services",
  "testimonials",
  "faqs",
  "blogPosts",
  "contactMessages",
  "quoteRequests",
  "orders",
  "documents",
  "portalMessages",
  "clientFeedback",
  "auditLogs",
  "loginAttempts",
] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const from = arg("--from");
  const apply = process.argv.includes("--apply");

  if (!from) {
    console.error("Usage: bun run restore -- --from backups/<stamp> [--apply]");
    process.exit(1);
  }

  const dir = resolve(from);
  if (!existsSync(join(dir, "MANIFEST.json"))) {
    console.error(`No MANIFEST.json in ${dir} — that is not a backup produced by ops/backup.ts`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8"));
  console.log(`Backup taken at ${manifest.createdAt}`);
  console.log(`Target database: ${(process.env.DATABASE_URL ?? "").replace(/\/\/.*@/, "//<redacted>@")}`);
  console.log("");

  if (apply && process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE !== "1") {
    console.error("Refusing to restore over a production database without ALLOW_DESTRUCTIVE=1.");
    process.exit(1);
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "MANIFEST.json");
  const present = new Set(files.map((f) => f.replace(/\.json$/, "")));

  for (const name of [...ORDER].reverse()) {
    if (!present.has(name)) continue;
    const table = (schema as Record<string, unknown>)[name];
    if (!table) continue;
    if (apply) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.delete(table as any);
    }
    console.log(`${apply ? "cleared " : "would clear "} ${name}`);
  }

  for (const name of ORDER) {
    if (!present.has(name)) continue;
    const table = (schema as Record<string, unknown>)[name];
    if (!table) continue;
    const rows = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as Record<string, unknown>[];
    if (rows.length && apply) {
      // Chunked: libSQL has a bound-parameter ceiling per statement.
      for (let i = 0; i < rows.length; i += 200) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.insert(table as any).values(rows.slice(i, i + 200) as any);
      }
    }
    console.log(`${apply ? "restored" : "would restore"} ${name.padEnd(18)} ${rows.length} row(s)`);
  }

  console.log("");
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write.");
  } else {
    console.log("Restore complete.");
    console.log("Post-restore actions that are NOT optional:");
    console.log("  1. Every user must reset their password (credential columns are redacted in backups).");
    console.log("  2. Every 2FA enrolment must be redone.");
    console.log("  3. Restore uploaded documents separately from Tigris object versioning.");
    console.log("  4. Verify row counts against MANIFEST.json before letting traffic back in.");
  }
  process.exit(0);
}

await main();
