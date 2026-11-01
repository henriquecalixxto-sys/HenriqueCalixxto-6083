#!/usr/bin/env bash
# Non-destructive security regression suite for the Calixto Agency API.
# Usage: ./security-test.sh [base_url]
# Exits non-zero if any control fails. Safe to run against a live instance:
# it only reads, submits throwaway records, and cleans up after itself.

BASE="${1:-http://localhost:4200}"
PASS=0; FAIL=0
JAR_A=$(mktemp); JAR_B=$(mktemp)
trap 'rm -f "$JAR_A" "$JAR_B"' EXIT

ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1 (=$3)"; else bad "$1 (expected $2, got $3)"; fi
}

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "== Calixto Agency security test suite =="
echo "target: $BASE"
echo

echo "[1] Unauthenticated access control"
check "portal orders requires auth"        401 "$(code "$BASE/api/portal/orders")"
check "portal documents requires auth"     401 "$(code "$BASE/api/portal/documents")"
check "document url requires auth"         401 "$(code "$BASE/api/portal/documents/1/url")"
check "clients list requires auth"         401 "$(code "$BASE/api/portal/clients")"
check "audit log requires auth"            401 "$(code "$BASE/api/audit")"
check "admin feedback list requires auth"  401 "$(code "$BASE/api/feedback/all")"
check "contact inbox requires auth"        401 "$(code "$BASE/api/contact")"
check "quotes inbox requires auth"         401 "$(code "$BASE/api/quotes")"
check "service create requires auth"       401 "$(code -X POST "$BASE/api/services" -H 'content-type: application/json' -d '{}')"
check "blog delete requires auth"          401 "$(code -X DELETE "$BASE/api/blog/1")"
echo

echo "[2] CORS origin allowlist"
EVIL=$(curl -s -D- -o /dev/null -H "Origin: https://evil.example" "$BASE/api/services" | grep -ci "access-control-allow-origin" || true)
check "malicious origin NOT reflected" 0 "$EVIL"
GOOD=$(curl -s -D- -o /dev/null -H "Origin: http://localhost:4200" "$BASE/api/services" | grep -ci "access-control-allow-origin: http://localhost:4200" || true)
check "trusted origin allowed" 1 "$GOOD"
echo

echo "[3] Security headers"
H=$(curl -s -D- -o /dev/null "$BASE/api/health")
for header in "x-content-type-options: nosniff" "referrer-policy" "permissions-policy" "cross-origin-opener-policy"; do
  echo "$H" | grep -qi "$header" && ok "header present: $header" || bad "header missing: $header"
done
echo "$H" | grep -qi "cache-control: no-store" && ok "API responses are no-store" || bad "API responses cacheable"
echo

echo "[4] Input validation / mass assignment"
check "contact rejects missing fields"  400 "$(code -X POST "$BASE/api/contact" -H 'content-type: application/json' -d '{}')"
check "contact rejects bad email"       400 "$(code -X POST "$BASE/api/contact" -H 'content-type: application/json' -d '{"name":"x","email":"notanemail","message":"hello there"}')"
check "feedback rejects short message"  400 "$(code -X POST "$BASE/api/feedback" -H 'content-type: application/json' -d '{"name":"ab","message":"hi"}')"
check "feedback rejects rating 99"      400 "$(code -X POST "$BASE/api/feedback" -H 'content-type: application/json' -d '{"name":"abc","message":"good service here","rating":99}')"
check "malformed JSON rejected"         400 "$(code -X POST "$BASE/api/feedback" -H 'content-type: application/json' -d 'not json')"
echo

echo "[5] Moderation cannot be bypassed"
NEW=$(curl -s -X POST "$BASE/api/feedback" -H 'content-type: application/json' \
  -d '{"name":"SecTest Bot","message":"automated non-destructive security probe","rating":5,"approved":true}')
echo "$NEW" | grep -q '"approved":true' && bad "approved flag accepted from client" || ok "approved flag ignored on submit"
curl -s "$BASE/api/feedback" | grep -q "SecTest Bot" && bad "unmoderated feedback is public" || ok "unmoderated feedback withheld from public list"
curl -s "$BASE/api/feedback" | grep -q '"email"' && bad "submitter email exposed publicly" || ok "submitter email not exposed publicly"
echo

echo "[6] Request size limit"
BIGFILE=$(mktemp)
python3 -c "import sys; sys.stdout.write('{\"name\":\"probe\",\"message\":\"' + 'x'*400000 + '\"}')" > "$BIGFILE"
check "oversized body rejected" 413 "$(code -X POST "$BASE/api/feedback" -H 'content-type: application/json' --data-binary @"$BIGFILE")"
rm -f "$BIGFILE"
echo

echo "[7] Rate limiting (public feedback form: 3/hour)"
RL=0
for _ in 1 2 3 4 5 6; do
  R=$(code -X POST "$BASE/api/feedback" -H 'content-type: application/json' \
      -d '{"name":"RateProbe","message":"rate limit probe message","rating":5}')
  [ "$R" = "429" ] && RL=1
done
check "burst is throttled" 1 "$RL"
echo

echo "[8] Path / id handling"
check "non-numeric document id rejected" 401 "$(code "$BASE/api/portal/documents/abc/url")"   # auth checked first
check "unknown route returns 404 json"   404 "$(code "$BASE/api/does-not-exist")"
echo

echo "[9] Sensitive data exposure in public responses"
curl -s "$BASE/api/blog"   | grep -q '"published":false' && bad "unpublished blog posts are public" || ok "drafts hidden from public blog API"
# Look for secret-bearing JSON *keys*, not prose (avoids matching "Secretary of the State").
curl -s "$BASE/api/services" | grep -qiE '"(password|passwordHash|secret|token|apiKey|accessKey)"[[:space:]]*:' \
  && bad "secret-like field in public payload" || ok "no secret-bearing fields in public payload"
curl -s "$BASE/api/feedback" | grep -qiE '"(email|approved)"[[:space:]]*:' \
  && bad "internal feedback fields leaked publicly" || ok "public feedback projection is minimal"
echo

echo "=========================================="
echo "PASS: $PASS   FAIL: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
