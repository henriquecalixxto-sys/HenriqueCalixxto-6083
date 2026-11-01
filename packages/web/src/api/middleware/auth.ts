import { createMiddleware } from "hono/factory";
import { auth } from "../auth";

type SessionUser = typeof auth.$Infer.Session.user;

export const authMiddleware = createMiddleware<{
  Variables: { user: SessionUser | null; session: typeof auth.$Infer.Session.session | null };
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", (session?.user as SessionUser) ?? null);
  c.set("session", session?.session ?? null);
  return next();
});

export const requireAuth = createMiddleware<{
  Variables: { user: SessionUser | null };
}>(async (c, next) => {
  if (!c.get("user")) return c.json({ message: "Unauthorized" }, 401);
  return next();
});

export const requireAdmin = createMiddleware<{
  Variables: { user: SessionUser | null };
}>(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ message: "Unauthorized" }, 401);
  if (user.role !== "admin") return c.json({ message: "Forbidden" }, 403);
  return next();
});
