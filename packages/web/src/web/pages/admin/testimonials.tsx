import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Testimonials() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", quote: "", rating: 5 });
  const testimonials = useQuery({ queryKey: ["testimonials"], queryFn: async () => (await api.testimonials.$get()).json() });

  const create = useMutation({
    mutationFn: async () => (await api.testimonials.$post({ json: form })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["testimonials"] }); setShowForm(false); setForm({ name: "", role: "", quote: "", rating: 5 }); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.testimonials[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["testimonials"] }),
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl">Testimonials</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand-black text-white px-5 py-3 text-xs uppercase tracking-wide flex items-center gap-2 hover:bg-brand-gold hover:text-brand-black"><Plus size={16} /> Add</button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="border border-brand-border bg-white p-8 mb-8 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-brand-border px-4 py-3" />
            <input placeholder="Role / Company" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border border-brand-border px-4 py-3" />
          </div>
          <textarea required placeholder="Quote" value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={3} className="w-full border border-brand-border px-4 py-3" />
          <input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} className="border border-brand-border px-4 py-3 w-24" />
          <button className="bg-brand-gold text-brand-black px-6 py-3 text-xs uppercase tracking-wide">Save</button>
        </form>
      )}

      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(testimonials.data, "testimonials").map((t: any) => (
          <div key={t.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-display text-sm">{t.name} <span className="text-brand-gray text-xs">— {t.role}</span></p>
              <p className="text-brand-gray text-sm mt-1 max-w-xl">{t.quote}</p>
            </div>
            <button onClick={() => remove.mutate(t.id)} className="text-brand-gray hover:text-red-600 shrink-0 ml-4"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default function AdminTestimonialsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Testimonials />
    </ProtectedRoute>
  );
}
