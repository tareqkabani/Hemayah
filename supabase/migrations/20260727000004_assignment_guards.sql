-- ============================================================
-- تحصين ثلاثي كشفه الاختبار الحيّ تحت الحمل (2026-07-27):
--
-- (أ) حرج — submit_study/submit_assessment يتحققان من الدور فقط لا من
--     الإسناد، فأيّ دارس أو مقيّم يستطيع نداء الدالة مباشرةً (PostgREST
--     يعرض كل RPC لكل موثَّق) والكتابةَ على أيّ قضيةٍ في الدراسة. ولأن
--     نصاب التقدّم دراسةٌ واحدة + تقييمٌ واحد، يصير مخرَج الدخيل هو
--     مخرَج القضية المعتمد وتُلغى مهامّ المُسنَدين فعلياً — فينهار
--     العزل الصفّي وحياد التوزيع الآلي معاً.
--
-- (ب) قاعدة «طلبٌ واحد نشط» مفروضةٌ في الواجهة فقط؛ نداءٌ مباشر للـRPC
--     يُنشئ طلبات مكرّرة للشخص نفسه — إغراقٌ لطابور الفرز واحتمال
--     قرارَي حمايةٍ متعارضَين لنفس المشمول. الاعتراض محلّه التظلّم (م21).
--
-- (ج) submit_entity_recommendation يُنشئ التوصية بلا branch_id، فتحجبها
--     RLS الموجَّهة بالفرع عن الجهة الرافعة نفسها. (نظير ما عولج في
--     20260727000001 لـtriage_decide، وبقي هنا.)
-- ============================================================

-- ===== (أ) شرط الإسناد =====
create or replace function public.submit_study(
  _case_id uuid, _recommendation text, _reject_reasons jsonb, _proposed_type jsonb,
  _proposed_duration interval, _notes text, _partial_reason text default null,
  _found_recommendation boolean default null, _found_request boolean default null)
returns table(id uuid)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $$
declare _uid uuid := auth.uid(); _sid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'studier') then raise exception 'forbidden: not studier'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

  -- الإسناد شرطٌ: لا مخرَج إلا ممّن أُسندت إليه المهمة (حياد التوزيع والعزل الصفّي)
  if not exists (select 1 from studies s where s.case_id = _case_id and s.studier_id = _uid) then
    raise exception 'هذه القضية غير مُسنَدة إليك — لا يُقبل مخرَجك عليها.';
  end if;

  if exists (select 1 from studies s where s.case_id = _case_id and s.studier_id = _uid
             and s.superseded_at is not null) then
    raise exception 'أُعيد إسناد هذه المهمة (%) — لا يُقبل مخرَجك عليها.',
      (select s.superseded_reason from studies s where s.case_id = _case_id and s.studier_id = _uid);
  end if;

  insert into studies (case_id, studier_id, recommendation, reject_reasons, proposed_type,
                       proposed_duration, notes, partial_reason,
                       found_recommendation, found_request, submitted_at)
  values (_case_id, _uid, _recommendation, _reject_reasons, _proposed_type,
          _proposed_duration, _notes, _partial_reason,
          _found_recommendation, _found_request, now())
  on conflict (case_id, studier_id) do update
    set recommendation = excluded.recommendation, reject_reasons = excluded.reject_reasons,
        proposed_type = excluded.proposed_type, proposed_duration = excluded.proposed_duration,
        notes = excluded.notes, partial_reason = excluded.partial_reason,
        found_recommendation = excluded.found_recommendation,
        found_request = excluded.found_request, submitted_at = now()
  returning studies.id into _sid;

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_study', _ref);
  return query select _sid;
end $$;

create or replace function public.submit_assessment(
  _case_id uuid, _recommendation text, _reject_reasons jsonb, _proposed_type jsonb,
  _proposed_duration interval, _notes text, _partial_reason text default null,
  _found_recommendation boolean default null, _found_request boolean default null)
returns table(id uuid)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $$
declare _uid uuid := auth.uid(); _aid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'evaluator') then raise exception 'forbidden: not evaluator'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

  if not exists (select 1 from assessments a where a.case_id = _case_id and a.evaluator_id = _uid) then
    raise exception 'هذه القضية غير مُسنَدة إليك — لا يُقبل مخرَجك عليها.';
  end if;

  if exists (select 1 from assessments a where a.case_id = _case_id and a.evaluator_id = _uid
             and a.superseded_at is not null) then
    raise exception 'أُعيد إسناد هذه المهمة (%) — لا يُقبل مخرَجك عليها.',
      (select a.superseded_reason from assessments a where a.case_id = _case_id and a.evaluator_id = _uid);
  end if;

  insert into assessments (case_id, evaluator_id, recommendation, reject_reasons, proposed_type,
                           proposed_duration, notes, partial_reason,
                           found_recommendation, found_request, submitted_at)
  values (_case_id, _uid, _recommendation, _reject_reasons, _proposed_type,
          _proposed_duration, _notes, _partial_reason,
          _found_recommendation, _found_request, now())
  on conflict (case_id, evaluator_id) do update
    set recommendation = excluded.recommendation, reject_reasons = excluded.reject_reasons,
        proposed_type = excluded.proposed_type, proposed_duration = excluded.proposed_duration,
        notes = excluded.notes, partial_reason = excluded.partial_reason,
        found_recommendation = excluded.found_recommendation,
        found_request = excluded.found_request, submitted_at = now()
  returning assessments.id into _aid;

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_assessment', _ref);
  return query select _aid;
end $$;

-- ===== (ب) حارس الطلب الواحد النشط =====
-- الحالات المفتوحة التي تمنع طلباً جديداً — ما عداها (closed/rejected) يُعاد التقديم بعده.
create or replace function public.has_open_case(_uid uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from protection_cases
     where submitted_by = _uid
       and status in ('triage','referred','under_study','classified',
                      'in_decision','accepted','signed','active','under_review','terminating')
  );
$$;
revoke execute on function public.has_open_case(uuid) from public, anon;
grant execute on function public.has_open_case(uuid) to authenticated, service_role;

create or replace function public.submit_protection_request(
  _applicant_role text, _category app_category, _entity text, _crime text, _reason text,
  _prior_submit boolean, _case_no text, _details jsonb default '{}'::jsonb)
returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $$
declare
  _uid   uuid := auth.uid();
  _cid   uuid;
  _ref   text;
  _sec   text;
  _yr    text := extract(year from now())::text;
  _tries int  := 0;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;

  -- طلبٌ واحدٌ نشطٌ لكل شخص: الاعتراض على أيّ قرار يكون بالتظلّم (م21) لا بطلبٍ جديد.
  if has_open_case(_uid) then
    raise exception 'لديك طلبٌ قائمٌ قيد المعالجة — لا يُقبل طلبٌ جديد (منعاً للتكرار)؛ والاعتراض على القرار يكون بالتظلّم.';
  end if;

  -- توليد مرجعٍ ورمزٍ سرّيٍّ فريدين مع إعادة المحاولة عند أيّ تصادم (بذور/تدفّقات أخرى/تزامن).
  loop
    _tries := _tries + 1;
    _ref := 'REF-' || _yr || '-' || nextval('seeker_ref_seq')::text;
    _sec := 'C-'  || _yr || '-' || lpad(nextval('seeker_secret_seq')::text, 4, '0');
    begin
      insert into protection_cases (ref_no, secret_code, category, status, source, submitted_by)
      values (_ref, _sec, _category, 'triage', 'local', _uid)
      returning id into _cid;
      exit;
    exception when unique_violation then
      if _tries >= 100 then
        raise exception 'تعذّر توليد رمزٍ سرّيٍّ فريد بعد % محاولة', _tries;
      end if;
    end;
  end loop;

  insert into protection_requests (case_id, applicant_role, channel, details)
  values (_cid, _applicant_role, 'seeker',
          coalesce(_details, '{}'::jsonb)
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no));

  insert into messages (case_id, thread, direction, body, sender_label)
  values (_cid, 'center', 'in',
          'مرحباً، تسلّمنا طلبك ونراجع بياناته في مرحلة الفرز المبدئي. سنتواصل معك إن لزم استيفاء.',
          'منسّق الحماية');

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_cid, 'submission', 'تم استلام طلبك',
          'سُجِّل طلبك ' || _ref || ' وأُسند له رمز سري (' || _sec || '). سيُحال إلى الجهة المختصة لرفع التوصية خلال 5 أيام.',
          'requests', now());

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_protection_request', _ref);

  return query select _cid, _ref, _sec;
end $$;

-- ===== (ج) فرع توصية الجهة المرفوعة نيابةً عن الشخص =====
create or replace function public.submit_entity_recommendation(
  _applicant_role text, _category app_category, _entity text, _crime text, _reason text,
  _case_no text, _provide boolean, _details jsonb default '{}'::jsonb)
returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $$
declare
  _uid uuid := auth.uid();
  _cid uuid;
  _ref text;
  _sec text;
  _yr  text := extract(year from now())::text;
  _branch uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'competent_body') then raise exception 'forbidden: not competent_body'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;

  -- فرع الرافع: بدونه تحجب RLS الموجَّهة بالفرع التوصيةَ عن جهته نفسها.
  _branch := cb_branch();
  if _branch is null then
    select id into _branch from branches
     where entity = cb_entity() and coalesce(active, true)
     order by is_hq desc nulls last limit 1;
  end if;
  if _branch is null then
    raise exception 'لا فرع مرتبطٌ بحسابك — تعذّر رفع التوصية.';
  end if;

  _ref := 'REF-' || _yr || '-' || nextval('entity_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('entity_secret_seq')::text, 4, '0');

  insert into protection_cases (ref_no, secret_code, category, status, source)
  values (_ref, _sec, _category, 'triage', 'local')
  returning id into _cid;

  insert into protection_requests (case_id, applicant_role, channel, details)
  values (_cid, _applicant_role, 'body',
          coalesce(_details, '{}'::jsonb)
            || jsonb_build_object('entity', _entity, 'crime', _crime, 'reason', _reason,
                                  'case_no', _case_no, 'source_channel', 'entity_recommendation',
                                  'recommendation', case when _provide then 'توفير' else 'عدم توفير' end,
                                  'submitted_by', _uid, 'verified', false));

  insert into recommendations (case_id, source_body, decision, raised_at, due_at, branch_id)
  values (_cid, _entity, case when _provide then 'توفير' else 'عدم توفير' end,
          now(), now() + interval '5 days', _branch);

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_entity_recommendation', _ref);

  return query select _cid, _ref, _sec;
end $$;

-- سدّ رجعي للتوصيات اليتيمة: تُربط بفرعٍ واحدٍ لا لبس فيه فقط —
-- إمّا بمطابقة الاسم الكامل، وإمّا ببادئة اسم الجهة حين ينفرد فرعٌ واحد
-- بتلك البادئة (لا تخمين مناطق: ما بقي بلا فرع يُصحَّح من بيانات البذور).
with unambiguous as (
  select r.id as rec_id, min(b.id::text)::uuid as branch_id
    from recommendations r
    join branches b
      on b.name = r.source_body
      or r.source_body like split_part(b.name, ' — ', 1) || '%'
   where r.branch_id is null
   group by r.id
  having count(distinct b.id) = 1
)
update recommendations r
   set branch_id = u.branch_id
  from unambiguous u
 where r.id = u.rec_id;
