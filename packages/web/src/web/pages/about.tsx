import { Layout } from "../components/layout";
import { Reveal, RevealStagger, revealItem } from "../components/reveal";
import { motion } from "framer-motion";
import { ShieldCheck, Target, Eye, Heart } from "lucide-react";

const VALUES = [
  { icon: Target, title: "Mission", desc: "To deliver precise, professional document solutions that individuals and businesses can rely on with complete confidence." },
  { icon: Eye, title: "Vision", desc: "To be the most trusted name in professional document services across Connecticut and beyond." },
  { icon: Heart, title: "Values", desc: "Integrity, precision, and confidentiality guide every document that passes through our hands." },
  { icon: ShieldCheck, title: "Ethics", desc: "We operate within clear professional boundaries, never overstepping into legal advice or representation." },
];

export default function AboutPage() {
  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">About Calixto Agency</p>
          <h1 className="text-4xl md:text-5xl max-w-2xl mx-auto">Precision, Discretion, and Professionalism</h1>
        </Reveal>
      </section>

      <section className="py-24 max-w-[900px] mx-auto px-6 text-center">
        <Reveal>
          <p className="font-accent italic text-xl md:text-2xl text-brand-gray leading-relaxed">
            Calixto Agency was founded on a simple principle: your most important documents deserve expert, confidential
            handling. Based in Bridgeport, Connecticut, we serve individuals, families, and businesses navigating certified
            translation, notarization, apostille authentication, and administrative document needs — with the precision and
            discretion of a private professional services firm.
          </p>
        </Reveal>
      </section>

      <section className="py-24 bg-white border-y border-brand-border">
        <div className="max-w-[1240px] mx-auto px-6">
          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <motion.div key={v.title} variants={revealItem} className="text-center border border-brand-border p-10">
                  <Icon className="text-brand-gold mx-auto mb-5" size={30} strokeWidth={1.25} />
                  <h3 className="font-display text-lg mb-3">{v.title}</h3>
                  <p className="text-brand-gray text-sm leading-relaxed">{v.desc}</p>
                </motion.div>
              );
            })}
          </RevealStagger>
        </div>
      </section>

      <section className="py-24 max-w-[900px] mx-auto px-6 text-center">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Commitment to Confidentiality</p>
          <h2 className="text-3xl mb-6">Your Documents, Protected</h2>
          <p className="text-brand-gray leading-relaxed">
            Every engagement is treated with strict confidentiality. From secure digital storage to controlled access
            protocols, we safeguard your personal and business information at every step of the process.
          </p>
        </Reveal>
      </section>
    </Layout>
  );
}
