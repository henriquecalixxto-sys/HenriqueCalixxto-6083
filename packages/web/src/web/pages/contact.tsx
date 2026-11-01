import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Phone, Mail, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { api } from "../lib/api";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const submit = useMutation({
    mutationFn: async () => (await api.contact.$post({ json: form })).json(),
  });

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Get In Touch</p>
          <h1 className="text-4xl md:text-5xl">Contact Us</h1>
        </Reveal>
      </section>

      <section className="py-24 max-w-[1100px] mx-auto px-6 grid md:grid-cols-2 gap-16">
        <Reveal>
          <h2 className="text-2xl mb-8">Send a Message</h2>
          {submit.isSuccess ? (
            <div className="border border-brand-gold p-8 flex items-center gap-4">
              <CheckCircle2 className="text-brand-gold shrink-0" size={28} />
              <p className="text-brand-gray">Thank you. We've received your message and will respond shortly.</p>
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
              <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none" />
              <textarea required placeholder="Message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full border border-brand-border px-4 py-3 bg-white focus:border-brand-gold outline-none" />
              <button disabled={submit.isPending} className="bg-brand-black text-white px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold hover:text-brand-black transition-colors disabled:opacity-50">
                {submit.isPending ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="text-2xl mb-8">Contact Information</h2>
          <ul className="space-y-6 mb-10">
            <li className="flex items-start gap-4"><MapPin className="text-brand-gold shrink-0 mt-1" size={20} /><span className="text-brand-gray">4 Worth Street, Bridgeport, CT 06606</span></li>
            <li className="flex items-center gap-4"><Phone className="text-brand-gold shrink-0" size={20} /><a href="tel:+14754494306" className="text-brand-gray hover:text-brand-gold transition-colors">(475) 449-4306</a></li>
            <li className="flex items-center gap-4"><Mail className="text-brand-gold shrink-0" size={20} /><span className="text-brand-gray">info@calixtoagency.com</span></li>
            <li className="flex items-start gap-4"><Clock className="text-brand-gold shrink-0 mt-1" size={20} /><span className="text-brand-gray">Mon–Fri: 9:00 AM – 6:00 PM<br />Saturday: By appointment</span></li>
          </ul>
          <div className="aspect-video border border-brand-border overflow-hidden">
            <iframe
              title="map"
              className="w-full h-full"
              loading="lazy"
              src="https://www.google.com/maps?q=4+Worth+Street,+Bridgeport,+CT+06606&output=embed"
            />
          </div>
        </Reveal>
      </section>
    </Layout>
  );
}
