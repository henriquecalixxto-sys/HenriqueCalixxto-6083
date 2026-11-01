import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { clientIp } from "../middleware/rate-limit";

/**
 * Credential-stuffing defence, layer 2.
 *
 * better-auth's rate limiter is keyed by IP, which a distributed attacker can
 * trivially spread out. This module tracks failures per *account identifier*
 * as well, so a single account cannot be ground down from a botnet, and it
 * records every attempt so the admin security view can show what was tried.
 *
 * Deliberate design choices:
 *  - Only the email identifier is stored. The submitted password is never read,
 *    hashed, logged or persisted anywhere in this path.
 *  - The lockout is temporary (a cooldown, not a permanent disable) so it cannot
 *    be weaponised to lock a real customer out of their account indefinitely.
 *  - The response for a locked account is deliberately generic and identical in
 *    shape whether or not the account exists, so it is not a user-enumeration oracle.
 */

export const LOCKOUT_THRESHOLD = 8;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !email.includes("@")) return null;
  return email;
}

export async function recordLoginAttempt(opts: {
  email: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
}) {
  try {
    await db.insert(schema.loginAttempts).values({
      email: opts.email,
      ip: opts.ip,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      success: opts.success,
    });
  } catch (err) {
    console.error("[login-guard] failed to record attempt", (err as Error).message);
  }
}

/** Number of failures for this identifier inside the rolling window. */
export async function recentFailures(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.loginAttempts)
    .where(
      and(
        eq(schema.loginAttempts.email, email),
        eq(schema.loginAttempts.success, false),
        gte(schema.loginAttempts.createdAt, since),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export async function isLockedOut(email: string): Promise<boolean> {
  return (await recentFailures(email)) >= LOCKOUT_THRESHOLD;
}

/** Successful sign-in clears the cooldown so a legitimate user is never stuck. */
export async function clearFailures(email: string) {
  await db
    .delete(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.success, false)));
}

/** Housekeeping: attempt history is security telemetry, not a permanent record. */
export async function pruneOldAttempts() {
  const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_MS);
  await db.delete(schema.loginAttempts).where(sql`${schema.loginAttempts.createdAt} < ${cutoff.getTime()}`);
}

export async function listRecentAttempts(limit = 50) {
  return db
    .select({
      id: schema.loginAttempts.id,
      email: schema.loginAttempts.email,
      ip: schema.loginAttempts.ip,
      success: schema.loginAttempts.success,
      createdAt: schema.loginAttempts.createdAt,
    })
    .from(schema.loginAttempts)
    .orderBy(desc(schema.loginAttempts.createdAt))
    .limit(Math.min(limit, 200));
}

/**
 * Wraps the better-auth handler for email sign-in.
 * Returns a Response to short-circuit (locked out), or null to continue.
 */
export async function preSignIn(
  request: Request,
): Promise<{ blocked: Response } | { email: string | null; ip: string; userAgent: string | null }> {
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  let email: string | null = null;
  try {
    const cloned = request.clone();
    const body = (await cloned.json()) as Record<string, unknown> | null;
    email = normaliseEmail(body?.email);
  } catch {
    email = null;
  }

  if (email && (await isLockedOut(email))) {
    await recordLoginAttempt({ email, ip, userAgent, success: false });
    return {
      blocked: Response.json(
        {
          message:
            "Too many failed sign-in attempts for this account. For your protection, sign-in is paused for 15 minutes.",
          code: "ACCOUNT_TEMPORARILY_LOCKED",
        },
        { status: 423, headers: { "Retry-After": String(Math.ceil(LOCKOUT_WINDOW_MS / 1000)) } },
      ),
    };
  }

  return { email, ip, userAgent };
}
