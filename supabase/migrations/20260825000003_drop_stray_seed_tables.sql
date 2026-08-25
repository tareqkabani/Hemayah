-- ============================================================
--  إزالةُ الجداول الشاردة من public — تلوّثُ نسخةٍ محليّة لا تصميم
--  (تدقيق أمنيّ 2026-08-25 · HMY-21 · أكّده مُدقِّق Supabase: 0013_rls_disabled_in_public)
--
--  أصلها: تشغيلُ سطرٍ مثل `SELECT id INTO officer FROM auth.users …` في
--  psql على المستوى الأعلى (خارج كتلة DO $$…$$) يُنشئ جدولاً اسمُه
--  `officer` لا متغيّراً — بخلاف PL/pgSQL. فنتجت 17 جدولاً بأسماء
--  متغيّرات seed.sql، كلٌّ بعمود id:uuid وحده، بلا RLS، غير موجودةٍ في
--  أيّ مهاجرة. محتواها نسخُ id لصفوفٍ حيّةٍ سالمةٍ في auth.users/branches
--  — فلا بياناتٍ أصليةٍ تُفقد.
--
--  أثرُها: يرصدها مُدقِّق Supabase كـERROR (RLS معطّل على جدولٍ مكشوفٍ
--  لـPostgREST)، وتُفسد قياسَ تغطية RLS (56/73 بدل 59/59) فتُخفي أيَّ
--  جدولٍ حقيقيٍّ يُنسى بلا RLS. لا وجودَ لها على قاعدةٍ نظيفة، فهذه
--  المهاجرةُ تنظّف القواعدَ الملوّثةَ القائمة (المحليّة/التجريبية) وتُصبح
--  بلا أثرٍ على أيّ `db reset` قادم.
--
--  حارسُ البصمة: يُسقَط الجدولُ فقط إن كان عمودُه الوحيد id:uuid — فجدولٌ
--  حقيقيٌّ مستقبليٌّ بالاسم نفسه (بأعمدةٍ فعليّة) لا يُمسّ. idempotent.
-- ============================================================

do $$
declare
  _t   text;
  _names text[] := array[
    '_asr','_med','_nzh','e1','e2','e3','eid1','eid2','eid3',
    'evaluator','officer','s1','s2','sid1','sid2','sid3','studier'];
  _cols int;
  _only_id boolean;
begin
  foreach _t in array _names loop
    -- موجودٌ كجدولٍ عاديّ في public؟
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=_t and c.relkind='r'
    ) then
      continue;
    end if;

    -- بصمة: عمودٌ واحدٌ فقط، اسمُه id، نوعُه uuid
    select count(*),
           bool_and(a.attname='id' and format_type(a.atttypid,null)='uuid')
      into _cols, _only_id
      from pg_attribute a
      join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname=_t
       and a.attnum>0 and not a.attisdropped;

    if _cols=1 and coalesce(_only_id,false) then
      execute format('drop table public.%I', _t);
      raise notice 'أُسقط الجدول الشارد: public.%', _t;
    else
      raise notice 'تُخطّي %: لا يطابق البصمة (أعمدة=% ) — قد يكون جدولاً حقيقيّاً', _t, _cols;
    end if;
  end loop;
end $$;
