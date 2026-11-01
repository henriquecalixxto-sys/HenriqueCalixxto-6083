import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Clock, Award, Lock, Users2, CheckCircle2, Quote } from "lucide-react";
import { Layout } from "../components/layout";
import { FeedbackWall } from "../components/feedback-wall";
import { Reveal, RevealStagger, revealItem } from "../components/reveal";
import { api } from "../lib/api";
import { getIcon } from "../lib/icons";
import { motion } from "framer-motion";

const WHY_US = [
  { icon: Clock, title: "Fast", desc: "Efficient turnaround without compromising accuracy." },
  { icon: Lock, title: "Confidential", desc: "Your documents are handled under strict confidentiality." },
  { icon: Award, title: "Professional", desc: "Meticulous, detail-driven document expertise." },
  { icon: ShieldCheck, title: "Reliable", desc: "Consistent, dependable service you can count on." },
  { icon: CheckCircle2, title: "Secure", desc: "Encrypted storage and controlled access to your files." },
  { icon: Users2, title: "Experienced", desc: "Years of experience across document services." },
];

const STEPS = [
  { n: "01", title: "Upload Documents", desc: "Securely submit your documents through our client portal." },
  { n: "02", title: "Review", desc: "Our team reviews scope, requirements, and timeline." },
  { n: "03", title: "Professional Processing", desc: "Your documents are prepared with precision and care." },
  { n: "04", title: "Delivery", desc: "Receive your completed, ready-to-use documents." },
];

export default function HomePage() {
  const services = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.services.$get()).json(),
  });
  const testimonials = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => (await api.testimonials.$get()).json(),
  });

  return (
    <Layout>
      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/brand/hero-bg_1783648050388.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/85" />
        <div className="relative max-w-[1240px] mx-auto px-6 pt-32 pb-20 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-6">Connecticut, United States</p>
            <h1 className="font-display text-white text-4xl md:text-6xl leading-[1.15] mb-6">
              Professional Document Services You Can Trust
            </h1>
            <p className="font-accent italic text-white/80 text-xl md:text-2xl mb-10 max-w-xl leading-relaxed">
              Certified Translation, Notary Public, Apostille and Administrative Solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/request-quote"
                className="bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase text-center hover:bg-brand-gold-light transition-colors"
              >
                Request a Quote
              </Link>
              <Link
                to="/contact"
                className="border border-white/40 text-white px-8 py-4 text-[13px] tracking-[0.15em] uppercase text-center hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className="py-28 max-w-[1240px] mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">What We Offer</p>
          <h2 className="text-3xl md:text-4xl mb-5">Our Services</h2>
          <p className="text-brand-gray leading-relaxed">
            A full suite of professional document solutions, handled with precision, discretion, and care.
          </p>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-brand-border">
          {(services.data?.services ?? []).slice(0, 9).map((s: any) => {
            const Icon = getIcon(s.icon);
            return (
              <motion.div key={s.id} variants={revealItem}>
                <Link
                  to={`/services/${s.slug}`}
                  className="group bg-brand-cream p-10 flex flex-col h-full hover:bg-white transition-colors"
                >
                  <Icon className="text-brand-gold mb-6" size={32} strokeWidth={1.25} />
                  <h3 className="font-display text-lg mb-3">{s.title}</h3>
                  <p className="text-brand-gray text-sm leading-relaxed mb-6 flex-1">{s.shortDescription}</p>
                  <span className="text-xs tracking-[0.1em] uppercase text-brand-black inline-flex items-center gap-2 group-hover:text-brand-gold transition-colors">
                    Learn More <ArrowRight size={14} />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </RevealStagger>

        <Reveal className="text-center mt-14">
          <Link
            to="/services"
            className="border border-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-black hover:text-white transition-colors inline-block"
          >
            View All Services
          </Link>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-28 bg-brand-navy text-white">
        <div className="max-w-[1240px] mx-auto px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-20">
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Our Process</p>
            <h2 className="text-3xl md:text-4xl">How It Works</h2>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 md:grid-cols-4 gap-10 relative">
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-brand-gold/30" />
            {STEPS.map((step) => (
              <motion.div key={step.n} variants={revealItem} className="text-center relative">
                <div className="w-16 h-16 rounded-full border border-brand-gold text-brand-gold font-display flex items-center justify-center mx-auto mb-6 bg-brand-navy relative z-10">
                  {step.n}
                </div>
                <h3 className="font-display text-lg mb-3">{step.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="py-28 max-w-[1240px] mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Why Choose Us</p>
          <h2 className="text-3xl md:text-4xl">A Standard of Excellence</h2>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {WHY_US.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.title} variants={revealItem} className="border border-brand-border p-10 hover:border-brand-gold transition-colors">
                <Icon className="text-brand-gold mb-5" size={28} strokeWidth={1.25} />
                <h3 className="font-display text-lg mb-2">{item.title}</h3>
                <p className="text-brand-gray text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </RevealStagger>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-28 bg-brand-black text-white">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <Reveal>
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-10">Client Trust</p>
          </Reveal>
          {(testimonials.data?.testimonials ?? []).slice(0, 1).map((t: any) => (
            <Reveal key={t.id}>
              <Quote className="text-brand-gold mx-auto mb-6" size={32} />
              <p className="font-accent italic text-2xl md:text-3xl leading-relaxed mb-8">"{t.quote}"</p>
              <p className="text-brand-gold text-sm tracking-[0.1em] uppercase">{t.name}</p>
              <p className="text-white/50 text-sm">{t.role}</p>
            </Reveal>
          ))}
          <Reveal className="mt-12">
            <Link to="/testimonials" className="text-xs tracking-[0.15em] uppercase text-white/70 hover:text-brand-gold inline-flex items-center gap-2">
              Read More Client Stories <ArrowRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CLIENT FEEDBACK */}
      <section id="feedback" className="py-28 bg-brand-cream border-y border-brand-border">
        <div className="max-w-[1240px] mx-auto px-6">
          <FeedbackWall limit={3} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 max-w-[1240px] mx-auto px-6 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-4xl mb-6">Ready to Get Started?</h2>
          <p className="text-brand-gray max-w-xl mx-auto mb-10 leading-relaxed">
            Request a quote today and experience professional document services built on precision, confidentiality, and trust.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/request-quote" className="bg-brand-black text-white px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold hover:text-brand-black transition-colors">
              Request a Quote
            </Link>
            <a href="tel:+14754494306" className="border border-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:border-brand-gold hover:text-brand-gold transition-colors">
              Call Now
            </a>
          </div>
        </Reveal>
      </section>
    </Layout>
  );
}
