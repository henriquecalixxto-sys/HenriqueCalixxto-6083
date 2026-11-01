import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, X } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Services() {
  const qc = useQueryClient();
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.services.$get()).json() });
  const [editing, setEditing] = useState<any | null>(null);

  const update = useMutation({
    mutationFn: async () =>
      (await api.services[":id"].$put({
        param: { id: String(editing.id) },
        json: { title: editing.title, shortDescription: editing.shortDescription, overview: editing.overview, order: editing.order },
      })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); setEditing(null); },
  });

  return (
    <AdminLayout>
      <h1 className="text-3xl mb-2">Services</h1>
      <p className="text-brand-gray mb-8">Edit title, description, and overview for each service page. Services are seeded and cannot be deleted here to preserve SEO URLs.</p>

      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(services.data, "services").map((s: any) => (
          <div key={s.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-display text-sm">{s.title}</p>
              <p className="text-brand-gray text-xs">/services/{s.slug}</p>
            </div>
            <button onClick={() => setEditing(s)} className="text-brand-gray hover:text-brand-gold"><Pencil size={18} /></button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white max-w-lg w-full p-8 relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setEditing(null)} className="absolute top-6 right-6 text-brand-gray"><X size={20} /></button>
            <h2 className="text-xl mb-6">Edit {editing.title}</h2>
            <div className="space-y-4">
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full border border-brand-border px-4 py-3" placeholder="Title" />
              <textarea value={editing.shortDescription} onChange={(e) => setEditing({ ...editing, shortDescription: e.target.value })} rows={2} className="w-full border border-brand-border px-4 py-3" placeholder="Short Description" />
              <textarea value={editing.overview} onChange={(e) => setEditing({ ...editing, overview: e.target.value })} rows={5} className="w-full border border-brand-border px-4 py-3" placeholder="Overview" />
              <input type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} className="w-full border border-brand-border px-4 py-3" placeholder="Order" />
              <button onClick={() => update.mutate()} disabled={update.isPending} className="bg-brand-gold text-brand-black px-6 py-3 text-xs uppercase tracking-wide w-full">
                {update.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminServicesPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Services />
    </ProtectedRoute>
  );
}
