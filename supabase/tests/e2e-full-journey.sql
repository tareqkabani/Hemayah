-- ============================================================
-- رحلة قانونية كاملة E2E — من التقديم حتى الحماية الفعّالة
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/e2e-full-journey.sql
-- بأدوار حقيقية (انتحال بـrequest.jwt.claims) وعبر الـRPCs الفعلية،
-- مع التحقق أن إشعار كل مرحلة صادرٌ من قالبه في notification_templates.
-- كله داخل معاملة تُرجَع — لا أثر. ينجح بسطر NOTICE ختامي.
-- ============================================================
begin;

-- هويات تجريبية حقيقية (البذور)
create temp table jr as select
  (select id from auth.users where email='1000000001@nafath.local') as subject,
  (select id from auth.users where email='2000000002@nafath.local') as officer,
  (select id from auth.users where email='3000000001@nafath.local') as clerk,
  (select id from auth.users where email='3000000006@nafath.local') as branch_head,
  (select id from auth.users where email='2000000003@nafath.local') as studier,
  (select id from auth.users where email='2000000004@nafath.local') as evaluator,
  (select id from auth.users where email='2000000005@nafath.local') as preparer,
  (select id from auth.users where email='2000000009@nafath.local') as deputy,
  (select id from auth.users where email='2000000008@nafath.local') as chair;

do $$ begin
  if exists (select 1 from jr where subject is null or officer is null or clerk is null
    or branch_head is null
    or studier is null or evaluator is null or preparer is null or deputy is null or chair is null) then
    raise exception 'هويات البذور ناقصة — شغّل seed.sql أولاً';
  end if;
end $$;

create or replace function pg_temp.act(_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub',_uid,'role','authenticated')::text, true); end $$;

-- مقاعد المجلس السبعة الحقيقية للتصويت
create temp table seats as
  select user_id from user_roles where role in ('board_member','deputy_chair','board_chair');

create temp table jc (case_id uuid, ref text, sec text);

-- تحييد طلبات المستفيد التجريبي القائمة (داخل المعاملة المُرجَعة فقط) —
-- حارس «طلب واحد نشط» يمنع التقديم وإلا. لا أثر بعد rollback.
update protection_cases set status='closed'
 where submitted_by=(select subject from jr) and status not in ('closed','rejected');

-- ═══════════ 1) التقديم الإلكتروني (طالب الحماية) ═══════════
do $$ declare j jr; r record; begin
  select * into j from jr;
  perform pg_temp.act(j.subject); set local role authenticated;
  select * into r from submit_protection_request(
    'أصيل (عن شخصه)', 'witness', 'النيابة العامة',
    'واقعة اختبار الرحلة الكاملة', 'مسوّغات الخطر الجدّي', true, 'CASE-E2E-1', '{}'::jsonb);
  reset role;
  insert into jc values (r.case_id, r.ref_no, r.secret_code);

  if (select status from protection_cases where id=r.case_id) <> 'triage' then
    raise exception 'ف1: الحالة ليست triage'; end if;
  -- إشعار الاستلام من قالب n_received (يحمل الرمز السري)
  if not exists (select 1 from notifications n
    where n.case_id=r.case_id and n.type='submission' and n.body like '%'||r.secret_code||'%') then
    raise exception 'ف1: إشعار الاستلام لم يُرندَر من القالب'; end if;
  if not exists (select 1 from audit_log where action='notify_n_received' and target=r.case_id::text) then
    raise exception 'ف1: لا أثر تدقيق للإشعار'; end if;
  raise notice '✓ 1) التقديم: % (%) · n_received بالرمز السري', r.ref_no, r.secret_code;
end $$;

-- ═══════════ 2) محضر اتصال + الإحالة للجهة (موظف الفرز) ═══════════
do $$ declare j jr; c jc; _st case_status; begin
  select * into j from jr; select * into c from jc;
  perform pg_temp.act(j.officer); set local role authenticated;
  insert into contact_logs (case_id, officer_id, channel, result, summary)
  values (c.case_id, j.officer, 'phone', 'answered', 'تم التواصل والتحقق من الطلب');
  select status into _st from triage_decide(c.case_id, 'refer', null,
    '{"identity":true,"jurisdiction":true}'::jsonb, 'النيابة العامة', 'النيابة العامة', 'RUH');
  reset role;
  if _st <> 'referred' then raise exception 'ف2: الحالة % لا referred', _st; end if;
  if not exists (select 1 from recommendations where case_id=c.case_id and received_at is null and branch_id is not null) then
    raise exception 'ف2: لم تُنشأ توصية مستحقّة مربوطة بوحدة'; end if;
  -- إشعار الجهة من قالب n_ent_req + إشعار المتقدّم n_referred
  if not exists (select 1 from audit_log where action='notify_n_ent_req' and target=c.case_id::text) then
    raise exception 'ف2: لم يُشعَر ضابط الجهة بالقالب'; end if;
  if not exists (select 1 from audit_log where action='notify_n_referred' and target=c.case_id::text) then
    raise exception 'ف2: لم يُشعَر المتقدّم بالإحالة'; end if;
  raise notice '✓ 2) الإحالة: referred + توصية مستحقّة بوحدة + n_ent_req/n_referred';
end $$;

-- ═══════════ 3) توصية الجهة عبر سلسلة الاعتماد (موظف الفرع ← رئيسه) ═══════════
-- القناة الإلكترونية تمرّ بالدرجة الأولى إلزاماً: الموظف يُعِدّ ويرفع للاعتماد
-- (لا تصل المركز)، ورئيس الفرع يعتمد فترد التوصية ويعود الملف للفرز.
do $$ declare j jr; c jc; _rid uuid; _st case_status; _as text; begin
  select * into j from jr; select * into c from jc;

  perform pg_temp.act(j.clerk); set local role authenticated;
  select recommendation_id into _rid from submit_recommendation_for_approval(
    c.case_id, 'توفير', '{"risk":"مرتفع"}'::jsonb, '["الحماية الأمنية"]'::jsonb, null, 'توصية بالتوفير');
  reset role;
  if (select status from protection_cases where id=c.case_id) <> 'referred' then
    raise exception 'ف3: الرفع للاعتماد نقل الحالة قبل اعتماد الرئيس'; end if;
  if exists (select 1 from recommendations where id=_rid and received_at is not null) then
    raise exception 'ف3: التوصية وصلت المركز بلا اعتماد'; end if;
  -- (منقولة من #104) أثر الإعداد وصفّ الاعتماد المفتوح بميعاده
  if not exists (select 1 from recommendations
      where id=_rid and prepared_by=j.clerk and prepared_at is not null) then
    raise exception 'ف3: أثر الإعداد (prepared_by/at) لم يُسجَّل'; end if;
  if not exists (select 1 from recommendation_approvals
      where recommendation_id=_rid and approver='branch_head'
        and decided_at is null and due_at is not null) then
    raise exception 'ف3: لا صفّ اعتمادٍ مفتوحٌ بميعادٍ لرئيس الفرع'; end if;

  perform pg_temp.act(j.branch_head); set local role authenticated;
  select new_approval_status, new_case_status into _as, _st
    from decide_recommendation_approval(_rid, 'approved', 'مطابقة للسند النظامي');
  reset role;
  if _as <> 'approved' then raise exception 'ف3: حالة الاعتماد % لا approved', _as; end if;
  if _st <> 'triage' then raise exception 'ف3: الحالة % لا triage بعد الاعتماد', _st; end if;
  if not exists (select 1 from recommendations where case_id=c.case_id and received_at is not null and decision='توفير') then
    raise exception 'ف3: التوصية لم تُستلَم'; end if;
  if not exists (select 1 from recommendation_approvals
      where recommendation_id=_rid and decision='approved' and approver_id=j.branch_head and decided_at is not null) then
    raise exception 'ف3: أثر الاعتماد لم يُقيَّد في recommendation_approvals'; end if;
  if not exists (select 1 from audit_log
      where action='recommendation_approved_and_raised' and target=c.ref) then
    raise exception 'ف3: اعتماد الرئيس ورفعه لم يُقيَّد في التدقيق'; end if;

  -- (ج) المسار المباشر مقفولٌ على القناة الإلكترونية — الحارس هو ركن السلسلة
  begin
    perform pg_temp.act(j.clerk); set local role authenticated;
    perform record_recommendation(c.case_id, 'توفير', 'electronic', '{}'::jsonb,
                                  '[]'::jsonb, null, 'تجاوز السلسلة',
                                  null, null, null, null, null);
    reset role;
    raise exception 'ف3-ج: record_recommendation الإلكترونية مرّت رغم سلسلة الاعتماد';
  exception when others then
    reset role;
    if sqlerrm like 'ف3-ج%' then raise; end if;
    if sqlerrm not like '%سلسلة اعتماد رئيس الفرع%' then
      raise exception 'ف3-ج: رُفضت برسالةٍ غير رسالة السلسلة: %', sqlerrm; end if;
  end;
  raise notice '✓ 3) التوصية: أعدّها الموظف ← اعتمدها رئيس الفرع ← مُستلَمة (توفير) والحالة عادت triage';
end $$;

-- ═══════════ 4) القبول للدراسة (موظف الفرز) → إسناد آلي ═══════════
do $$ declare j jr; c jc; _st case_status; _n int; begin
  select * into j from jr; select * into c from jc;
  perform pg_temp.act(j.officer); set local role authenticated;
  select status into _st from triage_decide(c.case_id, 'study', null,
    '{"identity":true,"jurisdiction":true}'::jsonb, 'النيابة العامة', 'النيابة العامة', 'RUH');
  reset role;
  if _st <> 'under_study' then raise exception 'ف4: الحالة % لا under_study', _st; end if;
  select count(*) into _n from studies where case_id=c.case_id and superseded_at is null;
  if _n < 1 then raise exception 'ف4: لم يُسنَد دارس آلياً'; end if;
  select count(*) into _n from assessments where case_id=c.case_id and superseded_at is null;
  if _n < 1 then raise exception 'ف4: لم يُسنَد مقيّم آلياً'; end if;
  if not exists (select 1 from audit_log where action='notify_n_triage_accept' and target=c.case_id::text) then
    raise exception 'ف4: لم يُشعَر المتقدّم بالقبول من القالب'; end if;
  raise notice '✓ 4) القبول: under_study + إسناد دارسين ومقيّمين آلياً + n_triage_accept';
end $$;

-- ═══════════ 5) تسليم كل الدراسات والتقييمات → النصاب الكامل ═══════════
do $$ declare j jr; c jc; r record; _st case_status; begin
  select * into j from jr; select * into c from jc;
  for r in select studier_id as uid from studies where case_id=c.case_id and superseded_at is null loop
    perform pg_temp.act(r.uid); set local role authenticated;
    perform submit_study(c.case_id, 'قبول كلي', null, '["الحماية الأمنية","إخفاء البيانات الشخصية وما يدل على الهوية"]'::jsonb, null, 'دراسة تؤيّد الحماية', null, true, true);
    reset role;
  end loop;
  for r in select evaluator_id as uid from assessments where case_id=c.case_id and superseded_at is null loop
    perform pg_temp.act(r.uid); set local role authenticated;
    perform submit_assessment(c.case_id, 'قبول كلي', null, '["الحماية الأمنية"]'::jsonb, null, 'تقييم يؤيّد', null, true, true);
    reset role;
  end loop;
  select status into _st from protection_cases where id=c.case_id;
  if _st <> 'in_decision' then raise exception 'ف5: النصاب الكامل لم يقدّم للقرار (%)', _st; end if;
  if not exists (select 1 from council_decisions where case_id=c.case_id and status='preparing') then
    raise exception 'ف5: لم يُنشأ صفّ قرار المجلس'; end if;
  raise notice '✓ 5) الدراسة والتقييم: كل المخرجات سُلّمت → in_decision + قرار قيد الإعداد';
end $$;

-- ═══════════ 6) دورة القرار: إعداد → نائب → رئيس → طرح ═══════════
do $$ declare j jr; c jc; _st text; begin
  select * into j from jr; select * into c from jc;
  perform pg_temp.act(j.preparer); set local role authenticated;
  perform council_save(c.case_id, '["الحماية الأمنية","إخفاء البيانات الشخصية وما يدل على الهوية"]'::jsonb, 'ثلاثون يوماً', 'حيثيات مؤيِّدة للحماية بناءً على الدراسات والتقييمات.');
  select status into _st from council_submit(c.case_id, '["الحماية الأمنية"]'::jsonb, 'ثلاثون يوماً', 'حيثيات القرار المعدّ.', 'قبول كلي', null);
  reset role;
  if _st <> 'pending_deputy' then raise exception 'ف6: بعد الرفع % لا pending_deputy', _st; end if;

  perform pg_temp.act(j.deputy); set local role authenticated;
  select status into _st from council_approve(c.case_id);
  reset role;
  if _st <> 'pending_chair' then raise exception 'ف6: بعد اعتماد النائب % لا pending_chair', _st; end if;

  perform pg_temp.act(j.chair); set local role authenticated;
  select status into _st from council_approve_chair(c.case_id);
  reset role;
  if _st <> 'approved' then raise exception 'ف6: بعد اعتماد الرئيس % لا approved', _st; end if;

  perform pg_temp.act(j.preparer); set local role authenticated;
  select status into _st from council_open_voting(c.case_id);
  reset role;
  if _st <> 'voting' then raise exception 'ف6: بعد الطرح % لا voting', _st; end if;
  -- إشعار المقاعد بالطرح من قالب n_voting
  if not exists (select 1 from audit_log where action='notify_n_voting' and target=c.case_id::text) then
    raise exception 'ف6: لم تُشعَر المقاعد بالطرح من القالب'; end if;
  raise notice '✓ 6) القرار: إعداد→نائب→رئيس→طرح (voting) + n_voting للمقاعد السبعة';
end $$;

-- ═══════════ 7) التصويت بالأغلبية (4/7) ثم الإصدار (الرئيس) ═══════════
do $$ declare j jr; c jc; s record; _n int := 0; _out text; begin
  select * into j from jr; select * into c from jc;
  for s in select user_id from seats loop
    exit when _n >= 4;              -- أربعة أصوات قبول تُغلق النصاب
    perform pg_temp.act(s.user_id); set local role authenticated;
    perform council_vote(c.case_id, 'accept', null);
    reset role;
    _n := _n + 1;
  end loop;

  perform pg_temp.act(j.chair); set local role authenticated;
  select outcome into _out from council_issue(c.case_id, null);
  reset role;
  if _out <> 'accept' then raise exception 'ف7: نتيجة الإصدار % لا accept', _out; end if;
  if (select status from protection_cases where id=c.case_id) <> 'accepted' then
    raise exception 'ف7: الحالة ليست accepted'; end if;
  -- إشعار القبول + دعوة التوقيع + إشعار الجهة الموصية — كلها قوالب
  if not exists (select 1 from audit_log where action='notify_n_dec_accept' and target=c.case_id::text) then
    raise exception 'ف7: لا إشعار قبول من القالب'; end if;
  if not exists (select 1 from audit_log where action='notify_n_agreement' and target=c.case_id::text) then
    raise exception 'ف7: لا دعوة توقيع من القالب'; end if;
  if not exists (select 1 from audit_log where action='notify_n_dec_entity' and target=c.case_id::text) then
    raise exception 'ف7: لم تُشعَر الجهة الموصية بالقرار'; end if;
  raise notice '✓ 7) التصويت والإصدار: 4/7 قبول → accepted + n_dec_accept/n_agreement/n_dec_entity';
end $$;

-- ═══════════ 8) توقيع الاتفاقية (طالب الحماية) → الحماية فعّالة ═══════════
do $$ declare j jr; c jc; _st case_status; begin
  select * into j from jr; select * into c from jc;
  perform pg_temp.act(j.subject); set local role authenticated;
  select status into _st from seeker_sign_agreement(c.case_id);
  reset role;
  if _st <> 'active' then raise exception 'ف8: بعد التوقيع % لا active', _st; end if;
  if not exists (select 1 from protection_documents where case_id=c.case_id and signed_at is not null) then
    raise exception 'ف8: لا وثيقة موقّعة'; end if;
  if not exists (select 1 from audit_log where action='notify_n_signed' and target=c.case_id::text) then
    raise exception 'ف8: لا إشعار توقيع من القالب'; end if;
  raise notice '✓ 8) التوقيع: active + وثيقة موقّعة + n_signed بأنواع الحماية';
end $$;

-- ═══════════ الخلاصة ═══════════
do $$ declare c jc; _events int; begin
  select * into c from jc;
  select count(*) into _events from audit_log
   where target = c.case_id::text and action like 'notify_%';
  raise notice '════════ رحلة % كاملة: 8 مراحل + % إشعاراً من القوالب ════════', c.ref, _events;
end $$;

rollback;
