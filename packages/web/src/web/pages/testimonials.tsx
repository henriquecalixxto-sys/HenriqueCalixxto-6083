import { useQuery } from "@tanstack/react-query";
import { Quote, Star } from "lucide-react";
import { Layout } from "../components/layout";
import { Reveal, RevealStagger, revealItem } from "../components/reveal";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { FeedbackWall } from "../components/feedback-wall";

export default function TestimonialsPage() {
  const testimonials = useQuery({ queryKey: ["testimonials"], queryFn: async () => (await api.testimonials.$get()).json() });

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Client Trust</p>
          <h1 className="text-4xl md:text-5xl">What Our Clients Say</h1>
        </Reveal>
      </section>

      <section className="py-24 max-w-[1100px] mx-auto px-6">
        <RevealStagger className="grid md:grid-cols-2 gap-8">
          {(testimonials.data?.testimonials ?? []).map((t: any) => (
            <motion.div key={t.id} variants={revealItem} className="border border-brand-border p-10 bg-white">
              <Quote className="text-brand-gold mb-4" size={28} />
              <p className="font-accent italic text-lg leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex gap-1 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={14} className="fill-brand-gold text-brand-gold" />
                ))}
              </div>
              <p className="text-sm tracking-[0.08em] uppercase">{t.name}</p>
              <p className="text-brand-gray text-sm">{t.role}</p>
            </motion.div>
          ))}
        </RevealStagger>
      </section>

      <section className="py-24 bg-brand-cream border-t border-brand-border">
        <div className="max-w-[1240px] mx-auto px-6">
          <FeedbackWall limit={4} />
        </div>
      </section>
    </Layout>
  );
}
