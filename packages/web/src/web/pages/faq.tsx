import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { api } from "../lib/api";

export default function FaqPage() {
  const faqs = useQuery({ queryKey: ["faqs"], queryFn: async () => (await api.faqs.$get()).json() });
  const [open, setOpen] = useState<string | null>(null);

  const grouped = (faqs.data?.faqs ?? []).reduce((acc: Record<string, any[]>, f: any) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Support</p>
          <h1 className="text-4xl md:text-5xl">Frequently Asked Questions</h1>
        </Reveal>
      </section>

      <section className="py-24 max-w-[900px] mx-auto px-6">
        {Object.entries(grouped).map(([category, items]) => (
          <Reveal key={category} className="mb-14">
            <h2 className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-6">{category}</h2>
            <div className="border-t border-brand-border">
              {items.map((f: any) => {
                const key = `${category}-${f.id}`;
                return (
                  <div key={f.id} className="border-b border-brand-border">
                    <button onClick={() => setOpen(open === key ? null : key)} className="w-full flex items-center justify-between py-5 text-left">
                      <span className="font-display text-base pr-4">{f.question}</span>
                      <ChevronDown className={`shrink-0 transition-transform text-brand-gold ${open === key ? "rotate-180" : ""}`} size={20} />
                    </button>
                    {open === key && <p className="text-brand-gray text-sm leading-relaxed pb-5 pr-8">{f.answer}</p>}
                  </div>
                );
              })}
            </div>
          </Reveal>
        ))}
      </section>
    </Layout>
  );
}
