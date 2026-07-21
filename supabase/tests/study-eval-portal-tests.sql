-- ============================================================
--  حالات اختبار بوابتي الدارس والمقيّم — ضد Supabase الفعلي تحت RLS
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/study-eval-portal-tests.sql
--  الأسلوب (نمط triage-portal-tests): معاملة واحدة تُدحرج في النهاية —
--  لا أثر يبقى في القاعدة؛ قضايا الاختبار تُنشأ داخل المعاملة فلا تعتمد
--  على حالة بيانات العرض؛ الانتحال بـ request.jwt.claims + set local role.
--  التغطية: الإسناد الآليّ بالعبء (المشغّل) · إشعارات الإسناد والمهلة ·
--  my_study_tasks/my_assessment_tasks · submit_study/submit_assessment
--  (بندا الاطّلاع · الجزئي · الرفض · upsert · حرّاس الدور والحالة) ·
--  كشف الرمز وفتح المرفقات بالتدقيق (م15/16) · العزل الصفّي بالاتجاهين ·
--  عزل الإشعارات والتفضيلات · مراسلات القيادة (إرسال/رد/قراءة/حدود) ·
--  قراءة التجميع للمجلس ولمعدّ القرار.
-- ============================================================
\set QUIET on
begin;

-- ─── تجهيز: الهويات + ثلاث قضايا اختبار تُنشأ الآن ───
create temp table t_ids as
select
  (select id from auth.users where email = '2000000003@nafath.local') as s1, -- دارس (خالد)
  (select id from auth.users where email = '2000000031@nafath.local') as s2, -- دارس مساند
  (select id from auth.users where email = '2000000032@nafath.local') as s3, -- دارس مساند
  (select id from auth.users where email = '2000000004@nafath.local') as e1, -- مقيّمة (منى)
  (select id from auth.users where email = '2000000041@nafath.local') as e2, -- مقيّم مساند
  (select id from auth.users where email = '2000000042@nafath.local') as e3, -- مقيّم مساند
  (select id from auth.users where email = '2000000009@nafath.local') as deputy,  -- نائب الرئيس
  (select id from auth.users where email = '2000000006@nafath.local') as member,  -- عضو مجلس
  (select id from auth.users where email = '2000000005@nafath.local') as preparer; -- معدّ القرار

do $$ begin
  if exists (select 1 from t_ids where s1 is null or s2 is null or s3 is null
             or e1 is null or e2 is null or e3 is null
             or deputy is null or member is null or preparer is null) then
    raise exception 'هويات البذور ناقصة — شغّل seed.sql أولاً';
  end if;
end $$;

-- أحمال المؤلّفين قبل الإسناد (لإثبات «الأقل عبئاً»)
create temp table t_loads as
select ur.user_id, ur.role::text as role,
  case when ur.role = 'studier'
    then (select count(*) from studies s where s.studier_id = ur.user_id and s.submitted_at is null)
    else (select count(*) from assessments a where a.evaluator_id = ur.user_id and a.submitted_at is null)
  end as load
from user_roles ur where ur.role in ('studier','evaluator');

insert into protection_cases (ref_no, secret_code, category, status, source)
values ('REF-TEST-9901','C-TEST-9901','witness','submitted','local'),
       ('REF-TEST-9902','C-TEST-9902','victim','submitted','urgent'),
       ('REF-TEST-9903','C-TEST-9903','reporter','submitted','local');

create temp table t_cases as
select
  (select id from protection_cases where secret_code='C-TEST-9901') as c1,
  (select id from protection_cases where secret_code='C-TEST-9902') as c2,
  (select id from protection_cases where secret_code='C-TEST-9903') as c3;

-- انتحال مستخدم: claims + دور authenticated (يُعاد postgres بـ reset role)
create or replace function pg_temp.impersonate(_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end $$;

-- ─── 1) الإسناد الآليّ بالعبء عند under_study + إشعاراته ───
do $$
declare i record; c record; _s int; _a int; _n int; _worstpick int; _bestrest int;
begin
  select * into i from t_ids; select * into c from t_cases;

  update protection_cases set status='under_study' where id in (c.c1, c.c2, c.c3);

  select count(*), count(distinct studier_id) into _s, _n from studies where case_id = c.c1;
  if _s <> 2 or _n <> 2 then raise exception 'اختبار 1أ فشل: إسناد دارسين اثنين متمايزين (وجد %)', _s; end if;
  select count(*) into _a from assessments where case_id = c.c1;
  if _a <> 2 then raise exception 'اختبار 1ب فشل: إسناد مقيّمين اثنين (وجد %)', _a; end if;

  -- «الأقل عبئاً»: أسوأ مُختارٍ لا يتجاوز أفضل مستبعَد (قبل الإسناد)
  select max(l.load) into _worstpick from t_loads l
   where l.role='studier' and l.user_id in (select studier_id from studies where case_id=c.c1);
  select min(l.load) into _bestrest from t_loads l
   where l.role='studier' and l.user_id not in (select studier_id from studies where case_id=c.c1);
  if _bestrest is not null and _worstpick > _bestrest then
    raise exception 'اختبار 1ج فشل: الإسناد ليس بالأقل عبئاً (% > %)', _worstpick, _bestrest;
  end if;

  -- إشعار «assign» لكل مُسنَدٍ إليه، والعاجل يزيد إشعار مهلة crit
  select count(*) into _n from notifications where case_id=c.c1 and type='assign';
  if _n <> 4 then raise exception 'اختبار 1د فشل: 4 إشعارات إسناد (وجد %)', _n; end if;
  select count(*) into _n from notifications where case_id=c.c2 and type='deadline' and crit;
  if _n <> 4 then raise exception 'اختبار 1هـ فشل: إشعارات مهلة عاجلة crit (وجد %)', _n; end if;
  raise notice 'اختبار 1 ✓ الإسناد الآلي بالعبء + إشعارات الإسناد والمهلة';
end $$;

-- ─── 2) my_study_tasks / my_assessment_tasks — كلٌّ يرى مهامّه فقط ───
do $$
declare i record; _mine int; _leak int; _cross int; _real int;
begin
  select * into i from t_ids;
  perform pg_temp.impersonate(i.s1);
  execute 'set local role authenticated';
  select count(*), count(*) filter (where t.case_id in
    (select s.case_id from studies s where s.studier_id <> i.s1
      and s.case_id not in (select s2.case_id from studies s2 where s2.studier_id = i.s1)))
    into _mine, _leak from my_study_tasks() t;
  select count(*) into _cross from my_assessment_tasks();
  execute 'reset role';
  select count(*) into _real from studies where studier_id = i.s1;
  if _mine <> _real then raise exception 'اختبار 2أ فشل: مهام الدارس % <> صفوفه %', _mine, _real; end if;
  if _leak <> 0 then raise exception 'اختبار 2ب فشل: تسرّب مهام الغير'; end if;
  if _cross <> 0 then raise exception 'اختبار 2ج فشل: الدارس يرى مهام تقييم (%)', _cross; end if;

  perform pg_temp.impersonate(i.e1);
  execute 'set local role authenticated';
  select count(*) into _mine from my_assessment_tasks();
  select count(*) into _cross from my_study_tasks();
  execute 'reset role';
  select count(*) into _real from assessments where evaluator_id = i.e1;
  if _mine <> _real then raise exception 'اختبار 2د فشل: مهام المقيّمة % <> صفوفها %', _mine, _real; end if;
  if _cross <> 0 then raise exception 'اختبار 2هـ فشل: المقيّمة ترى مهام دراسة'; end if;
  raise notice 'اختبار 2 ✓ جلب المهام معزول بالمؤلّف وبالدور';
end $$;

-- ─── 3) submit_study: بندا الاطّلاع + الأنواع + upsert + الحرّاس ───
do $$
declare i record; c record; _uid uuid; _id1 uuid; _id2 uuid; _n int; _ok boolean := false;
begin
  select * into i from t_ids; select * into c from t_cases;
  select studier_id into _uid from studies where case_id = c.c2 limit 1;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  select id into _id1 from submit_study(c.c2, 'قبول جزئي', null,
    '["الحماية الأمنية","حماية المسكن"]'::jsonb, null,
    'ملاحظات الاطّلاع.', 'يُستثنى تغيير محل الإقامة.', true, false);
  -- upsert: إعادة الاعتماد تحدّث الصف نفسه
  select id into _id2 from submit_study(c.c2, 'قبول كلي', null,
    '["الحماية الأمنية"]'::jsonb, interval '30 days', null, null, true, true);
  execute 'reset role';

  if _id1 <> _id2 then raise exception 'اختبار 3أ فشل: upsert أنشأ صفاً جديداً'; end if;
  select count(*) into _n from studies where id = _id1 and recommendation='قبول كلي'
    and found_recommendation and found_request and submitted_at is not null;
  if _n <> 1 then raise exception 'اختبار 3ب فشل: بندا الاطّلاع/القيم لم تُكتب'; end if;
  select count(*) into _n from audit_log where actor_id=_uid and action='submit_study' and target='REF-TEST-9902';
  if _n < 2 then raise exception 'اختبار 3ج فشل: تدقيق الاعتماد ناقص (%)', _n; end if;

  -- حارس الدور: مقيّمة تستدعي submit_study
  perform pg_temp.impersonate(i.e1);
  execute 'set local role authenticated';
  begin
    perform submit_study(c.c2, 'قبول كلي', null, null, null, null);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%not studier%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 3د فشل: حارس الدور لم يعمل'; end if;

  -- حارس الحالة: قضية خارج under_study
  update protection_cases set status='in_decision' where id = c.c3;
  select studier_id into _uid from studies where case_id = c.c3 limit 1;
  _ok := false;
  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  begin
    perform submit_study(c.c3, 'قبول كلي', null, null, null, null);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%ليست في الدراسة%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  update protection_cases set status='under_study' where id = c.c3;
  if not _ok then raise exception 'اختبار 3هـ فشل: حارس الحالة لم يعمل'; end if;
  raise notice 'اختبار 3 ✓ submit_study: بندا الاطّلاع · upsert · التدقيق · حارسا الدور والحالة';
end $$;

-- ─── 4) submit_assessment: الرفض المسبَّب + حارس الدور ───
do $$
declare c record; i record; _uid uuid; _n int; _ok boolean := false;
begin
  select * into i from t_ids; select * into c from t_cases;
  select evaluator_id into _uid from assessments where case_id = c.c2 limit 1;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  perform submit_assessment(c.c2, 'رفض الحماية',
    '[{"k":"r3","t":"عدم وجود خطر أو تهديد","note":"لا مؤشرات موثّقة"}]'::jsonb,
    null, null, null, null, true, true);
  execute 'reset role';
  select count(*) into _n from assessments where case_id=c.c2 and evaluator_id=_uid
    and recommendation='رفض الحماية' and reject_reasons->0->>'k'='r3'
    and found_recommendation and found_request and submitted_at is not null;
  if _n <> 1 then raise exception 'اختبار 4أ فشل: الرفض المسبَّب لم يُكتب'; end if;

  perform pg_temp.impersonate(i.s1);
  execute 'set local role authenticated';
  begin
    perform submit_assessment(c.c2, 'قبول كلي', null, null, null, null);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%not evaluator%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 4ب فشل: حارس الدور لم يعمل'; end if;

  -- إشعار «output» عند الاعتماد
  select count(*) into _n from notifications where case_id=c.c2 and recipient_id=_uid and type='output';
  if _n < 1 then raise exception 'اختبار 4ج فشل: لا إشعار استقبال مخرَج'; end if;
  raise notice 'اختبار 4 ✓ submit_assessment: الرفض المسبَّب · حارس الدور · إشعار المخرَج';
end $$;

-- ─── 5) كشف الرمز وفتح المرفقات = تدقيق م15/16، وغير المُسنَد مرفوض ───
do $$
declare c record; i record; _uid uuid; _out uuid; _n int; _ok boolean := false;
begin
  select * into i from t_ids; select * into c from t_cases;
  select studier_id into _uid from studies where case_id = c.c1 limit 1;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  perform record_secret_reveal(c.c1);
  perform record_attachment_open(c.c1, 'تقرير تقييم المخاطر');
  execute 'reset role';
  select count(*) into _n from audit_log where actor_id=_uid and action='secret_reveal' and target='REF-TEST-9901';
  if _n <> 1 then raise exception 'اختبار 5أ فشل: كشف الرمز غير مسجَّل'; end if;
  select count(*) into _n from audit_log where actor_id=_uid and action='attachment_open'
    and target='REF-TEST-9901 · تقرير تقييم المخاطر';
  if _n <> 1 then raise exception 'اختبار 5ب فشل: فتح المرفق غير مسجَّل بصيغته'; end if;

  -- غير مُسنَد على c1 (مؤلّف لم يُختَر لها)
  select user_id into _out from t_loads
   where role='evaluator' and user_id not in (select evaluator_id from assessments where case_id=c.c1)
   limit 1;
  if _out is null then
    select user_id into _out from t_loads
     where role='studier' and user_id not in (select studier_id from studies where case_id=c.c1) limit 1;
  end if;
  perform pg_temp.impersonate(_out);
  execute 'set local role authenticated';
  begin
    perform record_attachment_open(c.c1, 'أي مستند');
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%not assigned%' then _ok := true; else raise; end if;
  end;
  begin
    perform record_secret_reveal(c.c1);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%not assigned%' then null; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 5ج فشل: غير المُسنَد لم يُرفض'; end if;

  -- مستند فارغ مرفوض
  _ok := false;
  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  begin
    perform record_attachment_open(c.c1, '  ');
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%غير محدّد%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 5د فشل: المستند الفارغ لم يُرفض'; end if;
  raise notice 'اختبار 5 ✓ الكشف وفتح المرفقات: تدقيق دقيق الصيغة + رفض غير المُسنَد';
end $$;

-- ─── 6) العزل الصفّي RLS بالاتجاهين + عزل الإشعارات والتفضيلات ───
do $$
declare i record; _peers int; _cross int; _n int;
begin
  select * into i from t_ids;

  perform pg_temp.impersonate(i.s1);
  execute 'set local role authenticated';
  select count(*) filter (where studier_id <> i.s1) into _peers from studies;
  select count(*) into _cross from assessments;
  select count(*) filter (where recipient_id <> i.s1) into _n from notifications;
  execute 'reset role';
  if _peers <> 0 then raise exception 'اختبار 6أ فشل: الدارس يرى دراسات أقرانه (%)', _peers; end if;
  if _cross <> 0 then raise exception 'اختبار 6ب فشل: الدارس يرى تقييمات (%)', _cross; end if;
  if _n <> 0 then raise exception 'اختبار 6ج فشل: تسرّب إشعارات الغير (%)', _n; end if;

  perform pg_temp.impersonate(i.e1);
  execute 'set local role authenticated';
  select count(*) filter (where evaluator_id <> i.e1) into _peers from assessments;
  select count(*) into _cross from studies;
  execute 'reset role';
  if _peers <> 0 or _cross <> 0 then
    raise exception 'اختبار 6د فشل: عزل المقيّمة (أقران % · دراسات %)', _peers, _cross; end if;

  -- التفضيلات: صفّ المستخدم نفسه فقط
  insert into user_prefs (user_id, prefs) values (i.s1, '{"sidebar-studier":true}'::jsonb)
  on conflict (user_id) do update set prefs = excluded.prefs;
  perform pg_temp.impersonate(i.e1);
  execute 'set local role authenticated';
  select count(*) filter (where user_id <> i.e1) into _n from user_prefs;
  execute 'reset role';
  if _n <> 0 then raise exception 'اختبار 6هـ فشل: تسرّب تفضيلات الغير'; end if;
  raise notice 'اختبار 6 ✓ العزل الصفّي بالاتجاهين + عزل الإشعارات والتفضيلات';
end $$;

-- ─── 7) مراسلات القيادة: إرسال المُسنَد فقط، الرد يولّد إشعاراً، والقراءة تثبت ───
do $$
declare c record; i record; _uid uuid; _out uuid; _mid uuid; _n int; _ok boolean := false;
begin
  select * into i from t_ids; select * into c from t_cases;
  select studier_id into _uid from studies where case_id = c.c1 limit 1;

  -- الموظف المُسنَد يبدأ خيطاً على طلب نشط + تدقيق
  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  select send_leader_message(c.c1, 'deputy', 'استفسار عن أولوية الطلب.') into _mid;
  execute 'reset role';
  if _mid is null then raise exception 'اختبار 7أ فشل: لم يُرسل'; end if;
  select count(*) into _n from audit_log where actor_id=_uid and action='leader_message' and target='REF-TEST-9901';
  if _n <> 1 then raise exception 'اختبار 7ب فشل: لا تدقيق للرسالة'; end if;

  -- رسالة فارغة مرفوضة
  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  begin
    perform send_leader_message(c.c1, 'deputy', '   ');
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%فارغة%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 7ج فشل: الرسالة الفارغة لم تُرفض'; end if;

  -- غير المُسنَد مرفوض
  select user_id into _out from t_loads
   where role='studier' and user_id not in (select studier_id from studies where case_id=c.c1) limit 1;
  _ok := false;
  if _out is not null then
    perform pg_temp.impersonate(_out);
    execute 'set local role authenticated';
    begin
      perform send_leader_message(c.c1, 'deputy', 'محاولة غير مشروعة');
      raise exception 'FORCE';
    exception when others then
      if sqlerrm like '%غير مُسنَد%' then _ok := true; else raise; end if;
    end;
    execute 'reset role';
    if not _ok then raise exception 'اختبار 7د فشل: غير المُسنَد أرسل'; end if;
  end if;

  -- ردّ القيادة (direction=in) يولّد إشعار «msg» للموظف، وفتح الخيط يثبت القراءة
  perform pg_temp.impersonate(i.deputy);
  execute 'set local role authenticated';
  insert into leadership_messages (case_id, author_id, author_role, leader, direction, body)
  values (c.c1, _uid, 'studier', 'deputy', 'in', 'تمّ الاطّلاع — استمرّ وفق المهلة.');
  execute 'reset role';
  select count(*) into _n from notifications where case_id=c.c1 and recipient_id=_uid and type='msg';
  if _n < 1 then raise exception 'اختبار 7هـ فشل: ردّ القيادة بلا إشعار'; end if;

  perform pg_temp.impersonate(_uid);
  execute 'set local role authenticated';
  perform mark_leader_thread_read(c.c1, 'deputy');
  execute 'reset role';
  select count(*) into _n from leadership_messages
   where case_id=c.c1 and author_id=_uid and direction='in' and read_at is null;
  if _n <> 0 then raise exception 'اختبار 7و فشل: القراءة لم تثبت'; end if;

  -- عزل الخيوط: مؤلّف آخر لا يرى خيط زميله
  if _out is not null then
    perform pg_temp.impersonate(_out);
    execute 'set local role authenticated';
    select count(*) into _n from leadership_messages where case_id=c.c1 and author_id=_uid;
    execute 'reset role';
    if _n <> 0 then raise exception 'اختبار 7ز فشل: تسرّب خيوط الغير'; end if;
  end if;
  raise notice 'اختبار 7 ✓ المراسلات: حدود الإرسال · إشعار الرد · ثبات القراءة · عزل الخيوط';
end $$;

-- ─── 8) قراءة التجميع: عضو المجلس ومعدّ القرار يقرآن الكل بالحقول الجديدة ───
do $$
declare c record; i record; _s int; _a int; _f int;
begin
  select * into i from t_ids; select * into c from t_cases;

  perform pg_temp.impersonate(i.member);
  execute 'set local role authenticated';
  select count(*) into _s from studies where case_id = c.c2;
  select count(*) into _a from assessments where case_id = c.c2;
  execute 'reset role';
  if _s < 2 or _a < 2 then raise exception 'اختبار 8أ فشل: تجميع المجلس ناقص (% · %)', _s, _a; end if;

  perform pg_temp.impersonate(i.preparer);
  execute 'set local role authenticated';
  select count(*) into _s from studies where case_id = c.c2;
  select count(*) into _f from studies where case_id = c.c2 and found_recommendation is not null;
  execute 'reset role';
  if _s < 2 then raise exception 'اختبار 8ب فشل: معدّ القرار لا يقرأ التجميع'; end if;
  if _f < 1 then raise exception 'اختبار 8ج فشل: بندا الاطّلاع لا يصلان الحزمة'; end if;
  raise notice 'اختبار 8 ✓ التجميع الكامل للمجلس ولمعدّ القرار ببندي الاطّلاع';
end $$;

rollback;
\echo '✓✓ اختبارات بوابتي الدارس والمقيّم اجتازت كاملة — أُرجعت المعاملة، لا أثر في القاعدة'
