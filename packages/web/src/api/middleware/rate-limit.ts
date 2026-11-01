import { createMiddleware } from "hono/factory";

/**
 * Fixed-window in-memory rate limiter.
 *
 * Scope/limitation: state lives in the process, so with multiple instances the
 * effective limit is (limit x instances). For this single-instance deployment
 * that is acceptable; if the app is horizontally scaled, swap the `hits` Map for
 * Redis/Turso-backed counters — the middleware signature stays the same.
 */
type Bucket = { count: number; resetAt: number };
const hits = new Map<string, Bucket>();

// Opportunistic sweep so the map cannot grow unbounded (memory DoS).
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of hits) if (bucket.resetAt <= now) hits.delete(key);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit({
  name,
  limit,
  windowMs,
  by = "ip",
}: {
  name: string;
  limit: number;
  windowMs: number;
  /** "ip" for anonymous endpoints, "user" to also key on the authenticated subject. */
  by?: "ip" | "user";
}) {
  return createMiddleware(async (c, next) => {
    const now = Date.now();
    sweep(now);

    const ip = clientIp(c.req.raw.headers);
    const subject = by === "user" ? ((c.get("user") as { id?: string } | null)?.id ?? ip) : ip;
    const key = `${name}:${subject}`;

    const bucket = hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > limit) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        c.header("Retry-After", String(retryAfter));
        c.header("RateLimit-Limit", String(limit));
        c.header("RateLimit-Remaining", "0");
        return c.json({ message: "Too many requests. Please slow down and try again shortly." }, 429);
      }
      c.header("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    }
    c.header("RateLimit-Limit", String(limit));
    return next();
  });
}

/** Reset all counters — test helper only. */
export function __resetRateLimits() {
  hits.clear();
}
