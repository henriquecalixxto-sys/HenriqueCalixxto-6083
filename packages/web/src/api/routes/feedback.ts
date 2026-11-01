import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { audit } from "../lib/audit";
import { parseBody, feedbackSchema, approvalSchema } from "../lib/validation";

// Client feedback / thank-you wall. Public submit, moderated by an admin before publishing.
export const feedback = new Hono()
  .use("*", authMiddleware)

  .get("/", async (c) => {
    // Public projection: approved rows only, and the submitter's email is never exposed.
    const rows = await db
      .select({
        id: schema.clientFeedback.id,
        name: schema.clientFeedback.name,
        city: schema.clientFeedback.city,
        serviceSlug: schema.clientFeedback.serviceSlug,
        rating: schema.clientFeedback.rating,
        message: schema.clientFeedback.message,
        createdAt: schema.clientFeedback.createdAt,
      })
      .from(schema.clientFeedback)
      .where(eq(schema.clientFeedback.approved, true))
      .orderBy(desc(schema.clientFeedback.createdAt))
      .limit(200);
    return c.json({ feedback: rows }, 200);
  })
  .post("/", rateLimit({ name: "feedback", limit: 3, windowMs: 3600_000 }), async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), feedbackSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .insert(schema.clientFeedback)
      .values({
        name: parsed.data.name,
        message: parsed.data.message,
        rating: parsed.data.rating,
        email: parsed.data.email ?? null,
        city: parsed.data.city ?? null,
        serviceSlug: parsed.data.serviceSlug ?? null,
        // Always unapproved on creation — moderation cannot be bypassed from the client.
        approved: false,
      })
      .returning({ id: schema.clientFeedback.id });
    return c.json({ feedback: row }, 201);
  })
  .get("/all", requireAdmin, async (c) => {
    const rows = await db.select().from(schema.clientFeedback).orderBy(desc(schema.clientFeedback.createdAt));
    return c.json({ feedback: rows }, 200);
  })
  .put("/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), approvalSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .update(schema.clientFeedback)
      .set({ approved: parsed.data.approved })
      .where(eq(schema.clientFeedback.id, id))
      .returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "feedback.moderated", {
      targetType: "feedback",
      targetId: id,
      meta: { approved: parsed.data.approved },
    });
    return c.json({ feedback: row }, 200);
  })
  .delete("/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.clientFeedback).where(eq(schema.clientFeedback.id, id));
    await audit(c, "feedback.moderated", { targetType: "feedback", targetId: id, meta: { deleted: true } });
    return c.json({ ok: true }, 200);
  });
