-- ============================================================
--  سلسلة اعتماد توصية الجهة المختصة — اختبارات تحت RLS بأدوارٍ حقيقية
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/approval-chain-tests.sql
--  الأسلوب: معاملة واحدة تُدحرج (لا أثر) + انتحال بـset_config(request.jwt.claims)
--  + `set local role authenticated` كي تسري RLS ومنحُ الجداول فعليّاً.
--  التغطية: الرفع للاعتماد لا يصل المركز · حجب الاعتماد عن الموظف والمقر ·
--  عزل الفرع · الإعادة بملاحظة وإعادة الرفع · الاعتماد يرفع للمركز بأثر تدقيق ·
--  إقفال تجاوز القناة الإلكترونية · إقفال الكتابة المباشرة على الجدول ·
--  مهلة الدرجة لا تتجاوز مظلّة م7 · قائمة الاعتماد تُظهر المُعِدّ الحقيقي.
-- ============================================================
begin;

create temp table ids as select
  (select id from auth.users where email='2000000002@nafath.local') as officer,
  (select id from auth.users where email='1000000001@nafath.local') as seeker,
  (select id from auth.users where email='3000000001@nafath.local') as clerk,
  (select id from auth.users where email='3000000006@nafath.local') as head,
  (select id from auth.users where email='2000000003@nafath.local') as studier;

do $$ begin
  if exists (select 1 from ids where officer is null or seeker is null or clerk is null
             or head is null or studier is null) then
    raise exception 'FIXTURE: هويات البذور ناقصة — شغّل seed.sql (يشمل 3000000006 رئيس الفرع)';
  end if;
  if (select attributes->>'level' from user_roles ur, ids
       where ur.user_id = ids.clerk and ur.role='competent_body') is distinct from 'clerk' then
    raise exception 'FIXTURE: 3000000001 ليس clerk';
  end if;
  if (select attributes->>'level' from user_roles ur, ids
       where ur.user_id = ids.head and ur.role='competent_body') is distinct from 'head' then
    raise exception 'FIXTURE: 3000000006 ليس head';
  end if;
end $$;
grant select on ids to authenticated;

create or replace function pg_temp.act(_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub',_uid,'role','authenticated')::text, true); end $$;

-- ─── تجهيز: قضيتان محالتان لفرع الرياض (النيابة) + قضية لفرعٍ آخر ───
create temp table br as select
  (select id from branches where entity='prosecution' and region='RUH' limit 1) as ruh,
  (select id from branches where entity='prosecution' and region='MAK' limit 1) as mak;

insert into protection_cases (ref_no, secret_code, category, status, classification, source, submitted_by, branch_id)
values ('REF-2026-9601','AC-2026-9601','witness','referred','medium','local',(select seeker from ids),(select ruh from br)),
       ('REF-2026-9602','AC-2026-9602','witness','referred','medium','local',(select seeker from ids),(select ruh from br)),
       ('REF-2026-9603','AC-2026-9603','witness','referred','medium','local',(select seeker from ids),(select mak from br));

insert into recommendations (case_id, source_body, raised_at, due_at, branch_id)
select c.id, 'النيابة العامة', now(), now() + interval '5 days',
       case when c.secret_code='AC-2026-9603' then (select mak from br) else (select ruh from br) end
  from protection_cases c where c.secret_code in ('AC-2026-9601','AC-2026-9602','AC-2026-9603');

create temp table cs as select
  (select id from protection_cases where secret_code='AC-2026-9601') as a,
  (select id from protection_cases where secret_code='AC-2026-9602') as b,
  (select id from protection_cases where secret_code='AC-2026-9603') as other;
grant select on cs, br to authenticated;

-- ═══ AC-01 السلسلة مفعّلة: درجةٌ أولى لكل جهة ═══
do $$ begin
  if (select count(*) from approval_chains where step_no=1 and approver='branch_head' and active) < 5 then
    raise exception 'AC-01 FAILED: سلسلة الاعتماد غير مبذورة لكل الجهات';
  end if;
  raise notice 'AC-01 PASS — الدرجة الأولى (رئيس الفرع) مفعّلة لكل جهةٍ مختصة';
end $$;

-- ═══ AC-02 الرفع للاعتماد: مسوّدةٌ محفوظة، والمركز لم يصله شيء ═══
select pg_temp.act((select clerk from ids));
set local role authenticated;
do $$ declare _rid uuid; _due timestamptz; _cdue timestamptz; begin
  select recommendation_id, step_due_at into _rid, _due
    from public.submit_recommendation_for_approval(
      (select a from cs), 'توفير',
      '{"risk_level":"مرتفع","extends_others":"نعم"}'::jsonb,
      '["الحماية الشخصية والمرافقة الأمنية"]'::jsonb,
      interval '180 days', 'تهديد جدّي مرتبط بصفته في قضية قائمة');
  if _rid is null then raise exception 'AC-02 FAILED: لم تُعَد التوصية'; end if;
  if (select status from protection_cases where id=(select a from cs)) <> 'referred' then
    raise exception 'AC-02 FAILED: الحالة غادرت referred قبل الاعتماد';
  end if;
  if exists (select 1 from recommendations where id=_rid and received_at is not null) then
    raise exception 'AC-02 FAILED: received_at ضُبط بلا اعتماد — التوصية وصلت المركز';
  end if;
  if (select approval_status from recommendations where id=_rid) <> 'pending_head' then
    raise exception 'AC-02 FAILED: approval_status لم يصر pending_head';
  end if;
  if not exists (select 1 from recommendation_approvals
                  where recommendation_id=_rid and step_no=1 and approver='branch_head' and decided_at is null) then
    raise exception 'AC-02 FAILED: لم تُفتح درجة اعتمادٍ معلّقة';
  end if;
  -- مهلة الدرجة لا تتجاوز مظلّة م7 (due_at التوصية)
  select due_at into _cdue from recommendations where id=_rid;
  if _due is null or _due > _cdue then
    raise exception 'AC-02 FAILED: مهلة الدرجة (%) تتجاوز مظلّة الخمسة أيام (%)', _due, _cdue;
  end if;
  raise notice 'AC-02 PASS — الرفع للاعتماد: pending_head + درجةٌ معلّقة بميعادٍ داخل م7، ولا وصول للمركز';
end $$;

-- ═══ AC-03 الموظف لا يعتمد عمل نفسه ═══
do $$ declare _rid uuid; begin
  select id into _rid from recommendations where case_id=(select a from cs);
  begin
    perform public.decide_recommendation_approval(_rid, 'approved', null);
    raise exception 'AC-03 FAILED: اعتمد الموظفُ التوصيةَ';
  exception when others then
    if sqlerrm like '%صلاحية رئيس الفرع%' then
      raise notice 'AC-03 PASS — الاعتماد محجوبٌ عن الموظف («%»)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ═══ AC-04 الكتابة المباشرة على الجدول مقفلة (لا قفز فوق السلسلة) ═══
do $$ declare _rid uuid; begin
  select id into _rid from recommendations where case_id=(select a from cs);
  begin
    update recommendations set approval_status='approved', received_at=now() where id=_rid;
    raise exception 'AC-04 FAILED: نجح تعديلٌ مباشرٌ من حساب الموظف';
  exception when insufficient_privilege then
    raise notice 'AC-04 PASS — منحة UPDATE مسحوبة: لا قفز فوق السلسلة بـPATCH مباشر';
  end;
end $$;

-- ═══ AC-05 قائمة الاعتماد تُظهر المُعِدّ الحقيقي والمسوّدة كاملة ═══
do $$ declare _r record; begin
  select * into _r from public.branch_approval_queue() q where q.case_id=(select a from cs);
  if _r is null then raise exception 'AC-05 FAILED: التوصية لا تظهر في قائمة السلسلة'; end if;
  if _r.prepared_by_name is null or _r.prepared_by_name = 'موظف الفرع' then
    raise exception 'AC-05 FAILED: اسم المُعِدّ غير محلول (%)', _r.prepared_by_name;
  end if;
  if _r.decision <> 'توفير' or _r.factors9->>'risk_level' <> 'مرتفع' then
    raise exception 'AC-05 FAILED: مسوّدة التوصية لا تصل شاشة المراجعة';
  end if;
  if _r.secret_code <> 'AC-2026-9601' then raise exception 'AC-05 FAILED: الرمز السري مفقود'; end if;
  raise notice 'AC-05 PASS — شاشة المراجعة تقرأ المُعِدّ (%) والقرار والعوامل من القاعدة', _r.prepared_by_name;
end $$;
reset role;

-- ═══ AC-06 الإعادة بملاحظة: الملاحظة إلزامية، والحالة تعود returned ═══
select pg_temp.act((select head from ids));
set local role authenticated;
do $$ declare _rid uuid; _as text; begin
  select id into _rid from recommendations where case_id=(select a from cs);
  begin
    perform public.decide_recommendation_approval(_rid, 'returned', '   ');
    raise exception 'AC-06 FAILED: قُبلت إعادةٌ بلا ملاحظة';
  exception when others then
    if sqlerrm not like '%الملاحظة إلزامية%' then raise; end if;
  end;
  select new_approval_status into _as
    from public.decide_recommendation_approval(_rid, 'returned', 'يلزم توضيح امتداد الخطر للغير');
  if _as <> 'returned' then raise exception 'AC-06 FAILED: الحالة % لا returned', _as; end if;
  if exists (select 1 from recommendations where id=_rid and received_at is not null) then
    raise exception 'AC-06 FAILED: الإعادة رفعت التوصية للمركز';
  end if;
  if not exists (select 1 from recommendation_approvals
                  where recommendation_id=_rid and decision='returned' and note is not null and decided_at is not null) then
    raise exception 'AC-06 FAILED: أثر الإعادة لم يُقيَّد';
  end if;
  raise notice 'AC-06 PASS — الإعادة: ملاحظةٌ إلزامية + returned + أثرٌ مقيَّد، ولا وصول للمركز';
end $$;
reset role;

-- ═══ AC-07 المُعادة تعود للموظف بملاحظتها ثم تُرفع ثانيةً ═══
select pg_temp.act((select clerk from ids));
set local role authenticated;
do $$ declare _r record; begin
  select * into _r from public.branch_approval_queue() q where q.case_id=(select a from cs);
  if _r.approval_status <> 'returned' or _r.last_note is null then
    raise exception 'AC-07 FAILED: الموظف لا يرى الإعادة ولا ملاحظتها';
  end if;
  perform public.submit_recommendation_for_approval(
    (select a from cs), 'توفير', '{"risk_level":"مرتفع","extends_who":"أسرته المقيمون معه"}'::jsonb,
    '["الحماية الشخصية والمرافقة الأمنية"]'::jsonb, interval '180 days', 'استُكمل امتداد الخطر');
  if (select approval_status from recommendations where case_id=(select a from cs)) <> 'pending_head' then
    raise exception 'AC-07 FAILED: إعادة الرفع لم تُعِد الحالة pending_head';
  end if;
  if (select count(*) from recommendation_approvals ra
        join recommendations r on r.id=ra.recommendation_id
       where r.case_id=(select a from cs)) < 2 then
    raise exception 'AC-07 FAILED: جولة الاعتماد الثانية لم تُقيَّد كدرجةٍ مستقلة';
  end if;
  raise notice 'AC-07 PASS — الإعادة تصل الموظف بملاحظتها، وإعادة الرفع تفتح جولةً مقيَّدة';
end $$;

-- ═══ AC-08 لا رفعَ مزدوج ═══
do $$ begin
  begin
    perform public.submit_recommendation_for_approval((select a from cs), 'توفير');
    raise exception 'AC-08 FAILED: قُبل رفعٌ ثانٍ فوق رفعٍ معلّق';
  exception when others then
    if sqlerrm like '%بالفعل%' then raise notice 'AC-08 PASS — لا رفعَ مزدوج («%»)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ═══ AC-09 إقفال تجاوز القناة الإلكترونية في record_recommendation ═══
do $$ begin
  begin
    perform public.record_recommendation((select b from cs), 'توفير', 'electronic');
    raise exception 'AC-09 FAILED: القناة الإلكترونية ما زالت تصل المركز مباشرةً';
  exception when others then
    if sqlerrm like '%سلسلة اعتماد%' then
      raise notice 'AC-09 PASS — التجاوز مقفل: القناة الإلكترونية تُحال على السلسلة';
    else raise; end if;
  end;
end $$;
reset role;

-- ═══ AC-10 عزل الفرع: رئيس الرياض لا يعتمد توصية مكة ═══
select pg_temp.act((select head from ids));
set local role authenticated;
do $$ declare _rid uuid; begin
  select id into _rid from recommendations where case_id=(select other from cs);
  begin
    perform public.decide_recommendation_approval(_rid, 'approved', null);
    raise exception 'AC-10 FAILED: اعتُمدت توصية فرعٍ آخر';
  exception when others then
    if sqlerrm like '%لا توصيةَ بهذا المعرّف في فرعك%' then
      raise notice 'AC-10 PASS — عزل الفرع: لا اعتماد خارج فرع الرئيس';
    else raise; end if;
  end;
end $$;

-- ═══ AC-11 الاعتماد يرفع للمركز: ورودٌ + عودةٌ للفرز + إشعار + تدقيق ═══
do $$ declare _rid uuid; _as text; _st case_status; begin
  select id into _rid from recommendations where case_id=(select a from cs);
  select new_approval_status, new_case_status into _as, _st
    from public.decide_recommendation_approval(_rid, 'approved', 'مطابقة للسند النظامي (م9)');
  if _as <> 'approved' then raise exception 'AC-11 FAILED: حالة الاعتماد % لا approved', _as; end if;
  if _st <> 'triage' then raise exception 'AC-11 FAILED: الحالة % لا triage', _st; end if;
  if not exists (select 1 from recommendations
                  where id=_rid and received_at is not null and channel='electronic'
                    and recorded_by=(select head from ids)) then
    raise exception 'AC-11 FAILED: الورود لم يُقيَّد باسم المعتمِد';
  end if;
  raise notice 'AC-11 PASS — الاعتماد: ورودٌ إلكترونيّ باسم الرئيس + عودة الملف للفرز';
end $$;
reset role;

-- التدقيق والإشعار يُقرآن بامتياز الفحص (محجوبان عن حساب الجهة بحكم RLS)
do $$ begin
  if not exists (select 1 from audit_log
                  where action='recommendation_approved_and_raised' and target='REF-2026-9601') then
    raise exception 'AC-11ب FAILED: لا قيدَ تدقيقٍ للاعتماد';
  end if;
  if not exists (select 1 from audit_log
                  where action='recommendation_submitted_for_approval' and target='REF-2026-9601') then
    raise exception 'AC-11ب FAILED: لا قيدَ تدقيقٍ للرفع';
  end if;
  if not exists (select 1 from notifications
                  where case_id=(select a from cs) and type='rec_received') then
    raise exception 'AC-11ب FAILED: المستفيد لم يُشعَر بورود التوصية';
  end if;
  if exists (select 1 from notifications n
              where n.case_id=(select a from cs) and n.type='rec_received'
                and (n.body like '%توفير%' or n.body like '%مرتفع%')) then
    raise exception 'AC-11ب FAILED: الإشعار كشف مضمون التوصية';
  end if;
  raise notice 'AC-11ب PASS — أثر التدقيق للرفع والاعتماد + إشعارٌ محايدٌ للمستفيد';
end $$;

-- ═══ AC-12 المُعتمَدة تغادر طابور السلسلة ولا تُعتمد مرتين ═══
select pg_temp.act((select head from ids));
set local role authenticated;
do $$ declare _rid uuid; begin
  select id into _rid from recommendations where case_id=(select a from cs);
  if exists (select 1 from public.branch_approval_queue() q where q.recommendation_id=_rid) then
    raise exception 'AC-12 FAILED: المُعتمَدة بقيت في طابور «بانتظار اعتمادي»';
  end if;
  begin
    perform public.decide_recommendation_approval(_rid, 'returned', 'تراجع');
    raise exception 'AC-12 FAILED: قُبل بتٌّ ثانٍ بعد الاعتماد';
  exception when others then
    if sqlerrm like '%ليست بانتظار اعتمادك%' then
      raise notice 'AC-12 PASS — المُعتمَدة تغادر الطابور ولا تُبتّ مرتين';
    else raise; end if;
  end;
end $$;
reset role;

-- ═══ AC-13 القناة الورقية لم تتأثر (الخطاب يصل موقّعاً من الجهة) ═══
select pg_temp.act((select officer from ids));
set local role authenticated;
do $$ declare _st case_status; begin
  select status into _st from public.record_recommendation(
    (select b from cs), 'عدم توفير', 'paper', '{}'::jsonb, '[]'::jsonb, null, 'خطابٌ ورقيٌّ واردٌ — اختبار');
  if _st <> 'under_study' then raise exception 'AC-13 FAILED: الورقية % لا under_study', _st; end if;
  raise notice 'AC-13 PASS — القناة الورقية على حالها: الخطاب الوارد يحيل للدراسة والتقييم';
end $$;
reset role;

do $$ begin raise notice '════ سلسلة الاعتماد: كل الحالات نجحت ════'; end $$;
rollback;
