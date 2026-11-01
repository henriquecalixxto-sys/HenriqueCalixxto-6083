/**
 * Removes throwaway accounts created by the security test suites and any legacy
 * seeded test account, plus their orders, documents (DB rows + stored objects)
 * and message threads.
 *
 * Run before going to production:  bun --env-file=../../.env run src/api/purge-test-accounts.ts
 */
import { like, or, eq, inArray } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db } from "./database";
import * as schema from "./database/schema";
import { s3 } from "./lib/s3";
import { guardDestructiveScript } from "./lib/guard-script";

guardDestructiveScript("purge-test-accounts");

const targets = await db
  .select({ id: schema.user.id, email: schema.user.email })
  .from(schema.user)
  .where(
    or(
      like(schema.user.email, "sectest-%@example.test"),
      like(schema.user.email, "esc-%@example.test"),
      like(schema.user.email, "weak-%@example.test"),
      like(schema.user.email, "%@example.com"),
    ),
  );

if (targets.length === 0) {
  console.log("No test accounts found. Nothing to purge.");
} else {
  const ids = targets.map((t) => t.id);
  console.log(`Purging ${ids.length} test account(s):`);
  for (const t of targets) console.log(`  - ${t.email}`);

  const docs = await db.select().from(schema.documents).where(inArray(schema.documents.userId, ids));
  for (const doc of docs) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: doc.key })).catch(() => {});
  }
  await db.delete(schema.documents).where(inArray(schema.documents.userId, ids));
  await db.delete(schema.portalMessages).where(inArray(schema.portalMessages.userId, ids));
  await db.delete(schema.orders).where(inArray(schema.orders.userId, ids));
  await db.delete(schema.session).where(inArray(schema.session.userId, ids));
  await db.delete(schema.account).where(inArray(schema.account.userId, ids));
  for (const id of ids) await db.delete(schema.user).where(eq(schema.user.id, id));

  console.log(`Removed ${docs.length} document(s) and ${ids.length} account(s).`);
}

// Also clear probe rows left by the public form tests.
const probes = await db
  .delete(schema.clientFeedback)
  .where(or(eq(schema.clientFeedback.name, "SecTest Bot"), eq(schema.clientFeedback.name, "RateProbe")))
  .returning({ id: schema.clientFeedback.id });
if (probes.length) console.log(`Removed ${probes.length} probe feedback row(s).`);
