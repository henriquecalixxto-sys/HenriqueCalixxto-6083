import { useQuery } from "@tanstack/react-query";
import { Briefcase, Newspaper, Star, FileQuestion, Inbox, Users } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Dashboard() {
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.services.$get()).json() });
  const posts = useQuery({ queryKey: ["blog"], queryFn: async () => (await api.blog.$get()).json() });
  const testimonials = useQuery({ queryKey: ["testimonials"], queryFn: async () => (await api.testimonials.$get()).json() });
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.quotes.$get()).json() });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: async () => (await api.contact.$get()).json() });
  const clients = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.portal.clients.$get()).json() });

  const cards = [
    { label: "Services", value: listOf(services.data, "services").length, icon: Briefcase },
    { label: "Blog Posts", value: listOf(posts.data, "posts").length, icon: Newspaper },
    { label: "Testimonials", value: listOf(testimonials.data, "testimonials").length, icon: Star },
    { label: "Quote Requests", value: listOf(quotes.data, "quotes").length, icon: FileQuestion },
    { label: "Contact Messages", value: listOf(contacts.data, "messages").length, icon: Inbox },
    { label: "Clients", value: listOf(clients.data, "clients").length, icon: Users },
  ];

  return (
    <AdminLayout>
      <h1 className="text-3xl mb-2">Admin Dashboard</h1>
      <p className="text-brand-gray mb-10">Manage every aspect of the Calixto Agency site.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="border border-brand-border bg-white p-8">
              <Icon className="text-brand-gold mb-4" size={26} />
              <p className="text-3xl font-display mb-1">{c.value ?? "–"}</p>
              <p className="text-brand-gray text-sm">{c.label}</p>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Dashboard />
    </ProtectedRoute>
  );
}
