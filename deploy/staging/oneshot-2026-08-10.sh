#!/usr/bin/env bash
# ============================================================
#  التنفيذ الموحّد لأدلة 8 + 9 + 10 أغسطس 2026 على البيئة التجريبية
#
#  يجمع في أمرٍ واحد: المرحلة صفر (30 يوليو–5 أغسطس) ← دفعة 8 أغسطس
#  (طبقة المحتوى + الأدمن) ← دفعة 9 أغسطس (المحاور + الحجب الأمني +
#  بنود الحماية الخمسة #88) ← دفعة 10 أغسطس (حزمة الاطّلاع #93 +
#  تشفير جهة الطوارئ #94)، ثم الفحوص وتسجيل النسخ وحزم الاختبار.
#
#  آخر ما طُبّق على التجريبية (نشرة 2026-07-30): 20260727000008 —
#  فالقائمة أدناه هي كامل الفجوة حتى main ‏81eb688.
#
#  ⚠️ إعادة تطبيق مهاجرةٍ قديمة فوق قاعدةٍ أحدث ليست آمنة دائماً
#  (مثال مُجرَّب: 20260806000001 تفترض قيد branches(entity,region)
#  الذي استبدلته 20260808000005 — فيفشل on conflict عند التكرار).
#  لذا السكربت يطبّق فقط ما بعد FROM_VERSION (الافتراضي حالة التجريبية
#  الموثَّقة 20260727000008) — والتكرار بعد نجاحٍ جزئي يكون برفع
#  FROM_VERSION إلى آخر مهاجرةٍ نجحت (يطبعها السكربت عند التوقف).
#
#  الاستعمال (من جهازٍ يصل قاعدة التجريبية — منفذ 55322 داخلي):
#    DB_URL='postgresql://postgres:PASS@172.22.7.52:55322/postgres' \
#      ./deploy/staging/oneshot-2026-08-10.sh
#    أضف --dry-run لعرض الخطوات بلا تنفيذ، وFROM_VERSION=... لتجاوز الحدّ.
#
#  بعد نجاحه يبقى يدوياً (Portainer): Stacks ← hemaya-frontend ←
#  Pull and redeploy، ثم hemaya-api ← Pull and redeploy (إلزامي —
#  عقد council_save/submit تغيّر في #93). ثم التحقق الوظيفي في ذيل
#  RUNBOOK-2026-08-09.md وRUNBOOK-2026-08-10.md.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

[ -n "${DB_URL:-}" ] || { echo "✗ اضبط DB_URL أولاً (مثال في رأس الملف)." >&2; exit 1; }
command -v psql >/dev/null || { echo "✗ psql غير موجود — ثبّت عميل postgres أو نفّذ من حاوية القاعدة." >&2; exit 1; }

q() { psql "$DB_URL" -tAc "$1"; }

# ── الفحوص القبلية ──
echo "── فحص الاتصال والوضع القائم"
q "select version();" >/dev/null || { echo "✗ تعذّر الاتصال بالقاعدة." >&2; exit 1; }
if [ "$(q "select count(*) from pg_available_extensions where name='supabase_vault'")" != "1" ]; then
  echo "✗ supabase_vault غير متوفرة في صورة القاعدة — شرط دفعة 10 أغسطس (#94). توقّف." >&2; exit 1
fi
if [ "$(q "select count(*) from pg_extension where extname='supabase_vault'")" != "1" ]; then
  echo "ℹ supabase_vault متوفرة وغير مثبَّتة — أثبّتها"
  [ $DRY -eq 1 ] || psql "$DB_URL" -v ON_ERROR_STOP=1 -c "create extension supabase_vault;"
fi

# ── كامل الفجوة منذ نشرة 2026-07-30 — الترتيب حرفيّ من الأدلة الثلاثة ──
MIGRATIONS=(
  # المرحلة صفر (دليل 08 §0)
  "20260730000001_referral_status_closed.sql"
  "20260730000002_referral_center_wiring.sql"
  "20260805000001_paper_intake_receipt_link.sql"
  "20260805000002_notifications_type_check.sql"
  # دفعة 8 أغسطس (دليل 08 §1)
  "20260806000001_central_entity_routing.sql"
  "20260807000001_seeker_conditional_entity.sql"
  "20260807000002_content_layer.sql"
  "20260807000003_content_seed.sql"
  "20260808000001_notification_engine.sql"
  "20260808000002_content_approval.sql"
  "20260808000003_admin_ops.sql"
  "20260808000004_admin_users.sql"
  "20260808000005_entity_org_structure.sql"
  "20260808000006_intake_templates.sql"
  "20260808000007_assign_study_eval_guard.sql"
  "20260808000008_reorder_reference_items.sql"
  # دفعة 9 أغسطس (دليل 09 §1) + الدفعة التكميلية #88 (دليل 09 §5)
  "20260809000001_study_dossier_handoff.sql"
  "20260809000002_triage_response_dedup.sql"
  "20260809000003_study_eval_request_redaction.sql"
  "20260809000004_protection_types_expansion.sql"
  # دفعة 10 أغسطس (دليل 10 §1 + ملحق #94)
  "20260810000001_decision_review_package.sql"
  "20260810000002_emergency_contact_encryption.sql"
  # ملحق #96: تعبئة subjects من مسارَي التقديم (مفتاح Vault + اعتراض + backfill)
  "20260810000003_subject_intake_sync.sql"
  # دفعة 11 أغسطس: سلسلة اعتماد رئيس الفرع (#105) — القائمة صريحة لا glob،
  # فما لا يُدرج هنا لا يصل التجريبية إطلاقاً (نُقل الإدراج من #104).
  "20260811000003_recommendation_approval_chain.sql"
)

# حدّ البدء: يُطبَّق ما نسخته أكبر منه فقط (انظر التحذير في الرأس)
FROM_VERSION="${FROM_VERSION:-20260727000008}"
REG_MAX=$(q "select coalesce(max(version),'—') from supabase_migrations.schema_migrations" 2>/dev/null || echo '—')
echo "── حدّ البدء: $FROM_VERSION (أعلى نسخة في سجلّ القاعدة: $REG_MAX — استرشادي، السجلّ ناقص تاريخياً)"

echo "── تطبيق ما بعد الحدّ من أصل ${#MIGRATIONS[@]}$([ $DRY -eq 1 ] && echo ' (عرض فقط)')"
LAST_OK="$FROM_VERSION"
for f in "${MIGRATIONS[@]}"; do
  v="${f%%_*}"
  if ! [ "$v" \> "$FROM_VERSION" ]; then echo "   ↷ $f (قبل الحدّ — تُتخطى)"; continue; fi
  [ -f "$MIG/$f" ] || { echo "✗ الملف مفقود: $f" >&2; exit 1; }
  echo "   $f"
  if [ $DRY -eq 0 ]; then
    psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$MIG/$f" \
      || { echo "✗ توقّف عند $f — آخر ناجحة: $LAST_OK. عالج السبب ثم أعد التشغيل بـFROM_VERSION=$LAST_OK" >&2; exit 1; }
    psql "$DB_URL" -q -c "insert into supabase_migrations.schema_migrations (version) values ('$v') on conflict do nothing;"
  fi
  LAST_OK="$v"
done
[ $DRY -eq 1 ] && { echo "✓ عرضٌ فقط — لم يُنفَّذ شيء."; exit 0; }

# ── الفحوص المجمَّعة من الأدلة الثلاثة ──
echo "── الفحوص"
chk() { local got; got="$(q "$1")"; [ "$got" = "$2" ] && echo "   ✓ $3" || { echo "   ✗ $3 (المتوقع $2، الوارد $got)" >&2; exit 1; }; }
chk "select count(*) from information_schema.tables where table_name='reference_lists'" 1 "طبقة المحتوى قائمة"
chk "select count(*) from pg_proc where proname in ('study_dossier','study_eval_requests')" 2 "دالّتا الملف والحجب"
chk "select count(*) from pg_policy where polname='study_eval_assigned_req'" 0 "سياسة القراءة المباشرة أُسقطت"
chk "select count(*) from reference_items where list_key='protection_types' and active" 18 "بنود الحماية 18 (م14 + اللائحة)"
chk "select count(*) from information_schema.tables where table_name='emergency_contacts'" 1 "جدول جهة الطوارئ"
chk "select count(*) from information_schema.columns where table_name='council_decisions' and column_name in ('scope','scope_note')" 2 "نطاق القرار"
chk "select pronargs from pg_proc where proname='council_submit'" 6 "توقيع council_submit السداسي"
chk "select count(*) from vault.secrets where name='emergency_contact_key'" 1 "مفتاح التشفير في Vault"
chk "select count(*) from pg_proc where proname in ('execution_emergency_contact','_store_emergency_contact')" 2 "دالّتا الكشف والكتابة المشفّرة"
chk "select count(*) from protection_requests where details ? 'emergency_contact'" 0 "details مبتورة بعد الترحيل"
chk "select count(*) from vault.secrets where name='subject_identity_key'" 1 "مفتاح هوية طالب الحماية في Vault (#96)"
chk "select count(*) from protection_requests where details ? 'identity'" 0 "identity مبتورة إلى subjects (#96)"
chk "select count(*) from pg_proc where proname in ('submit_recommendation_for_approval','decide_recommendation_approval','branch_approval_queue')" 3 "دوال سلسلة اعتماد رئيس الفرع (#105)"
chk "select count(*) from approval_chains where step_no=1 and approver='branch_head' and active" 5 "درجة الاعتماد الأولى لكل جهة (#105)"

# ── تسجيل النسخ (يمنع انحراف «الكائن موجود دون نسخته») ──
echo "── تسجيل النسخ في schema_migrations"
VALS=$(printf "('%s')," "${MIGRATIONS[@]%%_*}"); VALS=${VALS%,}
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "insert into supabase_migrations.schema_migrations (version) values $VALS on conflict do nothing;"

# ── حزم الاختبار على التجريبية نفسها ──
echo "── حزم الاختبار (كلٌّ في معاملة تُدحرج — لا أثر يبقى)"
for t in triage-portal-tests study-eval-request-redaction-tests decision-approval-ring-tests emergency-contact-encryption-tests subject-intake-tests approval-chain-tests; do
  echo "   ── $t"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$TESTS/$t.sql" || exit 1
done
psql "$DB_URL" -q -f "$TESTS/e2e-full-journey.sql" | grep -E "════|ERROR" || true

echo
echo "✓ اكتمل جانب القاعدة. المتبقي يدوياً (Portainer):"
echo "  1) Stacks ← hemaya-frontend ← Pull and redeploy"
echo "  2) Stacks ← hemaya-api      ← Pull and redeploy (إلزامي — عقد council_save/submit تغيّر)"
echo "  3) التحقق الوظيفي: ذيل RUNBOOK-2026-08-09.md وRUNBOOK-2026-08-10.md (+ ملحق #94)"
