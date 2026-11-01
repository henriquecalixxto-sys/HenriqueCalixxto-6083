import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, KeyRound, Clock } from "lucide-react";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api } from "../../lib/api";

type ConfigCheck = { id: string; label: string; ok: boolean; severity: "fatal" | "warn"; detail: string };

type Overview = {
  config: ConfigCheck[];
  auth: {
    adminCount: number;
    adminsWithout2fa: number;
    admins: { email: string; name: string; twoFactorEnabled: boolean }[];
    passwordResetEmailConfigured: boolean;
    lockoutThreshold: number;
    lockoutWindowMinutes: number;
    lockedAccounts: number;
  };
  activity: { failedLogins24h: number; deniedAccess24h: number };
  retention: {
    documentRetentionDays: number;
    auditRetentionDays: number;
    documentCount: number;
    oldestDocumentAt: string | null;
  };
};

type Attempt = { id: number; email: string; ip: string | null; success: boolean; createdAt: string };

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-brand-black";
  return (
    <div className="border border-brand-border bg-white p-6">
      <p className={`text-3xl font-display ${color}`}>{value}</p>
      <p className="text-xs tracking-[0.12em] uppercase text-brand-gray mt-2">{label}</p>
    </div>
  );
}

function Security() {
  const overview = useQuery({
    queryKey: ["security-overview"],
    queryFn: async () => (await api.security.overview.$get()).json() as Promise<Overview>,
  });
  const attempts = useQuery({
    queryKey: ["login-attempts"],
    queryFn: async () =>
      (await api.security["login-attempts"].$get({ query: { limit: "40" } })).json() as Promise<{
        attempts: Attempt[];
      }>,
  });

  const data = overview.data;
  const failing = data?.config.filter((c) => !c.ok && c.severity === "fatal") ?? [];
  const warning = data?.config.filter((c) => !c.ok && c.severity === "warn") ?? [];

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-6 flex-wrap mb-2">
        <div>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-3">Operations</p>
          <h1 className="text-3xl md:text-4xl">Security Posture</h1>
        </div>
        <a
          href="/admin/security-report"
          className="border border-brand-border px-6 py-3 text-[12px] tracking-[0.15em] uppercase hover:border-brand-black transition-colors"
        >
          Full Audit Report
        </a>
      </div>
      <p className="text-brand-gray leading-relaxed max-w-2xl mb-10">
        Live, server-derived state. Configuration checks show a verdict only — credential values are never sent to this
        page.
      </p>

      {overview.isLoading && <p className="text-brand-gray">Loading…</p>}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <Stat
              label="Failed logins (24h)"
              value={data.activity.failedLogins24h}
              tone={data.activity.failedLogins24h > 20 ? "warn" : "ok"}
            />
            <Stat
              label="Denied access (24h)"
              value={data.activity.deniedAccess24h}
              tone={data.activity.deniedAccess24h > 0 ? "warn" : "ok"}
            />
            <Stat
              label="Admins without 2FA"
              value={data.auth.adminsWithout2fa}
              tone={data.auth.adminsWithout2fa > 0 ? "bad" : "ok"}
            />
            <Stat label="Client documents stored" value={data.retention.documentCount} />
          </div>

          {/* ---- config checks ---- */}
          <h2 className="text-2xl mb-1">Configuration</h2>
          <p className="text-sm text-brand-gray mb-5">
            {failing.length === 0
              ? "No blocking issue. A production boot would be allowed."
              : `${failing.length} blocking issue(s) — a production boot would be refused.`}
          </p>
          <div className="border border-brand-border bg-white divide-y divide-brand-border mb-10">
            {data.config.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-5 py-3.5">
                {c.ok ? (
                  <ShieldCheck size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : c.severity === "fatal" ? (
                  <ShieldX size={17} className="text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert size={17} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm">{c.label}</p>
                  {!c.ok && <p className="text-xs text-brand-gray mt-0.5">{c.detail}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* ---- accounts ---- */}
          <h2 className="text-2xl mb-5">Administrator accounts</h2>
          <div className="border border-brand-border bg-white divide-y divide-brand-border mb-4">
            {data.auth.admins.map((a) => (
              <div key={a.email} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm truncate">{a.name}</p>
                  <p className="text-xs text-brand-gray truncate">{a.email}</p>
                </div>
                <span
                  className={`text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 shrink-0 ${
                    a.twoFactorEnabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {a.twoFactorEnabled ? "2FA on" : "2FA off"}
                </span>
              </div>
            ))}
            {data.auth.admins.length === 0 && <p className="px-5 py-4 text-sm text-brand-gray">No admin accounts.</p>}
          </div>
          {data.auth.adminsWithout2fa > 0 && (
            <p className="flex items-start gap-2 text-sm text-red-700 mb-4">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              An admin account without 2FA means one leaked password exposes every client document. Enable it at{" "}
              <a href="/portal/security" className="underline">
                /portal/security
              </a>
              .
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <div className="border border-brand-border bg-white p-5 flex items-start gap-3">
              <KeyRound size={17} className="text-brand-gray shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">Password reset email</p>
                <p className="text-xs text-brand-gray mt-0.5">
                  {data.auth.passwordResetEmailConfigured
                    ? "Provider configured — reset links will be delivered."
                    : "Not configured. In production a reset request fails loudly instead of silently going nowhere."}
                </p>
              </div>
            </div>
            <div className="border border-brand-border bg-white p-5 flex items-start gap-3">
              <Clock size={17} className="text-brand-gray shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">Account lockout</p>
                <p className="text-xs text-brand-gray mt-0.5">
                  {data.auth.lockoutThreshold} failed attempts pauses sign-in for {data.auth.lockoutWindowMinutes}{" "}
                  minutes. Currently in cooldown: {data.auth.lockedAccounts}.
                </p>
              </div>
            </div>
          </div>

          {/* ---- retention ---- */}
          <h2 className="text-2xl mb-5">Retention</h2>
          <div className="border border-brand-border bg-white p-6 mb-10 text-sm space-y-2">
            <p>
              Client documents are deleted after{" "}
              <span className="text-brand-black">{data.retention.documentRetentionDays} days</span>; audit records after{" "}
              <span className="text-brand-black">{data.retention.auditRetentionDays} days</span>.
            </p>
            <p className="text-brand-gray">
              Oldest document on file:{" "}
              {data.retention.oldestDocumentAt
                ? new Date(data.retention.oldestDocumentAt).toLocaleDateString()
                : "none"}
              . Enforcement runs on demand — <span className="font-mono text-xs">bun run retention -- --apply</span>.
            </p>
          </div>
        </>
      )}

      {/* ---- login attempts ---- */}
      <h2 className="text-2xl mb-1">Recent sign-in attempts</h2>
      <p className="text-sm text-brand-gray mb-5">
        Email identifier only. No password material is recorded anywhere in this path.
      </p>
      <div className="border border-brand-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-[0.12em] uppercase text-brand-gray border-b border-brand-border">
              <th className="px-5 py-3 font-normal">When</th>
              <th className="px-5 py-3 font-normal">Account</th>
              <th className="px-5 py-3 font-normal">Result</th>
              <th className="px-5 py-3 font-normal">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {(attempts.data?.attempts ?? []).map((a) => (
              <tr key={a.id} className={a.success ? "" : "bg-red-50/40"}>
                <td className="px-5 py-3 whitespace-nowrap text-brand-gray">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="px-5 py-3 truncate max-w-[240px]">{a.email}</td>
                <td className="px-5 py-3">
                  <span className={a.success ? "text-emerald-700" : "text-red-700"}>
                    {a.success ? "success" : "failed"}
                  </span>
                </td>
                <td className="px-5 py-3 text-brand-gray">{a.ip ?? "unknown"}</td>
              </tr>
            ))}
            {(attempts.data?.attempts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-brand-gray">
                  No sign-in attempts recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

export default function AdminSecurityPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Security />
    </ProtectedRoute>
  );
}
