import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

const OUTCOME_STYLE: Record<string, { icon: typeof ShieldCheck; className: string }> = {
  success: { icon: ShieldCheck, className: "text-brand-gold" },
  denied: { icon: ShieldX, className: "text-red-600" },
  error: { icon: ShieldAlert, className: "text-amber-600" },
};

function AuditLog() {
  const logs = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => (await api.audit.$get({ query: { limit: "300" } })).json(),
    refetchInterval: 30_000,
  });

  const rows = listOf(logs.data, "logs");
  const denied = rows.filter((r: any) => r.outcome === "denied").length;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl">Security Audit Log</h1>
        <p className="text-brand-gray text-sm mt-2">
          {rows.length} recent events
          {denied > 0 && <span className="text-red-600"> · {denied} denied access attempt(s)</span>}
        </p>
        <p className="text-brand-gray-light text-xs mt-2 max-w-2xl leading-relaxed">
          Append-only record of document access, role changes and administrative actions. Document
          contents, message bodies and credentials are never recorded here.
        </p>
      </div>

      <div className="border border-brand-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border text-left">
              {["When", "Actor", "Action", "Target", "Outcome", "IP"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] tracking-[0.15em] uppercase text-brand-gray font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-gray">
                  No events recorded yet.
                </td>
              </tr>
            )}
            {rows.map((r: any) => {
              const style = OUTCOME_STYLE[r.outcome] ?? OUTCOME_STYLE.success!;
              const Icon = style.icon;
              return (
                <tr key={r.id} className={r.outcome === "denied" ? "bg-red-50/40" : undefined}>
                  <td className="px-4 py-3 whitespace-nowrap text-brand-gray text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="block">{r.actorRole ?? "anonymous"}</span>
                    <span className="text-brand-gray-light font-mono">{(r.actorId ?? "—").slice(0, 10)}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3 text-xs text-brand-gray">
                    {r.targetType ? `${r.targetType}#${r.targetId ?? "?"}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${style.className}`}>
                      <Icon size={14} /> {r.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-gray-light">{r.ip ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

export default function AdminAuditPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AuditLog />
    </ProtectedRoute>
  );
}
