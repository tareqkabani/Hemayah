-- ============================================================
--  منصّة «حماية» — توقيع المستفيد لاتفاقية الحماية بنفسه (عبر نفاذ)
--  الجذر: sign_agreement الموجودة مقصورةٌ على case_officer، بينما تصميم بوابة
--  المستفيد أنّ **صاحب القضية** يوقّع اتفاقيّته عبر نفاذ لتفعيل الحماية. هذه دالةٌ
--  موازية owner-scoped: تتحقّق من مِلكيّة القضية (submitted_by) وحالتها (accepted)،
--  ثمّ تفعّل الحماية وتُصدر الوثيقة والإشعار والتدقيق — بنفس أثر النسخة الموظّفيّة.
-- ============================================================

create or replace function public.seeker_sign_agreement(_case_id uuid)
returns table(status case_status)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _cur case_status;
  _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;

  -- صاحب القضية فقط يوقّع اتفاقيّته
  select c.status, c.ref_no into _cur, _ref
  from protection_cases c
  where c.id = _case_id and c.submitted_by = _uid
  for update;
  if _cur is null then raise exception 'القضية غير موجودة أو ليست لك'; end if;
  if _cur not in ('accepted','signed') then
    raise exception 'لا يمكن التوقيع: حالة الطلب ليست «مقبولاً» (%).', _cur;
  end if;

  update protection_cases set status = 'active', updated_at = now() where id = _case_id;

  insert into protection_documents (case_id, signed_at) values (_case_id, now());

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'agreement', 'فُعّلت حمايتك',
    'وُقّعت اتفاقية الحماية عبر نفاذ وفُعّلت التدابير؛ ستبدأ المتابعة الدورية (م11).', 'requests', now());

  insert into audit_log (actor_id, action, target) values (_uid, 'seeker_sign_agreement', _ref);

  return query select 'active'::case_status;
end $$;

grant execute on function public.seeker_sign_agreement(uuid) to authenticated;
