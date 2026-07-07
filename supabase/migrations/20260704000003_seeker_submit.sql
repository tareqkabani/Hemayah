-- ============================================================
--  منصّة «حماية» — تقديم الطلب من بوابة المستفيد (M4)
--  ربط الحالة بالمُقدِّم + دالة تقديم آمنة (توليد رمز سرّي + تدقيق) + RLS للمستفيد.
-- ============================================================

-- ربط الحالة بطالب الحماية المُقدِّم، وتفاصيل الطلب.
alter table protection_cases    add column if not exists submitted_by uuid references auth.users(id);
alter table protection_requests add column if not exists details jsonb;
create index if not exists idx_cases_submitted_by on protection_cases (submitted_by);

-- تسلسلات لضمان تفرّد المرجع والرمز السرّي.
create sequence if not exists seeker_ref_seq    start 4821;
create sequence if not exists seeker_secret_seq start 481;

-- دالة التقديم — SECURITY DEFINER: تُنشئ الحالة والطلب والتدقيق ذرّياً وتعيد المرجع/الرمز.
create or replace function public.submit_protection_request(
  _applicant_role text,
  _category       app_category,
  _entity         text,
  _crime          text,
  _reason         text,
  _prior_submit   boolean,
  _case_no        text,
  _details        jsonb default '{}'::jsonb
) returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _cid uuid;
  _ref text;
  _sec text;
  _yr  text := extract(year from now())::text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;

  _ref := 'REF-' || _yr || '-' || nextval('seeker_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('seeker_secret_seq')::text, 4, '0');

  insert into protection_cases (ref_no, secret_code, category, status, source, submitted_by)
  values (_ref, _sec, _category, 'triage', 'local', _uid)
  returning id into _cid;

  insert into protection_requests (case_id, applicant_role, channel, details)
  values (_cid, _applicant_role, 'seeker',
          coalesce(_details, '{}'::jsonb)
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no));

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_protection_request', _ref);

  return query select _cid, _ref, _sec;
end $$;

grant execute on function public.submit_protection_request(text, app_category, text, text, text, boolean, text, jsonb) to authenticated;

-- ── سياسات المستفيد: يرى طلباته فقط ──
create policy seeker_case_read on protection_cases for select using (submitted_by = auth.uid());
create policy seeker_req_read  on protection_requests for select using (
  exists (select 1 from protection_cases c where c.id = protection_requests.case_id and c.submitted_by = auth.uid()));
