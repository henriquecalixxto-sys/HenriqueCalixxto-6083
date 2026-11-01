import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export * from "./auth-schema";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  overview: text("overview").notNull(),
  benefits: text("benefits").notNull(), // JSON string array
  process: text("process").notNull(), // JSON string array
  faq: text("faq").notNull(), // JSON string array of {q,a}
  icon: text("icon").notNull().default("FileText"),
  order: integer("order").notNull().default(0),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ...timestamps,
});

export const testimonials = sqliteTable("testimonials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role"),
  quote: text("quote").notNull(),
  rating: integer("rating").notNull().default(5),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  order: integer("order").notNull().default(0),
  ...timestamps,
});

export const faqs = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull().default("General"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  order: integer("order").notNull().default(0),
  ...timestamps,
});

export const blogPosts = sqliteTable("blog_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ...timestamps,
});

export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"), // new, read, replied, archived
  ...timestamps,
});

export const quoteRequests = sqliteTable("quote_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  serviceSlug: text("service_slug"),
  details: text("details").notNull(),
  status: text("status").notNull().default("new"), // new, quoted, accepted, closed
  ...timestamps,
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  serviceSlug: text("service_slug").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("submitted"), // submitted, in_review, processing, completed, delivered
  notes: text("notes"),
  amount: integer("amount"), // cents, placeholder
  ...timestamps,
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id"),
  userId: text("user_id").notNull(),
  filename: text("filename").notNull(),
  key: text("key").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  uploadedBy: text("uploaded_by").notNull().default("client"), // client, admin
  ...timestamps,
});

export const portalMessages = sqliteTable("portal_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  orderId: integer("order_id"),
  sender: text("sender").notNull(), // client, admin
  body: text("body").notNull(),
  readByClient: integer("read_by_client", { mode: "boolean" }).notNull().default(false),
  readByAdmin: integer("read_by_admin", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const clientFeedback = sqliteTable("client_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  city: text("city"),
  serviceSlug: text("service_slug"),
  rating: integer("rating").notNull().default(5),
  message: text("message").notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

/**
 * Security audit trail. Records who did what to which resource.
 * Deliberately stores NO document contents, no tokens, no passwords and no
 * message bodies — only the minimum needed for incident response.
 */
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  outcome: text("outcome").notNull().default("success"), // success | denied | error
  ip: text("ip"),
  userAgent: text("user_agent"),
  meta: text("meta"), // small JSON, non-sensitive
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
