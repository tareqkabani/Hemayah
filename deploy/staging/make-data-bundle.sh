#!/usr/bin/env bash
# ============================================================
#  مولّد حزمة بيانات العرض — من قاعدة التطوير المحلّية إلى بيئةٍ معزولة
#
#  الأخت التوأم لـmake-offline-bundle.sh: تلك تنقل **المخطّط** (المهاجرات)،
#  وهذه تنقل **البيانات** (الحسابات والقضايا وكلّ صفوف public). تُخرج ملفَ
#  SQL واحداً مكتفياً بذاته يُحمل ويُنفَّذ بـpsql وحده — بلا شبكةٍ ولا مستودع.
#
#  ⚠️ حارس النسخة: الحزمة تُسجّل نسخة مخطّط المصدر وتَقِف إن خالفتها الوجهة.
#  تحميل بياناتٍ من مخطّطٍ أحدث على مخطّطٍ أقدم يفشل جزئياً ويترك القاعدة
#  ممزّقة — فالمهاجرات أوّلاً (make-offline-bundle.sh) ثمّ البيانات.
#
#  ⚠️ كلمات السرّ: الحسابات المنقولة تحمل كلمة البذور الثابتة، وبيئة
#  التشغيل تضبط NAFATH_BRIDGE_PASSWORD عشوائيةً قوية. فبعد التحميل
#  شغّل fix-bridge-password.sh وإلّا رُفض كلُّ دخول.
#
#  الاستعمال:
#    ./deploy/staging/make-data-bundle.sh
#    CONTAINER=supabase_db_Hemayah OUT=/tmp/data.sql ./deploy/staging/make-data-bundle.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${CONTAINER:-supabase_db_Hemayah}"
OUT="${OUT:-$ROOT/deploy/staging/data-bundle.sql}"

docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "✗ الحاوية $CONTAINER غير موجودة." >&2; exit 1; }

SCHEMA_VER=$(docker exec "$CONTAINER" psql -U postgres -d postgres -At \
  -c "select max(version) from supabase_migrations.schema_migrations;")
[ -n "$SCHEMA_VER" ] || { echo "✗ تعذّرت قراءة نسخة المخطّط." >&2; exit 1; }
REV=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo "—")

echo "── توليد حزمة البيانات ──"
echo "   نسخة المخطّط: $SCHEMA_VER"

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

# بيانات public كلّها + حسابات المصادقة وهويّاتها فقط (لا جلسات ولا رموز
# تحديث: عابرةٌ وتُنشأ عند الدخول، ونقلُها يورّث جلساتٍ ميّتة).
# تفريغان منفصلان لا نداءٌ واحد: خلط --schema مع --table في pg_dump يقصر
# النتيجة على جداول --table ويُسقط المخطّط كلَّه بصمت (عيبٌ كشفه اختبار
# التحميل الدائريّ: صدرت الحزمة بجدولين من ستّةٍ وخمسين).
docker exec "$CONTAINER" pg_dump -U postgres -d postgres \
  --data-only --no-owner --no-privileges \
  --schema=public > "$TMP"

docker exec "$CONTAINER" pg_dump -U postgres -d postgres \
  --data-only --no-owner --no-privileges \
  --table=auth.users --table=auth.identities >> "$TMP"

COPIES=$(grep -c '^COPY ' "$TMP" || true)
[ "$COPIES" -ge 10 ] || { echo "\u2717 الحزمة تحوي $COPIES جدولاً فقط — تفريغٌ ناقص." >&2; exit 1; }
echo "   جداول فيها بيانات: $COPIES"

{
  echo "-- ============================================================"
  echo "--  حزمة بيانات العرض — مولَّدة آلياً، لا تُحرَّر يدوياً."
  echo "--  المصدر: $CONTAINER · نسخة المخطّط: $SCHEMA_VER · الشيفرة: $REV"
  echo "--  التوليد: $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo "--"
  echo "--  التنفيذ:  psql \"\$DB_URL\" -v ON_ERROR_STOP=1 -f data-bundle.sql"
  echo "--  ثمّ:       ./deploy/staging/fix-bridge-password.sh"
  echo "-- ============================================================"
  echo "\\set ON_ERROR_STOP on"
  echo "begin;"
  echo "-- تعطيل مشغّلات القيود أثناء التحميل. لا --disable-triggers:\n-- تُصدر ALTER TABLE … DISABLE TRIGGER ALL وهي تُرفض على مشغّلات\n-- القيود النظامية حتى للمستخدم الأعلى (خطأٌ مُجرَّب)."
  echo "set session_replication_role = replica;"
  echo ""
  echo "-- حارس النسخة: تُرفض الوجهة إن خالف مخطّطها مخطّط المصدر."
  echo "do \$guard\$"
  echo "declare _v text;"
  echo "begin"
  echo "  select max(version) into _v from supabase_migrations.schema_migrations;"
  echo "  if _v is distinct from '$SCHEMA_VER' then"
  echo "    raise exception 'نسخة المخطّط لا تطابق: الوجهة % والحزمة % — طبّق المهاجرات أوّلاً (make-offline-bundle.sh).', coalesce(_v,'∅'), '$SCHEMA_VER';"
  echo "  end if;"
  echo "end \$guard\$;"
  echo ""
  echo "-- إفراغ بيانات العرض القائمة (المخطّط لا يُمسّ)."
  echo "do \$wipe\$"
  echo "declare t record;"
  echo "begin"
  echo "  for t in select tablename from pg_tables where schemaname='public'"
  echo "                   and tablename <> 'schema_migrations' loop"
  echo "    execute format('truncate table public.%I cascade', t.tablename);"
  echo "  end loop;"
  echo "  delete from auth.identities;"
  echo "  delete from auth.users;"
  echo "end \$wipe\$;"
  echo ""
  cat "$TMP"
  echo ""
  echo "set session_replication_role = origin;"
  echo "commit;"
  echo "\\echo '✅ حُمّلت بيانات العرض — شغّل الآن fix-bridge-password.sh وإلّا رُفض كلُّ دخول.'"
} > "$OUT"

LINES=$(wc -l < "$OUT" | tr -d ' ')
SIZE=$(du -h "$OUT" | cut -f1)
echo "✅ $OUT  ($LINES سطراً · $SIZE)"
echo ""
echo "   على الخادم:"
echo "     psql \"\$DB_URL\" -v ON_ERROR_STOP=1 -f data-bundle.sql"
echo "     NAFATH_BRIDGE_PASSWORD=... DB_URL=... ./deploy/staging/fix-bridge-password.sh"
