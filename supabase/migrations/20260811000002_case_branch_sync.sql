-- مزامنة فرع القضية مع فرع التوصية (سدّ فجوة REF-2026-6008 / REF-2026-4836)
--
-- الخلل: triage_decide وsubmit_entity_recommendation تُدرجان recommendations.branch_id
-- لكن لا تضبطان protection_cases.branch_id، بينما سياسة case_branch_read على
-- protection_cases موجَّهة بالفرع — فيرجع تضمين protection_cases في بوابة الجهات
-- المختصة فارغاً وتظهر البطاقة بـ«—». السدّ الرجعي 20260811000001 عالج البيانات
-- القائمة؛ هذه المهاجرة تمنع تكرار الفجوة في أي إحالة/رفع جديد.
--
-- النسختان أدناه منقولتان من أحدث تعريفٍ حيّ في القاعدة (درس «آخر نسخة دالة»)،
-- والتغيير الوحيد مُعلَّم بتعليق «مزامنة فرع القضية».

create or replace function public.triage_decide(_case_id uuid, _decision text, _reason text, _formal_check jsonb default '{}'::jsonb, _authority text default null::text, _entity_name text default null::text, _region text default null::text)
 returns table(status case_status)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  _uid uuid := auth.uid();
  _cur case_status;
  _new case_status;
  _ref text;
  _ent competent_entity;
  _branch uuid;
  _reason_label text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;

  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'triage' then raise exception 'case not in triage (%).', _cur; end if;

  -- شرط: محضر اتصالٍ واحد على الأقل قبل أي قرار (م — الفرز).
  if not exists (select 1 from contact_logs where case_id = _case_id) then
    raise exception 'محضر اتصالٍ واحد شرطٌ قبل القرار.';
  end if;

  _new := case _decision
            when 'study' then 'under_study'::case_status
            when 'refer' then 'referred'::case_status
            when 'close' then 'closed'::case_status
            else null end;
  if _new is null then raise exception 'قرار غير معروف: %', _decision; end if;
  if _decision = 'close' and (_reason is null or btrim(_reason) = '') then
    raise exception 'الحفظ يتطلّب سبباً موثّقاً (م10).';
  end if;

  -- ركن القبول الثاني: توصيةُ الجهة المختصة مستلَمةٌ فعلاً.
  if _decision = 'study'
     and not exists (select 1 from recommendations r
                      where r.case_id = _case_id and r.received_at is not null) then
    raise exception
      'لا يُقبل الطلب في البرنامج قبل ورود توصية الجهة المختصة — أحِل الطلب لطلب التوصية أوّلاً.';
  end if;

  update protection_cases
     set status = _new, officer_id = coalesce(officer_id, _uid), updated_at = now()
   where id = _case_id;

  insert into triage_reviews (case_id, officer_id, formal_check, decision, reason, authority)
  values (_case_id, _uid, coalesce(_formal_check, '{}'::jsonb), _decision, _reason, _authority);

  -- عند الإحالة: توصيةٌ مستحقّة خلال 5 أيام عمل (م9) مربوطةٌ بوحدة الاستقبال
  -- بحسب النموذج التنظيمي (#62) — ولا يُخترع فرعٌ غائب.
  if _decision = 'refer' then
    _ent := case _entity_name
              when 'النيابة العامة'               then 'prosecution'::competent_entity
              when 'رئاسة أمن الدولة'             then 'state_security'::competent_entity
              when 'وزارة الداخلية'               then 'moi'::competent_entity
              when 'هيئة الرقابة ومكافحة الفساد'  then 'nazaha'::competent_entity
              when 'وزارة العدل'                  then 'moj'::competent_entity
              else null end;
    if _ent is null then
      raise exception 'جهة مختصة غير معروفة: %', coalesce(_entity_name, '—');
    end if;

    select id into _branch from branches
     where entity = _ent and is_hq and coalesce(active, true)
     limit 1;
    if _branch is null and _region is not null then
      select id into _branch from branches
       where entity = _ent and region = _region::region_code and coalesce(active, true)
       limit 1;
    end if;
    if _branch is null then
      raise exception 'لا وحدة استقبال مبذورة للجهة % — تُدار وحدات الجهات بالهجرات لا بالإحالات.', _entity_name;
    end if;

    -- مزامنة فرع القضية: بدونها تحجب case_branch_read القضيةَ عن بوابة الجهة
    -- رغم ظهور توصيتها، فيرجع التضمين فارغاً وتظهر البطاقة بـ«—».
    update protection_cases set branch_id = _branch where id = _case_id;

    insert into recommendations (case_id, source_body, raised_at, due_at, branch_id)
    values (_case_id, _authority, now(), now() + interval '5 days', _branch);
  end if;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'triage_' || _decision, _ref);

  -- إشعار المتقدّم من القوالب — كل قرارٍ بقالبه، وسبب الإغلاق بنصّه المعتمد
  if _decision = 'study' then
    perform notify_from_template('n_triage_accept',
      jsonb_build_object('رقم_الطلب', _ref, 'مهلة_الإشعار', '3 أيام'),
      _case_id, 'triage', 'requests');
  elsif _decision = 'refer' then
    perform notify_from_template('n_referred',
      jsonb_build_object('رقم_الطلب', _ref, 'المهلة', '5 أيام عمل'),
      _case_id, 'triage', 'requests');
  else
    select label into _reason_label from reference_items
     where list_key = 'close' and item_key = _reason;
    if _reason = 'closeReq' then
      perform notify_from_template('n_close_req',
        jsonb_build_object('رقم_الطلب', _ref, 'تاريخ_القرار', to_char(now(), 'YYYY-MM-DD')),
        _case_id, 'triage', 'requests');
    else
      perform notify_from_template('n_close_admin',
        jsonb_build_object('رقم_الطلب', _ref, 'تاريخ_القرار', to_char(now(), 'YYYY-MM-DD'),
          'سبب_الإغلاق', coalesce(_reason_label, _reason)),
        _case_id, 'triage', 'requests');
    end if;
  end if;

  return query select _new;
end $function$;

create or replace function public.submit_entity_recommendation(_applicant_role text, _category app_category, _entity text, _crime text, _reason text, _case_no text, _provide boolean, _details jsonb default '{}'::jsonb)
 returns table(case_id uuid, ref_no text, secret_code text)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
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

  -- مزامنة فرع القضية: القضية تولد على فرع الرافع نفسه حتى تراها case_branch_read.
  insert into protection_cases (ref_no, secret_code, category, status, source, branch_id)
  values (_ref, _sec, _category, 'triage', 'local', _branch)
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
end $function$;
