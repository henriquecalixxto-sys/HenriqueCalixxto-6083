import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { authClient } from "../lib/auth";

export default function SignUpPage() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.signUp.email({ email: form.email, password: form.password, name: form.name });
    setLoading(false);
    if (error) setError(error.message ?? "Sign up failed.");
    else navigate("/portal");
  };

  const google = async () => {
    const result = await authClient.managedAuth.signIn({ provider: "google" });
    if (result.error && result.error.code !== "POPUP_CLOSED") setError(result.error.message ?? "Sign in failed.");
    else navigate("/portal");
  };

  return (
    <Layout>
      <section className="min-h-screen bg-brand-black flex items-center justify-center px-6 py-32">
        <div className="w-full max-w-[440px]">
          <Reveal>
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4 text-center">Client Portal</p>
            <h1 className="text-3xl md:text-4xl text-center mb-10 text-white">Create Account</h1>

            <button
              onClick={google}
              className="w-full border border-white/25 bg-white text-brand-black px-4 py-3 mb-6 flex items-center justify-center gap-3 hover:border-brand-gold transition-colors text-sm font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.8 14.3-5l-6.6-5.4C29.7 35.3 27 36 24 36c-5.3 0-9.6-3.1-11.3-7.5l-6.6 5.1C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.6 5.4C41.7 36 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-white/15 flex-1" />
              <span className="text-xs text-white/40 uppercase">or</span>
              <div className="h-px bg-white/15 flex-1" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              <input
                required
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/40 px-4 py-3 focus:border-brand-gold outline-none"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/40 px-4 py-3 focus:border-brand-gold outline-none"
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/40 px-4 py-3 focus:border-brand-gold outline-none"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                disabled={loading}
                className="w-full bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold-light transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <p className="text-center text-sm text-white/60 mt-8">
              Already have an account? <Link to="/sign-in" className="text-brand-gold underline">Sign in</Link>
            </p>
          </Reveal>
        </div>
      </section>
    </Layout>
  );
}
