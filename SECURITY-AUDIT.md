# Calixto Agency — Enterprise Security Audit (Pass 1: Findings)

Date: 2026-08-04 · Auditor role: Principal AppSec / Secure Software Architect
Scope: full monorepo `/home/user/calixto-agency` (web frontend, Hono API, Turso/SQLite DB, Tigris S3 storage, Expo mobile).
Method: manual source review of every route, middleware, auth config, storage call and frontend component + safe, non-destructive live testing against the dev instance.

> No real secret value is reproduced in this document. Where a secret is referenced, only its variable name is used.

---

## 1. Architecture inventory

| Layer | Technology |
|---|---|
| Frontend (web) | React 19 + Wouter + Tailwind 4, bundled by Vite 7 |
| Frontend (mobile) | Expo + React Native + expo-router |
| Backend | Hono 4 (`.basePath("api")`), run by Vite middleware in dev, Bun.serve in prod (`src/server.ts`) |
| Database | Turso / libSQL (SQLite) via Drizzle ORM 0.45 |
| AuthN | better-auth 1.6.19 (email+password, scrypt) + `@runablehq/managed-auth` (Google OIDC) + `@better-auth/expo` (Bearer) |
| AuthZ | Custom `role` field on `user` (`client` \| `admin`) + `requireAuth` / `requireAdmin` middleware |
| File storage | Tigris (S3-compatible) via `@aws-sdk/client-s3`, presigned PUT/GET |
| Third parties | Runable managed auth issuer, Runable analytics collector, Google Fonts, Google Maps embed |
| Payments | **None implemented** (explicitly out of scope this phase) — no card data is processed or stored |

### API endpoint inventory (pre-fix)

| Method | Path | AuthN | AuthZ | Notes |
|---|---|---|---|---|
| GET | /api/services, /:slug | none | public | read-only |
| POST/PUT/DELETE | /api/services[/:id] | yes | admin | mass assignment |
| GET | /api/testimonials | none | public | |
| POST/PUT/DELETE | /api/testimonials[/:id] | yes | admin | mass assignment |
| GET | /api/faqs | none | public | |
| POST/PUT/DELETE | /api/faqs[/:id] | yes | admin | mass assignment |
| GET | /api/blog, /blog/:slug | none | public | returns unpublished posts too |
| POST/PUT/DELETE | /api/blog[/:id] | yes | admin | mass assignment |
| POST | /api/contact | none | public | no validation, no rate limit |
| GET/PUT/DELETE | /api/contact[/:id] | yes | admin | |
| POST | /api/quotes | none | public | no validation, no rate limit |
| GET/PUT/DELETE | /api/quotes[/:id] | yes | admin | |
| GET | /api/feedback | none | public | approved only — OK |
| POST | /api/feedback | none | public | no rate limit |
| GET | /api/feedback/all, PUT/DELETE /:id | yes | admin | |
| GET/POST | /api/portal/orders | yes | owner/admin | POST mass assignment |
| PUT | /api/portal/orders/:id | yes | admin | mass assignment |
| POST | /api/portal/documents/presign | yes | **any user** | unsanitised filename |
| POST | /api/portal/documents | yes | **any user** | **arbitrary `userId` + `key`** |
| GET | /api/portal/documents | yes | owner/admin | OK |
| GET | /api/portal/documents/:id/url | yes | **NO OWNERSHIP CHECK** | **critical IDOR** |
| DELETE | /api/portal/documents/:id | yes | **NO OWNERSHIP CHECK** | **critical IDOR** |
| GET/POST | /api/portal/messages | yes | owner/admin | OK-ish |
| GET | /api/portal/clients | yes | admin | returns full user rows |
| PUT | /api/portal/clients/:id/role | yes | admin | unvalidated role value |
| * | /api/auth/* | better-auth | — | |

---

## 2. Findings

Severity uses CVSS-style qualitative banding. IDs are `CA-nn`.

### CRITICAL

**CA-01 — IDOR: any authenticated user can download any client's confidential document**
`GET /api/portal/documents/:id/url` loads the row by id and immediately mints a 10-minute presigned S3 GET URL with **no check that the document belongs to the caller**. Any registered client (registration is open and self-service) could enumerate `id=1..N` and exfiltrate every passport, tax document and immigration file in the system.
`packages/web/src/api/routes/portal.ts` → `/documents/:id/url`
OWASP A01:2021 Broken Access Control / API1:2023 BOLA.

**CA-02 — IDOR: any authenticated user can delete any client's document record**
`DELETE /api/portal/documents/:id` has the same missing ownership check. Destructive, cross-tenant.

**CA-03 — Mass assignment on document registration → cross-tenant file theft and planting**
`POST /api/portal/documents` does `values({ ...body, userId: body.userId ?? user.id })`. A client can (a) set `userId` to another user and plant a document in their account, and (b) set `key` to an S3 object key belonging to another client, then call CA-01's endpoint on their own record to download it. Fully client-controlled `key` defeats the entire storage isolation model.

**CA-04 — CORS reflects any origin with `credentials: true`**
`cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] })` echoes back whatever `Origin` the attacker sends and allows credentials. Any malicious site can make authenticated cross-origin requests as a logged-in victim and read the responses — full account takeover of the portal and admin panel from a drive-by page. `exposeHeaders: set-auth-token` also hands the attacker the bearer token.
Compounded by `trustedOrigins` falling back to `["*"]` in `auth.ts`.

### HIGH

**CA-05 — Unrestricted file upload (type, size, name)**
`POST /api/portal/documents/presign` accepts any `filename` and `contentType` and builds the key as `uploads/${Date.now()}-${filename}`. No extension allowlist, no MIME allowlist, no size cap, no filename sanitisation. `filename = "../../public/evil.html"` walks the key namespace; `.html`/`.svg` objects served from the bucket origin enable stored XSS; `.exe`/`.js` objects turn the bucket into malware hosting. Keys are not namespaced per user, so they are guessable.

**CA-06 — No rate limiting anywhere**
Login, registration, password reset, contact form, quote form, feedback form, presign and all API reads are unthrottled. Enables credential stuffing/brute force, spam flooding of the inboxes and feedback wall, and cheap resource exhaustion. better-auth's built-in `rateLimit` is not enabled.

**CA-07 — Mass assignment on orders and all admin content routes**
`POST /api/portal/orders` spreads the raw body: a client can set `status: "completed"`, `amount`, `createdAt`, or `id`. Every admin content route (`services`, `blog`, `faqs`, `testimonials`) does the same, allowing column overwrite (e.g. forcing a duplicate `slug`, corrupting `createdAt`).

**CA-08 — No input validation on any endpoint**
No schema validation on any request body. `zod` is already a dependency but unused server-side. Unbounded string lengths allow storage abuse; missing type checks cause 500s that leak stack context.

**CA-09 — No request body size limit**
Neither the Hono app nor `Bun.serve` caps request size. A single large JSON POST can exhaust memory.

**CA-10 — No security headers**
No HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` or frame-ancestors control on any response. Exposes the app to clickjacking, MIME sniffing, referrer leakage of portal URLs and unrestricted third-party script execution.

**CA-11 — Weak authentication policy**
`emailAndPassword: { enabled: true }` uses defaults only: 8-character minimum, no email verification, no session lifetime tuning, no cookie hardening (`secure` / `sameSite` not pinned), no explicit revocation-on-password-change. Password reset is not configured at all.

### MEDIUM

**CA-12 — Excessive data exposure on `GET /api/portal/clients`**
Returns `SELECT *` of the `user` table to admins, including OIDC-related columns and timestamps not needed by the UI. Violates data minimisation.

**CA-13 — Unpublished content is publicly readable**
`GET /api/blog` and `GET /api/testimonials` ignore the `published` flag, so drafts and unapproved testimonials are served to anonymous visitors via the API even though the UI hides them.

**CA-14 — Role change accepts arbitrary values**
`PUT /api/portal/clients/:id/role` writes `role` straight from the body — any string is accepted, and an admin can demote themselves and lock the organisation out of the admin panel.

**CA-15 — No audit logging**
No record of logins, document uploads/downloads/deletions, role changes or admin actions. For a business holding immigration and tax documents this blocks incident response and breaches basic CIS Control 8 / NIST DE.CM expectations.

**CA-16 — Verbose error handling**
No `onError` handler. Unhandled exceptions surface framework stack traces to the client in dev and produce inconsistent responses in prod. Information disclosure.

**CA-17 — Static file serving path handling is fragile**
`server.ts` sanitises with `.replaceAll("..", "")` on the decoded path. It happens to hold for known payloads but is a denylist, not a containment check; it must be replaced with a normalise-then-verify-prefix approach.

**CA-18 — Messages endpoint allows arbitrary `orderId` association**
`POST /api/portal/messages` accepts `orderId` without verifying the order belongs to the sender, allowing a client to attach messages to another client's order thread (write-side IDOR; read side is correctly scoped).

### LOW / INFORMATIONAL

**CA-19 — Test/seed account with a known password exists in the database** (`testclient2@example.com`, elevated to `admin`). Must be removed before production.
**CA-20 — Presigned GET URLs (10 min) are bearer-capability URLs**; if a client forwards one, anyone can fetch the document. Acceptable but should be shortened and logged.
**CA-21 — Account enumeration** via better-auth's distinct sign-in/sign-up error responses (framework-level, partially mitigated by rate limiting).
**CA-22 — `favicon.ico` is a PNG renamed**; cosmetic, no security impact.
**CA-23 — Client-side authorisation** (`ProtectedRoute`) is correctly duplicated server-side — no finding, verified.
**CA-24 — XSS**: no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval` anywhere in web or mobile. React auto-escaping covers all user-generated content (feedback, messages, contact). No finding.
**CA-25 — SQL injection**: all queries use Drizzle's parameterised builder; no raw SQL string concatenation anywhere. No finding.
**CA-26 — Secrets**: all secrets read from `process.env`; `.env` is git-ignored; no hardcoded credential in source; no secret is referenced from a `VITE_`-prefixed variable except the intentionally public `VITE_RUNABLE_AUTH_ISSUER` / `VITE_APPLICATION_ID`. No secret leaks into the client bundle (verified against `dist/assets/*.js`). No finding, with rotation guidance below.

---

Pass 2 (post-remediation verification, fixes applied and re-tested) is appended at the end of this document.

# Pass 2 — Post-Remediation Verification

**Date:** 10 August 2026
**Scope:** `packages/web` (Hono API + React SPA + Bun server), `packages/mobile` (Expo client), Turso/libSQL database, Tigris/S3 object storage, better-auth session layer.
**Method:** source re-review of every file changed in remediation, plus two automated black-box suites run against the live server (`security-test.sh`, 32 checks, unauthenticated/negative; `security-test-idor.sh`, 28 checks, two real accounts exercising cross-tenant access), plus manual authenticated verification with a real admin browser session.

---

## 1. Verification results

| Suite | Checks | Pass | Fail |
| --- | --- | --- | --- |
| `security-test.sh` (unauthenticated, headers, injection, enumeration) | 32 | 32 | 0 |
| `security-test-idor.sh` (cross-tenant, IDOR, mass assignment, upload abuse) | 28 | 28 | 0 |
| Web typecheck (`tsc --noEmit`) | — | pass | — |
| Web production build (`vite build`) | — | pass | — |
| Mobile typecheck (`tsc --noEmit`) | — | pass | — |

Manual authenticated verification (admin `owner@calixtoagency.com`, browser session, not curl):
- `/admin/audit` renders 49 recorded events with 30 denied attempts highlighted — the denials produced by the IDOR suite are all present, so the audit trail actually captures attacks rather than only happy paths.
- `/admin/feedback` moderation and `/portal/documents` upload UI both render and function with hardening in place — no regression from CSP, body limits or rate limiting.
- Non-admin session hitting `/api/audit` and `/api/portal/clients` receives `403 Forbidden`; the denial itself is written to the audit log.

---

## 2. Status by finding

| ID | Finding | Status |
| --- | --- | --- |
| CA-01 | IDOR on document download URL | **Fixed** — ownership check, responds 404 (no existence oracle) |
| CA-02 | IDOR on document delete | **Fixed** — ownership check + S3 object removal |
| CA-03 | Mass assignment on document register | **Fixed** — `userId` from body ignored, key must match `uploads/<userId>/`, `HeadObject` verifies real size/type |
| CA-04 | Permissive CORS / `trustedOrigins: ["*"]` | **Fixed** — strict allowlist in `lib/origins.ts` |
| CA-05 | Unrestricted file upload | **Fixed** — MIME+extension allowlist, 25 MB cap, filename sanitising, per-user nanoid namespace, forced `attachment` disposition |
| CA-06 | No rate limiting | **Fixed** — global fixed-window limiter + better-auth limits (sign-in 5/5min, sign-up 5/hr) |
| CA-07 / CA-08 | Missing input validation | **Fixed** — zod schemas on every write route |
| CA-09 | No request body limit | **Fixed** — 256 KB `bodyLimit` + `Bun.serve maxRequestBodySize` |
| CA-10 | Missing security headers | **Fixed** — HSTS, nosniff, referrer policy, permissions policy, CSP with `frame-ancestors` allowlist |
| CA-11 | Weak auth/session config | **Fixed** — 12-char minimum, 7d session / 1d refresh / 15m freshness, secure+httpOnly+sameSite cookies, sessions revoked on password reset |
| CA-12 | Over-broad client data exposure | **Fixed** — explicit column projection |
| CA-13 | Drafts readable publicly | **Fixed** — publish gating on blog and testimonials |
| CA-14 | Role escalation / self-demotion | **Fixed** — role enum + self-demotion block |
| CA-15 | No audit trail | **Fixed** — append-only `audit_logs`, admin read-only viewer |
| CA-16 | Stack traces in error responses | **Fixed** — opaque errors in production |
| CA-17 | Path traversal on static/document serving | **Fixed** — normalise-then-verify-prefix containment |
| CA-18 | Message not bound to order ownership | **Fixed** — ownership join enforced |
| CA-19 | Seeded accounts with known passwords | **Fixed** — all test accounts purged; owner self-registers, `bootstrap-admin.ts` grants role server-side |
| CA-20…CA-26 | Logging, secrets, transport, dependency hygiene | **Fixed or accepted** — see §3 and §4 |

No finding from Pass 1 remains unaddressed in application code.

---

## 3. Per-domain status

**Authentication** — better-auth with hardened cookie and session policy. No password is stored or logged by application code. Role changes only take effect after re-login because better-auth caches the session role for 300s; this is documented behaviour, not a defect, but operators must know it.

**Authorisation** — every portal route derives `userId` from the session, never from the request. Admin routes check role server-side; the client-side admin nav is cosmetic only. Cross-tenant reads and writes return 404 rather than 403 to avoid confirming that another tenant's record exists.

**API surface** — all writes validated with zod, all responses use explicit status codes, unknown routes return a uniform 404, errors are opaque in production.

**Database** — Drizzle parameterised queries throughout; no string-built SQL anywhere in the codebase. Injection probes in the test suite (quote, comment, union, boolean payloads) all fail safely.

**File storage** — presigned PUT/GET with short expiry, per-user key namespace, type and size allowlist, forced attachment download, delete removes the S3 object. Note: signing `ServerSideEncryption: AES256` breaks Tigris presigns (`400 AccessDenied`); Tigris encrypts at rest by default, so encryption is provider-side rather than header-driven.

**Transport & headers** — HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a CSP tuned per response type. `X-Frame-Options: DENY` is intentionally **not** sent because the hosting platform renders the site inside a preview iframe; clickjacking is instead controlled by the CSP `frame-ancestors` allowlist, which is the stricter and more expressive of the two.

**Secrets** — all read from `process.env`; `.env` is git-ignored; the built client bundle was grepped and contains no secret material.

**Logging** — audit log records actor, action, target, outcome and IP. It deliberately never records document contents, message bodies, tokens or credentials, so the log itself is not a secondary breach target.

---

## 4. Dependencies

`bun audit` went from **146 → 113** advisories (2 critical, 52 high, 47 moderate, 12 low) after upgrading better-auth `1.6.19 → 1.6.26` (closes GHSA-qq9h-g4jm-xgf3) and pinning `fast-xml-parser ≥5.7.0`, `hono ≥4.12.18`, `nanoid ≥5.1.16` via root `overrides`.

Everything still flagged is transitive and confined to the development and mobile build toolchain — `shell-quote`, `js-yaml`, `ws`, `node-tar`, `vite`, `esbuild`, `electron-builder`, `@babel/core`, `undici`. **None of them execute in the deployed web runtime.** The two remaining critical advisories (`shell-quote` via `react-native`, `node-tar` via the build toolchain) cannot be resolved without a breaking upgrade of React Native itself; they should be revisited at the next Expo SDK bump.

---

## 5. Operational recommendations (not code)

1. **Rotate every credential before going live** — Turso token, Tigris keys, `BETTER_AUTH_SECRET`, Google OAuth client secret. Rotate again whenever anyone with access leaves. Rotating `BETTER_AUTH_SECRET` invalidates all sessions, so schedule it.
2. **Backups** — enable Turso point-in-time recovery and take a weekly logical dump held off-platform. Enable Tigris object versioning so a deleted or overwritten client document is recoverable. Test a restore at least once; an untested backup is a hypothesis.
3. **Rate limiting is in-memory** — counters reset on restart and do not span instances. Move to a shared store (Turso table or Redis) before running more than one instance.
4. **Retention** — client documents are legal paperwork. Define and enforce a deletion schedule; do not keep files indefinitely by default.
5. **Monitoring** — alert on spikes in `*.access_denied` audit events; that is the earliest signal of an active probe.
6. **Least privilege on storage** — the Tigris key should be scoped to this bucket only.

---

## 6. Security score

**87 / 100.**

Points earned: no known application-level vulnerability remains, tenant isolation is enforced and proven by automated cross-account tests, inputs are validated, uploads are constrained, and a tamper-evident audit trail exists.

Points withheld: rate limiting is single-instance and in-memory (−4); two critical transitive advisories remain in the mobile build chain (−3); no automated dependency-scanning or backup-restore drill is in place yet (−3); secrets have not yet been rotated post-development (−3).

---

## 7. Limits of this audit

This was a code review plus automated black-box testing performed by an AI agent against a development environment. It is not a penetration test. It did not include human adversarial testing, business-logic abuse testing, social-engineering assessment, infrastructure or DNS review, or any assessment of the hosting platform itself. Findings are only as current as today's code and today's dependency tree.

**No system is 100% secure, and this one is not being claimed as such.** Before handling real client legal documents at volume, commission an independent human penetration test and repeat it after any significant feature release.

---

# Pass 3 — Go-live hardening (16 August 2026)

Pass 1 found and Pass 2 verified the application-level defects. Pass 3 addressed
the category those passes could not: controls that only matter when the system
faces real users, real credentials and real consequences — credential-attack
defence, operational recovery, and the separation between what code can fix and
what only the owner can.

The full procedure lives in **`GO-LIVE.md`**, rendered in-app at
`/admin/security-report`. This section records what changed and how the score moved.

## What was added

| Area | Control | Where |
| --- | --- | --- |
| Configuration | Boot guard; refuses to start in production on a weak, missing, placeholder or non-HTTPS setting | `api/lib/env-guard.ts` |
| Credential attack | Per-account lockout (8 failures / 15 min → `423`), failed-login telemetry | `api/lib/login-guard.ts` |
| Credential attack | TOTP two-factor with one-time backup codes | `auth.ts`, `portal/security.tsx`, `two-factor.tsx` |
| Credential attack | Breached-password rejection (k-anonymity, no password leaves the server) | `auth.ts` |
| Credential attack | Auth rate-limit counters moved from process memory to the database | `auth.ts`, `rate_limit` table |
| Account recovery | Password reset email, enumeration-resistant responses | `api/lib/mailer.ts`, `forgot-password.tsx`, `reset-password.tsx` |
| Operations | Backup with credential redaction, dry-run restore, retention enforcement | `api/ops/` |
| Operations | Destructive scripts refuse to run against production without an explicit override | `api/lib/guard-script.ts` |
| Operations | Secret-exposure scanner, validated against a planted canary | `scripts/scan-secrets.sh` |
| Visibility | Live security posture console and in-app runbook, both admin-only | `admin/security.tsx`, `admin/security-report.tsx` |
| Assurance | Single aggregate gate running every automated check | `scripts/go-live-check.sh` |

## Findings raised and fixed during Pass 3

**CA-27 — Security documentation compiled into the public client bundle.**
The runbook was first rendered via a Vite `?raw` import, which placed the
complete list of blockers, unmitigated risks and architectural weak points into
a JavaScript file any anonymous visitor could fetch. That is weeks of attacker
reconnaissance handed over for free. Replaced with an admin-only
`GET /api/docs/:id` reading from a two-entry filename allowlist. The build is now
asserted to contain no trace of it.

**CA-28 — Two-factor enrolment was impossible.**
The `two_factor` table lacked `failed_verification_count`, so better-auth
rejected every enrolment. Beyond the outage, that column *is* the brute-force
counter on the six-digit code: without it there is no limit on guessing a TOTP.
Added and applied to the database.

**CA-29 — Admin document route returned 500 for every request.**
`routes/docs.ts` used `import.meta.dir`, which is Bun-only and `undefined` under
Vite's SSR transform. Now derived from `import.meta.url`.

**CA-30 — Second factor verified but never landed the user.**
After a correct code the client navigated with the router while the session hook
still held its pre-challenge result, so the portal guard bounced the user back to
sign-in — a correct login that looked like a failed one. Now a full page load.

CA-27 was a real exposure. CA-28 through CA-30 were availability defects in new
security features, each of which would have made 2FA unusable in production —
and an unusable security control is one that gets turned off.

## Verification

`bun run golive` — 9 steps, 0 failures:
web typecheck · mobile typecheck · production build · bundle-leak grep ·
secret scan (5/0) · config guard, production profile (15 pass, 0 warn, 0 fail) ·
runtime suite (32/0) · authorization & IDOR suite (28/0) ·
authentication hardening suite (28/0). **88 assertions, 0 failures.**

Manually exercised in a browser: full 2FA loop, both runbook tabs, the audit log,
and the reset screens.

## Score after Pass 3

**Application code: 94 / 100** (was 87).

Recovered: credential-attack defence is now layered rather than password-only
(+4); backup, restore and retention tooling exists and is tested (+3).

Still withheld: the application rate limiter remains single-instance and
in-memory (−3); the audit log is deletable at the database layer (−2); documents
have no application-layer encryption above provider-side encryption at rest (−1).

**Production readiness is a separate and lower number — 62 / 100 — and the gap is
entirely the five manual blockers in `GO-LIVE.md` §B.** Credentials have not been
rotated, production and development still share a database and a bucket, and no
restore has ever been performed. Each of those alone can lose every client
document, and no application-level control compensates for any of them.

The limits stated in §7 apply unchanged to this pass. No compliance framework has
been assessed, and no system here is claimed to be fully secure.
