import { Redirect } from "wouter";
import { authClient } from "../lib/auth";

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream">
        <div className="w-10 h-10 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Redirect to="/sign-in" />;
  if (requireAdmin && (session.user as any).role !== "admin") return <Redirect to="/portal" />;

  return <>{children}</>;
}
