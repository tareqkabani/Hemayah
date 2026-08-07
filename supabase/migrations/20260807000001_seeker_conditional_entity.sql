-- ============================================================
--  منصّة «حماية» — الجهة المختصة شرطيةٌ بسبق التقديم (ملحق تصميم 2026-08-07)
--  القاعدة: «اسم الجهة المختصة» إلزاميٌّ فقط عندما يجيب مقدّم الطلب بـ«نعم»
--  على «هل سبق التقديم إلى الجهة المختصة؟» — وإلا فلا جهة تُخزَّن أصلاً
--  (الفارز يحدّد الجهة والفرع لاحقاً في خطوة الإحالة، triage_decide).
--  يُطبَّق على ثلاث طبقات: الواجهة (إظهار شرطي) + التحقق الخادمي هنا +
--  قيد فحصٍ على المخطط يصمد أمام أي مسار إدخالٍ آخر.
-- ============================================================

-- (أ) قيد المخطط: prior_submit = true ⇒ جهةٌ غير فارغة في التفاصيل.
--  ملاحظتان: entity تُخزَّن داخل details (jsonb) لا كعمودٍ مستقل؛ وبذور
--  العرض التاريخية تكتب المفتاح باسم prior_entity — يُقبل المفتاحان.
--  المقارنة نصّية ('true') لا cast — كي لا يرمي القيد خطأ تحويلٍ إن ورد
--  المفتاح بصيغةٍ غير منطقية في بياناتٍ قديمة.
alter table public.protection_requests
  add constraint protection_requests_entity_when_prior_chk
  check (
    (details->>'prior_submit') is distinct from 'true'
    or nullif(btrim(coalesce(details->>'entity', details->>'prior_entity')), '') is not null
  );

-- (ب) التحقق الخادمي في دالة التقديم (إعادة كتابة نسخة 20260727000004 كاملةً
--  مع فحص الشرطية وتصفير الجهة اليتيمة).
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

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_cid, 'submission', 'تم استلام طلبك',
          'سُجِّل طلبك ' || _ref || ' وأُسند له رمز سري (' || _sec || '). سيُحال إلى الجهة المختصة لرفع التوصية خلال 5 أيام.',
          'requests', now());

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_protection_request', _ref);

  return query select _cid, _ref, _sec;
end $$;
