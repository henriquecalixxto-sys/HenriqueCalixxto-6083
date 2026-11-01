import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

const STATUSES = ["new", "quoted", "accepted", "closed"];

function Quotes() {
  const qc = useQueryClient();
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.quotes.$get()).json() });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.quotes[":id"].$put({ param: { id: String(id) }, json: { status } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  return (
    <AdminLayout>
      <h1 className="text-3xl mb-8">Quote Requests</h1>
      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(quotes.data, "quotes").map((q: any) => (
          <div key={q.id} className="px-6 py-5 flex items-start justify-between gap-6">
            <div>
              <p className="font-display text-sm">{q.name} <span className="text-brand-gray text-xs">— {q.email}{q.phone ? ` · ${q.phone}` : ""}</span></p>
              <p className="text-brand-gold text-xs uppercase mt-1">{q.serviceSlug}</p>
              <p className="text-brand-gray text-sm mt-2 max-w-xl">{q.details}</p>
              <p className="text-brand-gray text-xs mt-2">{new Date(q.createdAt).toLocaleString()}</p>
            </div>
            <select value={q.status} onChange={(e) => updateStatus.mutate({ id: q.id, status: e.target.value })} className="border border-brand-border px-3 py-2 text-xs uppercase h-fit shrink-0">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
        {listOf(quotes.data, "quotes").length === 0 && <p className="px-6 py-10 text-brand-gray text-sm text-center">No quote requests yet.</p>}
      </div>
    </AdminLayout>
  );
}

export default function AdminQuotesPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Quotes />
    </ProtectedRoute>
  );
}
