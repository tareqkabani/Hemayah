-- ============================================================
--  تدقيق فتح المرفقات لقرّاء حزمة القرار (م15/16)
--  كان record_attachment_open حكراً على المُسنَد إليه (دارس/مقيّم)؛
--  وحزمة الاطّلاع في بوابة القرار تعرض المستندَين الكاملين بمرفقاتهما
--  للمعدّ والقيادة والأعضاء — فكل فتحٍ منهم يجب أن يُسجَّل كذلك،
--  ويبقى غير المخوَّل (كطالب الحماية أو جهة خارجية) مرفوضاً.
-- ============================================================

create or replace function public.record_attachment_open(_case_id uuid, _doc text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(btrim(_doc),'') = '' then raise exception 'مستند غير محدّد'; end if;
  if not (
    is_assigned_study(_case_id) or is_assigned_assessment(_case_id)
    or has_role(_uid, 'case_officer')                       -- معدّ القرار/ضابط الحالة
    or has_role(_uid, 'board_member')                       -- أعضاء المجلس
    or has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair') -- القيادة
  ) then
    raise exception 'forbidden: not assigned';
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  insert into audit_log (actor_id, action, target)
  values (_uid, 'attachment_open', _ref || ' · ' || left(btrim(_doc), 120));
end $$;
