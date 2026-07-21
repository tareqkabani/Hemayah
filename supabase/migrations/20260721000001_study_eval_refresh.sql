-- ============================================================
--  تحديث مراجع الدراسة والتقييم 2026-07-21 (HANDOFF-STUDY-EVAL §refresh)
--  1) بندا الاطّلاع في مخرَج الدارس/المقيّم: «بالاطّلاع على الطلب المرافق
--     تبيّن الآتي» — وجود توصية جهة مختصة / وجود طلب مسبّب (يوجد/لا يوجد).
--  2) recommendations.details: مضمون التوصية الكامل (8 أقسام) — ضابط
--     الاتصال، مرجع التوصية، اعتمدها، الحالة الصحية/الجنائية/النفسية،
--     ملخّص القضية والدور، أنواع الخطر والضرر، أسباب التوصية، المرفقات.
--  3) فتح مرفق = صف تدقيق (م15/16): record_attachment_open — العارض
--     داخل الشاشة فقط، بلا تنزيل أو تداول.
-- ============================================================

-- ─────────────────── بندا الاطّلاع ───────────────────
alter table studies     add column if not exists found_recommendation boolean;
alter table studies     add column if not exists found_request        boolean;
alter table assessments add column if not exists found_recommendation boolean;
alter table assessments add column if not exists found_request        boolean;

-- ─────────────────── مضمون التوصية الكامل ───────────────────
alter table recommendations add column if not exists details jsonb;

-- ─────────────────── دالتا التقديم — ببندي الاطّلاع ───────────────────
drop function if exists public.submit_study(uuid, text, jsonb, jsonb, interval, text, text);
create or replace function public.submit_study(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text,
  _partial_reason text default null,
  _found_recommendation boolean default null,
  _found_request boolean default null
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _sid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'studier') then raise exception 'forbidden: not studier'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

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

drop function if exists public.submit_assessment(uuid, text, jsonb, jsonb, interval, text, text);
create or replace function public.submit_assessment(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text,
  _partial_reason text default null,
  _found_recommendation boolean default null,
  _found_request boolean default null
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _aid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'evaluator') then raise exception 'forbidden: not evaluator'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

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

grant execute on function public.submit_study(uuid, text, jsonb, jsonb, interval, text, text, boolean, boolean) to authenticated;
grant execute on function public.submit_assessment(uuid, text, jsonb, jsonb, interval, text, text, boolean, boolean) to authenticated;

-- ─────────────────── فتح مرفق = حدث تدقيق (م15/16) ───────────────────
-- الاطّلاع داخل الشاشة فقط: كل فتح مستند يسجَّل (من · أي مستند · متى) —
-- المفتوح له = المُسنَد إليه الطلب (دارساً أو مقيّماً).
create or replace function public.record_attachment_open(_case_id uuid, _doc text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(btrim(_doc),'') = '' then raise exception 'مستند غير محدّد'; end if;
  if not (is_assigned_study(_case_id) or is_assigned_assessment(_case_id)) then
    raise exception 'forbidden: not assigned';
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  insert into audit_log (actor_id, action, target)
  values (_uid, 'attachment_open', _ref || ' · ' || left(btrim(_doc), 120));
end $$;

grant execute on function public.record_attachment_open(uuid, text) to authenticated;
