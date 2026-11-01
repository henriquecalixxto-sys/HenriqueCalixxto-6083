import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { authMiddleware, requireAdmin } from "../middleware/auth";

/**
 * Serves the security documentation to authenticated admins only.
 *
 * These documents are deliberately NOT bundled into the client. A go-live
 * runbook is a map of the system's weakest points, its blockers and its
 * unmitigated risks — exactly the reconnaissance an attacker would otherwise
 * have to spend weeks assembling. Shipping it in a public JS bundle would hand
 * that over to anyone who views source.
 *
 * Only an explicit allowlist of filenames is readable; the client never supplies
 * a path, so there is no traversal surface.
 */
const ALLOWED = {
  golive: "GO-LIVE.md",
  audit: "SECURITY-AUDIT.md",
} as const;

type DocId = keyof typeof ALLOWED;

/** Walk up from this file until the directory containing the docs is found. */
function repoRoot(): string {
  // `import.meta.dir` is Bun-only and is undefined under Vite's dev SSR
  // transform, so derive the directory from the module URL instead.
  let dir = resolve(dirname(fileURLToPath(import.meta.url)));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "GO-LIVE.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No fallback to process.cwd(): this module is part of the API type the
  // mobile app imports, and the docs simply are not present in that deployment.
  return resolve(dirname(fileURLToPath(import.meta.url)));
}

export const docs = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAdmin)
  .get("/:id", (c) => {
    const id = c.req.param("id") as DocId;
    const filename = ALLOWED[id];
    if (!filename) return c.json({ message: "Not found" }, 404);

    const path = join(repoRoot(), filename);
    if (!existsSync(path)) {
      return c.json({ message: "Document is not available in this deployment" }, 404);
    }

    return c.json({ id, filename, markdown: readFileSync(path, "utf8") }, 200);
  });
