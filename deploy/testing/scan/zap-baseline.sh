#!/usr/bin/env bash
# OWASP ZAP — فحصٌ سلبيٌّ (baseline): يزحف الهدف ويحلّل ما يعود دون هجومٍ نشِط.
# آمنٌ على بيئةٍ حيّة، ولا يُعدِّل بيانات.
#
#   ./zap-baseline.sh https://hemayah.pp.gov.sa
#   ./zap-baseline.sh https://hemayah.pp.gov.sa --full   # فحصٌ نشِطٌ مهاجِم ⚠️
#
# التقرير: reports/zap-<التاريخ>.html
set -euo pipefail

TARGET="${1:-}"
MODE="${2:-baseline}"
[ -z "$TARGET" ] && { echo "الاستعمال: $0 <URL> [--full]"; exit 1; }

OUT="$(cd "$(dirname "$0")/.." && pwd)/reports"
mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M)

if [ "$MODE" = "--full" ]; then
  # الفحص النشِط يرسل حمولات هجومٍ حقيقيّة (حقن، XSS، تجاوز مصادقة) وقد
  # يُنشئ سجلّاتٍ ويُغيّر بيانات. لا يُشغَّل إلّا على بيئةٍ ببياناتٍ وهميّة
  # وبإذنٍ مكتوبٍ من مالك النظام، وخارج أوقات المختبرين.
  echo "⚠️  فحصٌ نشِطٌ على $TARGET — بياناتٌ قد تتغيّر. Ctrl-C خلال 10 ثوانٍ للإلغاء."
  sleep 10
  SCRIPT=zap-full-scan.py
  NAME="zap-full-$STAMP"
else
  SCRIPT=zap-baseline.py
  NAME="zap-baseline-$STAMP"
fi

# -I: لا تُسقط الأمر عند وجود تنبيهات (نريد التقرير لا رمز الخروج).
# -j: يستعمل زاحف AJAX أيضاً — ضروريٌّ لأنّ بوّاباتنا Next.js تُصيّر بالعميل.
docker run --rm -v "$OUT:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  "$SCRIPT" -t "$TARGET" -j -I -r "$NAME.html" -w "$NAME.md" || true

echo "✓ التقرير: $OUT/$NAME.html"
