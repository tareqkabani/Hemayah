-- ============================================================
--  حالات اختبار الإقفال الزمني (م10) — البثّ للجميع ومُقفِل الميعاد
--  (بديل «الإسناد المرن»: أُلغيت إعادة الإسناد بالعبء في 20260810000004)
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/study-eval-resilience-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج — قضايا الاختبار تُنشأ داخلها.
-- ============================================================
\set QUIET on
begin;

select set_config('app.settings.watchdog', 'on', true);

create temp table t_ids as
select
  (select id from auth.users where email = '2000000009@nafath.local') as deputy,
  (select count(*)::int from user_roles where role = 'studier') as n_studiers,
  (select count(*)::int from user_roles where role = 'evaluator') as n_evals;

insert into protection_cases (ref_no, secret_code, category, status, source)
values ('REF-RSL-9911','C-RSL-9911','witness','submitted','local'),
       ('REF-RSL-9912','C-RSL-9912','victim','submitted','local'),
       ('REF-RSL-9913','C-RSL-9913','reporter','submitted','local'),
       ('REF-RSL-9914','C-RSL-9914','witness','submitted','local'),
       ('REF-RSL-9915','C-RSL-9915','victim','submitted','local');

create temp table t_cases as
select
  (select id from protection_cases where secret_code='C-RSL-9911') as c1,
  (select id from protection_cases where secret_code='C-RSL-9912') as c2,
  (select id from protection_cases where secret_code='C-RSL-9913') as c3,
  (select id from protection_cases where secret_code='C-RSL-9914') as c4,
  (select id from protection_cases where secret_code='C-RSL-9915') as c5;

update protection_cases set status='under_study'
 where id in (select c1 from t_cases union select c2 from t_cases
              union select c3 from t_cases union select c4 from t_cases
              union select c5 from t_cases);

create or replace function pg_temp.impersonate(_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end $$;

-- تسليم دراسة/تقييم باسم مؤلَّفٍ ما (يغلّف الانتحال والدورين)
create or replace function pg_temp.submit_one(_case uuid, _kind text) returns uuid
language plpgsql as $$
declare _uid uuid;
begin
  if _kind = 'study' then
    select studier_id into _uid from studies
     where case_id=_case and submitted_at is null and superseded_at is null
     order by studier_id limit 1;
    perform pg_temp.impersonate(_uid);
    execute 'set local role authenticated';
    perform submit_study(_case, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
  else
    select evaluator_id into _uid from assessments
     where case_id=_case and submitted_at is null and superseded_at is null
     order by evaluator_id limit 1;
    perform pg_temp.impersonate(_uid);
    execute 'set local role authenticated';
    perform submit_assessment(_case, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
  end if;
  execute 'reset role';
  return _uid;
end $$;

-- ─── 1) أيام العمل: مرآة صحيحة (الجمعة والسبت لا يُحتسبان) ───
do $$
begin
  -- أحد 2026-07-19 → اثنين 2026-07-20 = يوم عمل واحد
  if business_days_between('2026-07-19','2026-07-20') <> 1 then raise exception 'اختبار 1أ'; end if;
  -- خميس 2026-07-16 → أحد 2026-07-19 = يوم عمل واحد (جمعة وسبت بينهما)
  if business_days_between('2026-07-16','2026-07-19') <> 1 then raise exception 'اختبار 1ب'; end if;
  -- نفس اليوم أو الماضي = صفر
  if business_days_between('2026-07-19','2026-07-19') <> 0 then raise exception 'اختبار 1ج'; end if;
  if business_days_between('2026-07-20','2026-07-19') <> 0 then raise exception 'اختبار 1د'; end if;
  raise notice 'اختبار 1 ✓ business_days_between يطابق تعريف domain (عطلة الجمعة والسبت)';
end $$;

-- ─── 2) الإقفال الزمني: نصاب أدنى وارد + ميعاد منقضٍ → وسم المتأخرين وتقدُّم القضية ───
do $$
declare c record; i record; _n int; _st case_status; _cl int; _al int;
begin
  select * into c from t_cases; select * into i from t_ids;

  -- نصاب أدنى: دراسة واحدة وتقييم واحد
  perform pg_temp.submit_one(c.c1, 'study');
  perform pg_temp.submit_one(c.c1, 'assessment');

  -- انقضاء الميعاد: نُرجع بداية المرحلة أسبوعاً
  update studies set created_at = now() - interval '7 days' where case_id = c.c1;
  update assessments set created_at = now() - interval '7 days' where case_id = c.c1;

  select * into _cl, _al from study_eval_watchdog();
  if _cl < 1 then raise exception 'اختبار 2أ فشل: المُقفِل لم يُقفل (closed=%)', _cl; end if;

  select status into _st from protection_cases where id = c.c1;
  if _st <> 'in_decision' then raise exception 'اختبار 2ب فشل: القضية لم تتقدّم (%)', _st; end if;
  if not exists (select 1 from council_decisions where case_id = c.c1 and status = 'preparing') then
    raise exception 'اختبار 2ج فشل: لا صف إعداد قرار'; end if;

  -- المتأخرون وُسموا «انقضى الميعاد النظامي» لا حُذفوا، والمُقدِّمون سالمون
  select count(*) into _n from (
    select 1 from studies where case_id=c.c1 and submitted_at is null
      and superseded_reason like '%انقضى الميعاد النظامي%'
    union all
    select 1 from assessments where case_id=c.c1 and submitted_at is null
      and superseded_reason like '%انقضى الميعاد النظامي%') x;
  if _n <> (i.n_studiers - 1) + (i.n_evals - 1) then
    raise exception 'اختبار 2د فشل: وسم المتأخرين ناقص (% من %)', _n, (i.n_studiers - 1) + (i.n_evals - 1); end if;
  if exists (select 1 from studies where case_id=c.c1 and submitted_at is not null and superseded_at is not null)
     or exists (select 1 from assessments where case_id=c.c1 and submitted_at is not null and superseded_at is not null) then
    raise exception 'اختبار 2هـ فشل: مخرَج وارد وُسم بالانقضاء'; end if;

  -- توثيق: تدقيق الإقفال والتقدُّم + إشعار «توثيقاً لا عقوبة» لكل متأخر
  select count(*) into _n from audit_log where action='deadline_close_study_eval' and target='REF-RSL-9911';
  if _n <> 1 then raise exception 'اختبار 2و فشل: لا تدقيق للإقفال'; end if;
  select count(*) into _n from audit_log where action='auto_send_to_decision' and target='REF-RSL-9911';
  if _n < 1 then raise exception 'اختبار 2ز فشل: لا تدقيق للتقدُّم'; end if;
  select count(*) into _n from notifications
   where case_id=c.c1 and type='deadline' and title like 'انقضى الميعاد النظامي%';
  if _n <> (i.n_studiers - 1) + (i.n_evals - 1) then
    raise exception 'اختبار 2ح فشل: إشعارات المتأخرين (% من %)', _n, (i.n_studiers - 1) + (i.n_evals - 1); end if;
  raise notice 'اختبار 2 ✓ الإقفال الزمني: وسم المتأخرين + تقدُّم القضية + التوثيق الكامل';
end $$;

-- ─── 3) سحب الاطّلاع بعد الإقفال + رفض المخرَج المتأخر رفضاً نظيفاً ───
do $$
declare c record; _late uuid; _n int; _ok boolean := false;
begin
  select * into c from t_cases;
  select studier_id into _late from studies
   where case_id = c.c1 and superseded_at is not null limit 1;

  perform pg_temp.impersonate(_late);
  execute 'set local role authenticated';
  select count(*) into _n from my_study_tasks() t where t.case_id = c.c1;
  begin
    perform record_attachment_open(c.c1, 'أي مستند');
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%not assigned%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if _n <> 0 then raise exception 'اختبار 3أ فشل: القضية ما تزال في طابور الموسوم'; end if;
  if not _ok then raise exception 'اختبار 3ب فشل: الموسوم ما يزال يفتح المرفقات'; end if;

  -- المخرَج المتأخر بعد التقدُّم: رفض صريح بحارس الحالة (القضية غادرت الدراسة)
  _ok := false;
  perform pg_temp.impersonate(_late);
  execute 'set local role authenticated';
  begin
    perform submit_study(c.c1, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%ليست في الدراسة%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 3ج فشل: المخرَج المتأخر لم يُرفض بحارس الحالة'; end if;
  if exists (select 1 from studies where case_id=c.c1 and submitted_at is not null and superseded_at is not null) then
    raise exception 'اختبار 3د فشل: صف submitted+superseded معاً'; end if;
  raise notice 'اختبار 3 ✓ سحب الاطّلاع بعد الإقفال + رفض المخرَج المتأخر';
end $$;

-- ─── 4) قبل الميعاد لا مساس: نصاب أدنى وارد والميعاد لم ينقضِ → لا إقفال ───
do $$
declare c record; _st case_status; _n int;
begin
  select * into c from t_cases;
  perform pg_temp.submit_one(c.c2, 'study');
  perform pg_temp.submit_one(c.c2, 'assessment');

  perform study_eval_watchdog();

  select status into _st from protection_cases where id = c.c2;
  if _st <> 'under_study' then
    raise exception 'اختبار 4أ فشل: أُقفلت قبل الميعاد (%) — عاد نصاب الواحد الملغى', _st; end if;
  select count(*) into _n from (
    select 1 from studies where case_id=c.c2 and superseded_at is not null
    union all
    select 1 from assessments where case_id=c.c2 and superseded_at is not null) x;
  if _n <> 0 then raise exception 'اختبار 4ب فشل: وسم قبل انقضاء الميعاد'; end if;
  raise notice 'اختبار 4 ✓ قبل الميعاد لا إقفال — تعدُّد الآراء يُنتظر مهلته كاملة';
end $$;

-- ─── 5) ورود مخرجات الجميع يُقدِّم فوراً دون انتظار الميعاد ───
do $$
declare c record; i record; r record; _st case_status; _done int;
begin
  select * into c from t_cases; select * into i from t_ids;

  for r in select studier_id as uid from studies
            where case_id=c.c2 and submitted_at is null and superseded_at is null loop
    perform pg_temp.impersonate(r.uid); execute 'set local role authenticated';
    perform submit_study(c.c2, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
    execute 'reset role';
  end loop;
  for r in select evaluator_id as uid from assessments
            where case_id=c.c2 and submitted_at is null and superseded_at is null loop
    perform pg_temp.impersonate(r.uid); execute 'set local role authenticated';
    perform submit_assessment(c.c2, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
    execute 'reset role';
  end loop;

  select status into _st from protection_cases where id = c.c2;
  if _st <> 'in_decision' then raise exception 'اختبار 5أ فشل: اكتمال الجميع لم يقدّم (%)', _st; end if;
  -- كل المخرجات محفوظة بلا وسم — تعدّد الآراء بلغ المجلس كاملاً
  select count(*) into _done from (
    select 1 from studies where case_id=c.c2 and submitted_at is not null and superseded_at is null
    union all
    select 1 from assessments where case_id=c.c2 and submitted_at is not null and superseded_at is null) x;
  if _done <> i.n_studiers + i.n_evals then
    raise exception 'اختبار 5ب فشل: لم تُجمَّع كل المخرجات (% من %)', _done, i.n_studiers + i.n_evals; end if;
  raise notice 'اختبار 5 ✓ اكتمال الجميع يُقدِّم فوراً وكل المخرجات تبلغ المجلس';
end $$;

-- ─── 6) ميعاد منقضٍ بلا نصاب: القضية تبقى مفتوحة + إنذار النائب مرة يومياً، وأول نصابٍ يُقفِل ───
do $$
declare c record; i record; _st case_status; _n int; _n2 int; _cl int; _al int;
begin
  select * into c from t_cases; select * into i from t_ids;

  -- لا مخرجات إطلاقاً والميعاد منقضٍ
  update studies set created_at = now() - interval '7 days' where case_id = c.c3;
  update assessments set created_at = now() - interval '7 days' where case_id = c.c3;

  select * into _cl, _al from study_eval_watchdog();
  if _al < 1 then raise exception 'اختبار 6أ فشل: العجز لم يُرصد (alerted=%)', _al; end if;

  select status into _st from protection_cases where id = c.c3;
  if _st <> 'under_study' then raise exception 'اختبار 6ب فشل: تقدّمت بلا نصاب (%)', _st; end if;
  if exists (select 1 from studies where case_id=c.c3 and superseded_at is not null) then
    raise exception 'اختبار 6ج فشل: وُسم مؤلّف والقضية بلا نصاب'; end if;

  select count(*) into _n from notifications
   where case_id = c.c3 and recipient_id = i.deputy and title = 'انقضاء الميعاد النظامي بلا نصاب';
  if _n < 1 then raise exception 'اختبار 6د فشل: لا إنذار للنائب'; end if;
  select count(*) into _n from audit_log where action='study_eval_deadline_no_quorum' and target='REF-RSL-9913';
  if _n < 1 then raise exception 'اختبار 6هـ فشل: لا تدقيق للعجز'; end if;

  -- الإنذار غير مُغرِق: جولة ثانية خلال اليوم لا تكرّره
  select count(*) into _n from notifications
   where case_id = c.c3 and recipient_id = i.deputy and title = 'انقضاء الميعاد النظامي بلا نصاب';
  perform study_eval_watchdog();
  select count(*) into _n2 from notifications
   where case_id = c.c3 and recipient_id = i.deputy and title = 'انقضاء الميعاد النظامي بلا نصاب';
  if _n2 <> _n then raise exception 'اختبار 6و فشل: إنذار العجز يتكرر كل جولة (إغراق)'; end if;

  -- أول نصابٍ بعد الميعاد: الجولة التالية تُقفِل
  perform pg_temp.submit_one(c.c3, 'study');
  perform pg_temp.submit_one(c.c3, 'assessment');
  select status into _st from protection_cases where id = c.c3;
  if _st <> 'under_study' then raise exception 'اختبار 6ز فشل: تقدّمت قبل جولة المُقفِل (%)', _st; end if;
  select * into _cl, _al from study_eval_watchdog();
  select status into _st from protection_cases where id = c.c3;
  if _st <> 'in_decision' then raise exception 'اختبار 6ح فشل: النصاب اللاحق لم يُقفِل (%)', _st; end if;
  raise notice 'اختبار 6 ✓ بلا نصاب: بقاء مفتوحة + إنذار يومي واحد، وأول نصابٍ لاحقٍ يُقفِل';
end $$;

-- ─── 7) الحارس معطّل (app_settings): لا يمسّ شيئاً حين الإعداد off ───
do $$
declare c record; _before int; _after int; _cl int; _al int; _st case_status;
begin
  select * into c from t_cases;
  perform pg_temp.submit_one(c.c4, 'study');
  perform pg_temp.submit_one(c.c4, 'assessment');
  update studies set created_at = now() - interval '7 days' where case_id = c.c4;
  update assessments set created_at = now() - interval '7 days' where case_id = c.c4;

  update app_settings set value = 'off' where key = 'watchdog';
  select count(*) into _before from studies where superseded_at is not null;
  select * into _cl, _al from study_eval_watchdog();
  select count(*) into _after from studies where superseded_at is not null;
  update app_settings set value = 'on' where key = 'watchdog';

  select status into _st from protection_cases where id = c.c4;
  if _cl <> 0 or _al <> 0 or _before <> _after or _st <> 'under_study' then
    raise exception 'اختبار 7 فشل: المُقفِل عمل وهو معطّل'; end if;
  raise notice 'اختبار 7 ✓ المُقفِل معطّل بالإعداد — التفعيل قرار بيئة صريح';
end $$;

-- ─── 8) المهلة قابلة للضبط: study_eval_deadline_days=0 → إقفال أول جولة (رافعة العرض) ───
do $$
declare c record; _st case_status;
begin
  select * into c from t_cases;
  insert into app_settings (key, value) values ('study_eval_deadline_days', '0')
  on conflict (key) do update set value = excluded.value;

  perform pg_temp.submit_one(c.c5, 'study');
  perform pg_temp.submit_one(c.c5, 'assessment');
  perform study_eval_watchdog();

  delete from app_settings where key = 'study_eval_deadline_days';

  select status into _st from protection_cases where id = c.c5;
  if _st <> 'in_decision' then raise exception 'اختبار 8 فشل: مهلة الصفر لم تُقفل فوراً (%)', _st; end if;
  raise notice 'اختبار 8 ✓ المهلة قابلة للضبط — الصفر يُقفل بأول جولة بعد النصاب';
end $$;

-- ─── 9) تحصين TRUNCATE: سجل التدقيق والجداول محصّنة من التفريغ ───
do $$
begin
  if has_table_privilege('authenticated','public.audit_log','TRUNCATE')
     or has_table_privilege('anon','public.audit_log','TRUNCATE')
     or has_table_privilege('authenticated','public.protection_cases','TRUNCATE')
     or has_table_privilege('anon','public.studies','TRUNCATE') then
    raise exception 'اختبار 9 فشل: TRUNCATE ما يزال ممنوحاً';
  end if;
  raise notice 'اختبار 9 ✓ TRUNCATE محجوب عن anon/authenticated (سجل التدقيق محصّن)';
end $$;

-- ─── 10) قفل الكتابة: تعديل studies/assessments مباشرةً ممنوع (RPC فقط) ───
do $$
declare c record; _late uuid; _ok boolean := false;
begin
  select * into c from t_cases;
  select studier_id into _late from studies
   where case_id = c.c1 and superseded_at is not null limit 1;
  perform pg_temp.impersonate(_late);
  execute 'set local role authenticated';
  begin
    update studies set superseded_at = null, submitted_at = now(), recommendation = 'RESURRECTED'
     where case_id = c.c1 and studier_id = _late;
    raise exception 'FORCE';
  exception when insufficient_privilege then _ok := true;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 10 فشل: الكتابة المباشرة نفذت — الوسم قابل للتجاوز'; end if;
  raise notice 'اختبار 10 ✓ قفل الكتابة: لا إحياء ولا تعديل مباشر — الدوالّ المدقَّقة هي الباب الوحيد';
end $$;

rollback;
\echo '✓✓ اختبارات الإقفال الزمني اجتازت كاملة — أُرجعت المعاملة، لا أثر في القاعدة'
