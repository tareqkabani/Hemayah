-- ============================================================
--  بوابة موظف المركز — الاستقبال الورقيّ (ربط قاعدة)
--  دالة تقديم ورقيّ (SECURITY DEFINER): يُدخلها موظف المركز نيابةً عن طالب/جهة،
--  فتُنشئ قضيةً في طابور الفرز (channel='paper', غير موثّقة) + تدقيق + رمز سرّيّ.
--  تُقيَّد بدور case_officer/hotline_operator (بخلاف submit_protection_request العامّة).
-- ============================================================

create sequence if not exists paper_ref_seq    start 6001;
create sequence if not exists paper_secret_seq start 700;

create or replace function public.submit_paper_intake(
  _source         text,          -- 'seeker' | 'entity'
  _applicant_role text,
  _category       app_category,
  _entity         text,
  _crime          text,
  _reason         text,
  _prior_submit   boolean,
  _case_no        text,
  _details        jsonb default '{}'::jsonb
) returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _cid uuid;
  _ref text;
  _sec text;
  _yr  text := extract(year from now())::text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'case_officer') or has_role(_uid, 'hotline_operator')) then
    raise exception 'forbidden: not intake officer';
  end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;

  _ref := 'REF-' || _yr || '-' || nextval('paper_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('paper_secret_seq')::text, 4, '0');

  -- قضية في طابور الفرز (بلا officer_id — تُسنَد عند الفرز).
  insert into protection_cases (ref_no, secret_code, category, status, source)
  values (_ref, _sec, _category, 'triage', 'local')
  returning id into _cid;

  -- تفاصيل الطلب — قناة ورقيّة، هوية غير موثّقة (تُفعَّل عبر نفاذ لاحقاً).
  insert into protection_requests (case_id, applicant_role, channel, details)
  values (_cid, _applicant_role, 'paper',
          coalesce(_details, '{}'::jsonb)
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no, 'paper_source', _source,
                                  'intake_by', _uid, 'verified', false));

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_paper_intake_' || _source, _ref);

  return query select _cid, _ref, _sec;
end $$;

grant execute on function public.submit_paper_intake(text, text, app_category, text, text, text, boolean, text, jsonb) to authenticated;
