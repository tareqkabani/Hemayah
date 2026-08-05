#!/usr/bin/env bash
# Trivy — فحص صور Docker من الثغرات المعروفة (CVE) في حزم النظام والاعتماديات.
# الاستثناء الوحيد الذي يُشغَّل على السيرفر نفسه: الصور محليّةٌ هناك.
#
#   ./trivy-images.sh                 # كلّ صور hemaya-* المبنيّة محليّاً
#   ./trivy-images.sh supabase        # صور مكدّس Supabase أيضاً
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/reports"
mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M)

if [ "${1:-}" = "supabase" ]; then
  IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'hemaya|supabase' | sort -u)
else
  IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^hemaya' | sort -u)
fi
[ -z "$IMAGES" ] && { echo "لا صور مطابقة — ابنِ المكدّس أوّلاً."; exit 1; }

# مخبأ مشترك كي لا تُنزَّل قاعدة الثغرات مع كلّ صورة.
CACHE="$HOME/.cache/trivy"
mkdir -p "$CACHE"

for img in $IMAGES; do
  safe=${img//[\/:]/-}
  echo "── $img"
  # HIGH/CRITICAL فقط، والمُصلَحة منها أوّلاً — القائمة الكاملة ضجيجٌ لا يُعالَج.
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$CACHE:/root/.cache/trivy" \
    -v "$OUT:/out:rw" \
    aquasec/trivy:latest image \
    --severity HIGH,CRITICAL --ignore-unfixed \
    --format table --output "/out/trivy-$safe-$STAMP.txt" \
    "$img" || true
  tail -5 "$OUT/trivy-$safe-$STAMP.txt" 2>/dev/null || true
done

echo "✓ التقارير في: $OUT"
