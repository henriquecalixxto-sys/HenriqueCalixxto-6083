import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Layout } from "../../components/layout";
import { Reveal, RevealStagger, revealItem } from "../../components/reveal";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { getIcon } from "../../lib/icons";

export default function ServicesIndexPage() {
  const services = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.services.$get()).json(),
  });

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">What We Offer</p>
          <h1 className="text-4xl md:text-5xl">Our Services</h1>
        </Reveal>
      </section>

      <section className="py-24 max-w-[1240px] mx-auto px-6">
        {services.isLoading ? (
          <div className="text-center text-brand-gray py-20">Loading services...</div>
        ) : (
          <RevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-brand-border">
            {(services.data?.services ?? []).map((s: any) => {
              const Icon = getIcon(s.icon);
              return (
                <motion.div key={s.id} variants={revealItem}>
                  <Link to={`/services/${s.slug}`} className="group bg-brand-cream p-10 flex flex-col h-full hover:bg-white transition-colors">
                    <Icon className="text-brand-gold mb-6" size={32} strokeWidth={1.25} />
                    <h3 className="font-display text-lg mb-3">{s.title}</h3>
                    <p className="text-brand-gray text-sm leading-relaxed mb-6 flex-1">{s.shortDescription}</p>
                    <span className="text-xs tracking-[0.1em] uppercase inline-flex items-center gap-2 group-hover:text-brand-gold transition-colors">
                      Learn More <ArrowRight size={14} />
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </RevealStagger>
        )}
      </section>
    </Layout>
  );
}
