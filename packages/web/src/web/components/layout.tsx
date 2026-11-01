import { Phone } from "lucide-react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { PHONE_DISPLAY, PHONE_TEL } from "../lib/contact";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />

      {/* Sitewide click-to-call */}
      <a
        href={PHONE_TEL}
        aria-label={`Call Calixto Agency at ${PHONE_DISPLAY}`}
        className="group fixed bottom-20 right-6 z-50 flex items-center gap-3 bg-brand-black text-brand-cream border border-brand-gold pl-4 pr-5 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:bg-brand-gold hover:text-brand-black transition-colors"
      >
        <Phone size={18} className="text-brand-gold group-hover:text-brand-black transition-colors" />
        <span className="flex flex-col leading-tight">
          <span className="text-[9px] tracking-[0.2em] uppercase opacity-70">Call Now</span>
          <span className="text-[13px] tracking-[0.06em] font-medium">{PHONE_DISPLAY}</span>
        </span>
      </a>
    </div>
  );
}
