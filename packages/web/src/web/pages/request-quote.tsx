import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { api } from "../lib/api";

export default function RequestQuotePage() {
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.services.$get()).json() });
  const [form, setForm] = useState({ name: "", email: "", phone: "", serviceSlug: "", details: "" });
  const submit = useMutation({ mutationFn: async () => (await api.quotes.$post({ json: form })).json() });

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Get Started</p>
          <h1 className="text-4xl md:text-5xl">Request a Quote</h1>
          <p className="font-accent italic text-white/70 text-lg mt-4 max-w-xl mx-auto">
            Tell us about your document needs and our team will respond with a tailored quote.
          </p>
        </Reveal>
      </section>

      <section className="py-24 max-w-[720px] mx-auto px-6">
        <Reveal>
          {submit.isSuccess ? (
            <div className="border border-brand-gold p-10 flex flex-col items-center text-center gap-4">
              <CheckCircle2 className="text-brand-gold" size={36} />
              <h2 className="text-2xl">Request Received</h2>
              <p className="text-brand-gray">Thank you. A member of our team will follow up with your quote shortly.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
              className="space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <input required placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none" />
                <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none" />
              </div>
              <input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none" />
              <select required value={form.serviceSlug} onChange={(e) => setForm({ ...form, serviceSlug: e.target.value })} className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none">
                <option value="">Select a Service</option>
                {(services.data?.services ?? []).map((s: any) => (
                  <option key={s.id} value={s.slug}>{s.title}</option>
                ))}
              </select>
              <textarea required placeholder="Tell us about your document needs..." rows={5} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none" />
              <button disabled={submit.isPending} className="w-full bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold-light transition-colors disabled:opacity-50">
                {submit.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          )}
        </Reveal>
      </section>
    </Layout>
  );
}
