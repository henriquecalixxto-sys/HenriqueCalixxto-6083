import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Star,
  MessageSquareHeart,
  HelpCircle,
  Newspaper,
  Inbox,
  FileQuestion,
  Users,
  LogOut,
  ShieldCheck,
  ScrollText,
  BookLock,
} from "lucide-react";
import { authClient } from "../lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/services", label: "Services", icon: Briefcase },
  { href: "/admin/blog", label: "Blog Posts", icon: Newspaper },
  { href: "/admin/testimonials", label: "Testimonials", icon: Star },
  { href: "/admin/feedback", label: "Client Feedback", icon: MessageSquareHeart },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/quotes", label: "Quote Requests", icon: FileQuestion },
  { href: "/admin/contacts", label: "Contact Inbox", icon: Inbox },
  { href: "/admin/clients", label: "Clients & Orders", icon: Users },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/security-report", label: "Runbook", icon: BookLock },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen flex bg-brand-cream">
      <aside className="w-64 bg-brand-black text-white flex flex-col fixed top-0 bottom-0 left-0">
        <Link to="/" className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <img src="/brand/icon-mark-transparent.png" alt="Calixto Agency" className="h-8 w-auto" />
          <span className="font-display tracking-[0.12em] text-xs">ADMIN</span>
        </Link>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm tracking-wide transition-colors ${
                  active ? "bg-white/10 text-brand-gold" : "text-white/70 hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-6 border-t border-white/10">
          <p className="text-xs text-white/50 px-4 mb-3 truncate">{session?.user?.email}</p>
          <button
            onClick={() => authClient.signOut().then(() => (window.location.href = "/"))}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-brand-gold w-full"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 ml-64 p-10">{children}</div>
    </div>
  );
}
