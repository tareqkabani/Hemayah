-- 20260808000002_content_approval.sql — البتّ في طلبات تعديل المحتوى المقفل (الأمر 5)
-- مدير النظام يرفع (ccr_insert في 20260807000002) ورئيس المركز يبتّ هنا:
-- عند الاعتماد تُطبَّق الحمولة على الجدول الهدف داخل المعاملة نفسها
-- (SECURITY DEFINER — فالمقفل محجوبٌ عن الكتابة المباشرة بالسياسات عمداً)،
-- وكل شيء مُسجَّل في audit_log عبر محفّزات طبقة المحتوى + محفّز الطلب نفسه.

create or replace function public.content_change_decide(_id uuid, _approve boolean, _note text default null)
returns table(status text, target_kind text, target_key text)
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _ccr content_change_requests%rowtype;
  _item jsonb;
  _idx int := 0;
  _key text;
  _n int;
  _existing_keys text[];
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'board_chair') then
    raise exception 'غير مصرَّح: البتّ في تعديلات المحتوى لرئيس المركز حصراً.';
  end if;

  select * into _ccr from content_change_requests c where c.id = _id for update;
  if not found then raise exception 'طلب التعديل غير موجود.'; end if;
  if _ccr.status <> 'pending' then raise exception 'الطلب مبتوتٌ فيه (%).', _ccr.status; end if;

  if not _approve then
    if _note is null or btrim(_note) = '' then
      raise exception 'الرفض يتطلّب سبباً مكتوباً.';
    end if;
    update content_change_requests
       set status = 'rejected', decided_by = _uid, decided_at = now(), note = _note
     where id = _id;
    return query select 'rejected'::text, _ccr.target_kind, _ccr.target_key;
    return;
  end if;

  -- ══ تطبيق الحمولة على الجدول الهدف ══
  if _ccr.target_kind = 'reference_list' then
    -- الحمولة: {items:[{item_key,label,active,sort_order,...}]} — تحديث القائم
    -- بمفتاحه، وتوليد مفاتيح ثابتة للجديد (المفتاح لا يُخترع يدوياً).
    if jsonb_typeof(_ccr.payload -> 'items') <> 'array' then
      raise exception 'حمولة قائمة بلا items[]';
    end if;
    select coalesce(array_agg(item_key), '{}') into _existing_keys
      from reference_items where list_key = _ccr.target_key;
    select count(*) into _n from reference_items where list_key = _ccr.target_key;
    for _item in select * from jsonb_array_elements(_ccr.payload -> 'items') loop
      _idx := _idx + 1;
      _key := _item ->> 'item_key';
      if _key is not null and _key = any (_existing_keys) then
        update reference_items
           set label      = coalesce(_item ->> 'label', label),
               sort_order = _idx,
               active     = coalesce((_item ->> 'active')::boolean, active)
         where list_key = _ccr.target_key and item_key = _key;
      else
        -- بند جديد (أو مفتاح موضعي من الواجهة) — يولَّد له مفتاح ثابت
        loop
          _n := _n + 1;
          _key := _ccr.target_key || '_' || lpad(_n::text, 2, '0');
          exit when not (_key = any (_existing_keys));
        end loop;
        _existing_keys := _existing_keys || _key;
        insert into reference_items (list_key, item_key, label, sort_order, active)
        values (_ccr.target_key, _key, _item ->> 'label', _idx,
                coalesce((_item ->> 'active')::boolean, true));
      end if;
    end loop;

  elsif _ccr.target_kind = 'notification' then
    update notification_templates
       set subject    = coalesce(_ccr.payload ->> 'subject', subject),
           body       = coalesce(_ccr.payload ->> 'body', body),
           channels   = case when _ccr.payload ? 'channels'
                             then (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(_ccr.payload -> 'channels') x)
                             else channels end,
           updated_by = _uid, updated_at = now()
     where template_key = _ccr.target_key;
    if not found then raise exception 'قالب غير موجود: %', _ccr.target_key; end if;
    update notification_templates set variables = (
      select coalesce(array_agg(distinct m[1]), '{}')
      from regexp_matches(subject || ' ' || body, '\{([^}]+)\}', 'g') as m)
    where template_key = _ccr.target_key;

  elsif _ccr.target_kind = 'system_message' then
    update system_messages
       set body = coalesce(_ccr.payload ->> 'body', body),
           tone = coalesce(_ccr.payload ->> 'tone', tone),
           updated_at = now()
     where message_key = _ccr.target_key;
    if not found then raise exception 'رسالة نظام غير موجودة: %', _ccr.target_key; end if;

  elsif _ccr.target_kind = 'legal_text' then
    -- النص النظامي يُحتجّ به: نسخة جديدة بتاريخ سريان الاعتماد
    update legal_texts
       set body = coalesce(_ccr.payload ->> 'body', body),
           version = version + 1,
           effective_at = now()
     where text_key = _ccr.target_key;
    if not found then raise exception 'نص نظامي غير موجود: %', _ccr.target_key; end if;
  end if;

  update content_change_requests
     set status = 'approved', decided_by = _uid, decided_at = now(), note = _note
   where id = _id;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'content_change_approved_' || _ccr.target_kind, _ccr.target_key);

  return query select 'approved'::text, _ccr.target_kind, _ccr.target_key;
end $$;

comment on function public.content_change_decide is
  'بتّ رئيس المركز في طلبات تعديل المحتوى المقفل — الاعتماد يطبّق الحمولة ذرّياً ويُسجَّل بالمعتمِد.';

revoke execute on function public.content_change_decide(uuid, boolean, text) from public, anon;
grant execute on function public.content_change_decide(uuid, boolean, text) to authenticated;
