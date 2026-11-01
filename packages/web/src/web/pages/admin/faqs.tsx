import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Faqs() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "General", question: "", answer: "" });
  const faqs = useQuery({ queryKey: ["faqs"], queryFn: async () => (await api.faqs.$get()).json() });

  const create = useMutation({
    mutationFn: async () => (await api.faqs.$post({ json: form })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["faqs"] }); setShowForm(false); setForm({ category: "General", question: "", answer: "" }); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.faqs[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faqs"] }),
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl">FAQs</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand-black text-white px-5 py-3 text-xs uppercase tracking-wide flex items-center gap-2 hover:bg-brand-gold hover:text-brand-black"><Plus size={16} /> Add</button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="border border-brand-border bg-white p-8 mb-8 space-y-4">
          <input required placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-brand-border px-4 py-3" />
          <input required placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full border border-brand-border px-4 py-3" />
          <textarea required placeholder="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={3} className="w-full border border-brand-border px-4 py-3" />
          <button className="bg-brand-gold text-brand-black px-6 py-3 text-xs uppercase tracking-wide">Save</button>
        </form>
      )}

      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(faqs.data, "faqs").map((f: any) => (
          <div key={f.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-brand-gold text-xs uppercase mb-1">{f.category}</p>
              <p className="font-display text-sm">{f.question}</p>
              <p className="text-brand-gray text-sm mt-1 max-w-xl">{f.answer}</p>
            </div>
            <button onClick={() => remove.mutate(f.id)} className="text-brand-gray hover:text-red-600 shrink-0 ml-4"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default function AdminFaqsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Faqs />
    </ProtectedRoute>
  );
}
