import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

const STATUSES = ["new", "read", "replied", "archived"];

function Contacts() {
  const qc = useQueryClient();
  const messages = useQuery({ queryKey: ["contacts"], queryFn: async () => (await api.contact.$get()).json() });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.contact[":id"].$put({ param: { id: String(id) }, json: { status } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });

  return (
    <AdminLayout>
      <h1 className="text-3xl mb-8">Contact Inbox</h1>
      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(messages.data, "messages").map((m: any) => (
          <div key={m.id} className="px-6 py-5 flex items-start justify-between gap-6">
            <div>
              <p className="font-display text-sm">{m.name} <span className="text-brand-gray text-xs">— {m.email}{m.phone ? ` · ${m.phone}` : ""}</span></p>
              {m.subject && <p className="text-brand-gold text-xs uppercase mt-1">{m.subject}</p>}
              <p className="text-brand-gray text-sm mt-2 max-w-xl">{m.message}</p>
              <p className="text-brand-gray text-xs mt-2">{new Date(m.createdAt).toLocaleString()}</p>
            </div>
            <select value={m.status} onChange={(e) => updateStatus.mutate({ id: m.id, status: e.target.value })} className="border border-brand-border px-3 py-2 text-xs uppercase h-fit shrink-0">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
        {listOf(messages.data, "messages").length === 0 && <p className="px-6 py-10 text-brand-gray text-sm text-center">No messages yet.</p>}
      </div>
    </AdminLayout>
  );
}

export default function AdminContactsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Contacts />
    </ProtectedRoute>
  );
}
