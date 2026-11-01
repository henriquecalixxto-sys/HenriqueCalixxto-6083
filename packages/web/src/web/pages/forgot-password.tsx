import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "../components/layout";
import { Reveal } from "../components/reveal";
import { authClient } from "../lib/auth";

/**
 * Password reset request.
 *
 * The confirmation message is identical whether or not the address exists — this
 * form must not become a way to test which emails have accounts here.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" }).catch(() => null);
    setLoading(false);
    setSent(true);
  };

  return (
    <Layout>
      <section className="min-h-screen bg-brand-black flex items-center justify-center px-6 py-32">
        <div className="w-full max-w-[440px]">
          <Reveal>
            <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4 text-center">Client Portal</p>
            <h1 className="text-3xl md:text-4xl text-center mb-4 text-white">Reset Password</h1>

            {sent ? (
              <>
                <p className="text-white/60 text-sm text-center leading-relaxed mb-8">
                  If an account exists for <span className="text-white">{email}</span>, a reset link is on its way. The
                  link is valid for 15 minutes and can be used once.
                </p>
                <p className="text-center text-sm">
                  <Link to="/sign-in" className="text-brand-gold underline">
                    Back to sign in
                  </Link>
                </p>
              </>
            ) : (
              <>
                <p className="text-white/50 text-sm text-center mb-10 leading-relaxed">
                  Enter the email on your account and we'll send you a single-use reset link.
                </p>
                <form onSubmit={submit} className="space-y-4">
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-white/20 bg-white/5 text-white placeholder:text-white/40 px-4 py-3 focus:border-brand-gold outline-none"
                  />
                  <button
                    disabled={loading}
                    className="w-full bg-brand-gold text-brand-black px-8 py-4 text-[13px] tracking-[0.15em] uppercase hover:bg-brand-gold-light transition-colors disabled:opacity-50 font-medium"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
                <p className="text-center text-sm text-white/60 mt-8">
                  <Link to="/sign-in" className="hover:text-brand-gold transition-colors">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </Reveal>
        </div>
      </section>
    </Layout>
  );
}
