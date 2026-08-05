#!/usr/bin/env bash
# testssl.sh — فحص طبقة TLS: الشهادة، الإصدارات المدعومة، الأصفار الضعيفة،
# والثغرات المعروفة (Heartbleed/ROBOT/…). قراءةٌ محضة، آمنٌ على بيئةٍ حيّة.
#
#   ./testssl.sh hemayah.pp.gov.sa
#
# متوقَّعٌ الآن: تحذير «شهادة ذاتيّة التوقيع» — يزول بتركيب شهادة الجهة
# (TLS_CERT_B64/TLS_KEY_B64 في stack الواجهات).
set -euo pipefail

TARGET="${1:-}"
[ -z "$TARGET" ] && { echo "الاستعمال: $0 <HOST[:PORT]>"; exit 1; }
[[ "$TARGET" == *:* ]] || TARGET="$TARGET:443"

OUT="$(cd "$(dirname "$0")/.." && pwd)/reports"
mkdir -p "$OUT"
NAME="testssl-${TARGET//:/-}-$(date +%Y%m%d-%H%M)"

docker run --rm -v "$OUT:/out:rw" drwetter/testssl.sh \
  --htmlfile "/out/$NAME.html" --logfile "/out/$NAME.log" \
  --severity LOW "$TARGET" || true

echo "✓ التقرير: $OUT/$NAME.html"
