import { useState } from "react";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { authClient } from "../lib/auth";

/**
 * Second-factor challenge. Reached only after a correct password when the
 * account has TOTP enabled — until this succeeds no session cookie is issued.
 */
export default function TwoFactorPage() {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: code.trim() })
        : await authClient.twoFactor.verifyBackupCode({ code: code.trim() });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "That code was not accepted.");
      setCode("");
      return;
    }
    // A full page load, not a client-side route change: the session hook still
    // holds the pre-challenge "no session" result, and the portal guard would
    // bounce straight back to /sign-in before the cache revalidates.
    window.location.href = "/portal";
  };

  return (
    <Layout>
      <section className="min-h-screen bg-brand-black flex items-center justify-center px-6 py-32">
        <div className="w-full max-w-[440px]">
          <Reveal>
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4 text-center">Security Check</p>
            <h1 className="text-3xl md:text-4xl text-center mb-4 text-white">Two-Factor</h1>
            <p className="text-white/50 text-sm text-center mb-10 leading-relaxed">
              {mode === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter one of your saved backup codes. Each code works once."}
            </p>

            <form onSubmit={submit} className="space-y-4">
              <input
                required
                autoFocus
                inputMode={mode === "totp" ? "numeric" : "text"}
                autoComplete="one-time-code"
                placeholder={mode === "totp" ? "000000" : "Backup code"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/30 px-4 py-3 text-center tracking-[0.4em] focus:border-brand-gold outline-none"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                disabled={loading || code.trim().length < 6}
                className="w-full bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold-light transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>

            <button
              onClick={() => {
                setMode(mode === "totp" ? "backup" : "totp");
                setCode("");
                setError("");
              }}
              className="w-full text-center text-sm text-white/50 hover:text-brand-gold transition-colors mt-8"
            >
              {mode === "totp" ? "Lost your device? Use a backup code" : "Use your authenticator app instead"}
            </button>
          </Reveal>
        </div>
      </section>
    </Layout>
  );
}
