import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";
import { content } from "./routes/content";
import { inquiries } from "./routes/inquiries";
import { portal } from "./routes/portal";
import { feedback } from "./routes/feedback";
import { audit as auditRoutes } from "./routes/audit";
import { security } from "./routes/security";
import { docs } from "./routes/docs";
import { securityHeaders } from "./middleware/security";
import { __resetRateLimits, rateLimit } from "./middleware/rate-limit";
import { corsOrigin } from "./lib/origins";
import { MAX_JSON_BYTES } from "./lib/validation";
import { assertSecureConfig } from "./lib/env-guard";
import { clearFailures, preSignIn, recordLoginAttempt } from "./lib/login-guard";

const isProd = process.env.NODE_ENV === "production";

// Fail fast rather than serve traffic with a broken security control.
assertSecureConfig();

/**
 * Auth entry point wrapped with per-account failed-login tracking and a
 * temporary lockout. Everything else about the better-auth handler is untouched.
 */
async function handleAuth(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isEmailSignIn = url.pathname.endsWith("/sign-in/email");

  if (!isEmailSignIn) return auth.handler(request);

  const pre = await preSignIn(request);
  if ("blocked" in pre) return pre.blocked;

  const res = await auth.handler(request);

  if (pre.email) {
    const success = res.status >= 200 && res.status < 300;
    await recordLoginAttempt({ email: pre.email, ip: pre.ip, userAgent: pre.userAgent, success });
    if (success) await clearFailures(pre.email);
  }
  return res;
}

const app = new Hono()
  .use(securityHeaders)
  // Behind the platform proxy TLS terminates upstream; refuse plain-HTTP
  // forwards in production instead of downgrading silently.
  .use(async (c, next) => {
    if (isProd) {
      const proto = c.req.header("x-forwarded-proto");
      if (proto && proto.split(",")[0]!.trim() !== "https") {
        return c.json({ message: "HTTPS is required" }, 403);
      }
    }
    return next();
  })
  // Strict origin allowlist. Previously every origin was reflected with
  // credentials enabled, which allowed cross-site authenticated requests.
  .use(
    cors({
      origin: corsOrigin,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "expo-origin"],
      exposeHeaders: ["set-auth-token"],
      maxAge: 600,
    }),
  )
  // Global request-size cap: a single oversized body can no longer exhaust memory.
  .use(bodyLimit({ maxSize: MAX_JSON_BYTES, onError: (c) => c.json({ message: "Request body too large" }, 413) }))
  // Coarse per-IP ceiling across the whole API, on top of the per-route limits.
  .use(rateLimit({ name: "global", limit: 600, windowMs: 60_000 }))
  .onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    // Log server-side with detail, return an opaque message to the client so
    // stack traces and internal identifiers are never disclosed.
    console.error("[api]", c.req.method, c.req.path, err);
    return c.json({ message: isProd ? "Internal server error" : `Internal server error: ${err.message}` }, 500);
  })
  .notFound((c) => c.json({ message: "Not found" }, 404))
  .on(["GET", "POST"], "/api/auth/*", (c) => handleAuth(c.req.raw))
  .basePath("api")
  .route("/", content)
  .route("/", inquiries)
  .route("/portal", portal)
  .route("/feedback", feedback)
  .route("/audit", auditRoutes)
  .route("/security", security)
  .route("/docs", docs)
  // Development-only echo endpoint. Removed from the production surface so it
  // cannot be used as a liveness/timing oracle by an unauthenticated caller.
  .get("/ping", (c) => (isProd ? c.json({ message: "Not found" }, 404) : c.json({ message: `Pong! ${Date.now()}` }, 200)))
  // Development-only rate-limit reset. The security suites deliberately exhaust
  // the public form budgets, so consecutive runs would otherwise report the
  // limiter working as if it were a validation defect. Absent in production —
  // an unauthenticated way to clear rate limits there would remove the very
  // control it exists to test.
  .post("/dev/reset-rate-limits", (c) => {
    if (isProd) return c.json({ message: "Not found" }, 404);
    __resetRateLimits();
    return c.json({ reset: true }, 200);
  })
  .get("/health", (c) => c.json({ status: "ok" }, 200));

export type AppType = typeof app;
export default app;
