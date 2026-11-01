/**
 * Guard for maintenance scripts that write to or delete from the database.
 *
 * Seed and purge scripts are the classic "ran it against prod by accident"
 * footgun: they are convenient, they are in the repo, and they take no
 * arguments. This refuses to run them when NODE_ENV=production unless the
 * operator opts in explicitly for that single invocation.
 */
export function guardDestructiveScript(name: string) {
  const isProd = process.env.NODE_ENV === "production";
  const override = process.env.ALLOW_DESTRUCTIVE === "1";

  if (isProd && !override) {
    console.error(
      `Refusing to run "${name}" against a production environment.\n` +
        `If this is genuinely intended, take a backup first (bun run backup) and re-run with:\n` +
        `  ALLOW_DESTRUCTIVE=1 bun run ${name}`,
    );
    process.exit(1);
  }

  if (isProd && override) {
    console.warn(`[guard] "${name}" running against PRODUCTION by explicit override.`);
  }
}
