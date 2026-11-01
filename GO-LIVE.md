# Calixto Agency — Go-Live Security Runbook

**Version 1.1 · 16 August 2026**
Covers the production launch of the Calixto Agency web application, client portal and mobile app.

This runbook is split into two halves. **Part A** lists what has already been implemented, in code, and how each item was verified. **Part B** lists what only you can do, because it requires access to accounts, billing and credentials that no automated process here holds.

Nothing in this document claims the application is fully secure, and nothing here claims compliance with SOC 2, PCI DSS, HIPAA, GDPR, CCPA or any other framework. None of those has been independently assessed. Where a control happens to align with a common expectation of those frameworks, that alignment is a by-product, not a certification.

---

# Part A — Automatically implemented

Every item below was changed in the codebase and verified by a command whose output is recorded in §A.13.

## A.1 Boot-time configuration guard

`packages/web/src/api/lib/env-guard.ts` runs on every server start and refuses to boot in production when a security-relevant setting is wrong.

It checks that all eight required secrets are present; that `BETTER_AUTH_SECRET` is at least 32 characters with ≥128 bits of measured entropy; that no secret matches a placeholder pattern (`changeme`, `test`, `your-...`); that `WEBSITE_URL` and `S3_ENDPOINT` are HTTPS; that `DATABASE_URL` points at a managed remote libSQL endpoint rather than a local file; and that no `VITE_`-prefixed variable has a secret-shaped name.

Refusing to start is deliberate. A silent misconfiguration — say `BETTER_AUTH_SECRET` missing and quietly defaulted — produces an application that looks healthy while every session token it issues is forgeable. A server that will not start gets fixed in minutes; a server that starts insecurely can run for months.

Inspect the verdict at any time without starting the server:

```bash
bun run security:config                       # current environment
NODE_ENV=production bun run security:config   # simulate the production verdict
```

Exit code 1 on any fatal failure, so it can gate a deployment pipeline.

## A.2 HTTPS enforcement

In production the API rejects any request whose `x-forwarded-proto` is not `https` with a `403`. Combined with `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` and `Secure` cookies, a plain-HTTP request cannot reach application logic or carry a session.

## A.3 Account lockout and failed-login tracking

`packages/web/src/api/lib/login-guard.ts` adds a second throttling layer keyed on the **account identifier**, not just the IP address.

This matters because the existing IP-based limiter is trivially defeated by a distributed attacker: a thousand hosts each making four attempts never trips a per-IP limit, but between them they get four thousand guesses at one password. Keying on the account closes that.

- 8 failed attempts within 15 minutes pauses sign-in for that account and returns `423 Locked`.
- The lockout is a cooldown, never a permanent disable, so it cannot be weaponised to lock a real customer out of their own documents indefinitely.
- A successful sign-in clears the counter immediately.
- Every attempt — success and failure — is recorded in the `login_attempts` table with email, IP, user agent and timestamp. **The submitted password is never read, hashed, logged or persisted anywhere in this path.**
- Attempt history is pruned after 30 days; it is security telemetry, not a permanent record.
- An admin can clear a cooldown for a customer who locked themselves out, via `POST /api/security/unlock`. That action is itself audit-logged.

## A.4 Two-factor authentication (TOTP)

The better-auth `twoFactor` plugin is enabled, issuer `Calixto Agency`, 6 digits on a 30-second period.

- Self-service enrolment at **`/portal/security`**: confirm current password → scan QR → verify a live code → receive 10 single-use backup codes.
- Requiring the current password before enrolment means a stolen *session* cannot silently bind an attacker's authenticator to the account.
- `skipVerificationOnEnable: false` — the flag is only set after a real code is verified, so nobody can lock themselves out with a mis-scanned QR.
- Sign-in with 2FA enabled returns `twoFactorRedirect` and issues **no session** until `/two-factor` succeeds.
- Secrets and backup codes are stored in the `two_factor` table, encrypted at rest by better-auth using `BETTER_AUTH_SECRET`, and are never returned by any API response.

2FA is available to every user and **expected on every admin account before launch** — see §B.4, where this is a blocker.

## A.5 Breached-password rejection

The `haveIBeenPwned` plugin rejects any password appearing in known breach corpora, on sign-up and on password change.

It uses the k-anonymity range API: only the first five characters of the password's SHA-1 hash ever leave the server, so the password itself is never transmitted to a third party. No API key and no new vendor relationship is required.

Combined with the existing 12-character minimum, this blocks the single most common real-world compromise — password reuse from an unrelated breached site.

## A.6 Password reset delivery

Previously `sendResetPassword` was unconfigured, which meant reset requests appeared to succeed and delivered nothing.

`packages/web/src/api/lib/mailer.ts` now wires the flow to a provider (Resend-compatible HTTP API). In development the message is printed to the server console so the flow can be exercised without a provider. **In production, an unconfigured mailer throws rather than pretending to succeed** — a password reset that silently goes nowhere is indistinguishable from a working one from the customer's side, and that gap is how an account becomes permanently unrecoverable.

The reset UI is at `/forgot-password` and `/reset-password`. The confirmation message is identical whether or not the address exists, so the form is not a user-enumeration oracle. Tokens are single-use and expire in 15 minutes, and a completed reset revokes every other session on the account.

Adding the provider credential is a manual step — see §B.5.

## A.7 Rate-limit counters moved into the database

better-auth's limiter now uses `storage: "database"` with a `rate_limit` table instead of process memory.

In-memory counters have two holes: they reset on every restart or deploy, and they do not span instances. An attacker who notices a deploy window gets a fresh budget. Database-backed counters survive restarts and hold across instances.

The application-level limiter in `middleware/rate-limit.ts` is still in memory and still single-instance. That is a documented remaining risk (§E) rather than a blocker, because the auth endpoints — the ones that actually matter for credential attacks — are now durable.

## A.8 Destructive scripts blocked against production

`seed.ts`, `seed-feedback.ts` and `purge-test-accounts.ts` now call `guardDestructiveScript()`, which exits with an explanatory error when `NODE_ENV=production` unless `ALLOW_DESTRUCTIVE=1` is set for that single invocation.

Seed and purge scripts are the classic "ran it against prod by accident" footgun: they are convenient, they sit in the repo, and they take no arguments. `purge-test-accounts.ts` deletes user accounts.

## A.9 Development endpoints removed from the production surface

`GET /api/ping` returns `404` when `NODE_ENV=production`. It served no purpose beyond local debugging and gave an unauthenticated caller a free timing and liveness oracle. `GET /api/health` remains — an uptime monitor needs it, and it returns a fixed `{"status":"ok"}` with no internal state.

## A.10 Backup, restore and retention tooling

Three operational scripts, all dry-run or read-only by default:

**`bun run backup`** — portable JSON snapshot of all 17 tables to `backups/<timestamp>/` with a `MANIFEST.json` recording row counts. Credential columns (`account.password`, session tokens, `two_factor.secret`, `two_factor.backupCodes`, `verification.value`) are written as `__REDACTED__`. A backup is a copy of the database with none of the database's access controls, so duplicating credential material into a file that gets emailed around is a net loss. Read-only; safe against production.

**`bun run restore -- --from backups/<stamp>`** — dry run by default, prints the plan and exits. `--apply` writes; against production it additionally requires `ALLOW_DESTRUCTIVE=1`. Deletes children before parents and inserts parents before children so foreign keys hold.

**`bun run retention`** — dry run by default. Deletes documents past the retention window (default 365 days, `DOCUMENT_RETENTION_DAYS`), audit records past 400 days, login telemetry past 30 days, and contact/quote inquiries past 730 days. Object storage is deleted **before** the database row, so a crash mid-run can never leave a readable orphaned object with no record that it exists. Every retention deletion writes an audit entry attributed to `system`.

These are tools, not schedules. Scheduling them is §B.7.

## A.11 Secret exposure scanner

`./scripts/scan-secrets.sh` (`bun run security:secrets`) checks the four places a credential actually leaks from:

1. tracked source files — searched for the literal value of every secret in `.env`
2. the compiled browser bundle in `packages/web/dist`
3. git history — a secret committed once is exposed forever, and rotation is the only fix
4. `.gitignore` coverage, so `.env` cannot be committed tomorrow

It also matches well-known credential shapes (AWS `AKIA…`, Stripe `sk_live_…`, OpenAI `sk-…`, GitHub `ghp_…`, Slack `xox…`, PEM private keys) and flags `console.log` calls that print credential material.

**It never prints a secret value.** Findings are reported by variable name and file path only.

The scanner was validated against a deliberately planted canary: a file containing the real `BETTER_AUTH_SECRET` was created, the scanner detected it, and the file was removed and the scan re-run clean. A scanner that has never caught anything is not evidence of a clean repository — it is an untested detector.

## A.12 Admin security console

Three new admin views:

- **`/admin/security`** — live posture: configuration verdicts, admin accounts and their 2FA status, failed logins and denied access in the last 24 hours, accounts currently in lockout cooldown, retention settings, and the 40 most recent sign-in attempts. Config checks return a label and a pass/fail verdict only; no credential value is ever sent to the browser.
- **`/admin/audit`** — the existing append-only audit trail.
- **`/admin/security-report`** — this runbook and the full security audit, rendered in the browser. The markdown is **not** bundled into the client: it is fetched at view time from `GET /api/docs/:id`, which requires an authenticated admin session and reads from a two-entry filename allowlist. A go-live runbook is a map of the system's weakest points; shipping it in a public JS bundle would hand an attacker weeks of reconnaissance. The build is checked for this — see §A.13.

## A.13 Verification

Everything above is verified by one aggregate gate, `bun run golive`
(`scripts/go-live-check.sh`), which runs the static checks, then the three live
suites against a running server, and stops nothing — it reports every step and
exits non-zero if any failed.

Full run, 16 August 2026:

| Step | Result |
| --- | --- |
| web typecheck (`bunx tsc --noEmit`) | PASS — no errors |
| mobile typecheck (`bunx tsc --noEmit`) | PASS — no errors |
| web production build (`bunx vite build`) | PASS |
| no security docs in client bundle (`grep` over `dist`) | PASS — 0 matches |
| secret scan (`./scripts/scan-secrets.sh`) | PASS 5 / FAIL 0 |
| configuration guard, production profile | PASS 15 / WARN 0 / FAIL 0 |
| runtime security suite (`./security-test.sh`) | PASS 32 / FAIL 0 |
| authorization & IDOR suite (`./security-test-idor.sh`) | PASS 28 / FAIL 0 |
| authentication hardening suite (`./security-test-auth.sh`) | PASS 28 / FAIL 0 |

**88 automated assertions, 0 failures.**

The gate inserts a cooldown between live suites. The suites deliberately exhaust
the public form budgets (feedback is 3/hour per IP), so a second suite starting
immediately would receive `429` where it expected a `400` — the limiter working,
misread as a validation defect. The cooldown clears the persisted better-auth
counters, calls the development-only `POST /api/dev/reset-rate-limits` (which
returns `404` in production, and is asserted to be `isProd`-gated at the source
level by the authentication suite), and waits out the 60-second in-memory window.

Manually verified in a browser with an admin session:

- Sign-in → TOTP challenge → portal, using a real time-based code. `/admin/security` then reports **admins without 2FA: 0**.
- Self-service enrolment at `/portal/security`: password gate → QR and manual key → verify → one-time display of ten backup codes.
- `/admin/security-report`: both the runbook and the audit render, with a table of contents.
- `/admin/audit`: 49 events, 30 denials, denials highlighted.
- `/forgot-password` and `/reset-password` render and post correctly.

Two defects were found and fixed during this verification, neither of which the
automated suites could have caught, because both only appear once authenticated:

- `routes/docs.ts` used `import.meta.dir`, which is Bun-only and `undefined`
  under Vite's dev SSR transform, so every admin document request returned a 500.
  Now derived from `import.meta.url`.
- The `two_factor` table was missing `failedVerificationCount`, so better-auth
  refused every enrolment. Without that column there is no brute-force counter on
  the six-digit code at all. Added and pushed to the database.

**`bun audit` is not part of the gate's pass/fail.** It is printed on every run
and must be read, not skipped — see §B.10 for the runtime-versus-toolchain split.

---

# Part B — Manual action required before go-live

Each item states what to do, where, which credential is involved, why it matters, how to verify, and what happens if you skip it.

## B.1 — BLOCKER — Rotate every credential

**What.** Generate new values for all seven secrets and replace them in the production environment. The current values were created during development, have existed in a development sandbox for weeks, and must be treated as compromised.

**Where and which credential:**

| Secret | Where to rotate | Notes |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Generate locally: `openssl rand -base64 48` | Signs every session token. Rotating invalidates all sessions — everyone signs in again. Do it during a quiet window. |
| `DATABASE_AUTH_TOKEN` | Turso dashboard → your database → **Tokens** → create new, then revoke the old one | Full read/write to every client record. |
| `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` | Tigris dashboard → **Access Keys** → create new pair, scoped to this bucket only, then delete the old pair | Full access to every uploaded client document. |
| `AI_GATEWAY_API_KEY` | Runable platform → project settings | Billable. A leaked key is someone else's compute on your invoice. |
| `AUTUMN_SECRET_KEY` | Autumn dashboard | Rotate or remove — payments are out of scope this phase, so if it is unused, delete the variable entirely. |
| Google OAuth client secret | Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 client | Also confirm the authorised redirect URI is your production domain and nothing else. |

**Do not paste any of these into a chat, a ticket, a commit, or a document.** Set them only in the production environment's secret store.

**Why.** Every one of these has been present in a development environment. Development environments are not hardened, are frequently shared, and leave traces in shell history, process listings and logs. A credential that has lived in one is a credential you must assume someone else could have.

**How to verify.**
```bash
bun run security:secrets     # expect: PASS 5 / FAIL 0
bun run security:config      # expect: FAIL 0
```
Then confirm the old credentials are actually dead: attempt a connection with a revoked Turso token and a revoked Tigris key pair and confirm both are rejected. Creating a new key is not rotation — revoking the old one is. This is the step people skip.

**If you skip it.** Anyone who ever had visibility into the development environment retains full read/write access to every client document and every account, indefinitely, with no log entry that distinguishes them from you.

## B.2 — BLOCKER — Separate production from development

**What.** Create a **separate Turso database** and a **separate Tigris bucket** for production. Point the production deployment at those, and leave the current ones as development.

**Where.** Turso dashboard → Create Database. Tigris dashboard → Create Bucket. Then set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `S3_BUCKET` and the S3 key pair in the production environment only.

**Why.** Right now one database serves both. That means a seed script, a schema push, or a stray `bun run retention -- --apply` in a terminal you thought was local writes to real client data. The `guardDestructiveScript` guard from §A.8 reduces this risk but depends on `NODE_ENV` being set correctly — separate databases do not depend on anyone remembering anything.

It also means real client documents are currently reachable from a development environment. That is the wrong blast radius for legal paperwork.

**How to verify.** Set `DEV_DATABASE_URL` to the development URL in your local `.env`; the `db.separation` check in `bun run security:config` then proves the two are distinct. Upload a test document in development and confirm it does **not** appear in the production bucket listing.

**If you skip it.** One mistyped command destroys or exposes real client records, with no undo unless §B.3 is already done.

## B.3 — BLOCKER — Backups and a tested restore

**What.**
1. Turso dashboard → your production database → enable **point-in-time recovery**, retention 7 days minimum (30 preferred).
2. Tigris dashboard → your production bucket → enable **object versioning**.
3. Schedule `bun run backup` weekly and store the output **off-platform** (encrypted cloud storage or an encrypted external drive) — not in the same account as the thing it protects.
4. **Perform one full restore drill before launch:** create a scratch Turso database, run `bun run restore -- --from backups/<stamp> --apply` against it, and verify row counts match `MANIFEST.json`.

**Why.** Turso's own PITR is the primary safety net, but it lives in the same account as the database it protects. If that account is lost, compromised or closed, the backups go with it. Object versioning is what makes a deleted or overwritten client document recoverable — without it, a delete is final.

The drill is not optional. An untested backup is a hypothesis, and the moment you discover it is wrong is the moment you need it.

**Recovery expectations after all four steps:**

| | Database | Uploaded documents |
| --- | --- | --- |
| Recovery point (max data loss) | ~1 minute via Turso PITR; up to 7 days from the off-platform snapshot alone | Zero, with versioning enabled |
| Recovery time | 15–30 min (PITR) · 1–2 h (JSON restore) | Minutes per object; hours for a bulk restore |

After a JSON restore, note that credential columns are redacted by design: **every user must reset their password and re-enrol 2FA.** Plan the customer communication for that before you need it.

**If you skip it.** A bad delete, a corrupted write or a compromised token is permanent. For a business holding client legal paperwork, that is not a technical incident — it is a client-relationship and potentially a liability event.

## B.4 — BLOCKER — Admin accounts and 2FA

**What.**
1. Sign in as each admin and enable 2FA at **`/portal/security`**. Save the backup codes offline — not in the same password manager entry as the password.
2. Open `/admin/security` and confirm **Admins without 2FA reads 0**.
3. Review the admin list on the same page and remove any account that should not have the role.
4. Confirm the account is a real named person's address, not a shared mailbox.

**Which credentials.** Each admin's own password plus their authenticator app (Google Authenticator, 1Password, Authy — any TOTP app).

**Why.** An admin account reaches every client document. Without 2FA, one phished or reused password exposes the entire document store, and the audit log will faithfully record the intruder as you. The breached-password check from §A.5 helps but only covers passwords already in a public corpus.

**How to verify.** `/admin/security` shows 0 admins without 2FA. Then actually test it: sign out, sign in, and confirm you are challenged for a code at `/two-factor`.

**If you skip it.** The single most likely path to a full compromise of this system stays wide open, and it is the one path that no amount of server-side hardening can close for you.

**Status.** The full loop — enrol, sign out, get challenged, verify with a real time-based code, land in the portal — was exercised end to end on the development instance on 16 August 2026, and `/admin/security` reported 0 admins without 2FA afterwards. That proves the mechanism works; it does not enrol your production admins. Once §B.1 and §B.2 give you a separate production database, no enrolment carries over and this must be done again there.

## B.5 — BLOCKER — Password reset email delivery

**What.** Create a Resend account (or equivalent), verify your sending domain with SPF and DKIM records, then set in production:

```
RESEND_API_KEY=<from the provider dashboard>
MAIL_FROM=Calixto Agency <noreply@yourdomain.com>
```

**Why.** Without this, a customer who forgets their password in production gets an error — and their documents are unreachable until you intervene manually. Domain verification matters too: unverified senders land in spam, which for a reset email is functionally the same as not sending it.

**How to verify.** `/admin/security` shows "Password reset email: provider configured". Then run the flow end to end against a real address you control: request a reset, receive the mail, complete it, and confirm your other sessions were signed out.

**If you skip it.** In production the mailer throws rather than failing silently — so the customer sees a clear error instead of a lie — but they still cannot recover their account without you.

## B.6 — Custom domain, HTTPS and CSP

**What.** Attach your production domain through the Runable platform UI, then set `WEBSITE_URL=https://yourdomain.com`. Add that origin to the allowlist in `packages/web/src/api/lib/origins.ts` and to `connect-src` in `buildCsp()` if the API is served from a different host.

**Why.** `WEBSITE_URL` drives cookie domain, CORS allowlist and better-auth's `trustedOrigins`. If it is wrong in production, either authentication breaks entirely, or the CORS allowlist stops matching your real origin. Cookies are `Secure` in production, so over plain HTTP the session cookie is never sent and sign-in fails in a way that looks like a bug rather than a misconfiguration.

**How to verify.**
```bash
curl -sI https://yourdomain.com | grep -i strict-transport-security
curl -s -o /dev/null -w '%{http_code}\n' http://yourdomain.com   # expect a redirect or 403
```
Then load the site and confirm the browser console reports no CSP violations.

**Note on framing.** `X-Frame-Options: DENY` is intentionally **not** sent, because the platform renders the site inside a preview iframe. Clickjacking is controlled by the CSP `frame-ancestors` allowlist instead, which is stricter and more expressive. Before launch, review that allowlist and remove any platform origin you do not actually need.

## B.7 — Schedule retention and backups

**What.** Create two recurring jobs: `bun run backup` weekly, and `bun run retention -- --apply` monthly.

Run the retention job **without** `--apply` first and read the list. It deletes real client documents.

**Why.** Client paperwork is the most sensitive thing this system holds. Every extra month of retention is a month it can be stolen, subpoenaed or leaked, with no corresponding business value once the matter is closed. Retention that exists only as a policy document and never runs is not retention.

**Before you set the window,** confirm 365 days against your actual obligations. Document services may carry a statutory minimum retention that exceeds it, and a retention job that deletes something you are legally required to keep is a worse outcome than keeping it too long. Set `DOCUMENT_RETENTION_DAYS` accordingly. This is a question for a lawyer, not for a security audit.

**How to verify.** `/admin/security` shows the configured windows and the oldest document on file. After the first real run, confirm the audit log contains `document.deleted` entries attributed to `system`.

## B.8 — Monitoring and alerting

**What.** Configure alerts on: spikes in `document.access_denied` audit events, spikes in failed logins, any `role.changed` event, and application error rate.

**Where.** Your uptime/log provider, pointed at `GET /api/health` and the server's stderr stream.

**Why.** Everything is being recorded — nothing is being watched. `/admin/security` shows 24-hour counters, but that requires someone to open it. A sustained probe against the portal produces a clear signal in `login_attempts` and in the audit log, hours before it succeeds. That window only has value if something is looking at it.

**How to verify.** Trigger a deliberate failure — eight bad passwords against a test account — and confirm your alert fires.

## B.9 — Set production environment variables

Set these in the production environment only. Never commit them.

```
NODE_ENV=production
DATABASE_URL=<production Turso URL>
DATABASE_AUTH_TOKEN=<new production token>
BETTER_AUTH_SECRET=<newly generated, 48 bytes>
WEBSITE_URL=https://yourdomain.com
S3_ENDPOINT=<Tigris endpoint>
S3_BUCKET=<production bucket>
S3_ACCESS_KEY_ID=<new production key>
S3_SECRET_ACCESS_KEY=<new production secret>
RESEND_API_KEY=<from provider>
MAIL_FROM=Calixto Agency <noreply@yourdomain.com>
DOCUMENT_RETENTION_DAYS=365
```

`NODE_ENV=production` is the switch behind HSTS, `Secure` cookies, opaque error messages, the removal of `/api/ping`, the destructive-script guard and the boot-time config guard. If it is unset, all of those silently stay in development mode. Verify with `bun run security:config` and expect `FAIL: 0`.

## B.10 — Dependency advisories

`bun audit` currently reports **113** advisories (2 critical, 52 high, 47 moderate, 12 low), down from 146.

**None are in the deployed web runtime.** The split, and why the classification is not a dismissal:

**Not shipped to production — build and mobile toolchain only:** `shell-quote` (via `react-native`, critical), `node-tar` (build toolchain, critical), `js-yaml`, `ws`, `vite`, `esbuild`, `electron-builder`, `@babel/core`, `undici`.

These execute on a developer machine or a CI runner, not on the server handling client requests. That materially lowers the risk but does not make it zero, and "it's a dev dependency" is not on its own a reason to ignore something:

- A build-toolchain compromise is a **supply-chain** compromise. Malicious code executing during `vite build` can inject itself into the bundle you then ship to every visitor. That is a more severe outcome than most runtime bugs, not a lesser one.
- `shell-quote` command injection matters wherever untrusted input reaches a build script. Today nothing untrusted does. That property holds only as long as nobody adds a build step that reads external input.
- CI runners hold deployment credentials. Arbitrary code execution during a build is arbitrary code execution with access to your production secrets.

**What to actually do before production:**
1. Fix nothing further right now — no advisory sits in the request path, and the two criticals cannot be resolved without a breaking React Native upgrade that would need full mobile regression testing. Doing that in the launch window trades a theoretical risk for a real one.
2. **Restrict who can run builds** and ensure CI credentials are scoped to deployment only, never to the production database or bucket.
3. **Re-run `bun audit` at every Expo SDK bump** and clear the two criticals then. Put a calendar reminder on it; this is the item most likely to be forgotten.
4. Enable automated dependency scanning on the repository once it is under version control.

**Verify:** `bun audit` and confirm no advisory names a package imported by `packages/web/src/api/**`.

## B.11 — Version control

The project is not currently a git repository. Initialise one before launch, with `.env` ignored from the very first commit — `.gitignore` already covers it.

Without version control there is no way to see what changed, no way to roll back a bad deploy, and no way for a scanner to check history for committed secrets. The history check in `scan-secrets.sh` currently reports `SKIP` for exactly this reason.

---

# C. Summary

## A. READY FOR GO-LIVE

Application-layer security is in a launchable state:

- No known application-level vulnerability remains open. All 26 Pass 1 findings are remediated.
- Tenant isolation is enforced server-side and proven by 28 automated cross-account tests.
- Authentication: 12-character minimum, breached-password rejection, TOTP 2FA available, database-backed rate limiting, per-account lockout, hardened session and cookie policy, working reset flow.
- Authorisation: role checks server-side on every protected route; the client-side admin nav is cosmetic only. Cross-tenant access returns `404`, not `403`, so it is not an existence oracle.
- API: zod validation on every write, explicit status codes, 256 KB body cap, strict CORS allowlist, opaque production errors.
- Storage: per-user key namespace, type and size allowlist, short-lived presigned URLs, forced attachment disposition, object deleted alongside the record.
- Headers: HSTS, nosniff, referrer policy, permissions policy, CSP with `frame-ancestors` allowlist.
- Logging: append-only audit trail plus login telemetry, neither of which records document contents, message bodies or credentials.
- Operations: backup, restore, retention, secret-scanning and config-check tooling, all verified.
- Verification: one command, `bun run golive`, runs every automated check — typechecks, production build, bundle-leak grep, secret scan, config guard and the three live suites. Latest run: **9 steps, 0 failures, 88 assertions**.
- Two-factor was exercised end to end on the development instance (enrol → sign out → challenge → verify → portal), so the mechanism is proven working, not merely present.

## B. BLOCKERS BEFORE GO-LIVE

Five. Each blocks because it cannot be mitigated in code, and each has an unbounded worst case.

**1. Credentials not rotated (§B.1).** Every secret has lived in a development environment. Until rotated, anyone who ever had visibility into it retains full access to all client data, indefinitely, indistinguishable in the audit log from legitimate use. No server-side control mitigates a valid credential.

**2. Production not separated from development (§B.2).** One database and one bucket serve both. Real client documents are reachable from a development environment, and one mistyped command writes to production data.

**3. No verified backups (§B.3).** PITR and object versioning are not enabled, and no restore has ever been tested. Any destructive event — accidental or malicious — is currently permanent. For a business holding client legal paperwork, that is an existential operational risk, not a technical one.

**4. Admin accounts without 2FA (§B.4).** Admin access reaches every client document. One phished password is a total compromise. The flow is built and proven — it was enrolled and challenged successfully on the development instance — but enrolment is per-account and per-database, so once §B.2 gives you a separate production database, nothing carries over. This is the single most likely real-world attack path and the only blocker that server-side hardening cannot close on your behalf.

**5. Password reset undeliverable (§B.5).** No mail provider is configured. In production a customer who forgets their password cannot recover their account without manual intervention — and account lockout (§A.3) makes hitting that state more likely, not less.

## C. MANUAL STEPS I MUST COMPLETE

| # | Step | Blocker | Effort |
| --- | --- | --- | --- |
| B.1 | Rotate all seven credentials, revoke the old ones | Yes | 45 min |
| B.2 | Separate production Turso database and Tigris bucket | Yes | 30 min |
| B.3 | Enable PITR + object versioning, schedule backups, run a restore drill | Yes | 2 h |
| B.4 | Enable 2FA on every admin account, save backup codes offline | Yes | 15 min |
| B.5 | Configure mail provider, verify sending domain (SPF/DKIM) | Yes | 45 min |
| B.6 | Custom domain, verify HTTPS/HSTS/CSP, trim `frame-ancestors` | No | 30 min |
| B.7 | Schedule backup and retention jobs; confirm the retention window legally | No | 30 min + legal |
| B.8 | Alerting on denied access, failed logins, role changes, error rate | No | 1 h |
| B.9 | Set production environment variables | Yes (part of B.1/B.2) | 15 min |
| B.10 | Restrict build access; diarise the Expo SDK dependency review | No | 30 min |
| B.11 | Initialise version control with `.env` ignored | No | 10 min |

## D. SECURITY IMPROVEMENTS ALREADY IMPLEMENTED

**This phase (go-live hardening):** boot-time config guard that refuses insecure production starts · HTTPS enforcement · per-account lockout with failed-login tracking · TOTP two-factor with backup codes · breached-password rejection via k-anonymity · working password reset with anti-enumeration wording · database-backed auth rate limiting · destructive-script production guard · `/api/ping` removed from production · backup / restore / retention tooling · secret-exposure scanner validated with a planted canary · admin security console · this runbook rendered in-app behind an admin-only API rather than bundled into the client · a single aggregate go-live gate (`bun run golive`) covering all 88 automated assertions.

**Previous phase (audit remediation):** IDOR fixes on document download and delete · mass-assignment fix on document registration · strict CORS allowlist · upload type/size/filename hardening · rate limiting · zod validation on every write route · request body cap · security headers and CSP · session and cookie hardening · client data column projection · draft gating · role enum with self-demotion block · append-only audit log · opaque production errors · path-traversal containment · message ownership binding · all test accounts purged · better-auth upgraded, three transitive pins added.

## E. REMAINING SECURITY RISKS

Present after all blockers are cleared:

1. **Application rate limiter is in-memory and single-instance.** Counters reset on restart and do not span instances. Auth endpoints are database-backed and unaffected; the remaining exposure is limited to general API flooding. Move to a shared store before horizontal scaling.
2. **Two critical transitive advisories in the build toolchain.** `shell-quote` and `node-tar`. Not in the request path, but a build-time compromise is a supply-chain compromise. Resolve at the next Expo SDK upgrade (§B.10).
3. **No human penetration test.** Everything here is code review plus automated testing. Business-logic abuse, chained exploits and creative misuse are precisely what automation does not find.
4. **Audit log is admin-readable and admin-deletable at the database level.** Tamper-evident at the API layer — there is no write or delete endpoint — but a compromised admin with direct database access could alter it. Shipping audit records to append-only external storage would close this.
5. **No WAF or DDoS protection** beyond application-level rate limiting.
6. **Documents rely on Tigris provider-side encryption at rest.** Adequate, but application-layer encryption would mean a storage-provider compromise alone did not expose document contents. `ServerSideEncryption: AES256` cannot be signed into the presigned URL — Tigris rejects it — so this would require a design change, not a config toggle.
7. **Session role is cached for 300 seconds.** A revoked admin retains admin capability for up to five minutes. For urgent revocation, delete the user's sessions directly.
8. **No independent compliance assessment.** No SOC 2, PCI DSS, HIPAA, GDPR or CCPA requirement has been verified here, and none is claimed.

## F. FINAL SECURITY SCORE

### Application code: 94 / 100

Earned: no known application-level vulnerability; tenant isolation proven by automated cross-account testing; validated inputs; constrained uploads; layered credential-attack defence including 2FA and breached-password rejection; tamper-evident audit trail; configuration that fails closed.

Withheld: application rate limiter still single-instance (−3); audit log deletable at the database layer (−2); no application-layer document encryption (−1).

### Production readiness today: 62 / 100

The gap between the two numbers is entirely §B. The code is ready; the environment is not. Unrotated credentials, a shared production/development database, and untested backups are each individually sufficient to lose all client data, and no amount of application hardening compensates for any of them.

**Projected after all five blockers are cleared: 88 / 100.** The remaining 12 points require a human penetration test, external append-only audit storage, a shared-state rate limiter, and a WAF.

---

## Limits of this document

This runbook was produced by an AI agent through code review and automated black-box testing against a development environment. It is not a penetration test. It did not include human adversarial testing, business-logic abuse testing, social-engineering assessment, infrastructure or DNS review, or any assessment of the hosting platform itself.

**No system is 100% secure, and this one is not being claimed as such.** No compliance certification is claimed or implied. Before handling client legal documents at volume, commission an independent human penetration test, and repeat it after any significant feature release.
