import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { authClient } from "../lib/auth";

/**
 * Completes a password reset. The token comes from the emailed link and is
 * validated server-side; a successful reset revokes every other session on the
 * account, so a stolen session cannot outlive the password that leaked it.
 */
export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Both passwords must match.");
    if (password.length < 12) return setError("Use at least 12 characters.");
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) return setError(error.message ?? "This reset link is invalid or has expired.");
    setDone(true);
    setTimeout(() => navigate("/sign-in"), 2500);
  };

  return (
    <Layout>
      <section className="min-h-screen bg-brand-black flex items-center justify-center px-6 py-32">
        <div className="w-full max-w-[440px]">
          <Reveal>
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4 text-center">Client Portal</p>
            <h1 className="text-3xl md:text-4xl text-center mb-6 text-white">New Password</h1>

            {!token ? (
              <p className="text-white/60 text-sm text-center leading-relaxed">
                This page needs a valid reset link.{" "}
                <Link to="/forgot-password" className="text-brand-gold underline">
                  Request a new one
                </Link>
                .
              </p>
            ) : done ? (
              <p className="text-white/60 text-sm text-center leading-relaxed">
                Your password has been changed and all other sessions were signed out. Redirecting you to sign in…
              </p>
            ) : (
              <>
                <p className="text-white/50 text-sm text-center mb-10 leading-relaxed">
                  Minimum 12 characters. Passwords found in known breaches are rejected.
                </p>
                <form onSubmit={submit} className="space-y-4">
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/40 px-4 py-3 focus:border-brand-gold outline-none"
                  />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/40 px-4 py-3 focus:border-brand-gold outline-none"
                  />
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <button
                    disabled={loading}
                    className="w-full bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold-light transition-colors disabled:opacity-50 font-medium"
                  >
                    {loading ? "Saving..." : "Change Password"}
                  </button>
                </form>
              </>
            )}
          </Reveal>
        </div>
      </section>
    </Layout>
  );
}
