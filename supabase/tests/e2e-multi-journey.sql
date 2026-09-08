-- ============================================================
--  الفحص الشامل متعدّد المسارات — أربعة طلبات مختلفة
--  من التقديم حتى إصدار القرار وإبلاغ الطرفين (طالب الحماية والجهة).
--
--    docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--      -f - < supabase/tests/e2e-multi-journey.sql
--
--  المسارات الأربعة (كلٌّ في معاملةٍ مستقلّة تُرجَع — لا أثر):
--    ١) إلكتروني (بوابة طالب الحماية) · توصية عبر سلسلة اعتماد رئيس الفرع
--       · قبولٌ بالتصويت · توقيع الاتفاقية → active
--    ٢) ورقيّ حضوريّ (الإدخال اليدوي) · ضمٌّ بنفاذ · توصية ورقية
--       · قبولٌ بالتصويت · توقيع → active
--    ٣) ورقيّ بريديّ (خطاب جهة) · ضمٌّ بنفاذ · توصية عبر السلسلة
--       · رفضٌ بالتصويت (4 أصوات رفض) → rejected
--    ٤) إلكتروني · توصية «عدم توفير» عبر السلسلة · المجلس يتبنّى رفضاً
--       مُعَدّاً (نطاق = رفض الحماية بأصوات قبول) → rejected
--
--  كل مرحلة تُنفَّذ بالدور الحقيقي (انتحال بـrequest.jwt.claims + set role)
--  وعبر الـRPCs الفعلية، ويُتحقَّق بعد الإصدار أنّ الإشعار **مرئيٌّ تحت RLS**
--  لطالب الحماية وللجهة المختصة — لا مجرّد مكتوبٍ في الجدول.
-- ============================================================

-- ═════════ أدوات مشتركة (خارج المعاملات كي تبقى بعد rollback) ═════════
create or replace function pg_temp.act(_uid uuid, _role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', _uid, 'role', _role)::text, true);
end $$;

drop table if exists who;
create temp table who as select
  (select id from auth.users where email='2000000002@nafath.local') as officer,
  (select id from auth.users where email='3000000001@nafath.local') as clerk,
  (select id from auth.users where email='3000000006@nafath.local') as head,
  (select id from auth.users where email='2000000010@nafath.local') as intake,
  (select id from auth.users where email='2000000005@nafath.local') as preparer,
  (select id from auth.users where email='2000000009@nafath.local') as deputy,
  (select id from auth.users where email='2000000008@nafath.local') as chair,
  (select id from auth.users where email='1000000001@nafath.local') as sub1,
  (select id from auth.users where email='1099887744@nafath.local') as sub2,
  (select id from auth.users where email='1099887755@nafath.local') as sub3,
  (select id from auth.users where email='1099887766@nafath.local') as sub4;

do $$ begin
  if exists (select 1 from who where officer is null or clerk is null or head is null
    or intake is null or preparer is null or deputy is null or chair is null
    or sub1 is null or sub2 is null or sub3 is null or sub4 is null) then
    raise exception 'هويات البذور ناقصة — شغّل seed.sql أولاً';
  end if;
end $$;

-- ─── مرحلة: محضر اتصال (موظف الفرز) ───
create or replace function pg_temp.s_contact(_case uuid) returns void
language plpgsql as $$ declare w who; begin
  select * into w from who;
  perform pg_temp.act(w.officer); set local role authenticated;
  insert into contact_logs (case_id, officer_id, channel, result, summary)
  values (_case, w.officer, 'phone', 'answered', 'تواصلٌ هاتفيٌّ وتحقّقٌ من الطلب');
  reset role;
end $$;

-- ─── مرحلة: الإحالة للجهة المختصة ───
create or replace function pg_temp.s_refer(_case uuid) returns void
language plpgsql as $$ declare w who; _st case_status; begin
  select * into w from who;
  perform pg_temp.act(w.officer); set local role authenticated;
  select status into _st from triage_decide(_case, 'refer', null,
    '{"identity":true,"jurisdiction":true}'::jsonb,
    'النيابة العامة', 'النيابة العامة', 'RUH');
  reset role;
  if _st <> 'referred' then raise exception 'الإحالة: الحالة % لا referred', _st; end if;
  if not exists (select 1 from recommendations where case_id=_case and received_at is null
                   and branch_id is not null) then
    raise exception 'الإحالة: لا توصية مستحقّة مربوطةٌ بوحدة'; end if;
  if not exists (select 1 from audit_log where action='notify_n_ent_req' and target=_case::text) then
    raise exception 'الإحالة: لم تُشعَر الجهة'; end if;
  if not exists (select 1 from audit_log where action='notify_n_referred' and target=_case::text) then
    raise exception 'الإحالة: لم يُشعَر المتقدّم'; end if;
end $$;

-- ─── مرحلة: توصية الجهة عبر سلسلة الاعتماد (موظف الفرع ← رئيسه) ───
create or replace function pg_temp.s_rec_chain(_case uuid, _decision text) returns void
language plpgsql as $$ declare w who; _rid uuid; _as text; _st case_status; begin
  select * into w from who;
  perform pg_temp.act(w.clerk); set local role authenticated;
  select recommendation_id into _rid from submit_recommendation_for_approval(
    _case, _decision, '{"risk":"مرتفع"}'::jsonb, '["الحماية الأمنية"]'::jsonb,
    null, 'توصية الوحدة: ' || _decision);
  reset role;
  if exists (select 1 from recommendations where id=_rid and received_at is not null) then
    raise exception 'السلسلة: التوصية وصلت المركز بلا اعتماد'; end if;
  if not exists (select 1 from recommendation_approvals where recommendation_id=_rid
                   and approver='branch_head' and decided_at is null and due_at is not null) then
    raise exception 'السلسلة: لا صفّ اعتمادٍ مفتوحٌ بميعادٍ لرئيس الفرع'; end if;

  perform pg_temp.act(w.head); set local role authenticated;
  select new_approval_status, new_case_status into _as, _st
    from decide_recommendation_approval(_rid, 'approved', 'مطابقةٌ للسند النظامي');
  reset role;
  if _as <> 'approved' then raise exception 'السلسلة: حالة الاعتماد % لا approved', _as; end if;
  if _st <> 'triage' then raise exception 'السلسلة: الحالة % لا triage بعد الاعتماد', _st; end if;
  if not exists (select 1 from recommendations where case_id=_case and received_at is not null
                   and decision=_decision) then
    raise exception 'السلسلة: التوصية لم تُستلَم بقرار %', _decision; end if;
end $$;

-- ─── مرحلة: توصية الجهة ورقيّاً (خطابٌ يفرّغه منسوب الإدخال) ───
create or replace function pg_temp.s_rec_paper(_case uuid, _decision text) returns void
language plpgsql as $$ declare w who; _st case_status; begin
  select * into w from who;
  perform pg_temp.act(w.intake); set local role authenticated;
  select status into _st from record_recommendation(_case, _decision, 'paper',
    '{"risk":"مرتفع"}'::jsonb, '["الحماية الأمنية"]'::jsonb, null,
    'خطاب الجهة الوارد', current_date, 'REG-REC-77', 'LTR-9001', current_date, 'مدير الوحدة', null);
  reset role;
  if _st <> 'under_study' then raise exception 'التوصية الورقية: الحالة % لا under_study', _st; end if;
  if not exists (select 1 from recommendations where case_id=_case and channel='paper'
                   and received_at is not null) then
    raise exception 'التوصية الورقية: لم تُقيَّد بقناتها'; end if;
end $$;

-- ─── مرحلة: القبول للدراسة (بعد ورود التوصية) ───
create or replace function pg_temp.s_to_study(_case uuid) returns void
language plpgsql as $$ declare w who; _st case_status; begin
  select * into w from who;
  perform pg_temp.act(w.officer); set local role authenticated;
  select status into _st from triage_decide(_case, 'study', null,
    '{"identity":true,"jurisdiction":true}'::jsonb, 'النيابة العامة', 'النيابة العامة', 'RUH');
  reset role;
  if _st <> 'under_study' then raise exception 'القبول: الحالة % لا under_study', _st; end if;
  if not exists (select 1 from audit_log where action='notify_n_triage_accept' and target=_case::text) then
    raise exception 'القبول: لم يُشعَر المتقدّم بالقبول'; end if;
end $$;

-- ─── تحقّق: الإسناد الآلي وقع (البثّ لكل الطاقم) ───
create or replace function pg_temp.s_assigned(_case uuid) returns text
language plpgsql as $$ declare _s int; _a int; begin
  select count(*) into _s from studies     where case_id=_case and superseded_at is null;
  select count(*) into _a from assessments where case_id=_case and superseded_at is null;
  if _s < 1 or _a < 1 then raise exception 'الإسناد: دارسون % ومقيّمون %', _s, _a; end if;
  return _s || ' دارس · ' || _a || ' مقيّم';
end $$;

-- ─── مرحلة: تسليم كل المخرجات → النصاب الكامل ───
create or replace function pg_temp.s_outputs(_case uuid, _rec text) returns void
language plpgsql as $$ declare r record; _st case_status; begin
  for r in select studier_id as uid from studies where case_id=_case and superseded_at is null loop
    perform pg_temp.act(r.uid); set local role authenticated;
    perform submit_study(_case, _rec, null, '["الحماية الأمنية"]'::jsonb, null,
                         'دراسةٌ مسبَّبة', null, true, true);
    reset role;
  end loop;
  for r in select evaluator_id as uid from assessments where case_id=_case and superseded_at is null loop
    perform pg_temp.act(r.uid); set local role authenticated;
    perform submit_assessment(_case, _rec, null, '["الحماية الأمنية"]'::jsonb, null,
                              'تقييمٌ مسبَّب', null, true, true);
    reset role;
  end loop;
  select status into _st from protection_cases where id=_case;
  if _st <> 'in_decision' then raise exception 'المخرجات: النصاب لم يقدّم للقرار (%)', _st; end if;
  if not exists (select 1 from council_decisions where case_id=_case and status='preparing') then
    raise exception 'المخرجات: لم يُنشأ صفّ قرار المجلس'; end if;
end $$;

-- ─── مرحلة: دورة القرار السداسية (إعداد ← نائب ← رئيس ← طرح) ───
create or replace function pg_temp.s_decide(_case uuid, _scope text, _reasoning text) returns void
language plpgsql as $$ declare w who; _st text; begin
  select * into w from who;
  perform pg_temp.act(w.preparer); set local role authenticated;
  perform council_save(_case, '["الحماية الأمنية"]'::jsonb, 'ثلاثون يوماً', _reasoning, _scope, null);
  select status into _st from council_submit(_case, '["الحماية الأمنية"]'::jsonb,
                                             'ثلاثون يوماً', _reasoning, _scope, null);
  reset role;
  if _st <> 'pending_deputy' then raise exception 'القرار: بعد الرفع % لا pending_deputy', _st; end if;

  perform pg_temp.act(w.deputy); set local role authenticated;
  select status into _st from council_approve(_case); reset role;
  if _st <> 'pending_chair' then raise exception 'القرار: بعد النائب % لا pending_chair', _st; end if;

  perform pg_temp.act(w.chair); set local role authenticated;
  select status into _st from council_approve_chair(_case); reset role;
  if _st <> 'approved' then raise exception 'القرار: بعد الرئيس % لا approved', _st; end if;

  perform pg_temp.act(w.preparer); set local role authenticated;
  select status into _st from council_open_voting(_case); reset role;
  if _st <> 'voting' then raise exception 'القرار: بعد الطرح % لا voting', _st; end if;
  if not exists (select 1 from audit_log where action='notify_n_voting' and target=_case::text) then
    raise exception 'القرار: لم تُشعَر المقاعد بالطرح'; end if;
end $$;

-- ─── مرحلة: التصويت ───
create or replace function pg_temp.s_vote(_case uuid, _choice text, _n int) returns void
language plpgsql as $$ declare s record; _i int := 0; begin
  for s in select user_id from user_roles
            where role in ('board_member','deputy_chair','board_chair') loop
    exit when _i >= _n;
    perform pg_temp.act(s.user_id); set local role authenticated;
    -- التصويت بالرفض يوجب تعليلاً (حارس في council_vote)
    perform council_vote(_case, _choice,
      case when _choice = 'reject'
           then 'لا تتوافر مسوّغات الخطر الجدّي في محضر الدراسة.' end);
    reset role;
    _i := _i + 1;
  end loop;
end $$;

-- ─── مرحلة: الإصدار (رئيس المركز) ───
create or replace function pg_temp.s_issue(_case uuid, _reason text) returns text
language plpgsql as $$ declare w who; _out text; _want case_status; begin
  select * into w from who;
  perform pg_temp.act(w.chair); set local role authenticated;
  select outcome into _out from council_issue(_case, _reason);
  reset role;
  _want := case _out when 'accept' then 'accepted'::case_status else 'rejected'::case_status end;
  if (select status from protection_cases where id=_case) <> _want then
    raise exception 'الإصدار: الحالة لا تطابق النتيجة %', _out; end if;
  if not exists (select 1 from board_decisions where case_id=_case) then
    raise exception 'الإصدار: لم يُقيَّد قرار المجلس'; end if;
  return _out;
end $$;

-- ─── تحقّق الإبلاغ: الإشعار **مرئيٌّ تحت RLS** للطرفين لا مكتوبٌ فحسب ───
create or replace function pg_temp.s_informed(_case uuid, _subject uuid, _out text) returns text
language plpgsql as $$ declare w who; _seek int; _ent int; _tpl text; begin
  select * into w from who;
  _tpl := case _out when 'accept' then 'notify_n_dec_accept' else 'notify_n_dec_reject' end;
  if not exists (select 1 from audit_log where action=_tpl and target=_case::text) then
    raise exception 'الإبلاغ: لا إشعار قرارٍ من القالب (%)', _tpl; end if;
  if _out = 'accept' and not exists (select 1 from audit_log
       where action='notify_n_agreement' and target=_case::text) then
    raise exception 'الإبلاغ: لا دعوة توقيعٍ بعد القبول'; end if;
  if not exists (select 1 from audit_log where action='notify_n_dec_entity' and target=_case::text) then
    raise exception 'الإبلاغ: لم تُشعَر الجهة الموصية'; end if;

  -- بعين طالب الحماية (RLS)
  perform pg_temp.act(_subject); set local role authenticated;
  select count(*) into _seek from notifications where case_id=_case and type='decision';
  reset role;
  if _seek < 1 then raise exception 'الإبلاغ: طالب الحماية لا يرى إشعار القرار تحت RLS'; end if;

  -- بعين ضابط الجهة المختصة (RLS)
  perform pg_temp.act(w.clerk); set local role authenticated;
  select count(*) into _ent from notifications
   where case_id=_case and authority='competent'::referral_authority;
  reset role;
  if _ent < 1 then raise exception 'الإبلاغ: الجهة لا ترى إشعار القرار تحت RLS'; end if;

  return 'طالب الحماية يرى ' || _seek || ' · الجهة ترى ' || _ent;
end $$;

-- ─── مرحلة: توقيع الاتفاقية → الحماية فعّالة ───
create or replace function pg_temp.s_sign(_case uuid, _subject uuid) returns void
language plpgsql as $$ declare _st case_status; begin
  perform pg_temp.act(_subject); set local role authenticated;
  select status into _st from seeker_sign_agreement(_case);
  reset role;
  if _st <> 'active' then raise exception 'التوقيع: بعد التوقيع % لا active', _st; end if;
  if not exists (select 1 from protection_documents where case_id=_case and signed_at is not null) then
    raise exception 'التوقيع: لا وثيقة موقّعة'; end if;
  if not exists (select 1 from audit_log where action='notify_n_signed' and target=_case::text) then
    raise exception 'التوقيع: لا إشعار توقيع'; end if;
end $$;

-- ─── ضمّ حالةٍ ورقية بنفاذ (جسر service_role) ───
create or replace function pg_temp.s_claim(_user uuid, _nid text) returns int
language plpgsql as $$ declare _n int; begin
  perform pg_temp.act(_user, 'service_role'); set local role service_role;
  select claim_paper_cases(_user, _nid) into _n;
  reset role;
  return _n;
end $$;

-- ─── تفريغ طلبٍ ورقيٍّ من الواردة ───
create or replace function pg_temp.s_paper_intake(
  _channel text, _category app_category, _crime text, _reason text,
  _details jsonb, _reg text)
returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql as $$ declare w who; _inbox uuid; _cid uuid; _ref text; _sec text; begin
  select * into w from who;
  perform pg_temp.act(w.intake); set local role authenticated;
  select intake_inbox_register(_channel, 'req', _reg, current_date) into _inbox;
  perform intake_inbox_claim(_inbox);
  -- خطاب الجهة البريديّ يلزمه مرفقٌ واحدٌ على الأقل (صورة الخطاب) — قاعدة عملٍ
  -- في submit_paper_intake، فيُقيَّد المرفق في مجلّد الرافع قبل التفريغ.
  if _channel = 'mail' then
    perform intake_attach_record(w.intake::text || '/' || _reg || '.pdf',
                                 'صورة خطاب الجهة', 'application/pdf', 120000, _reg);
  end if;
  select * into _cid, _ref, _sec from submit_paper_intake(
      case when _channel='mail' then 'entity' else 'seeker' end,
      'أصيل (عن شخصه)', _category, 'النيابة العامة', _crime, _reason,
      false, null, _details, current_date, _reg, _inbox);
  reset role;
  return query select _cid, _ref, _sec;
end $$;

-- ════════════════════════════════════════════════════════════
--  المسار ١ — إلكتروني · سلسلة اعتماد · قبول · توقيع → active
-- ════════════════════════════════════════════════════════════
begin;
update protection_cases set status='closed'
 where submitted_by=(select sub1 from who) and status not in ('closed','rejected');
do $$
declare w who; r record; _out text; _asg text; _inf text; _n int;
begin
  select * into w from who;
  raise notice '';
  raise notice '══════════ المسار ١: إلكتروني · قبول · توقيع ══════════';

  perform pg_temp.act(w.sub1); set local role authenticated;
  select * into r from submit_protection_request(
    'أصيل (عن شخصه)', 'witness', 'النيابة العامة',
    'ابتزازٌ وتهديدٌ بالنشر', 'خطرٌ جدّيٌّ على السلامة بعد الإدلاء بالشهادة',
    true, 'CASE-M1-2026', '{}'::jsonb);
  reset role;
  if (select status from protection_cases where id=r.case_id) <> 'triage' then
    raise exception 'التقديم: الحالة ليست triage'; end if;
  if not exists (select 1 from notifications n where n.case_id=r.case_id
                   and n.type='submission' and n.body like '%'||r.secret_code||'%') then
    raise exception 'التقديم: إشعار الاستلام بلا رمزٍ سرّي'; end if;
  raise notice '  ① التقديم عبر بوابة طالب الحماية: % · الرمز % · triage', r.ref_no, r.secret_code;

  perform pg_temp.s_contact(r.case_id);
  perform pg_temp.s_refer(r.case_id);
  raise notice '  ② الفرز: محضر اتصال ← إحالةٌ للنيابة العامة (RUH) · referred';

  perform pg_temp.s_rec_chain(r.case_id, 'توفير');
  raise notice '  ③ الجهة: أعدّها موظف الوحدة ← اعتمدها رئيس الفرع · توصية «توفير» مُستلَمة';

  perform pg_temp.s_to_study(r.case_id);
  _asg := pg_temp.s_assigned(r.case_id);
  raise notice '  ④ القبول للدراسة: under_study · إسنادٌ آليّ (%)', _asg;

  perform pg_temp.s_outputs(r.case_id, 'قبول كلي');
  raise notice '  ⑤ المخرجات: كل الدراسات والتقييمات سُلّمت · in_decision';

  perform pg_temp.s_decide(r.case_id, 'قبول كلي',
    'حيثياتٌ مؤيِّدةٌ للحماية استناداً إلى الدراسات والتقييمات وتوصية الجهة.');
  raise notice '  ⑥ دورة القرار: إعداد ← النائب ← الرئيس ← طرحٌ للتصويت';

  perform pg_temp.s_vote(r.case_id, 'accept', 4);
  _out := pg_temp.s_issue(r.case_id, null);
  raise notice '  ⑦ التصويت والإصدار: 4/7 قبول ← النتيجة % · accepted', _out;

  _inf := pg_temp.s_informed(r.case_id, w.sub1, _out);
  raise notice '  ⑧ الإبلاغ تحت RLS: %', _inf;

  perform pg_temp.s_sign(r.case_id, w.sub1);
  select count(*) into _n from audit_log where target=r.case_id::text and action like 'notify_%';
  raise notice '  ⑨ التوقيع: active · وثيقةٌ موقّعة';
  raise notice '  ✓ المسار ١ تمّ — % · % إشعاراً من القوالب', r.ref_no, _n;
end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  المسار ٢ — ورقيّ حضوريّ · ضمٌّ بنفاذ · توصية ورقية · قبول → active
-- ════════════════════════════════════════════════════════════
begin;
update protection_cases set status='closed'
 where submitted_by=(select sub2 from who) and status not in ('closed','rejected');
do $$
declare w who; r record; _out text; _asg text; _inf text; _n int; _st case_status;
begin
  select * into w from who;
  raise notice '';
  raise notice '══════════ المسار ٢: ورقيّ حضوريّ · ضمّ بنفاذ · قبول ══════════';

  select * into r from pg_temp.s_paper_intake('inperson', 'victim',
    'اعتداءٌ جسديٌّ متكرّر', 'خطرٌ على الحياة يستوجب تدابير عاجلة',
    jsonb_build_object(
      'channel', 'inperson',
      'interview', jsonb_build_object(
        'note', 'محضر مقابلةٍ حضورية: حضر طالب الحماية وأفاد بتهديدٍ مباشرٍ متكرّر.',
        'date', current_date),
      'identity', jsonb_build_object('name','طالب حماية ورقيّ','nid','1099887744','phone','0500000044')),
    'REG-M2-' || floor(random()*100000)::text);
  if (select status from protection_cases where id=r.case_id) <> 'triage' then
    raise exception 'الإدخال اليدوي: الحالة ليست triage'; end if;
  if not exists (select 1 from contact_logs where case_id=r.case_id and channel='inperson') then
    raise exception 'الإدخال اليدوي: محضر المقابلة الحضورية لم يُقيَّد'; end if;
  raise notice '  ① الإدخال اليدوي (حضوريّ): % · محضر المقابلة يقوم مقام محضر التحقّق', r.ref_no;

  _n := pg_temp.s_claim(w.sub2, '1099887744');
  if _n < 1 then raise exception 'الضمّ: نفاذ لم يضمّ الحالة الورقية'; end if;
  if (select submitted_by from protection_cases where id=r.case_id) is distinct from w.sub2 then
    raise exception 'الضمّ: القضية لم تُربط بصاحبها'; end if;
  raise notice '  ② الضمّ بنفاذ: % حالة ضُمّت · القضية صارت مملوكةً لصاحبها', _n;

  perform pg_temp.s_refer(r.case_id);
  raise notice '  ③ الفرز: إحالةٌ للنيابة العامة · referred';

  perform pg_temp.s_rec_paper(r.case_id, 'توفير');
  _asg := pg_temp.s_assigned(r.case_id);
  raise notice '  ④ توصية ورقية (خطابٌ فُرِّغ): under_study مباشرةً · إسنادٌ آليّ (%)', _asg;

  perform pg_temp.s_outputs(r.case_id, 'قبول كلي');
  raise notice '  ⑤ المخرجات: النصاب كامل · in_decision';

  perform pg_temp.s_decide(r.case_id, 'قبول كلي',
    'حيثياتٌ مؤيِّدةٌ للحماية بعد المقابلة الحضورية وتوصية الجهة.');
  perform pg_temp.s_vote(r.case_id, 'accept', 4);
  _out := pg_temp.s_issue(r.case_id, null);
  raise notice '  ⑥ دورة القرار والتصويت: 4/7 قبول ← % · accepted', _out;

  _inf := pg_temp.s_informed(r.case_id, w.sub2, _out);
  raise notice '  ⑦ الإبلاغ تحت RLS: %', _inf;

  perform pg_temp.s_sign(r.case_id, w.sub2);
  select count(*) into _n from audit_log where target=r.case_id::text and action like 'notify_%';
  raise notice '  ⑧ التوقيع: active';
  raise notice '  ✓ المسار ٢ تمّ — % · % إشعاراً من القوالب', r.ref_no, _n;
end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  المسار ٣ — ورقيّ بريديّ (خطاب جهة) · سلسلة اعتماد · رفضٌ بالتصويت
-- ════════════════════════════════════════════════════════════
begin;
update protection_cases set status='closed'
 where submitted_by=(select sub3 from who) and status not in ('closed','rejected');
do $$
declare w who; r record; _out text; _asg text; _inf text; _n int;
begin
  select * into w from who;
  raise notice '';
  raise notice '══════════ المسار ٣: ورقيّ بريديّ · رفضٌ بالتصويت ══════════';

  select * into r from pg_temp.s_paper_intake('mail', 'reporter',
    'إبلاغٌ عن جريمة فساد', 'خشيةُ الانتقام الوظيفيّ والشخصيّ',
    jsonb_build_object(
      'channel', 'mail',
      'identity', jsonb_build_object('name','مبلّغٌ بالبريد','nid','1099887755','phone','0500000055')),
    'REG-M3-' || floor(random()*100000)::text);
  raise notice '  ① الإدخال اليدوي (بريديّ من جهة): % · triage', r.ref_no;

  _n := pg_temp.s_claim(w.sub3, '1099887755');
  if _n < 1 then raise exception 'الضمّ: نفاذ لم يضمّ الحالة'; end if;
  raise notice '  ② الضمّ بنفاذ: % حالة', _n;

  perform pg_temp.s_contact(r.case_id);
  perform pg_temp.s_refer(r.case_id);
  raise notice '  ③ الفرز: محضر اتصال ← إحالة · referred';

  perform pg_temp.s_rec_chain(r.case_id, 'توفير');
  perform pg_temp.s_to_study(r.case_id);
  _asg := pg_temp.s_assigned(r.case_id);
  raise notice '  ④ توصية عبر السلسلة ← القبول للدراسة · under_study (%)', _asg;

  perform pg_temp.s_outputs(r.case_id, 'قبول كلي');
  perform pg_temp.s_decide(r.case_id, 'قبول كلي',
    'حيثياتٌ معروضةٌ على المجلس للبتّ.');
  raise notice '  ⑤ المخرجات ودورة القرار: طُرح للتصويت';

  perform pg_temp.s_vote(r.case_id, 'reject', 4);
  _out := pg_temp.s_issue(r.case_id,
    'لم تتوافر مسوّغات الخطر الجدّي المنصوص عليها نظاماً بعد دراسة الحالة (م21).');
  if _out <> 'reject' then raise exception 'المسار ٣: النتيجة % لا reject', _out; end if;
  raise notice '  ⑥ التصويت والإصدار: 4/7 رفض ← % · rejected بتسبيبٍ مكتوب', _out;

  _inf := pg_temp.s_informed(r.case_id, w.sub3, _out);
  raise notice '  ⑦ الإبلاغ تحت RLS: %', _inf;

  if exists (select 1 from audit_log where action='notify_n_agreement' and target=r.case_id::text) then
    raise exception 'المسار ٣: دعوة توقيعٍ صدرت رغم الرفض'; end if;
  select count(*) into _n from audit_log where target=r.case_id::text and action like 'notify_%';
  raise notice '  ✓ المسار ٣ تمّ — % · % إشعاراً · لا دعوة توقيع (صحيح)', r.ref_no, _n;
end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  المسار ٤ — إلكتروني · توصية «عدم توفير» · المجلس يتبنّى رفضاً مُعَدّاً
-- ════════════════════════════════════════════════════════════
begin;
update protection_cases set status='closed'
 where submitted_by=(select sub4 from who) and status not in ('closed','rejected');
do $$
declare w who; r record; _out text; _inf text; _n int; _just text;
begin
  select * into w from who;
  raise notice '';
  raise notice '══════════ المسار ٤: إلكتروني · تبنّي رفضٍ مُعَدّ ══════════';

  perform pg_temp.act(w.sub4); set local role authenticated;
  select * into r from submit_protection_request(
    'أصيل (عن شخصه)', 'expert', null,
    'تهديدٌ لفظيٌّ عقب تقريرٍ فنّي', 'تخوّفٌ من إيذاءٍ محتمل',
    false, null, '{}'::jsonb);
  reset role;
  raise notice '  ① التقديم الإلكتروني (بلا سبق تقديمٍ لجهة): % · triage', r.ref_no;

  perform pg_temp.s_contact(r.case_id);
  perform pg_temp.s_refer(r.case_id);
  perform pg_temp.s_rec_chain(r.case_id, 'عدم توفير');
  raise notice '  ② الإحالة والتوصية: الجهة أوصت بـ«عدم توفير» عبر السلسلة';

  perform pg_temp.s_to_study(r.case_id);
  perform pg_temp.s_outputs(r.case_id, 'رفض الحماية');
  raise notice '  ③ الدراسة والتقييم: المخرجات بـ«رفض الحماية» · in_decision';

  _just := 'لا تتوافر مسوّغات الخطر الجدّي؛ التهديد لفظيٌّ غير مقترنٍ بوقائع تنفيذ (م21).';
  perform pg_temp.s_decide(r.case_id, 'رفض الحماية', _just);
  raise notice '  ④ دورة القرار: نطاق المُعَدّ «رفض الحماية» · طُرح للتصويت';

  perform pg_temp.s_vote(r.case_id, 'accept', 4);
  _out := pg_temp.s_issue(r.case_id, null);
  if _out <> 'reject' then
    raise exception 'المسار ٤: تبنّي الرفض المُعَدّ أعطى % لا reject', _out; end if;
  if not exists (select 1 from council_decisions
                   where case_id=r.case_id and issued_type='reject'
                     and btrim(coalesce(issued_reason,'')) = btrim(_just)) then
    raise exception 'المسار ٤: حيثيات المُعَدّ لم تصر تسبيب الرفض'; end if;
  if not exists (select 1 from board_decisions
                   where case_id=r.case_id and type='reject' and scope='رفض الحماية') then
    raise exception 'المسار ٤: قرار المجلس لم يُقيَّد بنطاق الرفض'; end if;
  raise notice '  ⑤ الإصدار: أصواتُ قبولٍ على مُعَدٍّ نطاقُه الرفض ← % · التسبيب = حيثيات المُعَدّ', _out;

  _inf := pg_temp.s_informed(r.case_id, w.sub4, _out);
  select count(*) into _n from audit_log where target=r.case_id::text and action like 'notify_%';
  raise notice '  ⑥ الإبلاغ تحت RLS: %', _inf;
  raise notice '  ✓ المسار ٤ تمّ — % · % إشعاراً من القوالب', r.ref_no, _n;
end $$;
rollback;

do $$ begin
  raise notice '';
  raise notice '════════════ انتهت المسارات الأربعة ════════════';
end $$;
