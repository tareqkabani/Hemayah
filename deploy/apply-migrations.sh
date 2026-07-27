#!/usr/bin/env bash
# ============================================================
#  ترحيل هجرات 2026-07-27 إلى بيئةٍ قائمة (تجريبية أو غيرها)
#
#  السياق: إصلاحات هذا اليوم مُدمَجة في main (شيفرةً)، لكنّ الهجرات
#  طُبِّقت على قاعدة التطوير المحلّية فقط. فأيّ بيئةٍ أخرى ما تزال تحمل
#  الدوالّ القديمة — ومنها المخالفة النظامية (إسنادٌ للدراسة بلا توصية)
#  وثقبُ الدارس الدخيل. هذا السكربت يسدّ تلك الفجوة.
#
#  الاستعمال:
#    DB_URL='postgresql://postgres:PASS@HOST:PORT/postgres' ./deploy/apply-migrations.sh
#    DB_URL=... ./deploy/apply-migrations.sh --dry-run     # عرضٌ بلا تنفيذ
#
#  الأمان: يقف عند أوّل خطأ، ويُطبّق كلّ هجرةٍ داخل معاملةٍ واحدة، ويفحص
#  السلامة بعد الانتهاء. الهجرات مكتوبةٌ لتُعاد بلا ضرر (idempotent).
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

if [ -z "${DB_URL:-}" ]; then
  echo "✗ اضبط DB_URL أوّلاً." >&2
  echo "  مثال: DB_URL='postgresql://postgres:PASS@172.22.7.52:55322/postgres' $0" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "✗ psql غير موجودٍ على هذا الجهاز." >&2
  echo "  إمّا تثبيت عميل postgres، أو تشغيل السكربت من داخل حاوية القاعدة:" >&2
  echo "    docker cp . <container>:/repo && docker exec -e DB_URL=... <container> /repo/deploy/apply-migrations.sh" >&2
  exit 1
fi

# هجرات هذا اليوم بالترتيب — الترتيب مقصود:
#   ...001 يجب أن يسبق ...008 (كلاهما يُعيد تعريف triage_decide، والأخير هو النهائي)
#   ...006 يعتمد على ...007 عملياً (النصاب الكامل يستلزم حارساً مُفعَّلاً)
MIGRATIONS=(
  "20260727000001_triage_refer_branch.sql"          # ربط توصية الإحالة بالفرع
  "20260727000002_claim_paper_cases.sql"            # ضمّ الحالات الورقية عند دخول نفاذ
  "20260727000003_seeker_view_grievance_types.sql"  # أنواع بتّ المكتب في عرض المستفيد
  "20260727000004_assignment_guards.sql"            # شرط الإسناد + الطلب الواحد + فرع الجهة
  "20260727000005_revoke_public_execute.sql"        # سحب منحة PUBLIC عن دوال العمليات
  "20260727000007_watchdog_switch.sql"              # مفتاح الحارس جدولياً + تفعيله
  "20260727000006_full_quorum.sql"                  # النصاب الكامل (بعد تفعيل الحارس)
  "20260727000008_study_requires_recommendation.sql" # لا قبول قبل توصية الجهة (نصّ النظام)
)

echo "─────────────────────────────────────────────"
echo " ترحيل ${#MIGRATIONS[@]} هجرة$([ $DRY -eq 1 ] && echo ' (عرضٌ فقط — بلا تنفيذ)')"
echo "─────────────────────────────────────────────"

for m in "${MIGRATIONS[@]}"; do
  f="$MIG/$m"
  [ -f "$f" ] || { echo "✗ الهجرة غير موجودة: $m" >&2; exit 1; }
  if [ $DRY -eq 1 ]; then
    echo "  • $m ($(wc -l < "$f") سطراً)"
    continue
  fi
  printf "  ▶ %-50s" "$m"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$f" >/dev/null 2>/tmp/mig_err; then
    echo "✅"
  else
    echo "❌"
    echo "" >&2; echo "خطأٌ في $m:" >&2; cat /tmp/mig_err >&2
    echo "" >&2
    echo "لم تُطبَّق هذه الهجرة ولا ما بعدها. القاعدة سليمةٌ عند آخر هجرةٍ نجحت." >&2
    exit 1
  fi
done

[ $DRY -eq 1 ] && { echo ""; echo "عرضٌ فقط — لم يُنفَّذ شيء."; exit 0; }

echo ""
echo "─────────────────────────────────────────────"
echo " فحص السلامة بعد الترحيل"
echo "─────────────────────────────────────────────"
psql "$DB_URL" -q -f "$ROOT/supabase/tests/integrity-audit.sql" 2>&1 | grep -E "🚨|✅" || true

echo ""
echo "تحقّقٌ سريعٌ من الحُرّاس الجدد:"
psql "$DB_URL" -At -c "
select
  case when public.watchdog_enabled() then '✅ الحارس مُفعَّل' else '🚨 الحارس معطَّل — النصاب الكامل سيُعلّق القضايا' end
union all
select case when pg_get_functiondef(oid) ~ 'غير مُسنَدة إليك'
       then '✅ شرط الإسناد فعّال' else '🚨 شرط الإسناد مفقود' end
  from pg_proc where proname='submit_study'
union all
select case when pg_get_functiondef(oid) ~ 'قبل ورود توصية الجهة'
       then '✅ شرط التوصية فعّال (نصّ النظام)' else '🚨 شرط التوصية مفقود' end
  from pg_proc where proname='triage_decide'
union all
select case when pg_get_functiondef(oid) ~ 'has_open_case'
       then '✅ حارس الطلب الواحد فعّال' else '🚨 حارس الطلب الواحد مفقود' end
  from pg_proc where proname='submit_protection_request';"

echo ""
echo "⚠️  تذكير: اضبط NAFATH_BRIDGE_PASSWORD في بيئة التشغيل —"
echo "    الجسر يرفض الإقلاع في الإنتاج بدونها (وهذا مقصود)."
