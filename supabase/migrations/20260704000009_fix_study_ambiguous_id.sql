-- إصلاح: `id` غامض بين عمود إرجاع الدالة (returns table(id)) وعمود الجدول.
-- نؤهّل الجدول بألياس pc. (submit_study + submit_assessment).

create or replace function public.submit_study(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _sid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'studier') then raise exception 'forbidden: not studier'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

  insert into studies (case_id, studier_id, recommendation, reject_reasons, proposed_type, proposed_duration, notes, submitted_at)
  values (_case_id, _uid, _recommendation, _reject_reasons, _proposed_type, _proposed_duration, _notes, now())
  on conflict (case_id, studier_id) do update
    set recommendation = excluded.recommendation, reject_reasons = excluded.reject_reasons,
        proposed_type = excluded.proposed_type, proposed_duration = excluded.proposed_duration,
        notes = excluded.notes, submitted_at = now()
  returning studies.id into _sid;

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_study', _ref);
  return query select _sid;
end $$;

create or replace function public.submit_assessment(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _aid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'evaluator') then raise exception 'forbidden: not evaluator'; end if;
  select pc.status, pc.ref_no into _st, _ref from protection_cases pc where pc.id = _case_id;
  if _st <> 'under_study' then raise exception 'الحالة ليست في الدراسة (%).', _st; end if;

  insert into assessments (case_id, evaluator_id, recommendation, reject_reasons, proposed_type, proposed_duration, notes, submitted_at)
  values (_case_id, _uid, _recommendation, _reject_reasons, _proposed_type, _proposed_duration, _notes, now())
  on conflict (case_id, evaluator_id) do update
    set recommendation = excluded.recommendation, reject_reasons = excluded.reject_reasons,
        proposed_type = excluded.proposed_type, proposed_duration = excluded.proposed_duration,
        notes = excluded.notes, submitted_at = now()
  returning assessments.id into _aid;

  insert into audit_log (actor_id, action, target) values (_uid, 'submit_assessment', _ref);
  return query select _aid;
end $$;
