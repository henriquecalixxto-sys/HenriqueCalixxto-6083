/**
 * Logical database backup.
 *
 * Turso's own point-in-time recovery is the primary safety net, but it lives in
 * the same account as the database it protects: if that account is lost,
 * compromised or closed, the backups go with it. This produces a portable,
 * off-platform JSON snapshot that can be restored anywhere.
 *
 * Read-only. Safe to run against production.
 *
 *   bun run backup                 # writes backups/<timestamp>/
 *   bun run backup -- --out /path  # custom destination
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { db } from "../database";
import * as schema from "../database/schema";

/**
 * Tables included in a backup. `rate_limit` is deliberately excluded — it is
 * ephemeral counter state and restoring it would resurrect stale limits.
 */
const TABLES = [
  "user",
  "session",
  "account",
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

/**
 * Columns that must never be written to a backup file in readable form.
 * A backup is a copy of the database with none of the database's access
 * controls, so credential material is redacted rather than duplicated.
 */
const REDACT: Record<string, string[]> = {
  account: ["password", "accessToken", "refreshToken", "idToken"],
  session: ["token"],
  twoFactor: ["secret", "backupCodes"],
  verification: ["value"],
};

function redactRow(table: string, row: Record<string, unknown>) {
  const fields = REDACT[table];
  if (!fields) return row;
  const copy = { ...row };
  for (const f of fields) if (copy[f] != null) copy[f] = "__REDACTED__";
  return copy;
}

export async function backup(outDir?: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(outDir ?? join(process.cwd(), "backups", stamp));
  mkdirSync(dir, { recursive: true });

  const manifest: Record<string, number> = {};

  for (const name of TABLES) {
    const table = (schema as Record<string, unknown>)[name];
    if (!table) {
      console.warn(`[backup] skipping unknown table export "${name}"`);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await db.select().from(table as any)) as Record<string, unknown>[];
    const safe = rows.map((r) => redactRow(name, r));
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(safe, null, 2));
    manifest[name] = safe.length;
    console.log(`  ${name.padEnd(18)} ${safe.length} row(s)`);
  }

  writeFileSync(
    join(dir, "MANIFEST.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
        tables: manifest,
        redactedColumns: REDACT,
        note:
          "Credential columns are redacted. Restoring this snapshot restores data and audit history, " +
          "but every user must reset their password and re-enrol 2FA. Uploaded documents live in object " +
          "storage and are NOT included here — restore them from Tigris object versioning.",
      },
      null,
      2,
    ),
  );

  console.log(`\nBackup written to ${dir}`);
  return dir;
}

if (import.meta.main) {
  const outFlag = process.argv.indexOf("--out");
  await backup(outFlag > -1 ? process.argv[outFlag + 1] : undefined);
  process.exit(0);
}
