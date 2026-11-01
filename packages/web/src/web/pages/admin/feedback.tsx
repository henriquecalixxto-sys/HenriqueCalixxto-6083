import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, EyeOff, Star } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Feedback() {
  const qc = useQueryClient();
  const feedback = useQuery({
    queryKey: ["feedback-all"],
    queryFn: async () => (await api.feedback.all.$get()).json(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["feedback-all"] });
    qc.invalidateQueries({ queryKey: ["feedback"] });
  };

  const setApproved = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) =>
      (await api.feedback[":id"].$put({ param: { id: String(id) }, json: { approved } })).json(),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: number) =>
      (await api.feedback[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: invalidate,
  });

  const rows = listOf(feedback.data, "feedback");
  const pending = rows.filter((f: any) => !f.approved).length;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl">Client Feedback</h1>
          <p className="text-brand-gray text-sm mt-2">
            {rows.length} total · {pending} awaiting approval
          </p>
        </div>
      </div>

      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {rows.length === 0 && <p className="px-6 py-8 text-brand-gray text-sm">No feedback yet.</p>}
        {rows.map((f: any) => (
          <div key={f.id} className="px-6 py-5 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-display text-sm">{f.name}</p>
                {f.city && <span className="text-brand-gray text-xs">{f.city}</span>}
                <span className="flex gap-0.5">
                  {Array.from({ length: f.rating }).map((_, i) => (
                    <Star key={i} size={12} className="fill-brand-gold text-brand-gold" />
                  ))}
                </span>
                <span
                  className={`text-[10px] tracking-[0.15em] uppercase px-2 py-1 ${
                    f.approved ? "bg-brand-gold/20 text-brand-black" : "bg-brand-border text-brand-gray"
                  }`}
                >
                  {f.approved ? "Published" : "Pending"}
                </span>
              </div>
              <p className="text-brand-gray text-sm mt-2 max-w-2xl leading-relaxed">{f.message}</p>
              {f.email && <p className="text-brand-gray-light text-xs mt-2">{f.email}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setApproved.mutate({ id: f.id, approved: !f.approved })}
                title={f.approved ? "Unpublish" : "Publish"}
                className="border border-brand-border p-2 hover:border-brand-gold hover:text-brand-gold"
              >
                {f.approved ? <EyeOff size={16} /> : <Check size={16} />}
              </button>
              <button
                onClick={() => remove.mutate(f.id)}
                className="border border-brand-border p-2 text-brand-gray hover:text-red-600 hover:border-red-300"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default function AdminFeedbackPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Feedback />
    </ProtectedRoute>
  );
}
