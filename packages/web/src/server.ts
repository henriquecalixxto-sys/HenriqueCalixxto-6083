import path from "node:path";
import app from "./api";
import { documentSecurityHeaders } from "./api/middleware/security";

const port = Number(process.env.PORT ?? 3000);
const distDir = path.resolve(`${import.meta.dir}/../dist`);
const indexPath = path.join(distDir, "index.html");

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  ...documentSecurityHeaders(),
};

const server = Bun.serve({
  port,
  // Hard cap on request size at the transport layer (defence in depth alongside
  // the Hono bodyLimit middleware).
  maxRequestBodySize: 32 * 1024 * 1024,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      return app.fetch(request);
    }

    const filePath = resolveStaticPath(url.pathname);
    if (filePath) {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "X-Content-Type-Options": "nosniff",
            // Hashed Vite assets are immutable; everything else stays revalidated.
            "Cache-Control": url.pathname.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "public, max-age=0, must-revalidate",
          },
        });
      }
    }

    const index = Bun.file(indexPath);
    if (await index.exists()) {
      return new Response(index, { headers: HTML_HEADERS });
    }

    return new Response("Build output not found. Run `bun run build` first.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
});

console.log(`Web server listening on http://localhost:${server.port}`);

/**
 * Containment-based path resolution.
 *
 * The previous implementation stripped ".." substrings from the decoded path — a
 * denylist. This normalises the path and then verifies the result is still inside
 * `distDir`, which is the only reliable way to stop traversal (including encoded,
 * double-encoded and unicode variants). Returns null when the path escapes.
 */
function resolveStaticPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  // Reject NUL bytes and backslash separators outright.
  if (decoded.includes("\0") || decoded.includes("\\")) return null;

  const relative = decoded.replace(/^\/+/, "");
  if (!relative) return null;

  const resolved = path.resolve(distDir, relative);
  const withinDist = resolved === distDir || resolved.startsWith(distDir + path.sep);
  return withinDist ? resolved : null;
}
