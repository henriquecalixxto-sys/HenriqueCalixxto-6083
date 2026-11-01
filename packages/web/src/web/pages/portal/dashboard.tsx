import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, FileUp, MessageSquare, ArrowRight } from "lucide-react";
import { PortalLayout } from "../../components/portal-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";
import { authClient } from "../../lib/auth";

function Dashboard() {
  const { data: session } = authClient.useSession();
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: async () => (await api.portal.orders.$get()).json() });
  const documents = useQuery({ queryKey: ["my-documents"], queryFn: async () => (await api.portal.documents.$get()).json() });

  const active = listOf(orders.data, "orders").filter((o: any) => o.status !== "delivered").length;

  return (
    <PortalLayout>
      <h1 className="text-3xl mb-2">Welcome, {session?.user?.name?.split(" ")[0] ?? "Client"}</h1>
      <p className="text-brand-gray mb-10">Here's an overview of your account with Calixto Agency.</p>

      <div className="grid sm:grid-cols-3 gap-6 mb-12">
        <div className="border border-brand-border bg-white p-8">
          <ListChecks className="text-brand-gold mb-4" size={26} />
          <p className="text-3xl font-display mb-1">{listOf(orders.data, "orders").length ?? "–"}</p>
          <p className="text-brand-gray text-sm">Total Orders ({active} active)</p>
        </div>
        <div className="border border-brand-border bg-white p-8">
          <FileUp className="text-brand-gold mb-4" size={26} />
          <p className="text-3xl font-display mb-1">{listOf(documents.data, "documents").length ?? "–"}</p>
          <p className="text-brand-gray text-sm">Documents on File</p>
        </div>
        <Link to="/portal/messages" className="border border-brand-border bg-white p-8 hover:border-brand-gold transition-colors">
          <MessageSquare className="text-brand-gold mb-4" size={26} />
          <p className="text-lg font-display mb-1 flex items-center gap-2">Messages <ArrowRight size={16} /></p>
          <p className="text-brand-gray text-sm">Contact our team directly</p>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display">Recent Orders</h2>
        <Link to="/portal/orders" className="text-xs uppercase tracking-wide text-brand-gold">View All →</Link>
      </div>
      <div className="border border-brand-border bg-white divide-y divide-brand-border">
        {listOf(orders.data, "orders").slice(0, 5).map((o: any) => (
          <div key={o.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-display text-sm">{o.title}</p>
              <p className="text-brand-gray text-xs">{o.serviceSlug}</p>
            </div>
            <span className="text-xs uppercase tracking-wide px-3 py-1 border border-brand-gold text-brand-gold">{o.status.replace("_", " ")}</span>
          </div>
        ))}
        {listOf(orders.data, "orders").length === 0 && <p className="px-6 py-8 text-brand-gray text-sm">No orders yet.</p>}
      </div>
    </PortalLayout>
  );
}

export default function PortalDashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
