import { createMiddleware } from "hono/factory";

const isProd = process.env.NODE_ENV === "production";

/**
 * Baseline security headers for every API response.
 *
 * Note on framing: the platform renders the site inside a preview iframe, so we do
 * NOT send `X-Frame-Options: DENY`. Clickjacking is instead controlled with a CSP
 * `frame-ancestors` allowlist (see buildCsp) which is strictly more expressive and
 * is what modern browsers honour.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-site");
  c.header("X-Permitted-Cross-Domain-Policies", "none");
  // API responses must never be cached by shared caches — they carry per-user data.
  if (!c.res.headers.has("Cache-Control")) {
    c.header("Cache-Control", "no-store, private");
  }
  if (isProd) {
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
});

/**
 * Content-Security-Policy for HTML documents (applied by the production server).
 * Kept in one place so the policy cannot drift between environments.
 */
export function buildCsp(): string {
  const frameAncestors = ["'self'", "https://*.runable.com", "https://*.runable.site", "https://*.runable.app"];
  return [
    "default-src 'self'",
    // Vite emits a module preload + the analytics snippet; no remote script origins are needed.
    `script-src 'self' 'unsafe-inline'`,
    // Tailwind injects inline styles; Google Fonts stylesheets are remote.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    // API, S3 presigned uploads/downloads, analytics collector.
    "connect-src 'self' https://t3.storage.dev https://*.t3.storage.dev https://r.lilstts.com https://api.runable.com",
    // Google Maps embed on the contact page.
    "frame-src https://www.google.com https://maps.google.com",
    `frame-ancestors ${frameAncestors.join(" ")}`,
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Headers attached to HTML/static responses in production (`src/server.ts`). */
export function documentSecurityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": buildCsp(),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    ...(isProd ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" } : {}),
  };
}
