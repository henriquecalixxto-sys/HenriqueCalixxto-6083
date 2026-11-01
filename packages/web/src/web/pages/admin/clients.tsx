import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

const ORDER_STATUSES = ["submitted", "in_review", "processing", "completed", "delivered"];

function Clients() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.portal.clients.$get()).json() });
  const orders = useQuery({ queryKey: ["all-orders"], queryFn: async () => (await api.portal.orders.$get()).json() });
  const [selected, setSelected] = useState<any | null>(null);

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      (await api.portal.clients[":id"].role.$put({ param: { id }, json: { role } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.portal.orders[":id"].$put({ param: { id: String(id) }, json: { status } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-orders"] }),
  });

  const clientOrders = (userId: string) => listOf(orders.data, "orders").filter((o: any) => o.userId === userId);

  return (
    <AdminLayout>
      <h1 className="text-3xl mb-8">Clients & Orders</h1>
      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(clients.data, "clients").map((c: any) => (
          <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-6">
            <div>
              <p className="font-display text-sm">{c.name} <span className="text-brand-gray text-xs">— {c.email}</span></p>
              <p className="text-brand-gray text-xs mt-1">{clientOrders(c.id).length} order(s)</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button onClick={() => setSelected(c)} className="text-xs uppercase tracking-wide text-brand-gold underline">View Orders</button>
              <select value={c.role} onChange={(e) => setRole.mutate({ id: c.id, role: e.target.value })} className="border border-brand-border px-3 py-2 text-xs uppercase">
                <option value="client">client</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white max-w-lg w-full p-8 relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setSelected(null)} className="absolute top-6 right-6 text-brand-gray"><X size={20} /></button>
            <h2 className="text-xl mb-6">{selected.name}'s Orders</h2>
            <div className="space-y-4">
              {clientOrders(selected.id).map((o: any) => (
                <div key={o.id} className="border border-brand-border p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-sm">{o.title}</p>
                    <p className="text-brand-gray text-xs">{o.serviceSlug}</p>
                  </div>
                  <select value={o.status} onChange={(e) => updateOrderStatus.mutate({ id: o.id, status: e.target.value })} className="border border-brand-border px-2 py-1.5 text-xs uppercase shrink-0">
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
              ))}
              {clientOrders(selected.id).length === 0 && <p className="text-brand-gray text-sm">No orders yet.</p>}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminClientsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Clients />
    </ProtectedRoute>
  );
}
