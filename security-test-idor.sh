#!/usr/bin/env bash
# Authenticated cross-tenant (IDOR / BOLA) test.
#
# Creates two throwaway client accounts, has client A register a document, then
# verifies client B cannot read, download or delete it — and cannot claim A's
# storage key or plant a document in A's account.
#
# Non-destructive: only its own throwaway records are created/removed.
# NOTE: /api/auth sign-up is rate limited to 5/hour per IP. If this script has
# already run within the hour, restart the dev server to reset the counters.
#
# Usage: ./security-test-idor.sh [base_url]

BASE="${1:-http://localhost:4200}"
PASS=0; FAIL=0
JAR_A=$(mktemp); JAR_B=$(mktemp)
trap 'rm -f "$JAR_A" "$JAR_B"' EXIT

ok()  { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1 (=$3)"; else bad "$1 (expected $2, got $3)"; fi; }

STAMP=$(date +%s)
EMAIL_A="sectest-a-$STAMP@example.test"
EMAIL_B="sectest-b-$STAMP@example.test"
PW='Str0ng-Passphrase-2026!'

signup() { # signup <jar> <email> <name>
  curl -s -c "$1" -X POST "$BASE/api/auth/sign-up/email" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"$PW\",\"name\":\"$3\"}"
}

echo "== Cross-tenant document isolation test =="
echo "target: $BASE"
echo

echo "[0] Provision two client accounts"
RA=$(signup "$JAR_A" "$EMAIL_A" "SecTest A")
RB=$(signup "$JAR_B" "$EMAIL_B" "SecTest B")
echo "$RA" | grep -q '"token"\|"user"' && ok "client A signed up" || { bad "client A sign-up failed: $RA"; echo "$RA"; }
echo "$RB" | grep -q '"token"\|"user"' && ok "client B signed up" || { bad "client B sign-up failed: $RB"; echo "$RB"; }

UID_A=$(echo "$RA" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('user',{}).get('id',''))" 2>/dev/null)
echo

echo "[1] Password policy"
WEAK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/sign-up/email" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"weak-$STAMP@example.test\",\"password\":\"short1\",\"name\":\"Weak\"}")
[ "$WEAK" = "400" ] && ok "short password rejected (=400)" || bad "short password accepted (got $WEAK)"
echo

echo "[2] Privilege escalation via sign-up payload"
ESC=$(curl -s -X POST "$BASE/api/auth/sign-up/email" -H 'content-type: application/json' \
  -d "{\"email\":\"esc-$STAMP@example.test\",\"password\":\"$PW\",\"name\":\"Esc\",\"role\":\"admin\"}")
echo "$ESC" | grep -q '"role":"admin"' && bad "role=admin accepted from sign-up body" || ok "role cannot be set via sign-up body"
ADM=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_A" "$BASE/api/portal/clients")
check "client cannot list all clients" 403 "$ADM"
check "client cannot read audit log"   403 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" "$BASE/api/audit")"
check "client cannot change roles"     403 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" -X PUT "$BASE/api/portal/clients/$UID_A/role" -H 'content-type: application/json' -d '{"role":"admin"}')"
check "client cannot create a service" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" -X POST "$BASE/api/services" -H 'content-type: application/json' -d '{}')"
echo

echo "[3] Upload allowlist (client A)"
PRESIGN_BAD=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/documents/presign" -H 'content-type: application/json' \
  -d '{"filename":"shell.html","contentType":"text/html","size":100}')
echo "$PRESIGN_BAD" | grep -q '"url"' && bad "html upload allowed" || ok "html/active-content upload rejected"
PRESIGN_EXE=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/documents/presign" -H 'content-type: application/json' \
  -d '{"filename":"malware.exe","contentType":"application/x-msdownload","size":100}')
echo "$PRESIGN_EXE" | grep -q '"url"' && bad "exe upload allowed" || ok "executable upload rejected"
PRESIGN_MISMATCH=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/documents/presign" -H 'content-type: application/json' \
  -d '{"filename":"invoice.html","contentType":"application/pdf","size":100}')
echo "$PRESIGN_MISMATCH" | grep -q '"url"' && bad "extension/MIME mismatch allowed" || ok "extension/MIME mismatch rejected"
PRESIGN_BIG=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/documents/presign" -H 'content-type: application/json' \
  -d '{"filename":"huge.pdf","contentType":"application/pdf","size":99999999}')
echo "$PRESIGN_BIG" | grep -q '"url"' && bad "oversized upload allowed" || ok "oversized upload rejected"

PRESIGN_OK=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/documents/presign" -H 'content-type: application/json' \
  -d '{"filename":"../../etc/passwd.pdf","contentType":"application/pdf","size":1024}')
KEY_A=$(echo "$PRESIGN_OK" | python3 -c "import sys,json;print(json.load(sys.stdin).get('key',''))" 2>/dev/null)
URL_A=$(echo "$PRESIGN_OK" | python3 -c "import sys,json;print(json.load(sys.stdin).get('url',''))" 2>/dev/null)
[ -n "$KEY_A" ] && ok "valid pdf upload presigned" || bad "valid pdf upload was rejected: $PRESIGN_OK"
case "$KEY_A" in
  *".."*|*"/etc/"*) bad "traversal survived in storage key: $KEY_A" ;;
  uploads/*)        ok "filename sanitised + key namespaced per user" ;;
  *)               bad "unexpected key shape: $KEY_A" ;;
esac
echo

echo "[4] Client A uploads and registers a document"
printf '%%PDF-1.4 sectest\n' > /tmp/sectest-$STAMP.pdf
PUT=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$URL_A" -H 'Content-Type: application/pdf' --data-binary @/tmp/sectest-$STAMP.pdf)
[ "$PUT" = "200" ] && ok "object uploaded to storage (=200)" || bad "storage PUT failed (got $PUT)"
REG=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/documents" -H 'content-type: application/json' \
  -d "{\"filename\":\"passport.pdf\",\"key\":\"$KEY_A\",\"contentType\":\"application/pdf\",\"size\":18}")
DOC_ID=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('document',{}).get('id',''))" 2>/dev/null)
[ -n "$DOC_ID" ] && ok "document registered (id=$DOC_ID)" || bad "registration failed: $REG"
echo

echo "[5] CRITICAL — client B attempts cross-tenant access to A's document"
check "B cannot mint a download URL for A's doc" 404 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_B" "$BASE/api/portal/documents/$DOC_ID/url")"
check "B cannot delete A's doc"                  404 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_B" -X DELETE "$BASE/api/portal/documents/$DOC_ID")"
LIST_B=$(curl -s -b "$JAR_B" "$BASE/api/portal/documents")
echo "$LIST_B" | grep -q "$KEY_A" && bad "A's document appears in B's list" || ok "A's document absent from B's list"
echo

echo "[6] CRITICAL — client B attempts to claim A's storage key / plant a doc"
CLAIM=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_B" -X POST "$BASE/api/portal/documents" -H 'content-type: application/json' \
  -d "{\"filename\":\"stolen.pdf\",\"key\":\"$KEY_A\",\"contentType\":\"application/pdf\",\"size\":18}")
check "B cannot register A's key" 403 "$CLAIM"
PLANT=$(curl -s -b "$JAR_B" -X POST "$BASE/api/portal/documents" -H 'content-type: application/json' \
  -d "{\"filename\":\"planted.pdf\",\"key\":\"$KEY_A\",\"userId\":\"$UID_A\",\"contentType\":\"application/pdf\",\"size\":18}")
echo "$PLANT" | grep -q '"document"' && bad "B planted a document in A's account" || ok "userId in body is ignored/forbidden"
echo

echo "[7] Order mass assignment (client A)"
ORD=$(curl -s -b "$JAR_A" -X POST "$BASE/api/portal/orders" -H 'content-type: application/json' \
  -d '{"serviceSlug":"notary-public","title":"SecTest order","status":"completed","amount":999999,"userId":"someone-else"}')
echo "$ORD" | grep -q '"status":"submitted"' && ok "client-supplied status ignored (forced to submitted)" || bad "client controlled order status: $ORD"
echo "$ORD" | grep -q '"amount":999999' && bad "client controlled order amount" || ok "client-supplied amount ignored"
ORD_ID=$(echo "$ORD" | python3 -c "import sys,json;print(json.load(sys.stdin).get('order',{}).get('id',''))" 2>/dev/null)
check "client cannot update order status" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" -X PUT "$BASE/api/portal/orders/$ORD_ID" -H 'content-type: application/json' -d '{"status":"delivered"}')"
echo

echo "[8] Message thread binding"
MSG=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_B" -X POST "$BASE/api/portal/messages" -H 'content-type: application/json' \
  -d "{\"body\":\"probe\",\"orderId\":$ORD_ID}")
check "B cannot attach a message to A's order" 400 "$MSG"
echo

echo "[9] A retains access to its own document (no regression)"
OWN=$(curl -s -b "$JAR_A" "$BASE/api/portal/documents/$DOC_ID/url")
echo "$OWN" | grep -q '"url"' && ok "owner can still download its own document" || bad "owner lost access: $OWN"
echo "$OWN" | grep -q 'response-content-disposition' && ok "download forced as attachment" || bad "download not forced as attachment"
echo

echo "[10] Cleanup"
DEL=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_A" -X DELETE "$BASE/api/portal/documents/$DOC_ID")
check "owner can delete its own document" 200 "$DEL"
rm -f /tmp/sectest-$STAMP.pdf
echo

echo "=========================================="
echo "PASS: $PASS   FAIL: $FAIL"
echo "Throwaway accounts left behind: $EMAIL_A, $EMAIL_B (remove with bun run src/api/purge-test-accounts.ts)"
[ "$FAIL" -eq 0 ] || exit 1
