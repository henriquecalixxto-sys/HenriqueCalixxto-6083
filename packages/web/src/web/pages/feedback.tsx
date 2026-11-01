import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { FeedbackWall } from "../components/feedback-wall";

export default function FeedbackPage() {
  return (
    <Layout>
      <section className="pt-40 pb-24 bg-brand-navy text-white text-center px-6">
        <Reveal>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4">Client Feedback</p>
          <h1 className="text-4xl md:text-5xl mb-5">Your Voice Matters</h1>
          <p className="text-white/60 max-w-xl mx-auto leading-relaxed font-body">
            Leave a comment, a review, or a simple thank-you note. Every message is read by our team.
          </p>
        </Reveal>
      </section>

      <section className="py-24 max-w-[1240px] mx-auto px-6">
        <FeedbackWall />
        <div className="mt-16 pt-10 border-t border-brand-border text-center">
          <Link to="/testimonials" className="text-xs tracking-[0.15em] uppercase text-brand-black hover:text-brand-gold inline-flex items-center gap-2">
            Read Full Client Stories <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
