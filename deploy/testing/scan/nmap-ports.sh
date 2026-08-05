#!/usr/bin/env bash
# nmap — جرد المنافذ والخدمات المكشوفة من الخارج. يُشغَّل من جهاز الفاحص
# (خارج السيرفر) كي يرى ما يراه مهاجمٌ على الشبكة. قراءةٌ محضة.
#
#   ./nmap-ports.sh 172.22.7.52          # سيرفر الواجهات
#   ./nmap-ports.sh 172.22.7.50,172.22.7.51,172.22.7.52
#
# المتوقَّع المسموح: الواجهات 80/443 فقط · الـAPI 3020 · القاعدة 55321
# (و55323 للمشرفين). ظهورُ 55322 (Postgres) أو 3000 على الواجهات = خلل حصر.
set -euo pipefail

TARGETS="${1:-}"
[ -z "$TARGETS" ] && { echo "الاستعمال: $0 <IP[,IP...]>"; exit 1; }

OUT="$(cd "$(dirname "$0")/.." && pwd)/reports"
mkdir -p "$OUT"
NAME="nmap-$(date +%Y%m%d-%H%M)"

# -sV كشف الإصدارات، -Pn تجاوز ping (كثيرٌ من الشبكات تحجبه)، أعلى 2000 منفذ.
docker run --rm -v "$OUT:/out:rw" instrumentisto/nmap \
  -sV -Pn --top-ports 2000 -oN "/out/$NAME.txt" "${TARGETS//,/ }" || true

echo "✓ التقرير: $OUT/$NAME.txt"
