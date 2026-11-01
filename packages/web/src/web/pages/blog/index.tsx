import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Layout } from "../../components/layout";
import { Reveal, RevealStagger, revealItem } from "../../components/reveal";
import { motion } from "framer-motion";
import { api } from "../../lib/api";

export default function BlogIndexPage() {
  const posts = useQuery({ queryKey: ["blog"], queryFn: async () => (await api.blog.$get()).json() });

  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Insights</p>
          <h1 className="text-4xl md:text-5xl">From the Blog</h1>
        </Reveal>
      </section>

      <section className="py-24 max-w-[1100px] mx-auto px-6">
        <RevealStagger className="grid md:grid-cols-2 gap-8">
          {(posts.data?.posts ?? []).map((p: any) => (
            <motion.div key={p.id} variants={revealItem}>
              <Link to={`/blog/${p.slug}`} className="group block border border-brand-border p-10 h-full hover:border-brand-gold transition-colors">
                <p className="text-brand-gold text-xs tracking-[0.15em] uppercase mb-4">{p.category}</p>
                <h2 className="font-display text-xl mb-4">{p.title}</h2>
                <p className="text-brand-gray text-sm leading-relaxed mb-6">{p.excerpt}</p>
                <span className="text-xs uppercase tracking-wide inline-flex items-center gap-2 group-hover:text-brand-gold">
                  Read Article <ArrowRight size={14} />
                </span>
              </Link>
            </motion.div>
          ))}
        </RevealStagger>
      </section>
    </Layout>
  );
}
