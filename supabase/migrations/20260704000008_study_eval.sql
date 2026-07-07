-- ============================================================
--  بوابة موظف المركز — الدراسة والتقييم (CO-2)
--  دوران معزولان (studies/assessments). العزل الصفّيّ RLS موجودٌ في المخطّط
--  (study_author_rw · assess_author_rw · study_board_read · assess_board_read).
--  هنا: قراءة حالات الدراسة للمؤلّفين + دالتا التقديم (تدقيق + ختم زمنيّ).
-- ============================================================

-- الدارس/المقيّم يريان الحالات في مرحلة الدراسة (طابور العمل) — لا هويات، رمزٌ سرّيّ فقط.
create policy studier_under_study on protection_cases for select using (
  (has_role(auth.uid(), 'studier') or has_role(auth.uid(), 'evaluator')) and status = 'under_study');
create policy studier_req on protection_requests for select using (
  (has_role(auth.uid(), 'studier') or has_role(auth.uid(), 'evaluator'))
  and exists (select 1 from protection_cases c where c.id = protection_requests.case_id and c.status = 'under_study'));

-- ── تقديم الدراسة (الدارس) — يكتب صفّه فقط + ختم زمنيّ + تدقيق ──
create or replace function public.submit_study(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _sid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'studier') then raise exception 'forbidden: not studier'; end if;
  select status, ref_no into _st, _ref from protection_cases where id = _case_id;
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

-- ── تقديم التقييم (المقيّم) — نظير معزول ──
create or replace function public.submit_assessment(
  _case_id uuid, _recommendation text, _reject_reasons jsonb,
  _proposed_type jsonb, _proposed_duration interval, _notes text
) returns table(id uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _aid uuid; _ref text; _st case_status;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'evaluator') then raise exception 'forbidden: not evaluator'; end if;
  select status, ref_no into _st, _ref from protection_cases where id = _case_id;
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

grant execute on function public.submit_study(uuid, text, jsonb, jsonb, interval, text) to authenticated;
grant execute on function public.submit_assessment(uuid, text, jsonb, jsonb, interval, text) to authenticated;
