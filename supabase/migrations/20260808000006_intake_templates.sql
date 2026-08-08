-- 20260808000006_intake_templates.sql — إشعارات التقديم والفرز من القوالب (المرحلة 3)
-- إتمام تغطية محرّك الإشعارات بعد دمج #62/#63 اللذين كانا يجمّدان هذه الدوال:
--   التقديم الإلكتروني → n_received · قرارات الفرز → n_triage_accept /
--   n_referred (جديد) / n_close_req / n_close_admin · إحالة التوصية للجهة →
--   n_ent_req (بدل نصّ مُشغّل التغذية). النصوص من notification_templates
--   حصراً — تحريرها من بوابة مدير النظام يسري بلا نشر.
-- المؤجَّل الموثَّق: n_paper يتطلّب قناة SMS لغير المفعَّلين (لا حساب بعد) —
-- يُبنى مع تكامل القنوات؛ وn_contact مع محاضر الاتصال.

-- ══ 1) مواءمة القوالب ══
-- n_received: النص الحرفي الحالي يسلّم الرمز السري في متن الإشعار — يُحفظ ذلك
update notification_templates set
  body = 'وصلنا طلبكم برقم {رقم_الطلب} بتاريخ {تاريخ_التقديم}، ورمزكم السري ({الرمز_السري}) فاحتفظوا به. الطلب قيد الفرز المبدئي، وستصلكم نتيجته خلال {مهلة_الفرز}. يمكنكم متابعة الطلب من صفحة «طلباتي».'
where template_key = 'n_received';

-- قالب جديد: إشعار المتقدّم بإحالة طلبه للجهة (لم يكن له قالب في الكتالوج)
insert into notification_templates (template_key, title, category, trigger_desc, recipient, channels, legal_ref, subject, body) values
('n_referred','إحالة الطلب للجهة المختصة','intake','عند قرار الفرز بالإحالة لطلب توصية','طالب الحماية','{platform,app}','م9·م10',
 'أُحيل طلبكم {رقم_الطلب} إلى الجهة المختصة',
 'أُحيل طلبكم {رقم_الطلب} إلى الجهة المختصة لرفع توصيتها خلال {المهلة}. تُستكمل دراسة الطلب فور ورودها، وتصلكم المستجدات أولاً بأول.')
on conflict (template_key) do nothing;

update notification_templates set variables = (
  select coalesce(array_agg(distinct m[1]), '{}')
  from regexp_matches(subject || ' ' || body, '\{([^}]+)\}', 'g') as m)
where template_key in ('n_received','n_referred');

-- ══ 2) التقديم الإلكتروني — n_received ══
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

  -- الجهة المختصة إلزامية ⇔ سبق التقديم إليها؛ وعند «لا» تُصفَّر فلا تُخزَّن قيمة يتيمة.
  if _prior_submit is true and (_entity is null or btrim(_entity) = '') then
    raise exception 'اسم الجهة المختصة مطلوب عند سبق التقديم إليها.';
  end if;
  if _prior_submit is distinct from true then
    _entity := null;
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

  -- إشعار الاستلام من القالب (كان نصاً حرفياً)
  perform notify_from_template('n_received',
    jsonb_build_object('رقم_الطلب', _ref, 'الرمز_السري', _sec,
      'تاريخ_التقديم', to_char(now(), 'YYYY-MM-DD'), 'مهلة_الفرز', '5 أيام عمل'),
    _cid, 'submission', 'requests');

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_protection_request', _ref);

  return query select _cid, _ref, _sec;
end $$;

-- ══ 3) قرارات الفرز — القوالب بدل النصوص الثلاثة المضمّنة ══
create or replace function public.triage_decide(
  _case_id uuid,
  _decision text,
  _reason text,
  _formal_check jsonb default '{}'::jsonb,
  _authority text default null,
  _entity_name text default null,
  _region text default null
)
returns table(status case_status)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
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
end $$;

grant execute on function public.triage_decide(uuid, text, text, jsonb, text, text, text) to authenticated;
revoke execute on function public.triage_decide(uuid, text, text, jsonb, text, text, text) from public, anon;

-- ══ 4) إحالة التوصية للجهة — n_ent_req بدل نصّ مُشغّل التغذية ══
create or replace function public._notify_competent_new_rec() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare _sec text;
begin
  select secret_code into _sec from protection_cases where id = new.case_id;
  perform notify_from_template('n_ent_req',
    jsonb_build_object('الرمز_السري', coalesce(_sec, ''),
      'المهلة', '5 أيام عمل',
      'تاريخ_الاستحقاق', to_char(coalesce(new.due_at, now() + interval '5 days'), 'YYYY-MM-DD')),
    new.case_id, 'rec_in', 'incoming', null, 'competent'::referral_authority);
  return new;
end $$;
