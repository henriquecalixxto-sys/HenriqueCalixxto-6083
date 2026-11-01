import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { authClient } from "../lib/auth";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/feedback", label: "Reviews" },
  { href: "/blog", label: "Insights" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Every page opens with a dark navy/photo hero, so the navbar should stay in "light text"
  // mode until the user scrolls past it — not just on the homepage.
  const dark = !scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-brand-cream/95 backdrop-blur border-b border-brand-border py-3" : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-[1240px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/brand/icon-mark-transparent.png"
            alt="Calixto Agency"
            className={`transition-all duration-500 ${scrolled ? "h-10" : "h-[52px]"} w-auto drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]`}
          />
          <span
            className={`font-display tracking-[0.15em] text-sm md:text-base transition-colors ${
              dark ? "text-white" : "text-brand-black"
            }`}
          >
            CALIXTO <span className="text-brand-gold">AGENCY</span>
          </span>
        </Link>

        <nav className="hidden xl:flex items-center gap-5 shrink-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`text-[13px] tracking-[0.08em] uppercase font-body whitespace-nowrap transition-colors hover:text-brand-gold ${
                dark ? "text-white/90" : "text-brand-black"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden xl:flex items-center gap-5 shrink-0">
          <Link
            to={session ? "/portal" : "/sign-in"}
            className={`text-[13px] tracking-[0.08em] uppercase whitespace-nowrap transition-colors hover:text-brand-gold ${
              dark ? "text-white/90" : "text-brand-black"
            }`}
          >
            {session ? "Client Portal" : "Sign In"}
          </Link>
          <Link
            to="/request-quote"
            className={`border px-5 py-2.5 text-[12px] tracking-[0.12em] uppercase whitespace-nowrap transition-colors ${
              dark
                ? "border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-black"
                : "border-brand-gold text-brand-black hover:bg-brand-gold"
            }`}
          >
            Request a Quote
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`xl:hidden ${dark ? "text-white" : "text-brand-black"}`}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="xl:hidden bg-brand-cream border-t border-brand-border mt-4">
          <div className="flex flex-col px-6 py-6 gap-5">
            {NAV.map((item) => (
              <Link key={item.href} to={item.href} onClick={() => setOpen(false)} className="text-sm uppercase tracking-wide">
                {item.label}
              </Link>
            ))}
            <Link to={session ? "/portal" : "/sign-in"} onClick={() => setOpen(false)} className="text-sm uppercase tracking-wide">
              {session ? "Client Portal" : "Sign In"}
            </Link>
            <Link
              to="/request-quote"
              onClick={() => setOpen(false)}
              className="border border-brand-gold px-5 py-2.5 text-center text-[12px] tracking-[0.12em] uppercase"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
