#!/usr/bin/env bash
# ============================================================
#  مولّد حزمة الترحيل المعزولة — لبيئةٍ لا تصل الشبكة
#
#  قاعدة التجريبية على خوادم محلّية معزولة عن الإنترنت، فلا يُنفَّذ
#  الترحيل من هنا. هذا المولّد يُخرج **ملفَ SQL واحداً مكتفياً بذاته**
#  يُحمل إليها ويُنفَّذ بـpsql وحده — بلا مستودع ولا bash ولا شبكة.
#
#  المصدر الواحد: القائمة تُقرأ من oneshot-2026-08-10.sh نفسه، فلا
#  تنشأ قائمةٌ ثانية تنحرف عنها. (وحارس check-staging-list.sh يضمن
#  أنّ تلك القائمة مكتملة.)
#
#  كل مهاجرةٍ في معاملةٍ مستقلّة — كسلوك السكربت الأصليّ: ما نجح ثبت،
#  والتوقّف عند أوّل خطأ يترك ما قبله مُطبَّقاً ومُسجَّلاً.
#
#  ⚠️ حدّ البروفة: لا تُجرَّب حزمةٌ كاملة على استنساخٍ من قاعدةٍ حديثة.
#  إعادةُ تطبيق مهاجرةٍ قديمة فوق مخطّطٍ أحدث تفشل بحقّ — مثالٌ مُجرَّب:
#  20260806000001 تستعمل on conflict (entity, region) على branches،
#  و20260808000005 يُسقط ذلك القيد ويستبدله بفهارس جزئية. فالبروفة
#  الصالحة تكون على قاعدةٍ في حالة الوجهة الفعلية، أو على المهاجرات
#  التي تلي حالتها (FROM_VERSION مرفوعاً).
#
#  الاستعمال:
#    ./deploy/staging/make-offline-bundle.sh                 # من الحدّ الافتراضي
#    FROM_VERSION=20260811000004 ./deploy/staging/make-offline-bundle.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LIST="$ROOT/deploy/staging/oneshot-2026-08-10.sh"
MIG="$ROOT/supabase/migrations"
OUT="${OUT:-$ROOT/deploy/staging/offline-bundle.sql}"

DEFAULT_FROM=$(grep -oE 'FROM_VERSION="\$\{FROM_VERSION:-[0-9]+\}"' "$LIST" | grep -oE '[0-9]{14}' | head -1)
FROM="${FROM_VERSION:-$DEFAULT_FROM}"
[ -n "$FROM" ] || { echo "✗ تعذّر تحديد FROM_VERSION." >&2; exit 1; }

# القائمة بترتيبها من السكربت — لا sort هنا: الترتيب مقصود.
# (حلقة read لا mapfile: الأخيرة من bash 4، وmacOS على 3.2.)
ALL=""
while IFS= read -r line; do ALL="$ALL$line
"; done < <(grep -oE '^[[:space:]]+"2026[0-9]{10}_[^"]+\.sql"' "$LIST" | tr -d ' "')

REV=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo "—")
n=0
{
  echo "-- ============================================================"
  echo "-- حزمة ترحيل معزولة — منصّة «حماية»"
  echo "-- وُلّدت من: $REV   ·   الحدّ: بعد $FROM"
  echo "--"
  echo "-- التنفيذ (داخل حاوية القاعدة، فلا حاجة لعميل psql على المضيف):"
  echo "--   docker exec -i <db-container> psql -U postgres -d postgres \\"
  echo "--     -v ON_ERROR_STOP=1 -f - < offline-bundle.sql"
  echo "--"
  echo "-- كل مهاجرةٍ في معاملةٍ مستقلّة: ما نجح ثبت، والتوقّف عند أوّل"
  echo "-- خطأ يترك ما قبله مُطبَّقاً ومُسجَّلاً في schema_migrations."
  echo "-- فأصلح السبب ثمّ أعد التنفيذ — المُطبَّق يُتخطّى بأمان."
  echo "-- ============================================================"
  echo
  echo "\\set ON_ERROR_STOP on"
  echo "create schema if not exists supabase_migrations;"
  echo "create table if not exists supabase_migrations.schema_migrations(version text primary key);"
  echo
  for f in $ALL; do
    v="${f%%_*}"
    [ "$v" \> "$FROM" ] || continue
    [ -f "$MIG/$f" ] || { echo "✗ الملف مفقود: $f" >&2; exit 1; }
    n=$((n+1))
    printf -- "-- ─────────────────────────────────────────────────────────\n"
    printf -- "-- [%02d] %s\n" "$n" "$f"
    printf -- "-- ─────────────────────────────────────────────────────────\n"
    echo "\\echo '  ▶ $f'"
    echo "begin;"
    cat "$MIG/$f"
    echo
    echo "insert into supabase_migrations.schema_migrations(version) values ('$v') on conflict do nothing;"
    echo "commit;"
    echo
  done
  echo "\\echo ''"
  echo "\\echo '✓ انتهت الحزمة — $n مهاجرة.'"
  echo "select version from supabase_migrations.schema_migrations where version > '$FROM' order by version;"
} > "$OUT"

echo "✓ وُلّدت: $OUT"
echo "  المهاجرات: $n   ·   الحجم: $(wc -c < "$OUT" | tr -d ' ') بايت   ·   المصدر: $REV"
