-- ============================================================
--  حجب هوية طالب الحماية عن الدارس والمقيّم — ضد Supabase الفعلي تحت RLS
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/study-eval-request-redaction-tests.sql
--  الأسلوب (نمط study-eval-portal-tests): معاملة واحدة تُدحرج في النهاية؛
--  الانتحال بـ request.jwt.claims + set local role.
--  التغطية: study_eval_requests تبتر identity/emergency_contact/on_behalf
--  وonBehalf (نموذج seeker الإلكتروني) وتُبقي مفاتيح الوقائع · النمط
--  النصّي القديم يمرّ كما هو · عزل غير المُسنَد إليه · إقفال القراءة
--  المباشرة من protection_requests.
-- ============================================================
\set QUIET on
begin;

create temp table t_ids as
select
  (select id from auth.users where email = '2000000003@nafath.local') as s1, -- دارس (خالد)
  (select id from auth.users where email = '2000000031@nafath.local') as s2, -- دارس مساند
  (select id from auth.users where email = '2000000032@nafath.local') as s3, -- دارس مساند
  (select id from auth.users where email = '2000000004@nafath.local') as e1; -- مقيّمة (منى)

do $$ begin
  if exists (select 1 from t_ids where s1 is null or s2 is null or s3 is null or e1 is null) then
    raise exception 'هويات البذور ناقصة — شغّل seed.sql أولاً';
  end if;
end $$;

-- قضيتان: ورقية بمفاتيح الهوية الكاملة + قديمة بتفاصيل نصّية حرة
insert into protection_cases (ref_no, secret_code, category, status, source)
values ('REF-TEST-9911','C-TEST-9911','witness','submitted','local'),
       ('REF-TEST-9912','C-TEST-9912','victim','submitted','local');

create temp table t_cases as
select
  (select id from protection_cases where secret_code='C-TEST-9911') as c1,
  (select id from protection_cases where secret_code='C-TEST-9912') as c2;

insert into protection_requests (case_id, applicant_role, channel, details)
select c.c1, 'أصيل', 'seeker', jsonb_build_object(
  'identity', jsonb_build_object('name','فلان الفلاني','nid','1099887766','phone','0500000001','verified',false),
  'emergency_contact', jsonb_build_object('name','علّان','rel','أخ','phone','0500000002'),
  'on_behalf', jsonb_build_object('nid','1088776655','name','وكيله','age','40'),
  'onBehalf', jsonb_build_object('id','1077665544','name','المشمول بالحماية','age','15'),
  'crime', 'ابتزاز', 'reason', 'مسوّغات الاختبار', 'city', 'الرياض',
  'paper_source', 'seeker')
from t_cases c;

insert into protection_requests (case_id, applicant_role, channel, details)
select c.c2, 'أصيل', 'seeker', to_jsonb('نصّ حرّ قديم — مسوّغات بلا بنية'::text)
from t_cases c;

-- الإسناد الآليّ بالمحفّز عند under_study
update protection_cases set status='under_study'
where id in (select c1 from t_cases union select c2 from t_cases);

-- انتحال مستخدم: claims + دور authenticated (يُعاد postgres بـ reset role)
create or replace function pg_temp.impersonate(_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end $$;

-- ─── 1) المُسنَد إليه: النموذج يصل مبتور الهوية كامل الوقائع ───
do $$
declare i record; c record; _uid uuid; _d jsonb; _n int;
begin
  select * into i from t_ids; select * into c from t_cases;
  -- دارس مُسنَد للقضيتين معاً — الإسناد بالعبء (_per_role=2) قد يفرّق زوجَي
  -- القضيتين متى زاد الدارسون على اثنين، فالتقاطع لا دارسٌ بعينه
  select x.studier_id into _uid from (
    select s.studier_id from studies s where s.case_id = c.c1
    intersect
    select s.studier_id from studies s where s.case_id = c.c2
  ) x order by x.studier_id limit 1;
  if _uid is null then
    -- لا تقاطع — إسناد حتميّ في التجهيز يُدحرج مع المعاملة كسائر البيانات
    select s.studier_id into _uid from studies s where s.case_id = c.c1
    order by s.studier_id limit 1;
    if _uid is null then raise exception 'تجهيز فشل: لا إسناد دراسة للقضية'; end if;
    insert into studies (case_id, studier_id) values (c.c2, _uid)
      on conflict (case_id, studier_id) do nothing;
  end if;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  select count(*) into _n from study_eval_requests(array[c.c1, c.c2]);
  select details into _d from study_eval_requests(array[c.c1]) limit 1;
  execute 'reset role';

  if _n <> 2 then raise exception 'اختبار 1أ فشل: نموذجا القضيتين المُسنَدتين (وجد %)', _n; end if;
  if _d ? 'identity' or _d ? 'emergency_contact' or _d ? 'on_behalf' or _d ? 'onBehalf' then
    raise exception 'اختبار 1ب فشل: مفاتيح الهوية لم تُبتر — %', _d;
  end if;
  if _d->>'crime' <> 'ابتزاز' or _d->>'reason' <> 'مسوّغات الاختبار' or _d->>'city' <> 'الرياض' then
    raise exception 'اختبار 1ج فشل: مفاتيح الوقائع تضرّرت بالبتر';
  end if;
  raise notice 'اختبار 1 ✓ البتر الثلاثي مع سلامة الوقائع للمُسنَد إليه';
end $$;

-- ─── 2) النمط النصّي القديم يمرّ كما هو + المقيّم كالدارس ───
do $$
declare c record; _uid uuid; _d jsonb;
begin
  select * into c from t_cases;
  select a.evaluator_id into _uid from assessments a where a.case_id = c.c2 limit 1;
  if _uid is null then raise exception 'تجهيز فشل: لا إسناد تقييم للقضية'; end if;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  select details into _d from study_eval_requests(array[c.c2]) limit 1;
  execute 'reset role';

  if jsonb_typeof(_d) <> 'string' or _d #>> '{}' <> 'نصّ حرّ قديم — مسوّغات بلا بنية' then
    raise exception 'اختبار 2 فشل: التفاصيل النصّية القديمة تغيّرت (%)', _d;
  end if;
  raise notice 'اختبار 2 ✓ النمط النصّي القديم سليم والمقيّم يقرأ عبر الدالة';
end $$;

-- ─── 3) العزل: غير المُسنَد إليه لا يرى شيئاً ───
do $$
declare i record; c record; _uid uuid; _n int;
begin
  select * into i from t_ids; select * into c from t_cases;
  -- دارس غير مُسنَد لهذه القضية تحديداً
  select x.u into _uid from (values (i.s1),(i.s2),(i.s3)) x(u)
  where not exists (select 1 from studies s where s.case_id = c.c1 and s.studier_id = x.u)
    and not exists (select 1 from assessments a where a.case_id = c.c1 and a.evaluator_id = x.u)
  limit 1;
  if _uid is null then raise notice 'اختبار 3 (تخطٍّ): كل مستخدمي البذور مُسنَدون'; return; end if;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  select count(*) into _n from study_eval_requests(array[c.c1]);
  execute 'reset role';
  if _n <> 0 then raise exception 'اختبار 3 فشل: غير المُسنَد إليه قرأ النموذج (%)', _n; end if;
  raise notice 'اختبار 3 ✓ العزل — غير المُسنَد إليه صفر صفوف';
end $$;

-- ─── 4) إقفال القراءة المباشرة: صفّ protection_requests لم يعد يصل ───
do $$
declare c record; _uid uuid; _n int;
begin
  select * into c from t_cases;
  select s.studier_id into _uid from studies s where s.case_id = c.c1 limit 1;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  select count(*) into _n from protection_requests where case_id in (c.c1, c.c2);
  execute 'reset role';
  if _n <> 0 then
    raise exception 'اختبار 4 فشل: القراءة المباشرة ما زالت مفتوحة (% صفوف) — سياسة أخرى تفتحها؟', _n;
  end if;
  raise notice 'اختبار 4 ✓ القراءة المباشرة مقفلة — الدالة المقيّدة هي المنفذ الوحيد';
end $$;

rollback;
\echo '✓✓ اختبارات حجب الهوية عن الدارس والمقيّم اجتازت كاملة — أُرجعت المعاملة، لا أثر في القاعدة'
