-- ============================================================
--  حارس الإحياء (كشفه التحقق العدائي 2026-07-22)
--  upsert دالتَي الاعتماد كان «يُحيي» الصف المُحال: من سُحبت مهمته
--  (إعادة إسناد/نصاب) واستدعى الدالة مباشرةً بعد السحب كان مخرَجه
--  يُكتب على صفه الموسوم فيصير submitted + superseded معاً — حزمة
--  القرار كانت ستعرضه مدخلاً نافذاً بينما مشغّل النصاب نفسه يعدّه
--  لاغياً. الآن: المُحال عنه يُرفض صراحةً، وحارس السباق في الحارس
--  المُجدوَل لا يسحب صفاً اعتُمد في اللحظة الأخيرة.
-- ============================================================

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

-- حارس السباق في الحارس المُجدوَل: لا سحب لصفٍّ اعتُمد بين الرصد والتنفيذ —
-- شرط submitted_at is null داخل UPDATE نفسه (كان where id فقط).
create or replace function public.study_eval_watchdog()
returns table (reassigned int, exhausted int)
language plpgsql security definer set search_path = public as $$
declare r record; _next uuid; _ref text; _secret text; _re int := 0; _ex int := 0; _hit int;
begin
  if coalesce(current_setting('app.settings.watchdog', true), 'off') <> 'on' then
    return query select 0, 0; return;
  end if;

  for r in
    select 'study' as kind, s.id, s.case_id, s.studier_id as author_id, c.ref_no, c.secret_code
      from studies s join protection_cases c on c.id = s.case_id
     where c.status = 'under_study' and s.submitted_at is null and s.superseded_at is null
       and business_days_between(s.created_at, now()) >= 1
    union all
    select 'assessment', a.id, a.case_id, a.evaluator_id, c.ref_no, c.secret_code
      from assessments a join protection_cases c on c.id = a.case_id
     where c.status = 'under_study' and a.submitted_at is null and a.superseded_at is null
       and business_days_between(a.created_at, now()) >= 1
  loop
    _ref := r.ref_no; _secret := r.secret_code;

    if r.kind = 'study' then
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'studier'
         and not exists (select 1 from studies s2 where s2.case_id = r.case_id and s2.studier_id = ur.user_id)
       order by (select count(*) from studies s3 where s3.studier_id = ur.user_id
                   and s3.submitted_at is null and s3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      update studies set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — ' || case when _next is null then 'لا بديل متاح' else 'أُعيد الإسناد' end
        where id = r.id and submitted_at is null and superseded_at is null;
      get diagnostics _hit = row_count;
      if _hit = 0 then continue; end if; -- اعتُمد في اللحظة الأخيرة — لا سحب

      if _next is not null then
        insert into studies (case_id, studier_id) values (r.case_id, _next);
        _re := _re + 1;
        perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — دراسة',
          _secret || ' — مهمة دراسة تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
        insert into audit_log (actor_id, action, target) values (null, 'reassign_study', _ref);
      else
        _ex := _ex + 1;
        perform _notify_deputies(r.case_id, 'عجز طاقم الدراسة',
          _secret || ' — تجاوزت مهمة الدراسة مهلتها ولا دارس متاحاً بلا صفٍّ على القضية. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'study_pool_exhausted', _ref);
      end if;

    else
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'evaluator'
         and not exists (select 1 from assessments a2 where a2.case_id = r.case_id and a2.evaluator_id = ur.user_id)
       order by (select count(*) from assessments a3 where a3.evaluator_id = ur.user_id
                   and a3.submitted_at is null and a3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      update assessments set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — ' || case when _next is null then 'لا بديل متاح' else 'أُعيد الإسناد' end
        where id = r.id and submitted_at is null and superseded_at is null;
      get diagnostics _hit = row_count;
      if _hit = 0 then continue; end if;

      if _next is not null then
        insert into assessments (case_id, evaluator_id) values (r.case_id, _next);
        _re := _re + 1;
        perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — تقييم',
          _secret || ' — مهمة تقييم تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
        insert into audit_log (actor_id, action, target) values (null, 'reassign_assessment', _ref);
      else
        _ex := _ex + 1;
        perform _notify_deputies(r.case_id, 'عجز طاقم التقييم',
          _secret || ' — تجاوزت مهمة التقييم مهلتها ولا مقيّم متاحاً بلا صفٍّ على القضية. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'assessment_pool_exhausted', _ref);
      end if;
    end if;
  end loop;

  return query select _re, _ex;
end $$;

revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;

-- بثّ القرار الحي (مصالحة حقيقة الخادم في الواجهة): إضافة جدولي الدورة للمنشور
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='council_decisions') then
    alter publication supabase_realtime add table council_decisions;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='council_votes') then
    alter publication supabase_realtime add table council_votes;
  end if;
end $$;
