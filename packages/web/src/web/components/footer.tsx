import { Link } from "wouter";
import { Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-brand-navy text-white">
      <div className="max-w-[1240px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src="/brand/icon-mark-transparent.png" alt="Calixto Agency" className="h-10 w-auto" />
            <span className="font-display tracking-[0.15em] text-sm">
              CALIXTO <span className="text-brand-gold">AGENCY</span>
            </span>
          </div>
          <p className="text-white/60 text-sm leading-relaxed font-body">Professional Document Solutions</p>
        </div>

        <div>
          <h4 className="text-[13px] tracking-[0.15em] uppercase text-brand-gold mb-4">Navigate</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/about">About</Link></li>
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/how-it-works">How It Works</Link></li>
            <li><Link to="/blog">Insights</Link></li>
            <li><Link to="/testimonials">Testimonials</Link></li>
            <li><Link to="/feedback">Leave Feedback</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[13px] tracking-[0.15em] uppercase text-brand-gold mb-4">Services</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/services/certified-translation">Certified Translation</Link></li>
            <li><Link to="/services/notary-public">Notary Public</Link></li>
            <li><Link to="/services/apostille-services">Apostille Services</Link></li>
            <li><Link to="/services/immigration-document-assistance">Immigration Documents</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[13px] tracking-[0.15em] uppercase text-brand-gold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-gold" /> 4 Worth Street, Bridgeport, CT 06606</li>
            <li className="flex items-center gap-2"><Phone size={16} className="text-brand-gold" /> <a href="tel:+14754494306" className="hover:text-brand-gold transition-colors">(475) 449-4306</a></li>
            <li className="flex items-center gap-2"><Mail size={16} className="text-brand-gold" /> info@calixtoagency.com</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1240px] mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-xs text-center md:text-left max-w-2xl">
            Calixto Agency provides document services only and does not provide legal representation or legal advice.
          </p>
          <div className="flex items-center gap-6 text-white/50 text-xs">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms">Terms</Link>
            <span>© {new Date().getFullYear()} Calixto Agency</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
