import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Quote, Star, CheckCircle2, PenLine } from "lucide-react";
import { api, listOf } from "../lib/api";
import { Reveal, RevealStagger, revealItem } from "./reveal";

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type={onChange ? "button" : undefined}
          onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? "transition-transform hover:scale-110" : "cursor-default"}
          aria-label={`${n} stars`}
        >
          <Star
            size={onChange ? 22 : 14}
            className={n <= value ? "fill-brand-gold text-brand-gold" : "text-brand-border"}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Public "leave your feedback" wall — clients submit a comment, rating and thank-you note.
 * Submissions are moderated in /admin/feedback before appearing publicly.
 */
export function FeedbackWall({ limit }: { limit?: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", city: "", message: "", rating: 5 });
  const feedback = useQuery({
    queryKey: ["feedback"],
    queryFn: async () => (await api.feedback.$get()).json(),
  });

  const submit = useMutation({
    mutationFn: async () => (await api.feedback.$post({ json: form })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      setForm({ name: "", email: "", city: "", message: "", rating: 5 });
    },
  });

  const all = listOf(feedback.data, "feedback");
  const entries = limit ? all.slice(0, limit) : all;

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 items-start">
      {/* FORM */}
      <Reveal>
        <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Share Your Experience</p>
        <h2 className="text-3xl md:text-4xl mb-4">Leave Your Feedback</h2>
        <p className="text-brand-gray leading-relaxed mb-8 font-body">
          Your words help other families and businesses trust us with their documents. Tell us how we
          did — a comment, a note of thanks, anything at all.
        </p>

        {submit.isSuccess ? (
          <div className="border border-brand-gold p-8 flex items-start gap-4 bg-white">
            <CheckCircle2 className="text-brand-gold shrink-0 mt-0.5" size={28} />
            <div>
              <p className="font-display text-lg mb-1">Thank you</p>
              <p className="text-brand-gray text-sm leading-relaxed">
                We received your message. It will appear on this page once our team reviews it.
              </p>
              <button
                onClick={() => submit.reset()}
                className="mt-4 text-xs tracking-[0.15em] uppercase text-brand-black hover:text-brand-gold"
              >
                Write another
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
            className="space-y-5 border border-brand-border bg-white p-8"
          >
            <div className="grid sm:grid-cols-2 gap-5">
              <input
                required
                placeholder="Your Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none"
              />
              <input
                placeholder="City (optional)"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none"
              />
            </div>
            <input
              type="email"
              placeholder="Email (optional, never published)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none"
            />
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase text-brand-gray mb-3">Your Rating</p>
              <Stars value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
            </div>
            <textarea
              required
              rows={5}
              placeholder="Your comment or thank-you note..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none"
            />
            {submit.isError && (
              <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
            )}
            <button
              disabled={submit.isPending}
              className="bg-brand-black text-white px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold hover:text-brand-black transition-colors disabled:opacity-50 inline-flex items-center gap-3"
            >
              <PenLine size={15} />
              {submit.isPending ? "Sending..." : "Submit Feedback"}
            </button>
            <p className="text-brand-gray-light text-xs leading-relaxed">
              Reviewed before publishing. We never share your email address.
            </p>
          </form>
        )}
      </Reveal>

      {/* WALL */}
      <div>
        <Reveal>
          <p className="text-[11px] tracking-[0.25em] uppercase text-brand-gray mb-6">
            Words From Our Clients
          </p>
        </Reveal>
        {entries.length === 0 ? (
          <Reveal>
            <div className="border border-dashed border-brand-border p-12 text-center">
              <Quote className="text-brand-gold mx-auto mb-4" size={26} />
              <p className="text-brand-gray text-sm">
                No published notes yet — yours could be the first.
              </p>
            </div>
          </Reveal>
        ) : (
          <RevealStagger className="space-y-5">
            {entries.map((f: any) => (
              <motion.div
                key={f.id}
                variants={revealItem}
                className="border border-brand-border bg-white p-7 hover:border-brand-gold transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm tracking-[0.08em] uppercase">{f.name}</p>
                    {f.city && <p className="text-brand-gray-light text-xs mt-1">{f.city}</p>}
                  </div>
                  <Stars value={f.rating} />
                </div>
                <p className="font-accent italic text-lg leading-relaxed text-brand-gray">
                  "{f.message}"
                </p>
                {f.createdAt && (
                  <p className="text-brand-gray-light text-[11px] tracking-[0.15em] uppercase mt-5">
                    {new Date(f.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </motion.div>
            ))}
          </RevealStagger>
        )}
      </div>
    </div>
  );
}
