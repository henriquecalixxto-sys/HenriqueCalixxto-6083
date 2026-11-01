import { useState } from "react";
import { ShieldCheck, ShieldAlert, Copy, Check } from "lucide-react";
import { PortalLayout } from "../../components/portal-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { authClient } from "../../lib/auth";

/**
 * Self-service two-factor enrolment.
 *
 * Enabling requires the current password (proof of possession, so a stolen
 * session cannot silently bind an attacker's authenticator), then a verified
 * TOTP code before the flag is set server-side.
 */
function Security() {
  const { data: session, refetch } = authClient.useSession();
  const enabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);

  const [step, setStep] = useState<"idle" | "password" | "verify" | "codes">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep("idle");
    setPassword("");
    setCode("");
    setTotpUri("");
    setError("");
  };

  const begin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    setPassword("");
    if (error) return setError(error.message ?? "That password was not accepted.");
    setTotpUri((data as { totpURI?: string } | null)?.totpURI ?? "");
    setBackupCodes((data as { backupCodes?: string[] } | null)?.backupCodes ?? []);
    setStep("verify");
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    setCode("");
    if (error) return setError(error.message ?? "That code was not accepted. Check your device clock and try again.");
    await refetch();
    setStep("codes");
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setBusy(false);
    setPassword("");
    if (error) return setError(error.message ?? "That password was not accepted.");
    await refetch();
    reset();
  };

  const secret = totpUri ? (new URLSearchParams(totpUri.split("?")[1] ?? "").get("secret") ?? "") : "";
  const qr = totpUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`
    : "";

  return (
    <PortalLayout>
      <div className="max-w-2xl">
        <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-3">Account</p>
        <h1 className="text-3xl md:text-4xl mb-3">Security</h1>
        <p className="text-brand-gray leading-relaxed mb-10">
          Your documents are private to your account. Two-factor authentication adds a second step at sign-in, so a
          stolen password alone is not enough to reach them.
        </p>

        <div className="border border-brand-border bg-white p-8">
          <div className="flex items-start gap-4 mb-6">
            {enabled ? (
              <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={22} />
            ) : (
              <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={22} />
            )}
            <div>
              <h2 className="text-xl mb-1">Two-Factor Authentication</h2>
              <p className="text-sm text-brand-gray">
                {enabled
                  ? "Enabled. Sign-in requires a code from your authenticator app."
                  : "Not enabled. Your password is currently the only thing protecting this account."}
              </p>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          {/* ---------------- idle ---------------- */}
          {step === "idle" && (
            <button
              onClick={() => setStep("password")}
              className={`px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase font-medium transition-colors ${
                enabled
                  ? "border border-brand-border hover:border-brand-black"
                  : "bg-brand-black text-white hover:bg-brand-gold hover:text-brand-black"
              }`}
            >
              {enabled ? "Turn Off" : "Set Up Two-Factor"}
            </button>
          )}

          {/* ---------------- password gate ---------------- */}
          {step === "password" && (
            <form onSubmit={enabled ? disable : begin} className="space-y-4">
              <p className="text-sm text-brand-gray">
                Confirm your current password to {enabled ? "turn off" : "enable"} two-factor.
              </p>
              <input
                required
                autoFocus
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-brand-border px-4 py-3 focus:border-brand-black outline-none"
              />
              <div className="flex gap-3">
                <button
                  disabled={busy}
                  className="bg-brand-black text-white px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase disabled:opacity-50 font-medium"
                >
                  {busy ? "Checking..." : "Continue"}
                </button>
                <button type="button" onClick={reset} className="px-6 text-sm text-brand-gray hover:text-brand-black">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ---------------- scan + verify ---------------- */}
          {step === "verify" && (
            <div className="space-y-6">
              <p className="text-sm text-brand-gray leading-relaxed">
                Scan this with Google Authenticator, 1Password, Authy or any TOTP app, then enter the 6-digit code it
                shows.
              </p>
              {qr && <img src={qr} alt="Two-factor setup QR code" className="border border-brand-border" width={200} height={200} />}
              {secret && (
                <p className="text-xs text-brand-gray">
                  Can't scan? Enter this key manually: <span className="font-mono text-brand-black">{secret}</span>
                </p>
              )}
              <form onSubmit={confirm} className="space-y-4">
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full max-w-[200px] border border-brand-border px-4 py-3 text-center tracking-[0.4em] focus:border-brand-black outline-none"
                />
                <div className="flex gap-3">
                  <button
                    disabled={busy || code.trim().length < 6}
                    className="bg-brand-black text-white px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase disabled:opacity-50 font-medium"
                  >
                    {busy ? "Verifying..." : "Verify & Enable"}
                  </button>
                  <button type="button" onClick={reset} className="px-6 text-sm text-brand-gray hover:text-brand-black">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ---------------- backup codes ---------------- */}
          {step === "codes" && (
            <div className="space-y-5">
              <p className="text-sm text-emerald-700">Two-factor is now active on your account.</p>
              <p className="text-sm text-brand-gray leading-relaxed">
                Save these backup codes somewhere safe and offline. Each one works once, and they are the only way back
                in if you lose your device. This is the last time they will be shown.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-brand-cream border border-brand-border p-4">
                {backupCodes.map((bc) => (
                  <span key={bc}>{bc}</span>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join("\n"));
                    setCopied(true);
                  }}
                  className="flex items-center gap-2 border border-brand-border px-6 py-3 text-[13px] tracking-[0.15em] uppercase hover:border-brand-black"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy Codes"}
                </button>
                <button
                  onClick={() => {
                    setBackupCodes([]);
                    reset();
                  }}
                  className="bg-brand-black text-white px-8 py-3 text-[13px] tracking-[0.15em] uppercase font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border border-brand-border bg-white p-8 mt-6">
          <h2 className="text-xl mb-3">Password</h2>
          <p className="text-sm text-brand-gray leading-relaxed mb-5">
            Minimum 12 characters. Passwords that appear in known public breaches are rejected. Changing your password
            signs out every other device.
          </p>
          <a
            href="/forgot-password"
            className="inline-block border border-brand-border px-8 py-3.5 text-[13px] tracking-[0.15em] uppercase hover:border-brand-black transition-colors"
          >
            Change Password
          </a>
        </div>
      </div>
    </PortalLayout>
  );
}

export default function PortalSecurityPage() {
  return (
    <ProtectedRoute>
      <Security />
    </ProtectedRoute>
  );
}
