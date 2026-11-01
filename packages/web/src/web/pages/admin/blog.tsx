import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Blog() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: "", title: "", category: "", excerpt: "", content: "" });
  const posts = useQuery({ queryKey: ["blog"], queryFn: async () => (await api.blog.$get()).json() });

  const create = useMutation({
    mutationFn: async () => (await api.blog.$post({ json: form })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blog"] }); setShowForm(false); setForm({ slug: "", title: "", category: "", excerpt: "", content: "" }); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.blog[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog"] }),
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl">Blog Posts</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand-black text-white px-5 py-3 text-xs uppercase tracking-wide flex items-center gap-2 hover:bg-brand-gold hover:text-brand-black"><Plus size={16} /> Add</button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="border border-brand-border bg-white p-8 mb-8 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border border-brand-border px-4 py-3" />
            <input required placeholder="Slug (e.g. my-article)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="border border-brand-border px-4 py-3" />
          </div>
          <input required placeholder="Category (USCIS, Translation, Notary...)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-brand-border px-4 py-3" />
          <textarea required placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className="w-full border border-brand-border px-4 py-3" />
          <textarea required placeholder="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} className="w-full border border-brand-border px-4 py-3" />
          <button className="bg-brand-gold text-brand-black px-6 py-3 text-xs uppercase tracking-wide">Publish</button>
        </form>
      )}

      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(posts.data, "posts").map((p: any) => (
          <div key={p.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-brand-gold text-xs uppercase mb-1">{p.category}</p>
              <p className="font-display text-sm">{p.title}</p>
            </div>
            <button onClick={() => remove.mutate(p.id)} className="text-brand-gray hover:text-red-600 shrink-0 ml-4"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default function AdminBlogPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Blog />
    </ProtectedRoute>
  );
}
