#!/usr/bin/env bash
# فحص سريع بعد التشغيل: ./deploy/staging/verify.sh <SERVER_HOST>
set -u
HOST="${1:-localhost}"
ok=0; fail=0
check() {
  local label="$1" url="$2" want="$3"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "$url")
  if [ "$code" = "$want" ]; then echo "✓ $label ($code)"; ok=$((ok+1));
  else echo "✗ $label — توقعنا $want وجاء $code ($url)"; fail=$((fail+1)); fi
}
check "الشاشة الموحّدة"        "http://$HOST:3000/"            200
check "منطقة seeker (تحويل دخول)" "http://$HOST:3000/seeker"     307
check "منطقة المركز"            "http://$HOST:3000/center"      307
check "منطقة القرار"            "http://$HOST:3000/decision"    307
check "واجهة REST"              "http://$HOST:3000/api/v1/health" 200
check "Supabase API"            "http://$HOST:55321/rest/v1/"   401
echo; echo "الناجح: $ok — الفاشل: $fail"
[ $fail -eq 0 ]
