# Calixto Agency — Build Progress

## Done
- app_init at /home/user/calixto-agency (web + mobile)
- design.md written (Cinzel/Cormorant Garamond/PT Serif, black/gold/navy/cream palette)
- Logo assets copied to packages/web/public/brand (logo-card.png, icon-mark_*.png)
- Auth: better-auth + managed auth (Google) + email/password, role field (client/admin) on user
- DB schema: services, testimonials, faqs, blogPosts, contactMessages, quoteRequests, orders, documents, portalMessages
- db:push done, seed.ts run (10 services, 3 testimonials, 6 faqs, 4 blog posts)
- API routes: content.ts (services/testimonials/faqs/blog CRUD, public GET + admin write),
  inquiries.ts (contact + quotes), portal.ts (orders/documents presign+CRUD/messages/clients+role) — mounted in src/api/index.ts
- Web: styles.css theme (fonts + brand colors), lib/auth.ts, lib/api.ts, main.tsx handles managed redirect
- components/reveal.tsx (framer motion scroll reveal)

## Status: COMPLETE (Phase 1 full build — web + mobile + admin, no payments)
All pages, portal, admin, and mobile app built, typechecked, and build-verified.
Test admin account: testclient2@example.com / TestPass123! (role=admin) for demo access to /admin.

## TODO (in order)
1. components: navbar, footer, layout (public), protected-route, admin-layout, portal-layout
2. Public pages: index (home hero+how it works+why us+testimonials+cta), about, services index, services/[slug] dynamic,
   why-choose-us (fold into home), testimonials (fold into home + maybe /testimonials), faq, blog index, blog/[slug],
   contact, request-quote, sign-in, sign-up
3. Portal pages (protected, role client/admin both can access own): portal dashboard, upload docs, orders, messages
4. Admin pages (protected role=admin): dashboard, services CRUD, blog CRUD, testimonials CRUD, faqs CRUD, quotes inbox,
   contact inbox, clients list
5. app.tsx wire all routes
6. Mobile app: sign-in, dashboard, upload, request quote, contact — Expo screens
7. bun run build to verify compile
8. Start dev servers, screenshot check, deliver

## Notes
- Disclaimer must appear in footer: "Calixto Agency provides document services only and does not provide legal representation or legal advice."
- No Stripe/payments this phase (user chose skip).
- role stored as better-auth additionalField "role" default "client".

## Phase 2 — Client Feedback (done Aug 4)
- Table `client_feedback` (name, email, city, serviceSlug, rating, message, approved) — db:push applied, 4 rows seeded (approved).
- API `/api/feedback`: GET public (approved only), POST public (approved=false), GET /all + PUT/:id + DELETE/:id admin-only.
- Component `components/feedback-wall.tsx` (form + star rating + wall). Used on `/` (#feedback), `/testimonials` (limit 4), `/feedback` page.
- Admin moderation at `/admin/feedback` (publish / unpublish / delete) + sidebar entry.
- Nav: "Testimonials" replaced by "Reviews" -> /feedback (avoids navbar crowding); footer links both.
- tsc + vite build pass; verified via screenshots shot-feedback.png, shot-home-feedback.png, shot-admin-feedback.png.

## Phase 3 — Security audit & hardening (DONE, 10 Aug 2026)
- Pass 1: 26 findings (CA-01..CA-26) documented in SECURITY-AUDIT.md.
- All application-level findings remediated (IDOR, mass assignment, CORS, uploads, rate limiting, validation, body limit, headers/CSP, auth config, projections, draft gating, role enum, audit log, opaque errors, path containment, message binding, test-account purge).
- security-test.sh 32/32 PASS; security-test-idor.sh 28/28 PASS; web tsc + vite build OK; mobile tsc OK.
- Deps: better-auth 1.6.19->1.6.26 + root overrides; bun audit 146 -> 113. 2 critical transitive remain (shell-quote via react-native, node-tar) — build-time only.
- Admin browser session verified: /admin/audit (49 events, 30 denials), /admin/feedback, /portal/documents all render clean.
- Fixed admin layout horizontal overflow (added min-w-0 to content column).
- Pass 2 report appended to SECURITY-AUDIT.md with score 87/100.

## Phase 4 — Go-live hardening + security site (in progress, 10 Aug 2026)
AUTO: env guard, https redirect, prod gating of dev endpoints/scripts, DB-backed rate limit,
failed-login tracking + lockout, TOTP 2FA, backup/restore/retention/secret-scan scripts,
go-live preflight command, extended test suite, /admin/security report site.
MANUAL: secret rotation, Turso backup config, Tigris versioning, prod env, custom domain/HTTPS.

## Phase 5 — Go-live verification (16 Aug 2026)
- `scripts/go-live-check.sh` written; `bun run golive` → 9 steps, 0 failures (88 assertions).
- Auth suite extended to 28 (added source-level isProd gating checks for /ping and /dev/reset-rate-limits).
- Fixed CA-27 (docs in bundle → admin-only API), CA-28 (two_factor.failed_verification_count missing),
  CA-29 (import.meta.dir undefined under Vite SSR), CA-30 (2FA verify did not land in portal).
- Moved retention constants to `ops/retention-policy.ts` so the mobile type graph no longer pulls a Node CLI entry point.
- Browser-verified: full 2FA loop, /admin/security (0 admins without 2FA), both runbook tabs, /admin/audit, reset screens.
- GO-LIVE.md §A.13 rewritten around the gate; Pass 3 appended to SECURITY-AUDIT.md.
- Remaining: five manual blockers (B.1–B.5) — owner action only.

## Phase 6 — Go-live Blocker 1: credential inventory & rotation prep (24 Aug 2026)
- Inventoried 16 root .env vars + 1 mobile + 6 referenced-but-unset. No values printed.
- F-1 CRITICAL: RUNABLE_URL carries an embedded API key in its query string, AND
  scan-secrets.sh explicitly skipped RUNABLE_URL as "URL-shaped therefore non-secret",
  so a live credential was never scanned. Fixed: query strings are now parsed and any
  credential-named parameter is scanned against the bundle + reported by name.
  Added rk_ and JWT shapes to the pattern list. Re-verified PASS 5 / FAIL 0.
- F-2: AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL, AUTUMN_SECRET_KEY set but referenced
  nowhere in code -> recommend deletion + provider-side revocation, not rotation.
- F-3: .env.template covered 9 of 16 vars. Rewritten to cover all + the 6 unset ones.
- F-4 clean: no hardcoded secret, nothing in dist bundle, only 2 VITE_ vars (both public
  identifiers), no EXPO_PUBLIC_/NEXT_PUBLIC_, .env gitignored, no creds in logs.
- Git history: NOT a git repo -> zero history risk. Preserve this when initialising (B.11).
- Wrote SECRET-ROTATION.md: inventory, findings, ordered rotation plan (BETTER_AUTH_SECRET
  last; do the whole thing AFTER Blocker 2), post-rotation verification checklist.
- NOTHING ROTATED. Verified after changes: config guard 15/0/0, secret scan 5/0.
- Status: SECRET ROTATION REQUIRED — DO NOT GO LIVE YET.
