-- ============================================================
--  بوابة الجهات المختصّة — رفع التوصية (ربط قاعدة)
--  الجهة تُصدر توصيةً بشأن طلب حماية → قضيةٌ في طابور الفرز (channel='body').
--  مقيّدة بدور competent_body.
-- ============================================================

create sequence if not exists entity_ref_seq    start 7001;
create sequence if not exists entity_secret_seq start 800;

create or replace function public.submit_entity_recommendation(
  _applicant_role text,
  _category       app_category,
  _entity         text,
  _crime          text,
  _reason         text,
  _case_no        text,
  _provide        boolean,
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
  if not has_role(_uid, 'competent_body') then raise exception 'forbidden: not competent_body'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
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

  -- توصيةٌ مستحقّة خلال 5 أيام عمل (م5/3)
  insert into recommendations (case_id, source_body, decision, raised_at, due_at)
  values (_cid, _entity, case when _provide then 'توفير' else 'عدم توفير' end, now(), now() + interval '5 days');

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_entity_recommendation', _ref);

  return query select _cid, _ref, _sec;
end $$;

grant execute on function public.submit_entity_recommendation(text, app_category, text, text, text, text, boolean, jsonb) to authenticated;
