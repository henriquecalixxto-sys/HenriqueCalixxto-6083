# Secret Rotation Plan — Go-Live Blocker 1

**Calixto Agency · 24 August 2026**

Scope: credential inventory and rotation preparation only. Blockers 2–5 from
`GO-LIVE.md` are untouched.

**Nothing has been rotated.** No credential was changed, revoked or invalidated
by this pass. Rotation requires access to provider dashboards that no automated
process here holds, and revoking a live credential before its replacement is in
place causes an outage. Every action below is yours to perform.

No real secret value appears in this document, in the code, in comments, or in
any test output produced by this pass.

---

## 1. Inventory

16 variables in the root `.env`, 1 in `packages/mobile/.env`, plus 6 referenced
by code but not currently set.

Legend — **Risk**: what an attacker gets if they hold this value.
**Rotate**: mandatory before go-live?

### Secrets — full credentials

| Variable | Service | Purpose | Env | Risk | Rotate |
| --- | --- | --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | better-auth (self-hosted) | Signs every session token; also encrypts TOTP secrets and backup codes at rest | both | **CRITICAL** — forge any session, impersonate any admin, decrypt 2FA material | **YES** |
| `DATABASE_AUTH_TOKEN` | Turso | Full read/write to the database | both | **CRITICAL** — read, alter or delete every client record and the audit log | **YES** |
| `S3_SECRET_ACCESS_KEY` | Tigris | Object storage secret | both | **CRITICAL** — read or delete every uploaded client document | **YES** |
| `S3_ACCESS_KEY_ID` | Tigris | Object storage key id (pairs with the above) | both | **CRITICAL** — same as above; rotate as a pair | **YES** |
| `RUNABLE_URL` | Runable platform CLI | **Contains an embedded API key in its query string** (`?key=rk_…`) | dev tooling | **HIGH** — platform CLI access under your account | **YES** |
| `AI_GATEWAY_API_KEY` | Runable AI gateway | Billable LLM access | unused | **HIGH** — someone else's compute on your invoice | **YES** (or delete) |
| `AUTUMN_SECRET_KEY` | Autumn | Payments | unused | **HIGH** — payment-provider API access | **YES** (or delete) |
| `RESEND_API_KEY` | Resend | Password-reset email | not set | **HIGH** once set — send mail as your domain | n/a yet |

### Sensitive but not credentials

| Variable | Service | Purpose | Env | Risk | Rotate |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Turso | Database hostname (`libsql://…`) | both | **MEDIUM** — identifies the target; useless without the token, but it is reconnaissance | Changes with Blocker 2 |
| `S3_BUCKET` | Tigris | Bucket identifier (a UUID) | both | **LOW** — identifier only | Changes with Blocker 2 |
| `APPLICATION_ID` | Runable managed auth | Application identifier | both | **LOW** — public identifier | No |

### Not secrets — configuration

| Variable | Purpose | Notes |
| --- | --- | --- |
| `NODE_ENV` | Runtime switch | Controls HSTS, Secure cookies, opaque errors, dev-route removal, destructive-script guard. **Must be `production` in production.** |
| `WEBSITE_URL` | Public origin | Currently a preview domain with a trailing slash. Changes with Blocker 6. |
| `S3_ENDPOINT` | Tigris endpoint | `https://t3.storage.dev` |
| `AI_GATEWAY_BASE_URL` | AI gateway endpoint | Unused |
| `VITE_APPLICATION_ID` | Client-side app identifier | **Compiled into the browser bundle in cleartext.** Public identifier — correct to expose. |
| `VITE_RUNABLE_AUTH_ISSUER` | Client-side auth issuer URL | Same. Public URL — correct to expose. |
| `EXPO_PACKAGER_PROXY_URL` (mobile) | Expo dev packager | Local dev tooling only |
| `MAIL_FROM` | Sender address | Not a secret |
| `DOCUMENT_RETENTION_DAYS` / `AUDIT_RETENTION_DAYS` / `INQUIRY_RETENTION_DAYS` | Retention windows | Not secrets |
| `DEV_DATABASE_URL` | Dev DB, for the separation check | Not set; optional |
| `ALLOW_DESTRUCTIVE` | Single-command escape hatch | Must never be set in a deployed environment |

---

## 2. Findings

### F-1 — CRITICAL — A live credential was hidden inside a URL-shaped variable

`RUNABLE_URL` looks like a plain endpoint but carries an API key in its query
string (`?key=rk_…`). Two consequences:

1. It is a real credential that was never on anyone's rotation list, because the
   variable name gives no indication that it holds one.
2. **The secret scanner explicitly skipped it.** `scripts/scan-secrets.sh` kept a
   list of "URL-shaped, therefore not secret" variables — `RUNABLE_URL` among
   them — and excluded them from the leak search. So this key was never checked
   against source or against the browser bundle. The scanner reported `PASS`
   while a live credential sat outside its coverage.

That is the more serious half. A scanner with a silent blind spot is worse than
no scanner, because it produces documented confidence in a result it never
actually tested.

**Fixed in this pass.** The skip now strips the query string first and scans any
parameter named like a credential (`*key*`, `*token*`, `*secret*`, `*password*`,
`*sig*`, `*auth*`) against the bundle, and reports it by name for the rotation
inventory. `rk_…` and JWT-shaped values were added to the pattern list.
Re-verified: **PASS 5 / FAIL 0**, now with real coverage.

**Rotation is still required.** The value is unchanged and must be treated as
compromised — it has lived in a development environment for weeks.

### F-2 — HIGH — Three unused credentials

`AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL` and `AUTUMN_SECRET_KEY` are set in
`.env` but referenced nowhere in application code.

An unused credential is pure liability. It can be stolen and abused exactly like
a used one, but nothing breaks when it is, so the abuse is never noticed. Two of
the three are billable or payment-related.

**Recommendation: delete them rather than rotate them.** Payments are out of
scope this phase, and the AI gateway is not called anywhere. If you delete
instead of rotating, revoke them provider-side too — removing the line from
`.env` does not invalidate the key.

### F-3 — MEDIUM — The environment template was incomplete

`.env.template` listed 9 variables; the project uses 16, and code references 6
more that were absent entirely (`RESEND_API_KEY`, `MAIL_FROM`, the three
retention windows, `DEV_DATABASE_URL`).

Anyone provisioning production from that template would have produced an
environment missing the S3 credentials and the mail provider. The boot guard
would have caught the S3 gap by refusing to start; the mail gap would have
surfaced later as customers unable to reset their passwords.

**Fixed in this pass.** `.env.template` now covers all 16 variables plus the 6
referenced-but-unset ones, grouped by purpose, with placeholder values only, an
explicit warning on the `VITE_` prefix, and the unused three marked for deletion.

### F-4 — Verified clean

- **No secret is hardcoded in source.** Every `.env` value was searched across
  tracked source files: no match.
- **No secret reaches the browser bundle.** The built `dist` was searched for
  every `.env` value, including the newly-covered embedded key: no match.
- **No client-side exposure.** The only `VITE_`-prefixed variables are
  `VITE_APPLICATION_ID` and `VITE_RUNABLE_AUTH_ISSUER`, both public identifiers.
  The boot guard fails the start if a `VITE_` variable is ever given a
  secret-shaped name.
- **No `EXPO_PUBLIC_`, `NEXT_PUBLIC_` or `PUBLIC_` variables exist.**
- **`.env` is covered by `.gitignore`.**
- **No AWS / Stripe / OpenAI / GitHub / Slack / PEM pattern in source.**
- **No credential is written to logs.** No `console.log` prints credential
  material; the login telemetry table has no password column and stores no
  submitted password value.
- **No `.env` file in `dist/` or `public/`.**
- **No backup directory currently exists**, so no snapshot is holding data. When
  one is created, `bun run backup` redacts credential columns by design.

### F-5 — LOW — Ephemeral test artifacts

`/tmp/adminjar.txt` and `/tmp/2fa.txt` are cookie jars from this session's
testing and hold live session tokens for the development admin account. They are
outside the project, are not committed, and die with the sandbox. Rotating
`BETTER_AUTH_SECRET` invalidates them regardless. Noted for completeness.

---

## 3. Git history

**The project is not a git repository.** There is no history, no previous
commits and no deleted tracked files, so no secret can be recovered from version
control. `scan-secrets.sh` reports `SKIP` for this check for that reason.

This is a clean starting position and worth preserving. When you initialise the
repository (`GO-LIVE.md` §B.11), `.env` must be ignored in the very first commit
— `.gitignore` already covers it. A secret committed once is exposed permanently
in history, and rotation becomes the only remedy.

---

## 4. Rotation order

Ordered so nothing is revoked before its replacement is live, and so the most
disruptive change lands last.

**Prerequisite.** Do this after Blocker 2 (separate production database and
bucket), not before. Rotating credentials on shared dev/prod infrastructure means
doing the work twice. If you rotate first, you will rotate again after splitting.

| # | Variable | Where | Breaks anything? | Verify |
| --- | --- | --- | --- | --- |
| 1 | `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AUTUMN_SECRET_KEY` | Runable settings / Autumn dashboard | No — unused | App still boots: `bun run security:config` |
| 2 | `RUNABLE_URL` | Runable platform → regenerate CLI key | No — not used by app code | Platform CLI still authenticates |
| 3 | `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` | Tigris → Access Keys → create new pair scoped to the production bucket, update `.env`, **then** delete the old pair | Briefly, if the old pair is deleted first — create, deploy, then delete | Upload and download a test document in the portal |
| 4 | `DATABASE_AUTH_TOKEN` | Turso → database → Tokens → create new, update `.env`, **then** revoke the old | Same ordering rule | App boots and reads data; `bun run security:config` passes |
| 5 | `DATABASE_URL` | Set to the production database from Blocker 2 | Points at a different database | Row counts match expectations |
| 6 | `BETTER_AUTH_SECRET` | `openssl rand -base64 48` | **YES — invalidates every session.** Everyone signs in again. Do it last, in a quiet window | Sign in, complete the 2FA challenge, reach the portal |

**Why `BETTER_AUTH_SECRET` is last.** It is the only rotation with a guaranteed
user-visible effect. Doing it first would sign you out mid-procedure, while you
still have four more credentials to change.

**Note on 2FA.** `BETTER_AUTH_SECRET` encrypts TOTP secrets and backup codes at
rest. Rotating it means existing enrolments can no longer be decrypted: every
user must re-enrol their authenticator. Since Blocker 4 requires admin 2FA
enrolment anyway, **do the rotation first and enrol afterwards**, or the
enrolment is wasted.

**Ordering rule for every provider credential:** create the new one, deploy it,
confirm it works, and only then revoke the old one. Creating a new key is not
rotation — revoking the old one is. That is the step people skip, and skipping it
means the compromised credential stays valid indefinitely.

---

## 5. What you must do

Not automatable — each requires a provider dashboard login.

1. Complete Blocker 2 first (separate production Turso database and Tigris bucket).
2. Delete or rotate the three unused credentials, and revoke them provider-side.
3. Regenerate the Runable CLI key behind `RUNABLE_URL`.
4. Create a new Tigris key pair scoped to the production bucket only; deploy; delete the old pair.
5. Create a new Turso token; deploy; revoke the old one.
6. Generate a new `BETTER_AUTH_SECRET` (`openssl rand -base64 48`); deploy during a quiet window.
7. Set every value in the production environment's secret store — never in a committed file, a chat message, or a ticket.
8. Confirm the old credentials are actually dead: attempt a connection with the revoked Turso token and the revoked Tigris pair and confirm both are rejected.

---

## 6. Post-rotation verification

Run in this order. Steps 1–3 must pass before you touch anything else.

```bash
# 1. Configuration is complete and production-safe
NODE_ENV=production bun run security:config     # expect FAIL: 0

# 2. No secret has leaked into source or the bundle
bun run security:secrets                        # expect PASS 5 / FAIL 0

# 3. Full automated gate
bun run golive                                  # expect 9 steps, 0 failures
```

Then, by hand, against the production deployment:

| # | Check | Pass condition |
| --- | --- | --- |
| 1 | Application starts | No boot error; the config guard does not throw |
| 2 | Database connection | Portal dashboard loads real data |
| 3 | Old database token is dead | Connection with the revoked token is rejected |
| 4 | Old storage keys are dead | Request with the revoked pair is rejected |
| 5 | Tigris upload | Upload a document in the portal; it appears in the list |
| 6 | Tigris download authorization | Download as the owner succeeds; as another account returns `404` |
| 7 | Sign-in | Email + password reaches the 2FA challenge |
| 8 | 2FA | Re-enrol, then a fresh TOTP code completes sign-in |
| 9 | Password reset | Only once Blocker 5 is done: request, receive, complete, other sessions revoked |
| 10 | API authentication | Unauthenticated `GET /api/security/overview` returns `401` |
| 11 | Admin console | `/admin/security` shows 0 failed config checks and 0 admins without 2FA |
| 12 | No regression | Public site, quote form, contact form, blog and portal all load |

Steps 3 and 4 are the ones that actually prove rotation happened. Everything else
proves the new credentials work — only these two prove the old ones stopped
working.

---

## 7. Status

**SECRET ROTATION REQUIRED — DO NOT GO LIVE YET**

Nothing was rotated in this pass. Seven credentials must be replaced, one of
which (`RUNABLE_URL`) was not previously known to be a credential at all and was
outside the scanner's coverage until this pass fixed it.

The tooling and the environment template are now ready for you to rotate safely.
The rotation itself is unstarted.
