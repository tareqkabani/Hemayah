-- ============================================================
--  الإدارة الأمنية — رفع توصيات دورة الحياة للمجلس (م18)
--  الضابط/المدير يرفع (continue/modify/close) → lifecycle_reviews → يبتّ المجلس.
-- ============================================================

alter table public.lifecycle_reviews enable row level security;

-- الإدارة الأمنية (سلطة security) تقرأ/تكتب مراجعاتها؛ قيادة المجلس تقرأ الكل للبتّ.
drop policy if exists lr_security_rw on public.lifecycle_reviews;
create policy lr_security_rw on public.lifecycle_reviews for select using (has_authority('security'));
drop policy if exists lr_council_read on public.lifecycle_reviews;
create policy lr_council_read on public.lifecycle_reviews for select using (
  has_role(auth.uid(),'board_member') or has_role(auth.uid(),'board_chair') or has_role(auth.uid(),'deputy_chair'));

-- ── رفع توصية دورة حياة للمجلس (يفرض سلطة security) ──
create or replace function public.raise_lifecycle_review(
  _case_id uuid, _proposal review_outcome, _rationale text)
returns lifecycle_reviews
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row lifecycle_reviews; _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_authority('security') then raise exception 'forbidden: not security authority'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  if _ref is null then raise exception 'case not found'; end if;

  -- تحديث توصية قائمة (raised) لنفس القضية أو إنشاء جديدة.
  update lifecycle_reviews
     set proposal = _proposal, rationale = _rationale, status = 'raised', officer_id = _uid, created_at = now()
   where case_id = _case_id and status = 'raised'
   returning * into _row;
  if _row.id is null then
    insert into lifecycle_reviews (case_id, officer_id, proposal, rationale, status)
    values (_case_id, _uid, _proposal, _rationale, 'raised')
    returning * into _row;
  end if;

  -- إشعار المجلس (يظهر في مرحلة القرار/القيادة).
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'lifecycle', 'توصية دورة حياة من الإدارة الأمنية (م18)',
    'رُفعت توصية ('|| _proposal ||') للبتّ من المجلس: ' || coalesce(_rationale,''), 'notifications', now());

  insert into audit_log (actor_id, action, target)
  values (_uid, 'raise_lifecycle_'|| _proposal::text, _ref);
  return _row;
end $$;
grant execute on function public.raise_lifecycle_review(uuid, review_outcome, text) to authenticated;
