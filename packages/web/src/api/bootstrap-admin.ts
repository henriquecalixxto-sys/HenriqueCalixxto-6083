/**
 * Promote an existing account to admin.
 *
 * There is deliberately NO seeded admin account with a known password in this
 * codebase — that was a finding in the security audit (CA-19). The owner signs up
 * normally through /sign-up, then this script grants the role once, server-side.
 *
 * Usage:
 *   cd packages/web
 *   bun --env-file=../../.env run src/api/bootstrap-admin.ts owner@calixtoagency.com
 *
 * Safe to re-run: it is idempotent and never creates or changes a password.
 */
import { eq } from "drizzle-orm";
import { db } from "./database";
import * as schema from "./database/schema";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: bun run src/api/bootstrap-admin.ts <email>");
  process.exit(1);
}

const [account] = await db
  .select({ id: schema.user.id, email: schema.user.email, role: schema.user.role })
  .from(schema.user)
  .where(eq(schema.user.email, email));

if (!account) {
  console.error(`No account found for ${email}. Sign up through /sign-up first, then re-run this script.`);
  process.exit(1);
}

if (account.role === "admin") {
  console.log(`${email} is already an admin. Nothing to do.`);
} else {
  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, account.id));
  await db.insert(schema.auditLogs).values({
    actorId: account.id,
    actorRole: "system",
    action: "role.changed",
    targetType: "user",
    targetId: account.id,
    outcome: "success",
    meta: JSON.stringify({ role: "admin", via: "bootstrap-admin script" }),
  });
  console.log(`${email} is now an admin.`);
}
