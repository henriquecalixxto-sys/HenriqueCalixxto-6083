import type { Context } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { clientIp } from "../middleware/rate-limit";

export type AuditAction =
  | "document.upload_presigned"
  | "document.registered"
  | "document.downloaded"
  | "document.deleted"
  | "document.access_denied"
  | "order.created"
  | "order.updated"
  | "message.sent"
  | "role.changed"
  | "content.created"
  | "content.updated"
  | "content.deleted"
  | "feedback.moderated"
  | "inquiry.updated"
  | "admin.viewed_clients";

/**
 * Append-only security event log.
 *
 * Never pass secrets, tokens, passwords, document contents or message bodies in
 * `meta` — this log is readable by admins and may be exported for incident review.
 * Logging failures are swallowed: an audit write must never break a user action,
 * but it is reported to stderr so the gap is visible in monitoring.
 */
export async function audit(
  c: Context,
  action: AuditAction,
  opts: {
    targetType?: string;
    targetId?: string | number;
    outcome?: "success" | "denied" | "error";
    meta?: Record<string, string | number | boolean | null>;
  } = {},
) {
  try {
    const user = c.get("user") as { id?: string; role?: string } | null;
    await db.insert(schema.auditLogs).values({
      actorId: user?.id ?? null,
      actorRole: user?.role ?? null,
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId != null ? String(opts.targetId) : null,
      outcome: opts.outcome ?? "success",
      ip: clientIp(c.req.raw.headers),
      userAgent: (c.req.header("user-agent") ?? "").slice(0, 300) || null,
      meta: opts.meta ? JSON.stringify(opts.meta).slice(0, 1000) : null,
    });
  } catch (err) {
    console.error("[audit] failed to write audit record", (err as Error).message);
  }
}
