import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { audit } from "../lib/audit";
import { parseBody, serviceSchema, testimonialSchema, faqSchema, blogPostSchema } from "../lib/validation";

/** Shared guard for `/:id` routes so a non-numeric id can never reach the query builder. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Public + admin-managed content: services, blog, testimonials, faqs.
// All writes are admin-only and schema-validated (no mass assignment).
export const content = new Hono()
  .use("*", authMiddleware)

  // ---- Services ----
  .get("/services", async (c) => {
    const rows = await db.select().from(schema.services).orderBy(schema.services.order);
    return c.json({ services: rows }, 200);
  })
  .get("/services/:slug", async (c) => {
    const slug = c.req.param("slug");
    const [row] = await db.select().from(schema.services).where(eq(schema.services.slug, slug));
    if (!row) return c.json({ message: "Not found" }, 404);
    return c.json({ service: row }, 200);
  })
  .post("/services", requireAdmin, async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), serviceSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.insert(schema.services).values(parsed.data).returning();
    await audit(c, "content.created", { targetType: "service", targetId: row!.id });
    return c.json({ service: row }, 201);
  })
  .put("/services/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), serviceSchema.partial());
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.update(schema.services).set(parsed.data).where(eq(schema.services.id, id)).returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "content.updated", { targetType: "service", targetId: id });
    return c.json({ service: row }, 200);
  })
  .delete("/services/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.services).where(eq(schema.services.id, id));
    await audit(c, "content.deleted", { targetType: "service", targetId: id });
    return c.json({ ok: true }, 200);
  })

  // ---- Testimonials ----
  .get("/testimonials", async (c) => {
    const user = c.get("user");
    // Unpublished testimonials are visible to admins only.
    const rows =
      user?.role === "admin"
        ? await db.select().from(schema.testimonials).orderBy(schema.testimonials.order)
        : await db
            .select()
            .from(schema.testimonials)
            .where(eq(schema.testimonials.published, true))
            .orderBy(schema.testimonials.order);
    return c.json({ testimonials: rows }, 200);
  })
  .post("/testimonials", requireAdmin, async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), testimonialSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.insert(schema.testimonials).values(parsed.data).returning();
    await audit(c, "content.created", { targetType: "testimonial", targetId: row!.id });
    return c.json({ testimonial: row }, 201);
  })
  .put("/testimonials/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), testimonialSchema.partial());
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .update(schema.testimonials)
      .set(parsed.data)
      .where(eq(schema.testimonials.id, id))
      .returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "content.updated", { targetType: "testimonial", targetId: id });
    return c.json({ testimonial: row }, 200);
  })
  .delete("/testimonials/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.testimonials).where(eq(schema.testimonials.id, id));
    await audit(c, "content.deleted", { targetType: "testimonial", targetId: id });
    return c.json({ ok: true }, 200);
  })

  // ---- FAQs ----
  .get("/faqs", async (c) => {
    const rows = await db.select().from(schema.faqs).orderBy(schema.faqs.order);
    return c.json({ faqs: rows }, 200);
  })
  .post("/faqs", requireAdmin, async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), faqSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.insert(schema.faqs).values(parsed.data).returning();
    await audit(c, "content.created", { targetType: "faq", targetId: row!.id });
    return c.json({ faq: row }, 201);
  })
  .put("/faqs/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), faqSchema.partial());
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.update(schema.faqs).set(parsed.data).where(eq(schema.faqs.id, id)).returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "content.updated", { targetType: "faq", targetId: id });
    return c.json({ faq: row }, 200);
  })
  .delete("/faqs/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.faqs).where(eq(schema.faqs.id, id));
    await audit(c, "content.deleted", { targetType: "faq", targetId: id });
    return c.json({ ok: true }, 200);
  })

  // ---- Blog ----
  .get("/blog", async (c) => {
    const user = c.get("user");
    // Drafts must not leak through the public API even though the UI hides them.
    const rows =
      user?.role === "admin"
        ? await db.select().from(schema.blogPosts).orderBy(desc(schema.blogPosts.createdAt))
        : await db
            .select()
            .from(schema.blogPosts)
            .where(eq(schema.blogPosts.published, true))
            .orderBy(desc(schema.blogPosts.createdAt));
    return c.json({ posts: rows }, 200);
  })
  .get("/blog/:slug", async (c) => {
    const user = c.get("user");
    const slug = c.req.param("slug");
    const [row] = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.slug, slug));
    if (!row || (!row.published && user?.role !== "admin")) return c.json({ message: "Not found" }, 404);
    return c.json({ post: row }, 200);
  })
  .post("/blog", requireAdmin, async (c) => {
    const parsed = await parseBody(await c.req.json().catch(() => null), blogPostSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.insert(schema.blogPosts).values(parsed.data).returning();
    await audit(c, "content.created", { targetType: "blog", targetId: row!.id });
    return c.json({ post: row }, 201);
  })
  .put("/blog/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), blogPostSchema.partial());
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.update(schema.blogPosts).set(parsed.data).where(eq(schema.blogPosts.id, id)).returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "content.updated", { targetType: "blog", targetId: id });
    return c.json({ post: row }, 200);
  })
  .delete("/blog/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return c.json({ message: "Invalid id" }, 400);
    await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, id));
    await audit(c, "content.deleted", { targetType: "blog", targetId: id });
    return c.json({ ok: true }, 200);
  });
