-- ============================================================
--  حالات اختبار الإسناد المرن — الاسترداد الصامت ونظافة النصاب وسحب الاطّلاع
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/study-eval-resilience-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج — قضايا الاختبار تُنشأ داخلها؛ الحارس يُفعَّل
--  محلياً بـ set_config(app.settings.watchdog) داخل المعاملة فقط.
-- ============================================================
\set QUIET on
begin;

select set_config('app.settings.watchdog', 'on', true);

create temp table t_ids as
select
  (select id from auth.users where email = '2000000009@nafath.local') as deputy;

insert into protection_cases (ref_no, secret_code, category, status, source)
values ('REF-RSL-9911','C-RSL-9911','witness','submitted','local'),
       ('REF-RSL-9912','C-RSL-9912','victim','submitted','local'),
       ('REF-RSL-9913','C-RSL-9913','reporter','submitted','local');

create temp table t_cases as
select
  (select id from protection_cases where secret_code='C-RSL-9911') as c1,
  (select id from protection_cases where secret_code='C-RSL-9912') as c2,
  (select id from protection_cases where secret_code='C-RSL-9913') as c3;

update protection_cases set status='under_study'
 where id in (select c1 from t_cases union select c2 from t_cases union select c3 from t_cases);

create or replace function pg_temp.impersonate(_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', _uid, 'role', 'authenticated')::text, true);
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

-- ─── 2) الاسترداد الصامت: المتعثر يُحال ويُشعَر النائب ويبقى الأثر ───
do $$
declare c record; i record; _old uuid; _oldrow uuid; _new uuid; _re int; _ex int; _n int;
begin
  select * into c from t_cases; select * into i from t_ids;
  select id, studier_id into _oldrow, _old from studies where case_id = c.c1 limit 1;

  -- تعثّر: نُرجع تاريخ الإسناد أسبوعاً (يتجاوز يوم العمل قطعاً)
  update studies set created_at = now() - interval '7 days' where id = _oldrow;

  select * into _re, _ex from study_eval_watchdog();
  if _re < 1 then raise exception 'اختبار 2أ فشل: لم يُعد الإسناد (re=%)', _re; end if;

  -- الصف القديم موسوم لا محذوف
  select count(*) into _n from studies where id = _oldrow
    and superseded_at is not null and superseded_reason like '%أُعيد الإسناد%';
  if _n <> 1 then raise exception 'اختبار 2ب فشل: الأثر التدقيقي للصف القديم'; end if;

  -- بديل مختلف أُسند، والنشِط على القضية بقي اثنين
  select studier_id into _new from studies
   where case_id = c.c1 and superseded_at is null and studier_id <> _old
   order by created_at desc limit 1;
  if _new is null or _new = _old then raise exception 'اختبار 2ج فشل: لا بديل مختلف'; end if;
  select count(*) into _n from studies where case_id = c.c1 and superseded_at is null;
  if _n <> 2 then raise exception 'اختبار 2د فشل: النشِط <> 2 (%)', _n; end if;

  -- إشعار النائب + إشعار إسناد للبديل + تدقيق
  select count(*) into _n from notifications
   where case_id = c.c1 and recipient_id = i.deputy and title like 'إعادة إسناد آلية%';
  if _n < 1 then raise exception 'اختبار 2هـ فشل: النائب لم يُشعَر'; end if;
  select count(*) into _n from notifications
   where case_id = c.c1 and recipient_id = _new and type = 'assign';
  if _n < 1 then raise exception 'اختبار 2و فشل: البديل لم يُشعَر'; end if;
  select count(*) into _n from audit_log where action='reassign_study' and target='REF-RSL-9911';
  if _n <> 1 then raise exception 'اختبار 2ز فشل: لا تدقيق لإعادة الإسناد'; end if;
  raise notice 'اختبار 2 ✓ الاسترداد الصامت: إحالة + وسم + إشعارا النائب والبديل + تدقيق';
end $$;

-- ─── 3) سحب الاطّلاع: المُحال عنه يفقد القضية من طابوره وصلاحياته ───
do $$
declare c record; _old uuid; _n int; _ok boolean := false;
begin
  select * into c from t_cases;
  select studier_id into _old from studies
   where case_id = c.c1 and superseded_at is not null limit 1;

  perform pg_temp.impersonate(_old);
  execute 'set local role authenticated';
  select count(*) into _n from my_study_tasks() t where t.case_id = c.c1;
  begin
    perform record_attachment_open(c.c1, 'أي مستند');
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%not assigned%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';

  if _n <> 0 then raise exception 'اختبار 3أ فشل: القضية ما تزال في طابور المُحال عنه'; end if;
  if not _ok then raise exception 'اختبار 3ب فشل: المُحال عنه ما يزال يفتح المرفقات'; end if;
  raise notice 'اختبار 3 ✓ سحب الاطّلاع: الطابور والصلاحيات سُحبا من المُحال عنه فوراً';
end $$;

-- ─── 4) نظافة النصاب: التقدّم للقرار يوسم صفوف الباقين «اكتُفي بالنصاب» ───
do $$
declare c record; _s uuid; _e uuid; _n int; _st case_status;
begin
  select * into c from t_cases;
  select studier_id into _s from studies where case_id = c.c2 and superseded_at is null limit 1;
  select evaluator_id into _e from assessments where case_id = c.c2 and superseded_at is null limit 1;

  perform pg_temp.impersonate(_s);
  execute 'set local role authenticated';
  perform submit_study(c.c2, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
  execute 'reset role';
  perform pg_temp.impersonate(_e);
  execute 'set local role authenticated';
  perform submit_assessment(c.c2, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, null, null, true, true);
  execute 'reset role';

  select status into _st from protection_cases where id = c.c2;
  if _st <> 'in_decision' then raise exception 'اختبار 4أ فشل: النصاب لم يقدّم القضية (%)', _st; end if;

  -- لا صفوف نشطة غير معتمدة بقيت — الباقون وُسموا
  select count(*) into _n from (
    select 1 from studies where case_id=c.c2 and submitted_at is null and superseded_at is null
    union all
    select 1 from assessments where case_id=c.c2 and submitted_at is null and superseded_at is null) x;
  if _n <> 0 then raise exception 'اختبار 4ب فشل: بقيت صفوف معلّقة (%)', _n; end if;
  select count(*) into _n from (
    select 1 from studies where case_id=c.c2 and superseded_reason like '%اكتُفي بالنصاب%'
    union all
    select 1 from assessments where case_id=c.c2 and superseded_reason like '%اكتُفي بالنصاب%') x;
  if _n < 1 then raise exception 'اختبار 4ج فشل: لا وسم نصاب'; end if;

  -- المعتمدان بقيا سليمين للحزمة
  select count(*) into _n from (
    select 1 from studies where case_id=c.c2 and submitted_at is not null and superseded_at is null
    union all
    select 1 from assessments where case_id=c.c2 and submitted_at is not null and superseded_at is null) x;
  if _n <> 2 then raise exception 'اختبار 4د فشل: مخرجا النصاب تأثرا'; end if;
  raise notice 'اختبار 4 ✓ نظافة النصاب: القضية تقدّمت والباقون وُسموا والطوابير نظيفة';
end $$;

-- ─── 5) عجز الطاقم: لا بديل متاحاً → إنذار للنائب لا توقّف صامت ───
do $$
declare c record; i record; r record; _n int; _re int; _ex int;
begin
  select * into c from t_cases; select * into i from t_ids;

  -- نشغل كل الدارسين بصفٍّ على c3 كي لا يبقى بديل
  for r in select ur.user_id from user_roles ur where ur.role='studier' loop
    insert into studies (case_id, studier_id) values (c.c3, r.user_id)
    on conflict (case_id, studier_id) do nothing;
  end loop;
  -- ونُعثّر واحداً منها
  update studies set created_at = now() - interval '7 days'
   where id = (select id from studies where case_id=c.c3 and superseded_at is null limit 1);

  select * into _re, _ex from study_eval_watchdog();
  if _ex < 1 then raise exception 'اختبار 5أ فشل: العجز لم يُرصد (ex=%)', _ex; end if;
  select count(*) into _n from notifications
   where case_id = c.c3 and recipient_id = i.deputy and title = 'عجز طاقم الدراسة';
  if _n < 1 then raise exception 'اختبار 5ب فشل: لا إنذار عجز للنائب'; end if;
  select count(*) into _n from audit_log where action='study_pool_exhausted' and target='REF-RSL-9913';
  if _n < 1 then raise exception 'اختبار 5ج فشل: لا تدقيق للعجز'; end if;
  raise notice 'اختبار 5 ✓ عجز الطاقم: إنذار صريح للقيادة بدل التوقف الصامت';
end $$;

-- ─── 6) الحارس معطّل افتراضياً: لا يمسّ شيئاً حين الإعداد off ───
do $$
declare c record; _before int; _after int; _re int; _ex int;
begin
  select * into c from t_cases;
  perform set_config('app.settings.watchdog', 'off', true);
  update studies set created_at = now() - interval '7 days'
   where case_id = c.c1 and superseded_at is null;
  select count(*) into _before from studies where superseded_at is not null;
  select * into _re, _ex from study_eval_watchdog();
  select count(*) into _after from studies where superseded_at is not null;
  perform set_config('app.settings.watchdog', 'on', true);
  if _re <> 0 or _ex <> 0 or _before <> _after then
    raise exception 'اختبار 6 فشل: الحارس عمل وهو معطّل'; end if;
  raise notice 'اختبار 6 ✓ الحارس معطّل افتراضياً — التفعيل قرار بيئة صريح';
end $$;

rollback;
\echo '✓✓ اختبارات الإسناد المرن اجتازت كاملة — أُرجعت المعاملة، لا أثر في القاعدة'
