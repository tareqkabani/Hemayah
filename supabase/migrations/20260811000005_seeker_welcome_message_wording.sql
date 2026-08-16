-- ============================================================
--  صياغة رسالة الترحيب الأولى لطالب الحماية
--
--  الرسالة التي يفتح بها «منسّق الحماية» قناة المركز فور التقديم كانت:
--    «… سنتواصل معك إن لزم استيفاء.»
--  والصياغة المعتمدة:
--    «… سنتواصل معك إن عند الحاجة»
--
--  الدالة تُعاد كتابتها كاملةً عن نسختها الأخيرة 20260810000003
--  (subject_intake_sync) — لا 20260810000002 ولا 20260808000006
--  (درس «آخر نسخة دالة»): لا فرق عنها سوى نصّ الرسالة أدناه.
--
--  الرسائل المكتوبة سلفاً لا تُمسّ — النصّ محفوظٌ في صفّه وقت إنشائه،
--  والتعديل يسري على الطلبات الجديدة فقط.
-- ============================================================

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
  _ec    jsonb;
  _meta  jsonb;
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

  -- جهة الطوارئ لا تسكن details نصّاً صريحاً — تُعترض هنا وتُشفَّر في جدولها (م15/16).
  _ec      := _details->'emergency_contact';
  _details := coalesce(_details, '{}'::jsonb) - 'emergency_contact';

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
          _details
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no));

  perform public._store_emergency_contact(_cid, _ec);

  -- هوية نفاذ من الجلسة إلى موطنها subjects (مشفّرةً) — بوسم live لأنها موثّقة.
  select u.raw_user_meta_data into _meta from auth.users u where u.id = _uid;
  perform public._store_subject(_cid,
    jsonb_build_object('name', _meta->>'name', 'nid', _meta->>'national_id'), 'live');

  insert into messages (case_id, thread, direction, body, sender_label)
  values (_cid, 'center', 'in',
          'مرحباً، تسلّمنا طلبك ونراجع بياناته في مرحلة الفرز المبدئي. سنتواصل معك إن عند الحاجة',
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
