import { z } from "zod";

/**
 * Central input-validation layer.
 * Every request body that reaches the database MUST go through one of these schemas.
 * Rationale: prevents mass assignment (only listed keys survive), bounds every string
 * so storage cannot be abused, and rejects malformed input before it reaches Drizzle.
 */

const shortText = z.string().trim().min(1).max(200);
const mediumText = z.string().trim().min(1).max(2000);
const longText = z.string().trim().min(1).max(50_000);
const optionalShort = z.string().trim().max(200).optional().nullable();

export const emailSchema = z.string().trim().email().max(254);
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase alphanumeric with hyphens");

// ---------- Public inquiry forms ----------

export const contactSchema = z.object({
  name: shortText,
  email: emailSchema,
  phone: optionalShort,
  subject: optionalShort,
  message: mediumText,
});

export const quoteSchema = z.object({
  name: shortText,
  email: emailSchema,
  phone: optionalShort,
  serviceSlug: slugSchema.optional().nullable(),
  details: mediumText,
});

export const feedbackSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema.optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  serviceSlug: slugSchema.optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  message: z.string().trim().min(5).max(2000),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["new", "read", "replied", "archived", "quoted", "accepted", "closed"]),
});

export const approvalSchema = z.object({ approved: z.boolean() });

// ---------- Admin content ----------

export const serviceSchema = z.object({
  slug: slugSchema,
  title: shortText,
  shortDescription: mediumText,
  overview: longText,
  benefits: longText,
  process: longText,
  faq: longText,
  icon: z.string().trim().max(60).default("FileText"),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  metaTitle: optionalShort,
  metaDescription: z.string().trim().max(400).optional().nullable(),
});

export const testimonialSchema = z.object({
  name: shortText,
  role: optionalShort,
  quote: mediumText,
  rating: z.coerce.number().int().min(1).max(5).default(5),
  published: z.boolean().default(true),
  order: z.coerce.number().int().min(0).max(9999).default(0),
});

export const faqSchema = z.object({
  category: z.string().trim().max(80).default("General"),
  question: mediumText,
  answer: longText,
  order: z.coerce.number().int().min(0).max(9999).default(0),
});

export const blogPostSchema = z.object({
  slug: slugSchema,
  title: shortText,
  category: z.string().trim().max(80),
  excerpt: mediumText,
  content: longText,
  coverImage: z.string().trim().max(500).url().optional().nullable(),
  published: z.boolean().default(true),
  metaTitle: optionalShort,
  metaDescription: z.string().trim().max(400).optional().nullable(),
});

// ---------- Portal ----------

export const orderCreateSchema = z.object({
  serviceSlug: slugSchema,
  title: shortText,
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const orderAdminUpdateSchema = z.object({
  status: z.enum(["submitted", "in_review", "processing", "completed", "delivered"]).optional(),
  title: shortText.optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  amount: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  orderId: z.coerce.number().int().positive().optional().nullable(),
  userId: z.string().trim().min(1).max(64).optional().nullable(), // admin only, enforced in route
});

export const roleSchema = z.object({ role: z.enum(["client", "admin"]) });

// ---------- File upload ----------

/**
 * Strict allowlist. Deliberately excludes every executable, script and
 * active-content type (html, svg, xml, js, exe, sh, jar, ...). Anything not
 * listed here is rejected — denylists are not used anywhere in this codebase.
 */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/heic": ["heic"],
  "image/tiff": ["tif", "tiff"],
  "image/webp": ["webp"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/plain": ["txt"],
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_JSON_BYTES = 256 * 1024; // 256 KB

export const presignSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(180),
  size: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
  targetUserId: z.string().trim().min(1).max(64).optional().nullable(), // admin only
});

export const documentRegisterSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  key: z.string().trim().min(1).max(300),
  contentType: z.string().trim().max(180).optional().nullable(),
  size: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
  orderId: z.coerce.number().int().positive().optional().nullable(),
});

/**
 * Reduce an arbitrary client-supplied filename to a safe, flat S3 path segment.
 * Strips directory separators, control characters, leading dots and unicode
 * trickery, then re-attaches a validated extension. Never returns an empty string.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename
    .normalize("NFKD")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^[._-]+/, "")
    .slice(-120);
  return base.length > 0 ? base : "file";
}

/** Validate the declared MIME type against the extension. Both must agree and both must be allowlisted. */
export function validateUploadType(filename: string, contentType: string): { ok: true } | { ok: false; reason: string } {
  const allowedExts = ALLOWED_UPLOAD_TYPES[contentType.toLowerCase()];
  if (!allowedExts) return { ok: false, reason: "File type not allowed" };
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExts.includes(ext)) return { ok: false, reason: "File extension does not match its type" };
  return { ok: true };
}

/** Parse a request body against a schema, returning a uniform 400 payload on failure. */
export async function parseBody<T extends z.ZodTypeAny>(
  raw: unknown,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; error: string }> {
  const result = await schema.safeParseAsync(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request body" };
  }
  return { ok: true, data: result.data };
}
