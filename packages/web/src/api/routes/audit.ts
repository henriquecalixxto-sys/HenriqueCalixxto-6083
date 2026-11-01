import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authMiddleware, requireAdmin } from "../middleware/auth";

// Read-only security audit trail. Admin-only; there is intentionally no write or
// delete endpoint so the log cannot be tampered with through the API.
export const audit = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const limitRaw = Number(c.req.query("limit") ?? 200);
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(limit);
    return c.json({ logs: rows }, 200);
  });
