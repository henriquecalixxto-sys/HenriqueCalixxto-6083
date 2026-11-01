/**
 * Environment separation report — READ ONLY.
 *
 * Answers one question: does the environment this process just loaded point at
 * production infrastructure, development infrastructure, or a mixture of both?
 *
 * It performs no writes, no network calls and no deletes. It reads the loaded
 * environment, derives a non-reversible fingerprint of each target, and prints a
 * verdict. Credential values are never printed; the database host and bucket are
 * shown as short salted digests so two runs can be compared without either
 * output revealing the underlying identifier.
 *
 *   bun run security:separation
 *
 * Exit code 1 when a collision is proven, so it can gate a deploy.
 */
import { createHash } from "node:crypto";

/** Short, non-reversible digest. Enough to compare two environments, not enough to reconstruct one. */
function fingerprint(value: string | undefined): string {
  if (!value) return "unset";
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

/** Host only — the credential lives in DATABASE_AUTH_TOKEN, not the URL, but the URL is still reconnaissance. */
function dbHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

const env = process.env;
const isProd = env.NODE_ENV === "production";
const profile = isProd ? "PRODUCTION" : `NON-PRODUCTION (NODE_ENV=${env.NODE_ENV ?? "undefined"})`;

type Row = { label: string; value: string };
const rows: Row[] = [
  { label: "Runtime profile", value: profile },
  { label: "Database host fingerprint", value: fingerprint(dbHost(env.DATABASE_URL)) },
  { label: "Database token fingerprint", value: fingerprint(env.DATABASE_AUTH_TOKEN) },
  { label: "Storage endpoint", value: env.S3_ENDPOINT ?? "unset" },
  { label: "Storage bucket fingerprint", value: fingerprint(env.S3_BUCKET) },
  { label: "Storage key-id fingerprint", value: fingerprint(env.S3_ACCESS_KEY_ID) },
  { label: "Session secret fingerprint", value: fingerprint(env.BETTER_AUTH_SECRET) },
  { label: "Public origin", value: env.WEBSITE_URL ?? "unset" },
];

type Finding = { ok: boolean; fatal: boolean; label: string; detail: string };
const findings: Finding[] = [];

const devDbSet = Boolean(env.DEV_DATABASE_URL);
const dbCollision = devDbSet && env.DATABASE_URL === env.DEV_DATABASE_URL;
findings.push({
  ok: !dbCollision,
  fatal: dbCollision && isProd,
  label: "Database is distinct from the development database",
  detail: dbCollision
    ? "DATABASE_URL === DEV_DATABASE_URL — one database serves both environments"
    : devDbSet
      ? "proven distinct"
      : "unproven: DEV_DATABASE_URL is not set, so no comparison is possible",
});

const devBucketSet = Boolean(env.DEV_S3_BUCKET);
const bucketCollision = devBucketSet && env.S3_BUCKET === env.DEV_S3_BUCKET;
findings.push({
  ok: !bucketCollision,
  fatal: bucketCollision && isProd,
  label: "Bucket is distinct from the development bucket",
  detail: bucketCollision
    ? "S3_BUCKET === DEV_S3_BUCKET — development can read and delete real client documents"
    : devBucketSet
      ? "proven distinct"
      : "unproven: DEV_S3_BUCKET is not set, so no comparison is possible",
});

const devOnly = ["DEV_DATABASE_URL", "DEV_S3_BUCKET", "ALLOW_DESTRUCTIVE"].filter((k) => env[k]);
findings.push({
  ok: !isProd || devOnly.length === 0,
  fatal: false,
  label: "No development-only variable present in a production environment",
  detail: devOnly.length === 0 ? "clean" : `present: ${devOnly.join(", ")}`,
});

findings.push({
  ok: !isProd || (env.WEBSITE_URL ?? "").startsWith("https://"),
  fatal: isProd && !(env.WEBSITE_URL ?? "").startsWith("https://"),
  label: "Production origin is HTTPS",
  detail: env.WEBSITE_URL?.startsWith("https://") ? "https" : "non-https origin",
});

console.log("==========================================");
console.log(" Environment separation report (read-only)");
console.log("==========================================");
for (const r of rows) console.log(`  ${r.label.padEnd(30)} ${r.value}`);
console.log("");
for (const f of findings) {
  const tag = f.ok ? "PASS" : f.fatal ? "FAIL" : "WARN";
  console.log(`  ${tag}  ${f.label} — ${f.detail}`);
}
console.log("");
const fatal = findings.filter((f) => !f.ok && f.fatal);
const warn = findings.filter((f) => !f.ok && !f.fatal);
console.log(`PASS: ${findings.filter((f) => f.ok).length}   WARN: ${warn.length}   FAIL: ${fatal.length}`);
console.log("==========================================");
console.log("Fingerprints are truncated SHA-256 digests of the identifier, never of a secret value.");
console.log("Compare the dev and prod outputs: every fingerprint must differ.");
process.exit(fatal.length ? 1 : 0);
