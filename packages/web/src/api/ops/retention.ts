/**
 * Data retention enforcement.
 *
 * Client paperwork is the most sensitive thing this system holds. Every extra
 * month it is retained is a month it can be stolen, subpoenaed or leaked, with
 * no corresponding business value once the matter is closed. This job deletes
 * what is past its retention window, from object storage first and the database
 * second, so a crash mid-run can never leave an orphaned readable object.
 *
 * Dry run by default.
 *
 *   bun run retention                    # report only
 *   bun run retention -- --apply         # actually delete
 *   bun run retention -- --days 365 --apply
 */
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { lt, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { s3 } from "../lib/s3";
import {
  AUDIT_RETENTION_DAYS,
  DOCUMENT_RETENTION_DAYS,
  LOGIN_ATTEMPT_RETENTION_DAYS,
  RESOLVED_INQUIRY_RETENTION_DAYS,
} from "./retention-policy";

/** Defaults. Override per-run with --days / env. */
export {
  AUDIT_RETENTION_DAYS,
  DOCUMENT_RETENTION_DAYS,
  LOGIN_ATTEMPT_RETENTION_DAYS,
  RESOLVED_INQUIRY_RETENTION_DAYS,
} from "./retention-policy";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function cutoff(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function runRetention(opts: { apply: boolean; documentDays: number }) {
  const { apply, documentDays } = opts;
  const label = apply ? "DELETING" : "would delete";

  // ---- Client documents -------------------------------------------------
  const docCutoff = cutoff(documentDays);
  const stale = await db.select().from(schema.documents).where(lt(schema.documents.createdAt, docCutoff));

  console.log(`\nDocuments older than ${documentDays} days (before ${docCutoff.toISOString().slice(0, 10)}):`);
  if (stale.length === 0) console.log("  none");

  for (const doc of stale) {
    console.log(`  ${label}  #${doc.id}  ${doc.filename}  (${doc.createdAt.toISOString().slice(0, 10)})`);
    if (!apply) continue;
    try {
      // Object storage first: if this fails we stop, rather than dropping the
      // database row that tells us the object exists.
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: doc.key }));
    } catch (err) {
      console.error(`    ! object delete failed, keeping DB row: ${(err as Error).message}`);
      continue;
    }
    await db.delete(schema.documents).where(sql`${schema.documents.id} = ${doc.id}`);
    await db.insert(schema.auditLogs).values({
      actorId: null,
      actorRole: "system",
      action: "document.deleted",
      targetType: "document",
      targetId: String(doc.id),
      outcome: "success",
      meta: JSON.stringify({ reason: "retention", retentionDays: documentDays }),
    });
  }

  // ---- Audit log --------------------------------------------------------
  const auditCutoff = cutoff(AUDIT_RETENTION_DAYS);
  const auditRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.auditLogs)
    .where(lt(schema.auditLogs.createdAt, auditCutoff));
  const auditCount = Number(auditRows[0]?.n ?? 0);
  console.log(`\nAudit records older than ${AUDIT_RETENTION_DAYS} days: ${label} ${auditCount}`);
  if (apply && auditCount) {
    await db.delete(schema.auditLogs).where(lt(schema.auditLogs.createdAt, auditCutoff));
  }

  // ---- Login attempt telemetry -----------------------------------------
  const attemptCutoff = cutoff(LOGIN_ATTEMPT_RETENTION_DAYS);
  const attemptRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.loginAttempts)
    .where(lt(schema.loginAttempts.createdAt, attemptCutoff));
  const attemptCount = Number(attemptRows[0]?.n ?? 0);
  console.log(`Login attempts older than ${LOGIN_ATTEMPT_RETENTION_DAYS} days: ${label} ${attemptCount}`);
  if (apply && attemptCount) {
    await db.delete(schema.loginAttempts).where(lt(schema.loginAttempts.createdAt, attemptCutoff));
  }

  // ---- Contact / quote inquiries ---------------------------------------
  const inquiryCutoff = cutoff(RESOLVED_INQUIRY_RETENTION_DAYS);
  const contactRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.contactMessages)
    .where(lt(schema.contactMessages.createdAt, inquiryCutoff));
  const contactCount = Number(contactRows[0]?.n ?? 0);
  console.log(`Contact messages older than ${RESOLVED_INQUIRY_RETENTION_DAYS} days: ${label} ${contactCount}`);
  if (apply && contactCount) {
    await db.delete(schema.contactMessages).where(lt(schema.contactMessages.createdAt, inquiryCutoff));
  }

  console.log(
    apply
      ? "\nRetention applied."
      : "\nDry run only — nothing was deleted. Re-run with --apply once the list above looks right.",
  );
}

if (import.meta.main) {
  await runRetention({
    apply: process.argv.includes("--apply"),
    documentDays: Number(arg("--days") ?? DOCUMENT_RETENTION_DAYS),
  });
  process.exit(0);
}
