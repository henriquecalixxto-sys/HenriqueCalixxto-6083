/**
 * Boot-time configuration guard.
 *
 * Misconfiguration is the most common way a hardened app ships insecurely: a
 * missing secret falls back to a default, a dev database URL is left in place,
 * or the app runs over plain HTTP. This module refuses to start the server in
 * production when any of those are true, and prints warnings in development so
 * the same problems are visible long before launch.
 *
 * It never prints a secret value — only its name and a pass/fail verdict.
 */

export type CheckSeverity = "fatal" | "warn";

export type ConfigCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: CheckSeverity;
  detail: string;
};

const REQUIRED = [
  "DATABASE_URL",
  "DATABASE_AUTH_TOKEN",
  "BETTER_AUTH_SECRET",
  "WEBSITE_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

/** Values that must never appear in a production secret. */
const PLACEHOLDER_PATTERNS = [
  /^changeme/i,
  /^secret$/i,
  /^test/i,
  /^dev(elopment)?$/i,
  /^your[-_]/i,
  /^xxx/i,
  /^placeholder/i,
];

function looksPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value.trim()));
}

/** Shannon entropy per character — a crude but effective "is this random?" test. */
function entropyBits(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bitsPerChar = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bitsPerChar -= p * Math.log2(p);
  }
  return bitsPerChar * value.length;
}

export function runConfigChecks(env: NodeJS.ProcessEnv = process.env): ConfigCheck[] {
  const isProd = env.NODE_ENV === "production";
  const checks: ConfigCheck[] = [];

  for (const name of REQUIRED) {
    const value = env[name];
    checks.push({
      id: `env.${name}`,
      label: `${name} is set`,
      ok: Boolean(value && value.length > 0),
      severity: "fatal",
      detail: value ? "present" : "missing — the app cannot operate securely without it",
    });
    if (value && looksPlaceholder(value)) {
      checks.push({
        id: `env.${name}.placeholder`,
        label: `${name} is not a placeholder`,
        ok: false,
        severity: "fatal",
        detail: "value looks like a template/placeholder rather than a real credential",
      });
    }
  }

  const authSecret = env.BETTER_AUTH_SECRET ?? "";
  checks.push({
    id: "secret.strength",
    label: "BETTER_AUTH_SECRET has sufficient entropy",
    ok: authSecret.length >= 32 && entropyBits(authSecret) >= 128,
    severity: "fatal",
    detail:
      authSecret.length >= 32 && entropyBits(authSecret) >= 128
        ? "≥32 chars and ≥128 bits of entropy"
        : "must be ≥32 random characters (generate with: openssl rand -base64 48)",
  });

  const websiteUrl = env.WEBSITE_URL ?? "";
  checks.push({
    id: "transport.https",
    label: "WEBSITE_URL uses HTTPS",
    ok: !isProd || websiteUrl.startsWith("https://"),
    severity: "fatal",
    detail: websiteUrl.startsWith("https://")
      ? "https"
      : "production cookies are Secure-only; over http the session cookie is never sent and auth silently breaks",
  });

  checks.push({
    id: "db.remote",
    label: "DATABASE_URL points at a managed remote database",
    ok: !isProd || /^libsql:\/\/|^https:\/\//.test(env.DATABASE_URL ?? ""),
    severity: "fatal",
    detail: /^file:/.test(env.DATABASE_URL ?? "")
      ? "a local file database has no backups, no replication and disappears with the container"
      : "remote libsql endpoint",
  });

  // --- Environment separation -------------------------------------------------
  // A shared database or bucket means a development bug, a seed script or a
  // curious developer reaches real client documents. These checks are FATAL when
  // a collision is actually proven (the dev value is set and matches), and only
  // a warning when the dev value is absent — an unset variable proves nothing,
  // and refusing to boot over missing evidence would be a false positive.
  const devDbSet = Boolean(env.DEV_DATABASE_URL);
  const dbCollision = devDbSet && env.DATABASE_URL === env.DEV_DATABASE_URL;
  checks.push({
    id: "db.separation",
    label: "Production database is not the development database",
    ok: !isProd || !dbCollision,
    severity: dbCollision ? "fatal" : "warn",
    detail: dbCollision
      ? "DATABASE_URL is identical to DEV_DATABASE_URL — development and production share one database"
      : devDbSet
        ? "distinct from DEV_DATABASE_URL"
        : "set DEV_DATABASE_URL so this check can prove the two are distinct",
  });

  const devBucketSet = Boolean(env.DEV_S3_BUCKET);
  const bucketCollision = devBucketSet && env.S3_BUCKET === env.DEV_S3_BUCKET;
  checks.push({
    id: "storage.separation",
    label: "Production bucket is not the development bucket",
    ok: !isProd || !bucketCollision,
    severity: bucketCollision ? "fatal" : "warn",
    detail: bucketCollision
      ? "S3_BUCKET is identical to DEV_S3_BUCKET — development can read and delete real client documents"
      : devBucketSet
        ? "distinct from DEV_S3_BUCKET"
        : "set DEV_S3_BUCKET so this check can prove the two are distinct",
  });

  // A production deployment must not carry development-only variables at all.
  // Their presence means the prod environment was copied from a dev .env, which
  // is exactly how a dev credential ends up authenticating production traffic.
  const devOnly = ["DEV_DATABASE_URL", "DEV_S3_BUCKET", "ALLOW_DESTRUCTIVE"].filter((k) => env[k]);
  checks.push({
    id: "env.no_dev_vars_in_prod",
    label: "No development-only variable is present in the production environment",
    ok: !isProd || devOnly.length === 0,
    severity: "warn",
    detail:
      devOnly.length === 0
        ? "clean"
        : `present: ${devOnly.join(", ")} — these belong in a developer's local .env, not in the production secret store`,
  });

  checks.push({
    id: "storage.tls",
    label: "S3_ENDPOINT uses HTTPS",
    ok: (env.S3_ENDPOINT ?? "").startsWith("https://"),
    severity: "fatal",
    detail: "presigned upload/download traffic carries client documents",
  });

  checks.push({
    id: "prod.node_env",
    label: "NODE_ENV is 'production' when serving production traffic",
    ok: isProd,
    severity: "warn",
    detail: isProd
      ? "production"
      : `currently '${env.NODE_ENV ?? "undefined"}' — verbose errors and non-secure cookies are active`,
  });

  // Anything VITE_-prefixed is compiled into the browser bundle in cleartext.
  const leaked = Object.keys(env).filter(
    (k) =>
      k.startsWith("VITE_") &&
      /secret|token|password|private|_key$|apikey|api_key/i.test(k) &&
      !/ISSUER|APPLICATION_ID/i.test(k),
  );
  checks.push({
    id: "secret.client_bundle",
    label: "No secret-shaped variable is exposed to the client bundle",
    ok: leaked.length === 0,
    severity: "fatal",
    detail: leaked.length === 0 ? "clean" : `VITE_-prefixed and secret-shaped: ${leaked.join(", ")}`,
  });

  return checks;
}

/**
 * Called once at server start. Throws in production if a fatal check fails —
 * failing to boot is strictly safer than serving traffic with a broken
 * security control that nobody notices.
 */
export function assertSecureConfig(env: NodeJS.ProcessEnv = process.env): ConfigCheck[] {
  const checks = runConfigChecks(env);
  const fatal = checks.filter((c) => !c.ok && c.severity === "fatal");
  const warn = checks.filter((c) => !c.ok && c.severity === "warn");

  for (const c of warn) console.warn(`[config] WARN  ${c.label} — ${c.detail}`);

  if (fatal.length === 0) return checks;

  const summary = fatal.map((c) => `  - ${c.label}: ${c.detail}`).join("\n");
  if (env.NODE_ENV === "production") {
    throw new Error(`Refusing to start: insecure production configuration.\n${summary}`);
  }
  console.warn(`[config] ${fatal.length} check(s) would block a production boot:\n${summary}`);
  return checks;
}
