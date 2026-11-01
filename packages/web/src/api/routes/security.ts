import { Hono } from "hono";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { runConfigChecks } from "../lib/env-guard";
import { LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MS, listRecentAttempts } from "../lib/login-guard";
import { mailerConfigured } from "../lib/mailer";
import { AUDIT_RETENTION_DAYS, DOCUMENT_RETENTION_DAYS } from "../ops/retention-policy";

/**
 * Admin-only security posture endpoint.
 *
 * Everything here is derived server-side; nothing is trusted from the client.
 * Config checks are returned as label + verdict only — never the underlying
 * values — so this response is safe even if it is screenshotted or exported.
 */
export const security = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAdmin)
  .get("/overview", async (c) => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);

    const [failed24h] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.loginAttempts)
      .where(and(eq(schema.loginAttempts.success, false), gte(schema.loginAttempts.createdAt, dayAgo)));

    const [denied24h] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.outcome, "denied"), gte(schema.auditLogs.createdAt, dayAgo)));

    // Accounts currently inside the lockout cooldown.
    const lockedRows = await db
      .select({ email: schema.loginAttempts.email, n: sql<number>`count(*)` })
      .from(schema.loginAttempts)
      .where(and(eq(schema.loginAttempts.success, false), gte(schema.loginAttempts.createdAt, windowStart)))
      .groupBy(schema.loginAttempts.email)
      .having(sql`count(*) >= ${LOCKOUT_THRESHOLD}`);

    const admins = await db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        name: schema.user.name,
        twoFactorEnabled: schema.user.twoFactorEnabled,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(eq(schema.user.role, "admin"));

    const [docCount] = await db.select({ n: sql<number>`count(*)` }).from(schema.documents);
    const [oldestDoc] = await db
      .select({ createdAt: schema.documents.createdAt })
      .from(schema.documents)
      .orderBy(schema.documents.createdAt)
      .limit(1);

    return c.json(
      {
        config: runConfigChecks().map((k) => ({
          id: k.id,
          label: k.label,
          ok: k.ok,
          severity: k.severity,
          detail: k.detail,
        })),
        auth: {
          adminCount: admins.length,
          adminsWithout2fa: admins.filter((a) => !a.twoFactorEnabled).length,
          admins: admins.map((a) => ({ email: a.email, name: a.name, twoFactorEnabled: Boolean(a.twoFactorEnabled) })),
          passwordResetEmailConfigured: mailerConfigured(),
          lockoutThreshold: LOCKOUT_THRESHOLD,
          lockoutWindowMinutes: LOCKOUT_WINDOW_MS / 60000,
          lockedAccounts: lockedRows.length,
        },
        activity: {
          failedLogins24h: Number(failed24h?.n ?? 0),
          deniedAccess24h: Number(denied24h?.n ?? 0),
        },
        retention: {
          documentRetentionDays: DOCUMENT_RETENTION_DAYS,
          auditRetentionDays: AUDIT_RETENTION_DAYS,
          documentCount: Number(docCount?.n ?? 0),
          oldestDocumentAt: oldestDoc?.createdAt ?? null,
        },
      },
      200,
    );
  })
  /** Recent sign-in attempts. Email identifier only — never any password material. */
  .get("/login-attempts", async (c) => {
    const limitRaw = Number(c.req.query("limit") ?? 50);
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    return c.json({ attempts: await listRecentAttempts(limit) }, 200);
  })
  /**
   * Clear a lockout cooldown for one account. Support action for a customer who
   * locked themselves out — it does not change the password and is audit-logged.
   */
  .post("/unlock", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@") || email.length > 320) {
      return c.json({ message: "A valid email is required" }, 400);
    }
    await db
      .delete(schema.loginAttempts)
      .where(and(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.success, false)));

    const actor = c.get("user") as { id?: string; role?: string } | null;
    await db.insert(schema.auditLogs).values({
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      action: "role.changed",
      targetType: "account_lockout",
      targetId: email,
      outcome: "success",
      meta: JSON.stringify({ operation: "lockout_cleared" }),
    });
    return c.json({ ok: true }, 200);
  });
