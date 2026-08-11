-- ============================================================
-- طور «التجميع» في ملفّ القرار — القضية تبلغ معدّ القرار بأوّل مخرَج
--
-- المشكلة (شُخِّصت على C-2026-0539): مع البثّ لكل الطاقم (20260810000004)
-- تُنشَأ صفوف إسناد لكل دارس ومقيّم، ولا يتقدّم _auto_send_to_decision إلا
-- بـ_pending = 0 — أي تسليم الجميع. فحتى مع ورود دراسةٍ وتقييمٍ مكتملَين
-- تبقى القضية في under_study **غير مرئيّة بتاتاً** لمعدّ القرار (استعلامه
-- يبدأ من in_decision)، إلى أن يُقفل مُقفِل الميعاد الباب بعد يوم العمل.
-- فالمعدّ يعمل أعمى طوال مرحلة التجميع، ثم يتلقّى الحزمة دفعةً واحدة.
--
-- القرار (2026-08-11، باعتماد المستخدم): «أي دراسة أو تقييم تُنجَز تظهر في
-- بوابة معدّ القرار إلى أن تُجمع كلها مع بعض». أي: يُفتح ملفّ القرار بأوّل
-- مخرَج وارد في طور **collecting**، وتتراكم عليه المخرجات كما تَرِد فيطّلع
-- المعدّ عليها أولاً بأول، ثمّ يُرقّى الملفّ إلى **preparing** عند اكتمال
-- التجميع (تسليم الجميع أو إقفال الميعاد) فيبدأ الإعداد الفعليّ.
--
-- الضمانة محفوظة بلا حارسٍ جديد: council_save وcouncil_submit يشترطان
-- أصلاً status = 'preparing'، فطور collecting يمنع إعداد القرار ورفعه
-- للاعتماد بحكم الشرط القائم — اطّلاعٌ بلا بتّ. وحالة القضية تبقى
-- under_study فيظلّ submit_study/submit_assessment مفتوحاً لمن لم يسلّم
-- بعد (شرطهما `_st <> 'under_study'`) — وهو عين المطلوب: التراكم يستمر.
-- ============================================================

-- ─── 1) قيمة الحالة الجديدة في آلة قرار المجلس (تسبق preparing) ───
alter table council_decisions drop constraint if exists council_decisions_status_check;
alter table council_decisions add constraint council_decisions_status_check
  check (status = any (array['collecting','preparing','pending_deputy','pending_chair','approved','voting','issued']));

-- ─── 2) المشغّل: يفتح الملفّ بأوّل مخرَج، ويُرقّيه باكتمال التجميع ───
create or replace function public._auto_send_to_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare _ns int; _na int; _pending int; _cur case_status; _ref text;
begin
  select status, ref_no into _cur, _ref from protection_cases where id = NEW.case_id;
  if _cur is distinct from 'under_study' then return NEW; end if;

  -- المخرجات الواردة فعلاً (غير المُلغاة)
  select count(*) into _ns from studies
    where case_id = NEW.case_id and submitted_at is not null and superseded_at is null;
  select count(*) into _na from assessments
    where case_id = NEW.case_id and submitted_at is not null and superseded_at is null;

  -- مهامّ حيّة لم تُسلَّم بعد: تحجز القضية حتى تُسلَّم أو يُقفل الميعاد بابها
  select (select count(*) from studies
            where case_id = NEW.case_id and submitted_at is null and superseded_at is null)
       + (select count(*) from assessments
            where case_id = NEW.case_id and submitted_at is null and superseded_at is null)
    into _pending;

  -- (أ) أوّل مخرَج يفتح ملفّ القرار في طور التجميع فتبلغ القضية معدّ القرار
  --     فوراً؛ وما يليه من مخرجات يتراكم على الملفّ نفسه بلا صفٍّ ثانٍ.
  if _ns + _na >= 1 then
    insert into council_decisions (case_id, status) values (NEW.case_id, 'collecting')
      on conflict (case_id) do nothing;
  end if;

  -- (ب) اكتمال التجميع: رأيٌ من كلّ دور ولا مهمّة معلّقة ⇒ القضية للقرار
  if _ns >= 1 and _na >= 1 and _pending = 0 then
    update protection_cases set status = 'in_decision', updated_at = now() where id = NEW.case_id;
    -- الترقية مشروطة بـcollecting: لا تُعيد ملفّاً تقدّم في دورته إلى الوراء
    insert into council_decisions (case_id, status) values (NEW.case_id, 'preparing')
      on conflict (case_id) do update set status = 'preparing', updated_at = now()
      where council_decisions.status = 'collecting';

    insert into audit_log (actor_id, action, target)
      values (auth.uid(), 'auto_send_to_decision', _ref);
  end if;
  return NEW;
end $function$;

comment on function public._auto_send_to_decision is
  'يفتح ملفّ القرار (collecting) بأوّل مخرَج دراسة أو تقييم فتظهر القضية لمعدّ القرار وتتراكم عليها المخرجات، ويُرقّيه إلى preparing وينقل القضية إلى in_decision عند اكتمال التجميع (رأيٌ من كل دور ولا مهمّة معلّقة).';

-- ─── 3) مُقفِل الميعاد (م10): الترقية نفسها في ضمانته الحتمية ───
-- إعادة إنشاءٍ كاملة من نسخة 20260810000004 — لا فرق إلا في جملة الترقية.
create or replace function public.study_eval_watchdog()
returns table(closed integer, alerted integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; _ns int; _na int; _closed int := 0; _alerted int := 0; _st case_status;
begin
  if not public.watchdog_enabled() then
    return query select 0, 0; return;
  end if;

  for r in
    select c.id, c.ref_no, c.secret_code,
           (select min(t.created_at) from (
              select s.created_at from studies s where s.case_id = c.id
              union all
              select a.created_at from assessments a where a.case_id = c.id) t) as phase_start
      from protection_cases c
     where c.status = 'under_study'
  loop
    -- لا صفوف إسناد بعد (لم يُشغَّل البثّ) أو الميعاد لم ينقضِ — لا شأن للمُقفِل
    if r.phase_start is null
       or business_days_between(r.phase_start, now()) < study_eval_deadline_days() then
      continue;
    end if;

    select count(*) into _ns from studies
      where case_id = r.id and submitted_at is not null and superseded_at is null;
    select count(*) into _na from assessments
      where case_id = r.id and submitted_at is not null and superseded_at is null;

    if _ns >= 1 and _na >= 1 then
      -- توثيق للمتأخرين قبل الوسم (توثيقاً لا عقوبة)
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select r.id, x.uid, 'deadline', 'انقضى الميعاد النظامي (م10)',
             r.secret_code || ' — أُقفل باب الدراسة والتقييم بانقضاء يوم العمل النظامي، وتقدّمت القضية بما ورد من مخرجات. وُثّق ذلك في السجل توثيقاً لا عقوبة.',
             'tasks', now()
      from (select studier_id as uid from studies
              where case_id = r.id and submitted_at is null and superseded_at is null
            union all
            select evaluator_id from assessments
              where case_id = r.id and submitted_at is null and superseded_at is null) x;

      -- الوسم؛ آخر UPDATE يُصفّر المعلّق فيُقدِّم مشغّلُ _auto_send_to_decision
      -- القضيةَ بنفسه (الشرط: رأي من كل دور ولا مهمة معلّقة)
      update studies set superseded_at = now(),
        superseded_reason = 'انقضى الميعاد النظامي (م10)'
        where case_id = r.id and submitted_at is null and superseded_at is null;
      update assessments set superseded_at = now(),
        superseded_reason = 'انقضى الميعاد النظامي (م10)'
        where case_id = r.id and submitted_at is null and superseded_at is null;

      insert into audit_log (actor_id, action, target)
        values (null, 'deadline_close_study_eval', r.ref_no);

      -- ضمانة حتمية: إن لم يُقدِّمها المشغّل لأي سبب نُقدِّمها هنا بالشرط نفسه
      select status into _st from protection_cases where id = r.id;
      if _st = 'under_study' then
        update protection_cases set status = 'in_decision', updated_at = now() where id = r.id;
        insert into council_decisions (case_id, status) values (r.id, 'preparing')
          on conflict (case_id) do update set status = 'preparing', updated_at = now()
          where council_decisions.status = 'collecting';
        insert into audit_log (actor_id, action, target)
          values (null, 'auto_send_to_decision', r.ref_no);
      end if;

      _closed := _closed + 1;
    else
      -- ميعاد منقضٍ بلا نصاب أدنى: القضية تبقى مفتوحة ويُنذَر النائب مرة يومياً؛
      -- أول مخرَج مكتمِل للنصاب تُقفِله الجولة التالية
      perform _notify_deputies_once_daily(r.id, 'انقضاء الميعاد النظامي بلا نصاب',
        r.secret_code || ' — انقضى يوم العمل النظامي (م10) ولم ترد '
        || case when _ns = 0 and _na = 0 then 'أي دراسة أو تقييم'
                when _ns = 0 then 'أي دراسة'
                else 'أي تقييم' end
        || '؛ القضية بانتظار النصاب الأدنى (دراسة وتقييم) لتُقفل آلياً. يلزم تنبيه الطاقم.');
      insert into audit_log (actor_id, action, target)
        values (null, 'study_eval_deadline_no_quorum', r.ref_no);
      _alerted := _alerted + 1;
    end if;
  end loop;

  return query select _closed, _alerted;
end $function$;

revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;

comment on function public.study_eval_watchdog is
  'مُقفِل الميعاد النظامي (م10): بعد study_eval_deadline_days من بدء المرحلة يُوسم من لم يقدّم «انقضى الميعاد النظامي»، وتتقدّم القضية إن اكتمل النصاب الأدنى (دراسة+تقييم) فيُرقَّى ملفّ القرار من collecting إلى preparing، وإلا أُنذر النائب مرة يومياً. يُطلقه pg_cron كل 30 دقيقة حين app_settings.watchdog=on.';

-- ─── 4) بيانات الأطراف في طور التجميع (بطاقة «بيانات طالب الحماية») ───
-- إعادة إنشاءٍ كاملة من 20260811000004 — الفرق: توسعة البوابة لتشمل ملفّاً
-- في طور التجميع، **لمعدّ القرار وحده**؛ المجلس لا يرى القضية قبل طرحها.
create or replace function public.decision_case_parties(_case_ids uuid[])
returns table(case_id uuid, subject_type text, gender text, nationality text, birth_date date,
              marital_status text, national_address jsonb, employer text, job_title text,
              education_level text, source_flags jsonb, emergency_registered boolean,
              emergency_relationship text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (is_council(_uid) or has_role(_uid, 'case_officer')) then
    raise exception 'forbidden: not a decision-stage party';
  end if;

  return query
  select c.id,
         s.subject_type, s.gender, s.nationality, s.birth_date, s.marital_status,
         s.national_address, s.employer, s.job_title, s.education_level, s.source_flags,
         (e.id is not null) as emergency_registered,
         e.relationship
    from protection_cases c
    left join lateral (
      select * from subjects s2
       where s2.case_id = c.id and s2.subject_type = 'principal'
       order by s2.created_at limit 1) s on true
    left join lateral (
      select * from emergency_contacts e2
       where e2.case_id = c.id order by e2.created_at desc limit 1) e on true
   where c.id = any(_case_ids)
     and (case_in_decision(c.id)
          or (has_role(_uid, 'case_officer') and exists (
                select 1 from council_decisions cd
                 where cd.case_id = c.id and cd.status = 'collecting')));
end $function$;

revoke execute on function public.decision_case_parties(uuid[]) from public, anon;
grant execute on function public.decision_case_parties(uuid[]) to authenticated;

comment on function public.decision_case_parties is
  'بيانات الأطراف غير المعرِّفة لحزمة القرار (لا عمود مشفّر ولا مفتاح خدمة): للمجلس ومعدّ القرار في الحالات in_decision/accepted/rejected، ولمعدّ القرار وحده في طور التجميع (collecting).';

-- ─── 5) لَحاق القضايا الجارية: فتح ملفّ التجميع لما ورد فيه مخرَجٌ فعلاً ───
insert into council_decisions (case_id, status)
select c.id, 'collecting'
  from protection_cases c
 where c.status = 'under_study'
   and (exists (select 1 from studies s
                 where s.case_id = c.id and s.submitted_at is not null and s.superseded_at is null)
     or exists (select 1 from assessments a
                 where a.case_id = c.id and a.submitted_at is not null and a.superseded_at is null))
on conflict (case_id) do nothing;
