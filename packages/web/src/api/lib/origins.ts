/**
 * Single source of truth for which origins may talk to this API.
 *
 * Previously the API reflected ANY origin back with `credentials: true`, which let
 * any website on the internet issue authenticated requests as a logged-in client
 * and read the responses. This module replaces that with a strict allowlist.
 */

function normalize(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const isDev = process.env.NODE_ENV !== "production";

/** Preview/staging hosts provisioned by the platform for this project. */
const PLATFORM_HOST_SUFFIXES = [".runable.site", ".runable.app", ".runable.com"];

const staticAllowed = new Set<string>(
  [
    normalize(process.env.WEBSITE_URL),
    normalize(process.env.PUBLIC_SITE_URL),
    // Local development hosts for web + Expo web/tunnel.
    ...(isDev
      ? [
          "http://localhost:4200",
          "http://localhost:4300",
          "http://localhost:5173",
          "http://localhost:8081",
          "http://127.0.0.1:4200",
          "http://127.0.0.1:4300",
        ]
      : []),
  ].filter((o): o is string => Boolean(o)),
);

/** Native app schemes used by the Expo client (no browser CORS enforcement, but better-auth checks them). */
export const MOBILE_ORIGINS = ["mobile://", "calixto-agency://"];

export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  if (MOBILE_ORIGINS.includes(origin)) return true;
  const normalized = normalize(origin);
  if (!normalized) return false;
  if (staticAllowed.has(normalized)) return true;

  // Platform-provisioned preview domains over HTTPS only.
  try {
    const { protocol, hostname } = new URL(normalized);
    if (protocol !== "https:") return false;
    return PLATFORM_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

/** For hono/cors — returns the origin to echo, or null to deny. */
export function corsOrigin(origin: string): string | null {
  return isAllowedOrigin(origin) ? origin : null;
}

/** For better-auth `trustedOrigins`. Never falls back to "*". */
export function trustedOrigins(): string[] {
  return [...staticAllowed, ...MOBILE_ORIGINS];
}
