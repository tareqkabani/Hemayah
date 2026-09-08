#!/usr/bin/env bash
# ============================================================
#  مصالحة كلمة جسر نفاذ مع حسابات القاعدة — إصلاحُ «Invalid login credentials»
#
#  العلّة: `supabase/seed.sql` تبذر كلّ الحسابات بكلمةٍ ثابتة
#  ('nafath-staff-2026')، بينما بيئة التشغيل تضبط NAFATH_BRIDGE_PASSWORD
#  بكلمةٍ عشوائيةٍ قوية (deploy/staging/README.md). فالجسر يدخل بالعشوائية
#  والقاعدة تحمل الثابتة — فيُرفض **كلُّ حسابٍ مبذور**، وهي كلّ الحسابات.
#
#  ولمَ ظهرت الآن؟ كانت مستورةً بـ«المعالجة الذاتية» (PR #14) التي تدهس
#  كلمة سرّ الحساب عند فشل الدخول. وقد أُزيلت في PR #126 لأنّها ثغرة
#  استيلاء (HMY-02): أيُّ نداءٍ للمسار يدهس كلمة سرّ أيّ حساب. فالإزالة
#  صحيحة، وهذا السكربت هو البديل المشروع: مصالحةٌ إداريةٌ مقصودةٌ لمرّة.
#
#  الأمان: الكلمة تُقرأ من بيئة الخادم ولا تُمرَّر في سطر الأوامر (فتظهر
#  في `ps`) ولا تُطبع. وpsql يقتبسها بـ:'pw' فلا حقن.
#
#  الاستعمال (على خادم القاعدة):
#    export NAFATH_BRIDGE_PASSWORD='...'      # القيمة نفسها في الواجهة والـAPI
#    DB_URL='postgresql://postgres:PASS@HOST:PORT/postgres' \
#      ./deploy/staging/fix-bridge-password.sh
#    DB_URL=... ./deploy/staging/fix-bridge-password.sh --dry-run
# ============================================================
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

if [ -z "${DB_URL:-}" ]; then
  echo "✗ اضبط DB_URL أوّلاً." >&2; exit 1
fi
if [ -z "${NAFATH_BRIDGE_PASSWORD:-}" ]; then
  echo "✗ NAFATH_BRIDGE_PASSWORD غير مضبوطة في هذه الصدفة." >&2
  echo "  اقرأها من بيئة تشغيل الواجهة (نفس القيمة في السيرفرين)." >&2
  exit 1
fi
command -v psql >/dev/null 2>&1 || { echo "✗ psql غير موجود على هذا الجهاز." >&2; exit 1; }

echo "── قبل المصالحة ──"
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -v pw="$NAFATH_BRIDGE_PASSWORD" <<'SQL'
select count(*) as "حسابات الجسر",
       count(*) filter (where encrypted_password = extensions.crypt(:'pw', encrypted_password)) as "تقبل كلمة البيئة"
  from auth.users where email like '%@nafath.local';
SQL

if [ "$DRY" = "1" ]; then
  echo "(بروفة — لم يُكتب شيء)"; exit 0
fi

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -v pw="$NAFATH_BRIDGE_PASSWORD" <<'SQL'
begin;
update auth.users
   set encrypted_password = extensions.crypt(:'pw', extensions.gen_salt('bf')),
       updated_at = now()
 where email like '%@nafath.local'
   and encrypted_password <> extensions.crypt(:'pw', encrypted_password);
commit;
SQL

echo "── بعد المصالحة ──"
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -v pw="$NAFATH_BRIDGE_PASSWORD" <<'SQL'
select count(*) as "حسابات الجسر",
       count(*) filter (where encrypted_password = extensions.crypt(:'pw', encrypted_password)) as "تقبل كلمة البيئة",
       count(*) filter (where encrypted_password <> extensions.crypt(:'pw', encrypted_password)) as "ما زالت مخالِفة"
  from auth.users where email like '%@nafath.local';
SQL
echo "✅ تمّت المصالحة — جرّب الدخول بأيّ هويةٍ تجريبية."
