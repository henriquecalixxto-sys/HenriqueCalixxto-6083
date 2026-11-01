import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { twoFactor } from "better-auth/plugins/two-factor";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { runableManagedAuth } from "@runablehq/managed-auth/server";
import { db } from "./database";
import { trustedOrigins } from "./lib/origins";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),

  emailAndPassword: {
    enabled: true,
    // Passwords are hashed with scrypt (memory-hard) by better-auth — never stored in plaintext.
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // Invalidate every other session when the password changes (stops session persistence after takeover).
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 15, // 15 minutes
    // Password reset links are single-use and short-lived; sending the email is
    // wired to the platform mailer. Until an SMTP/provider credential is configured
    // this throws rather than silently pretending the mail was sent.
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import("./lib/mailer");
      await sendPasswordResetEmail(user.email, url);
    },
  },

  secret: process.env.BETTER_AUTH_SECRET,

  // Strict allowlist. Previously fell back to ["*"], which trusted every origin.
  trustedOrigins: trustedOrigins(),

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days absolute
    updateAge: 60 * 60 * 24, // sliding refresh once per day
    freshAge: 60 * 15, // sensitive operations require a session <15 min old
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    useSecureCookies: isProd,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
    },
  },

  // Built-in throttling for every /api/auth/* route: blunts credential stuffing,
  // registration spam and password-reset abuse. Complements the app-level limiter.
  rateLimit: {
    enabled: true,
    // Counters live in the database, not process memory: restarting the server
    // no longer resets an attacker's budget, and the limit holds across instances.
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 300, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 5 },
      "/change-password": { window: 3600, max: 10 },
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "client",
        // `input: false` is the privilege-escalation guard: the role can never be
        // set through sign-up or profile-update payloads, only server-side.
        input: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      company: {
        type: "string",
        required: false,
      },
    },
  },

  plugins: [
    // TOTP two-factor. Enrolment is self-service in /portal/security; admin
    // accounts are expected to enable it before go-live.
    twoFactor({
      issuer: "Calixto Agency",
      totpOptions: { digits: 6, period: 30 },
      skipVerificationOnEnable: false,
    }),
    // Rejects passwords that appear in known breach corpora, using the
    // k-anonymity range API (only a 5-character SHA-1 prefix ever leaves the
    // server — the password itself is never transmitted). No API key required.
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "This password has appeared in a known data breach. Please choose a different one.",
    }),
    ...runableManagedAuth({
      applicationId: process.env.APPLICATION_ID!,
      issuer: process.env.VITE_RUNABLE_AUTH_ISSUER!,
    }),
    expo(),
  ],
});
