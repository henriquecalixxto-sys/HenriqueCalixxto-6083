import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { audit } from "../lib/audit";
import { parseBody, contactSchema, quoteSchema, statusUpdateSchema } from "../lib/validation";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Contact form + quote requests. Public submit is validated and rate limited;
// everything else is admin-only.
export const inquiries = new Hono()
  .use("*", authMiddleware)

  .post("/contact", rateLimit({ name: "contact", limit: 5, windowMs: 3600_000 }), async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), contactSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .insert(schema.contactMessages)
      .values({ ...parsed.data, status: "new" })
      .returning({ id: schema.contactMessages.id, createdAt: schema.contactMessages.createdAt });
    // Only the id is echoed back — the stored record is never reflected to the public.
    return c.json({ message: row }, 201);
  })
  .get("/contact", requireAdmin, async (c) => {
    const rows = await db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt));
    return c.json({ messages: rows }, 200);
  })
  .put("/contact/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), statusUpdateSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .update(schema.contactMessages)
      .set(parsed.data)
      .where(eq(schema.contactMessages.id, id))
      .returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "inquiry.updated", { targetType: "contact", targetId: id, meta: { status: row.status } });
    return c.json({ message: row }, 200);
  })
  .delete("/contact/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.contactMessages).where(eq(schema.contactMessages.id, id));
    await audit(c, "inquiry.updated", { targetType: "contact", targetId: id, meta: { deleted: true } });
    return c.json({ ok: true }, 200);
  })

  .post("/quotes", rateLimit({ name: "quotes", limit: 5, windowMs: 3600_000 }), async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), quoteSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .insert(schema.quoteRequests)
      .values({ ...parsed.data, status: "new" })
      .returning({ id: schema.quoteRequests.id, createdAt: schema.quoteRequests.createdAt });
    return c.json({ quote: row }, 201);
  })
  .get("/quotes", requireAdmin, async (c) => {
    const rows = await db.select().from(schema.quoteRequests).orderBy(desc(schema.quoteRequests.createdAt));
    return c.json({ quotes: rows }, 200);
  })
  .put("/quotes/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), statusUpdateSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .update(schema.quoteRequests)
      .set(parsed.data)
      .where(eq(schema.quoteRequests.id, id))
      .returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "inquiry.updated", { targetType: "quote", targetId: id, meta: { status: row.status } });
    return c.json({ quote: row }, 200);
  })
  .delete("/quotes/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.quoteRequests).where(eq(schema.quoteRequests.id, id));
    await audit(c, "inquiry.updated", { targetType: "quote", targetId: id, meta: { deleted: true } });
    return c.json({ ok: true }, 200);
  });
