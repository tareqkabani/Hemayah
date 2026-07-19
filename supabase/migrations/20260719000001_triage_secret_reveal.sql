-- ============================================================
--  بوابة الفرز الموحّدة (apps/triage) — 19 يوليو 2026
--  توسعة record_secret_reveal: كشف الرمز حدثُ تدقيقٍ أيضاً لموظف الفرز
--  (القائمة المشتركة — أي موظف فرزٍ يعالج أي طلب) وللقيادة (اطّلاع وإشراف)،
--  إضافةً إلى الدارس/المقيّم المُسنَد كما كانت. م15/16 — مبدأ الحاجة إلى المعرفة
--  يبقى إجرائياً، وكل كشفٍ منسوبٌ لصاحبه في audit_log.
-- ============================================================

create or replace function public.record_secret_reveal(_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (
    is_assigned_study(_case_id) or is_assigned_assessment(_case_id)
    or has_role(_uid, 'case_officer')
    or has_role(_uid, 'deputy_chair') or has_role(_uid, 'board_chair')
  ) then
    raise exception 'forbidden: not assigned';
  end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  if _ref is null then raise exception 'قضية غير موجودة.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'secret_reveal', _ref);
end $$;
