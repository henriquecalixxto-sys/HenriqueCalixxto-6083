import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Layout } from "../../components/layout";
import { Reveal } from "../../components/reveal";
import { api } from "../../lib/api";
import { getIcon } from "../../lib/icons";

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const service = useQuery({
    queryKey: ["service", slug],
    queryFn: async () => (await api.services[":slug"].$get({ param: { slug } })).json(),
  });
  const allServices = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.services.$get()).json(),
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (service.isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center text-brand-gray">Loading...</div>
      </Layout>
    );
  }

  if (!service.data || "message" in service.data) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-brand-gray">Service not found.</p>
          <Link to="/services" className="text-brand-gold underline">Back to Services</Link>
        </div>
      </Layout>
    );
  }

  const s = service.data.service;
  const Icon = getIcon(s.icon);
  const benefits: string[] = JSON.parse(s.benefits);
  const process: string[] = JSON.parse(s.process);
  const faq: { q: string; a: string }[] = JSON.parse(s.faq);
  const related = (allServices.data?.services ?? []).filter((r: any) => r.slug !== slug).slice(0, 3);

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <Reveal>
            <Icon className="text-brand-gold mx-auto mb-6" size={40} strokeWidth={1.25} />
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Service</p>
            <h1 className="text-4xl md:text-5xl mb-6">{s.title}</h1>
            <p className="font-accent italic text-white/70 text-xl">{s.shortDescription}</p>
          </Reveal>
        </div>
      </section>

      <section className="py-24 max-w-[900px] mx-auto px-6">
        <Reveal>
          <h2 className="text-2xl mb-6">Overview</h2>
          <p className="text-brand-gray leading-relaxed mb-16">{s.overview}</p>
        </Reveal>

        <Reveal>
          <h2 className="text-2xl mb-6">Benefits</h2>
          <ul className="grid sm:grid-cols-2 gap-4 mb-16">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-3 border border-brand-border p-5 text-sm text-brand-gray">
                <span className="text-brand-gold mt-0.5">—</span> {b}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <h2 className="text-2xl mb-8">Our Process</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {process.map((p, i) => (
              <div key={i} className="border-t-2 border-brand-gold pt-4">
                <span className="font-display text-brand-gold text-sm">0{i + 1}</span>
                <p className="text-sm text-brand-gray mt-2 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <h2 className="text-2xl mb-6">Frequently Asked Questions</h2>
          <div className="border-t border-brand-border mb-16">
            {faq.map((item, i) => (
              <div key={i} className="border-b border-brand-border">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left"
                >
                  <span className="font-display text-base pr-4">{item.q}</span>
                  <ChevronDown className={`shrink-0 transition-transform text-brand-gold ${openFaq === i ? "rotate-180" : ""}`} size={20} />
                </button>
                {openFaq === i && <p className="text-brand-gray text-sm leading-relaxed pb-5 pr-8">{item.a}</p>}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="text-center bg-brand-navy text-white py-16 px-8">
          <h3 className="text-2xl mb-4">Ready to get started with {s.title}?</h3>
          <Link
            to="/request-quote"
            className="bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold-light transition-colors inline-block mt-2"
          >
            Request a Quote
          </Link>
        </Reveal>
      </section>

      {related.length > 0 && (
        <section className="py-24 bg-white border-t border-brand-border">
          <div className="max-w-[1240px] mx-auto px-6">
            <Reveal className="text-center mb-12">
              <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Explore More</p>
              <h2 className="text-3xl">Related Services</h2>
            </Reveal>
            <div className="grid sm:grid-cols-3 gap-8">
              {related.map((r: any) => {
                const RIcon = getIcon(r.icon);
                return (
                  <Link key={r.id} to={`/services/${r.slug}`} className="group border border-brand-border p-8 hover:border-brand-gold transition-colors">
                    <RIcon className="text-brand-gold mb-4" size={26} strokeWidth={1.25} />
                    <h3 className="font-display text-base mb-2">{r.title}</h3>
                    <span className="text-xs uppercase tracking-wide inline-flex items-center gap-2 group-hover:text-brand-gold">
                      Learn More <ArrowRight size={12} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
