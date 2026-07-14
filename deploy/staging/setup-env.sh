#!/usr/bin/env bash
# ============================================================
# إعداد متغيّرات البيئة لكل البوابات على سيرفر البيئة التجريبية الداخلي.
# يُشغَّل من جذر المستودع بعد `supabase start`:
#   ./deploy/staging/setup-env.sh <SERVER_HOST>
# مثال: ./deploy/staging/setup-env.sh 10.20.30.40
# يقرأ مفاتيح Supabase المحلية من `supabase status` ويولّد كلمة جسر
# نفاذ عشوائية (تُحفظ في deploy/staging/.bridge-password للرجوع إليها).
# ============================================================
set -euo pipefail

HOST="${1:?الاستخدام: setup-env.sh <SERVER_HOST> — عنوان السيرفر كما يراه المستخدمون على الشبكة}"
cd "$(dirname "$0")/../.."

SUPA="supabase"
command -v supabase >/dev/null || { SUPA="npx --yes supabase"; echo "ℹ supabase غير مثبّت عالمياً — أستخدم npx"; }

# مفاتيح المكدّس المحلي (يتطلب supabase start مُشغَّلاً)
eval "$($SUPA status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"
[ -n "${ANON_KEY:-}" ] || { echo "✗ تعذّر قراءة المفاتيح — شغّل supabase start أولاً"; exit 1; }

SUPA_URL="http://${HOST}:55321"
GATEWAY="http://${HOST}:3000"

BRIDGE_FILE="deploy/staging/.bridge-password"
if [ ! -f "$BRIDGE_FILE" ]; then
  openssl rand -hex 16 > "$BRIDGE_FILE"
  echo "✓ وُلّدت كلمة جسر نفاذ جديدة في $BRIDGE_FILE"
fi
BRIDGE=$(cat "$BRIDGE_FILE")

write_env() {
  local app="$1" extra="$2" file="hemaya-app/apps/$1/.env.local"
  cat > "$file" <<ENV
# ولّده deploy/staging/setup-env.sh — لا يُتتبَّع في git
NEXT_PUBLIC_SUPABASE_URL=${SUPA_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NEXT_PUBLIC_GATEWAY_URL=${GATEWAY}
SERVER_ACTIONS_ALLOWED_ORIGINS=${HOST}:3000
NAFATH_BRIDGE_PASSWORD=${BRIDGE}
INTG_MODE=mock
${extra}
ENV
  echo "✓ $file"
}

for app in landing seeker center-officer competent-entities attorney-general technical-office health hr interior security-admin decision; do
  write_env "$app" ""
done

# واجهة REST (Hono) — تقرأ .env لا .env.local
cat > hemaya-app/apps/api/.env <<ENV
NEXT_PUBLIC_SUPABASE_URL=${SUPA_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NAFATH_BRIDGE_PASSWORD=${BRIDGE}
API_PORT=3020
ENV
echo "✓ hemaya-app/apps/api/.env"

echo
echo "اكتمل الإعداد. البوابة الموحّدة ستكون على: ${GATEWAY}"
