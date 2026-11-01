import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "../../components/portal-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

const STATUS_STYLES: Record<string, string> = {
  submitted: "border-brand-gray text-brand-gray",
  in_review: "border-blue-500 text-blue-600",
  processing: "border-brand-gold text-brand-gold",
  completed: "border-green-600 text-green-700",
  delivered: "border-green-700 text-green-800 bg-green-50",
};

function Orders() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: async () => (await api.portal.orders.$get()).json() });
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.services.$get()).json() });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", serviceSlug: "", notes: "" });

  const create = useMutation({
    mutationFn: async () => (await api.portal.orders.$post({ json: form })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setShowForm(false);
      setForm({ title: "", serviceSlug: "", notes: "" });
    },
  });

  return (
    <ProtectedRoute>
      <PortalLayout>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl">My Orders</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-brand-black text-white px-5 py-3 text-xs uppercase tracking-wide hover:bg-brand-gold hover:text-brand-black transition-colors">
            {showForm ? "Cancel" : "New Order"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            className="border border-brand-border bg-white p-8 mb-10 space-y-4"
          >
            <input required placeholder="Order Title (e.g. Birth Certificate Translation)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-brand-border px-4 py-3 focus:border-brand-gold outline-none" />
            <select required value={form.serviceSlug} onChange={(e) => setForm({ ...form, serviceSlug: e.target.value })} className="w-full border border-brand-border px-4 py-3 focus:border-brand-gold outline-none">
              <option value="">Select a Service</option>
              {listOf(services.data, "services").map((s: any) => <option key={s.id} value={s.slug}>{s.title}</option>)}
            </select>
            <textarea placeholder="Additional notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full border border-brand-border px-4 py-3 focus:border-brand-gold outline-none" />
            <button disabled={create.isPending} className="bg-brand-gold text-brand-black px-6 py-3 text-xs uppercase tracking-wide">
              {create.isPending ? "Submitting..." : "Submit Order"}
            </button>
          </form>
        )}

        <div className="border border-brand-border bg-white divide-y divide-brand-border">
          {listOf(orders.data, "orders").map((o: any) => (
            <div key={o.id} className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="font-display text-sm mb-1">{o.title}</p>
                <p className="text-brand-gray text-xs">{o.serviceSlug} · {new Date(o.createdAt).toLocaleDateString()}</p>
                {o.notes && <p className="text-brand-gray text-xs mt-1 max-w-md">{o.notes}</p>}
              </div>
              <span className={`text-xs uppercase tracking-wide px-3 py-1 border ${STATUS_STYLES[o.status] ?? "border-brand-gray text-brand-gray"}`}>{o.status.replace("_", " ")}</span>
            </div>
          ))}
          {listOf(orders.data, "orders").length === 0 && <p className="px-6 py-10 text-brand-gray text-sm text-center">No orders yet. Create your first order above.</p>}
        </div>
      </PortalLayout>
    </ProtectedRoute>
  );
}

export default function PortalOrdersPage() {
  return <Orders />;
}
