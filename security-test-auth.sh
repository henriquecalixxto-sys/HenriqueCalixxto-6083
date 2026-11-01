#!/usr/bin/env bash
# Authentication hardening suite.
#
# Exercises the controls added in the go-live phase: account lockout, admin-only
# security endpoints, doc exposure, password policy, enumeration resistance and
# the config guard. Run against a live dev server on :4200.
#
#   ./security-test-auth.sh

set -uo pipefail
BASE="${BASE:-http://localhost:4200}"
PASS=0; FAIL=0
ok()  { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $1 (got: ${2:-?})"; FAIL=$((FAIL+1)); }
chk() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2 expected $3"; }

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }

STAMP=$(date +%s)
VICTIM="lockout-$STAMP@example.test"

echo "=========================================="
echo " Authentication hardening suite"
echo "=========================================="

# ---------------------------------------------------------------- admin-only surfaces
echo ""
echo "-- Admin-only endpoints reject anonymous callers"
for p in /api/security/overview /api/security/login-attempts /api/docs/golive /api/docs/audit /api/audit; do
  chk "GET $p is 401" "$(code "$BASE$p")" "401"
done
chk "POST /api/security/unlock is 401" \
  "$(code -X POST -H 'content-type: application/json' -d '{"email":"a@b.com"}' "$BASE/api/security/unlock")" "401"

# ---------------------------------------------------------------- doc exposure
echo ""
echo "-- Security documentation is not publicly reachable"
for p in /GO-LIVE.md /SECURITY-AUDIT.md /task.md /.env /package.json; do
  C=$(code "$BASE$p")
  # The SPA returns index.html (200) for unknown routes; what matters is that the
  # response is NOT the actual file contents.
  if [ "$C" = "404" ] || ! body "$BASE$p" | grep -qE 'BLOCKERS BEFORE GO-LIVE|BETTER_AUTH_SECRET=|CA-01'; then
    ok "$p does not serve file contents"
  else
    bad "$p leaks file contents" "$C"
  fi
done

if [ -d packages/web/dist ]; then
  if grep -rqE 'BLOCKERS BEFORE GO-LIVE|Pass 2 — Post-Remediation' packages/web/dist 2>/dev/null; then
    bad "security docs are compiled into the client bundle" "found"
  else
    ok "security docs are not compiled into the client bundle"
  fi
fi

# ---------------------------------------------------------------- password policy
echo ""
echo "-- Password policy"
R=$(body -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"weak-$STAMP@example.test\",\"password\":\"short1\",\"name\":\"T\"}" \
  "$BASE/api/auth/sign-up/email")
echo "$R" | grep -qi 'password' && ok "short password rejected" || bad "short password rejected" "$R"

R=$(body -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"pwned-$STAMP@example.test\",\"password\":\"Password12345\",\"name\":\"T\"}" \
  "$BASE/api/auth/sign-up/email")
if echo "$R" | grep -qi 'breach\|compromis'; then
  ok "breached password rejected (haveibeenpwned)"
else
  bad "breached password rejected" "$R"
fi

# ---------------------------------------------------------------- role cannot be self-assigned
echo ""
echo "-- Privilege escalation via sign-up payload"
R=$(body -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"esc-$STAMP@example.test\",\"password\":\"Zq7#vLm2Rt9wKp4X\",\"name\":\"T\",\"role\":\"admin\"}" \
  "$BASE/api/auth/sign-up/email")
if echo "$R" | grep -q '"role":"admin"'; then
  bad "role from sign-up body is ignored" "role granted"
else
  ok "role from sign-up body is ignored"
fi

# ---------------------------------------------------------------- enumeration
echo ""
echo "-- User enumeration resistance"
A=$(body -X POST -H 'content-type: application/json' -d '{"email":"definitely-not-a-user-'"$STAMP"'@example.test"}' "$BASE/api/auth/forget-password")
B=$(body -X POST -H 'content-type: application/json' -d '{"email":"owner@calixtoagency.com"}' "$BASE/api/auth/forget-password")
if [ "$A" = "$B" ]; then
  ok "password-reset response identical for known and unknown accounts"
else
  bad "password-reset response identical for known and unknown accounts" "differs"
fi

# ---------------------------------------------------------------- account lockout
echo ""
echo "-- Per-account lockout"
# Seed 8 failures for a synthetic identifier directly, then confirm the guard
# short-circuits the next sign-in with 423 before better-auth is reached.
bun --env-file=.env -e "
import { db } from './packages/web/src/api/database';
import * as s from './packages/web/src/api/database/schema';
const rows = Array.from({length: 8}, () => ({ email: '$VICTIM', ip: '203.0.113.9', success: false }));
await db.insert(s.loginAttempts).values(rows);
" >/dev/null 2>&1

C=$(code -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"$VICTIM\",\"password\":\"whatever-Aa1!xyz\"}" "$BASE/api/auth/sign-in/email")
chk "8 failures locks the account (423)" "$C" "423"

R=$(body -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"$VICTIM\",\"password\":\"whatever-Aa1!xyz\"}" "$BASE/api/auth/sign-in/email")
echo "$R" | grep -q 'ACCOUNT_TEMPORARILY_LOCKED' && ok "lockout response carries a clear code" || bad "lockout code" "$R"
echo "$R" | grep -qiE 'password|hash|exists' && bad "lockout response leaks account detail" "leak" || ok "lockout response leaks nothing about the account"

# An unrelated account must be unaffected — lockout is per-identifier, not global.
C=$(code -X POST -H 'content-type: application/json' \
  -d '{"email":"someone-else-'"$STAMP"'@example.test","password":"whatever-Aa1!xyz"}' "$BASE/api/auth/sign-in/email")
if [ "$C" = "423" ]; then bad "lockout is scoped to one account" "other account also locked"; else ok "lockout is scoped to one account"; fi

# ---------------------------------------------------------------- no password material stored
echo ""
echo "-- Login telemetry stores no credential material"
OUT=$(bun --env-file=.env -e "
import { db } from './packages/web/src/api/database';
import * as s from './packages/web/src/api/database/schema';
const rows = await db.select().from(s.loginAttempts).limit(50);
const cols = new Set(rows.flatMap(r => Object.keys(r)));
console.log([...cols].join(','));
console.log(JSON.stringify(rows).toLowerCase().includes('whatever-aa1') ? 'LEAK' : 'CLEAN');
" 2>/dev/null | tail -2)
echo "$OUT" | grep -q 'password' && bad "login_attempts has no password column" "found" || ok "login_attempts has no password column"
echo "$OUT" | grep -q 'CLEAN' && ok "no submitted password value appears in login telemetry" || bad "password value in telemetry" "LEAK"

# ---------------------------------------------------------------- config guard
echo ""
echo "-- Configuration guard"
( cd packages/web && NODE_ENV=production bun run security:config >/tmp/cfg.txt 2>&1 )
grep -q 'FAIL: 0' /tmp/cfg.txt && ok "production config check passes with no fatal finding" || bad "production config check" "$(grep -o 'FAIL: [0-9]*' /tmp/cfg.txt)"

( cd packages/web && NODE_ENV=production BETTER_AUTH_SECRET=changeme bun run security:config >/tmp/cfg2.txt 2>&1 )
grep -qE 'FAIL: [1-9]' /tmp/cfg2.txt && ok "guard rejects a placeholder BETTER_AUTH_SECRET" || bad "guard rejects placeholder secret" "passed"

( cd packages/web && NODE_ENV=production WEBSITE_URL=http://insecure.example bun run security:config >/tmp/cfg3.txt 2>&1 )
grep -q 'WEBSITE_URL uses HTTPS' /tmp/cfg3.txt && grep -qE 'FAIL: [1-9]' /tmp/cfg3.txt \
  && ok "guard rejects a non-HTTPS WEBSITE_URL" || bad "guard rejects http WEBSITE_URL" "passed"

# ---------------------------------------------------------------- dev-only routes
echo ""
echo "-- Development-only routes are absent from the production surface"
# These cannot be probed against a dev server (they answer 200 here by design),
# so assert at the source level that each is gated on the production flag.
for ROUTE in '"/ping"' '"/dev/reset-rate-limits"'; do
  if grep -A6 -F "$ROUTE" packages/web/src/api/index.ts | grep -q 'isProd'; then
    ok "$ROUTE is gated on isProd"
  else
    bad "$ROUTE is gated on isProd" "no isProd guard found near the route"
  fi
done

# ---------------------------------------------------------------- destructive script guard
echo ""
echo "-- Destructive scripts refuse to run against production"
OUT=$(cd packages/web && NODE_ENV=production bun --env-file=../../.env src/api/purge-test-accounts.ts 2>&1 | head -3)
echo "$OUT" | grep -qi 'refusing' && ok "purge-test-accounts refuses NODE_ENV=production" || bad "purge guard" "$OUT"

# ---------------------------------------------------------------- cleanup
bun --env-file=.env -e "
import { db } from './packages/web/src/api/database';
import * as s from './packages/web/src/api/database/schema';
import { like, or } from 'drizzle-orm';
await db.delete(s.loginAttempts).where(or(like(s.loginAttempts.email, '%@example.test')));
" >/dev/null 2>&1

echo ""
echo "=========================================="
echo "PASS: $PASS   FAIL: $FAIL"
echo "=========================================="
[ "$FAIL" -eq 0 ] || exit 1
