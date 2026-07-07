-- ============================================================
--  بوابة موظف المركز — التنفيذ والتجديد (ربط قاعدة)
--  قرارات القبول (accepted) تتدفّق للتنفيذ؛ توقيع الاتفاقية (م11) يُفعّل الحماية.
-- ============================================================

-- سياسة قراءة مرحلة التنفيذ (المنفّذ case_officer يرى المقبولين/المُفعّلين).
create policy co_execution_read on protection_cases for select using (
  has_role(auth.uid(),'case_officer') and status in ('accepted','signed','active','under_review','terminating'));
create policy co_exec_req_read on protection_requests for select using (
  has_role(auth.uid(),'case_officer')
  and exists (select 1 from protection_cases c where c.id = protection_requests.case_id
              and c.status in ('accepted','signed','active','under_review','terminating')));

-- ── توقيع اتفاقية الحماية (م11) → تفعيل الحماية ──
create or replace function public.sign_agreement(_case_id uuid)
returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur case_status; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;
  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur not in ('accepted','signed') then raise exception 'الحالة ليست مقبولةً بعدُ (%).', _cur; end if;

  update protection_cases set status = 'active', updated_at = now() where id = _case_id;

  insert into protection_documents (case_id, signed_at)
  values (_case_id, now());

  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'agreement', 'فُعّلت حمايتك',
    'وُقّعت اتفاقية الحماية وفُعّلت التدابير؛ ستبدأ المتابعة الدورية (م11).', 'requests', now());

  insert into audit_log (actor_id, action, target) values (_uid, 'sign_agreement', _ref);
  return query select 'active'::case_status;
end $$;
grant execute on function public.sign_agreement(uuid) to authenticated;
