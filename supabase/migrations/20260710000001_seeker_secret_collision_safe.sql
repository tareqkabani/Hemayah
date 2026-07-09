-- ============================================================
--  منصّة «حماية» — تحصين توليد الرمز السرّي/المرجع ضدّ التصادم (M4، إصلاح سلامة)
--  الجذر: submit_protection_request كان يولّد C-YYYY-<seq> ويُدرج مباشرةً؛ لكن
--  الرمز السرّي مشتركٌ في فضاءٍ واحد مع قضايا أخرى (بذور العرض، الاستقبال الورقي،
--  قضايا الموظفين) لا تمرّ بالتسلسل — فأوّل تقديمٍ حقيقيّ يتصادم مع رمزٍ مبذور
--  (شوهد فعليّاً: C-2026-0481). الإصلاح: حلقة إعادة توليد عند unique_violation،
--  فتصمد الدالة مهما كانت الرموز الموجودة وتحت التزامن.
--  ملاحظة: تُعاد كتابة الجسم كاملاً (يتضمّن الرسالة/الإشعار/التدقيق) مطابقاً للنسخة الحيّة.
-- ============================================================

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
language plpgsql security definer set search_path = public, extensions as $$
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

  -- توليد مرجعٍ ورمزٍ سرّيٍّ فريدين مع إعادة المحاولة عند أيّ تصادم (بذور/تدفّقات أخرى/تزامن).
  loop
    _tries := _tries + 1;
    _ref := 'REF-' || _yr || '-' || nextval('seeker_ref_seq')::text;
    _sec := 'C-'  || _yr || '-' || lpad(nextval('seeker_secret_seq')::text, 4, '0');
    begin
      insert into protection_cases (ref_no, secret_code, category, status, source, submitted_by)
      values (_ref, _sec, _category, 'triage', 'local', _uid)
      returning id into _cid;
      exit;  -- نجح الإدراج بمُعرّفات فريدة
    exception when unique_violation then
      if _tries >= 100 then
        raise exception 'تعذّر توليد رمزٍ سرّيٍّ فريد بعد % محاولة', _tries;
      end if;
      -- تُعاد الحلقة بقيَم تسلسلٍ جديدة (nextval غير تراجعيّ فلا يتكرّر الرمز)
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

grant execute on function public.submit_protection_request(text, app_category, text, text, text, boolean, text, jsonb) to authenticated;
