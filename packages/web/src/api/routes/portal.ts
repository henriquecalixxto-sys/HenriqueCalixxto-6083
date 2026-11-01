import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { db } from "../database";
import * as schema from "../database/schema";
import { authMiddleware, requireAuth, requireAdmin } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { s3 } from "../lib/s3";
import { audit } from "../lib/audit";
import {
  parseBody,
  orderCreateSchema,
  orderAdminUpdateSchema,
  messageSchema,
  roleSchema,
  presignSchema,
  documentRegisterSchema,
  sanitizeFilename,
  validateUploadType,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_TYPES,
} from "../lib/validation";

/** Every stored object lives under a per-user prefix so keys cannot cross tenants. */
function userPrefix(userId: string) {
  return `uploads/${userId}/`;
}

/** Presigned download links are short-lived capability URLs — keep the window tight. */
const DOWNLOAD_URL_TTL = 120; // seconds
const UPLOAD_URL_TTL = 300; // seconds

// Client portal: orders, document upload/download, messages — strictly scoped to the
// logged-in user. Admins may act across tenants; every such branch is explicit.
export const portal = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAuth)
  .use("*", rateLimit({ name: "portal", limit: 300, windowMs: 60_000, by: "user" }))

  // ---- Orders ----
  .get("/orders", async (c) => {
    const user = c.get("user")!;
    const rows =
      user.role === "admin"
        ? await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt))
        : await db
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.userId, user.id))
            .orderBy(desc(schema.orders.createdAt));
    return c.json({ orders: rows }, 200);
  })
  .post("/orders", rateLimit({ name: "order-create", limit: 20, windowMs: 3600_000, by: "user" }), async (c) => {
    const user = c.get("user")!;
    // Whitelisted fields only: status/amount/userId/id can never be set by the client.
    const parsed = await parseBody(await c.req.json().catch(() => null), orderCreateSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db
      .insert(schema.orders)
      .values({
        userId: user.id,
        serviceSlug: parsed.data.serviceSlug,
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
        status: "submitted",
      })
      .returning();
    await audit(c, "order.created", { targetType: "order", targetId: row!.id });
    return c.json({ order: row }, 201);
  })
  .put("/orders/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ message: "Invalid id" }, 400);
    const parsed = await parseBody(await c.req.json().catch(() => null), orderAdminUpdateSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const [row] = await db.update(schema.orders).set(parsed.data).where(eq(schema.orders.id, id)).returning();
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "order.updated", { targetType: "order", targetId: id, meta: { status: row.status } });
    return c.json({ order: row }, 200);
  })

  // ---- Documents ----
  .post("/documents/presign", rateLimit({ name: "presign", limit: 40, windowMs: 3600_000, by: "user" }), async (c) => {
    const user = c.get("user")!;
    const parsed = await parseBody(await c.req.json().catch(() => null), presignSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const { filename, contentType, size, targetUserId } = parsed.data;

    // Type + extension allowlist. Executables, HTML and SVG are rejected outright,
    // so no uploaded object can ever be served as active content.
    const typeCheck = validateUploadType(filename, contentType);
    if (!typeCheck.ok) {
      await audit(c, "document.access_denied", { outcome: "denied", meta: { reason: typeCheck.reason } });
      return c.json({ message: typeCheck.reason, allowed: Object.keys(ALLOWED_UPLOAD_TYPES) }, 400);
    }
    if (size > MAX_UPLOAD_BYTES) return c.json({ message: "File exceeds the 25 MB limit" }, 413);

    // Only admins may upload into another user's namespace.
    const ownerId = user.role === "admin" && targetUserId ? targetUserId : user.id;
    const safeName = sanitizeFilename(filename);
    const key = `${userPrefix(ownerId)}${nanoid(21)}-${safeName}`;

    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
        // Private by default; the bucket must have no public read policy.
        ACL: "private",
        // Encryption at rest is applied by the storage provider (Tigris encrypts all
        // objects with AES-256 by default). We deliberately do NOT sign an
        // x-amz-server-side-encryption header here: the browser would then have to
        // replay it byte-for-byte on the PUT or the request is rejected as unsigned.
      }),
      { expiresIn: UPLOAD_URL_TTL },
    );
    await audit(c, "document.upload_presigned", { targetType: "s3key", targetId: key });
    return c.json({ url, key }, 200);
  })
  .post("/documents", async (c) => {
    const user = c.get("user")!;
    const parsed = await parseBody(await c.req.json().catch(() => null), documentRegisterSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const { filename, key, contentType, size, orderId } = parsed.data;

    // The client may only register a key inside its own prefix. This closes the
    // hole where a user could claim another tenant's object by guessing its key.
    const owner = key.startsWith(userPrefix(user.id))
      ? user.id
      : user.role === "admin" && key.startsWith("uploads/")
        ? (key.split("/")[1] ?? "")
        : null;
    if (!owner) {
      await audit(c, "document.access_denied", { outcome: "denied", targetType: "s3key", targetId: key });
      return c.json({ message: "Forbidden" }, 403);
    }

    // Verify the object actually exists and matches what was declared, so the DB
    // never holds a record pointing at someone else's or a non-existent object.
    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    } catch {
      return c.json({ message: "Upload not found. Please retry." }, 400);
    }
    if ((head.ContentLength ?? 0) > MAX_UPLOAD_BYTES) {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })).catch(() => {});
      return c.json({ message: "File exceeds the 25 MB limit" }, 413);
    }
    const actualType = head.ContentType ?? contentType ?? "";
    if (!validateUploadType(filename, actualType).ok) {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })).catch(() => {});
      await audit(c, "document.access_denied", { outcome: "denied", meta: { reason: "type mismatch on head" } });
      return c.json({ message: "File type not allowed" }, 400);
    }

    const [row] = await db
      .insert(schema.documents)
      .values({
        userId: owner,
        filename: sanitizeFilename(filename),
        key,
        contentType: actualType,
        size: head.ContentLength ?? size,
        orderId: orderId ?? null,
        uploadedBy: user.role === "admin" ? "admin" : "client",
      })
      .returning();
    await audit(c, "document.registered", { targetType: "document", targetId: row!.id });
    return c.json({ document: row }, 201);
  })
  .get("/documents", async (c) => {
    const user = c.get("user")!;
    const orderIdRaw = c.req.query("orderId");
    const orderId = orderIdRaw ? Number(orderIdRaw) : undefined;
    if (orderIdRaw && (!Number.isInteger(orderId) || orderId! <= 0)) {
      return c.json({ message: "Invalid orderId" }, 400);
    }
    const rows =
      user.role === "admin"
        ? await db
            .select()
            .from(schema.documents)
            .where(orderId ? eq(schema.documents.orderId, orderId) : undefined)
            .orderBy(desc(schema.documents.createdAt))
        : await db
            .select()
            .from(schema.documents)
            .where(
              orderId
                ? and(eq(schema.documents.userId, user.id), eq(schema.documents.orderId, orderId))
                : eq(schema.documents.userId, user.id),
            )
            .orderBy(desc(schema.documents.createdAt));
    return c.json({ documents: rows }, 200);
  })
  .get(
    "/documents/:id/url",
    rateLimit({ name: "doc-download", limit: 60, windowMs: 3600_000, by: "user" }),
    async (c) => {
      const user = c.get("user")!;
      const id = Number(c.req.param("id"));
      if (!Number.isInteger(id) || id <= 0) return c.json({ message: "Invalid id" }, 400);
      const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
      if (!doc) return c.json({ message: "Not found" }, 404);

      // OWNERSHIP CHECK — previously missing, allowing any signed-in user to mint a
      // download link for any client's passport/tax/immigration file.
      if (doc.userId !== user.id && user.role !== "admin") {
        await audit(c, "document.access_denied", { outcome: "denied", targetType: "document", targetId: id });
        // 404, not 403: do not confirm the existence of other tenants' records.
        return c.json({ message: "Not found" }, 404);
      }

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: doc.key,
          // Force a download instead of inline rendering — defence in depth against
          // any content type slipping through the allowlist.
          ResponseContentDisposition: `attachment; filename="${doc.filename.replace(/"/g, "")}"`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL },
      );
      await audit(c, "document.downloaded", { targetType: "document", targetId: id });
      return c.json({ url, expiresIn: DOWNLOAD_URL_TTL }, 200);
    },
  )
  .delete("/documents/:id", async (c) => {
    const user = c.get("user")!;
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ message: "Invalid id" }, 400);
    const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    if (!doc) return c.json({ message: "Not found" }, 404);
    if (doc.userId !== user.id && user.role !== "admin") {
      await audit(c, "document.access_denied", { outcome: "denied", targetType: "document", targetId: id });
      return c.json({ message: "Not found" }, 404);
    }
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
    // Secure deletion: remove the object too, so no orphan copy of a sensitive
    // document survives in storage after the client deletes it.
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: doc.key })).catch((err) => {
      console.error("[storage] failed to delete object for document", id, (err as Error).message);
    });
    await audit(c, "document.deleted", { targetType: "document", targetId: id });
    return c.json({ ok: true }, 200);
  })

  // ---- Messages ----
  .get("/messages", async (c) => {
    const user = c.get("user")!;
    const targetUserId = c.req.query("userId");
    const rows =
      user.role === "admin" && targetUserId
        ? await db
            .select()
            .from(schema.portalMessages)
            .where(eq(schema.portalMessages.userId, targetUserId))
            .orderBy(schema.portalMessages.createdAt)
        : await db
            .select()
            .from(schema.portalMessages)
            .where(eq(schema.portalMessages.userId, user.id))
            .orderBy(schema.portalMessages.createdAt);
    return c.json({ messages: rows }, 200);
  })
  .post("/messages", rateLimit({ name: "message", limit: 60, windowMs: 3600_000, by: "user" }), async (c) => {
    const user = c.get("user")!;
    const parsed = await parseBody(await c.req.json().catch(() => null), messageSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    const isAdmin = user.role === "admin";
    const threadUserId = isAdmin && parsed.data.userId ? parsed.data.userId : user.id;

    // A thread may only be attached to an order the sender is allowed to see.
    if (parsed.data.orderId) {
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, parsed.data.orderId));
      if (!order || (!isAdmin && order.userId !== user.id)) {
        await audit(c, "document.access_denied", {
          outcome: "denied",
          targetType: "order",
          targetId: parsed.data.orderId,
        });
        return c.json({ message: "Invalid order" }, 400);
      }
    }

    const [row] = await db
      .insert(schema.portalMessages)
      .values({
        userId: threadUserId,
        orderId: parsed.data.orderId ?? null,
        sender: isAdmin ? "admin" : "client",
        body: parsed.data.body,
      })
      .returning();
    // Message bodies are never written to the audit log.
    await audit(c, "message.sent", { targetType: "thread", targetId: threadUserId });
    return c.json({ message: row }, 201);
  })

  // ---- Admin: clients list ----
  .get("/clients", requireAdmin, async (c) => {
    // Data minimisation: only the columns the admin UI renders.
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
        phone: schema.user.phone,
        company: schema.user.company,
        emailVerified: schema.user.emailVerified,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .orderBy(desc(schema.user.createdAt));
    await audit(c, "admin.viewed_clients", { meta: { count: rows.length } });
    return c.json({ clients: rows }, 200);
  })
  .put("/clients/:id/role", requireAdmin, async (c) => {
    const actor = c.get("user")!;
    const id = c.req.param("id");
    const parsed = await parseBody(await c.req.json().catch(() => null), roleSchema);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);

    // Prevent an admin from removing their own privileges and locking everyone out.
    if (id === actor.id && parsed.data.role !== "admin") {
      return c.json({ message: "You cannot remove your own admin role." }, 400);
    }
    const [row] = await db
      .update(schema.user)
      .set({ role: parsed.data.role })
      .where(eq(schema.user.id, id))
      .returning({ id: schema.user.id, email: schema.user.email, role: schema.user.role });
    if (!row) return c.json({ message: "Not found" }, 404);
    await audit(c, "role.changed", { targetType: "user", targetId: id, meta: { role: parsed.data.role } });
    return c.json({ client: row }, 200);
  });
