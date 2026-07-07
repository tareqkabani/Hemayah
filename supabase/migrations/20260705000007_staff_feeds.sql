-- ============================================================
--  (ج) إشعارات/رسائل الموظّفين على Supabase + RLS + Realtime
--  إشعاراتٌ موسومةٌ بالسلطة (عزلٌ نظيف) · رسائل خيط الجهة بـRLS عبر الإحالة
--  · مُشغّلٌ يولّد إشعار موظّفٍ حقيقيّاً عند وصول إحالةٍ جديدة.
-- ============================================================

-- 1) وسم الإشعار بالسلطة: null = إشعار المستفيد (مستوى القضيّة)؛ قيمة = إشعار موظّفي تلك السلطة.
alter table notifications add column if not exists authority referral_authority;

-- ── RLS الإشعارات ──
-- المستفيد: إشعارات قضيّته العامّة فقط (بلا سلطة) — لئلّا يرى إشعارات الموظّفين الداخليّة.
drop policy if exists seeker_notif_read on notifications;
create policy seeker_notif_read on notifications for select using (
  authority is null
  and exists (select 1 from protection_cases c where c.id = notifications.case_id and c.submitted_by = auth.uid()));
drop policy if exists seeker_notif_mark on notifications;
create policy seeker_notif_mark on notifications for update using (
  authority is null
  and exists (select 1 from protection_cases c where c.id = notifications.case_id and c.submitted_by = auth.uid()))
  with check (true);

-- الموظّف: إشعارات سلطته فقط.
drop policy if exists staff_notif_read on notifications;
create policy staff_notif_read on notifications for select using (
  authority is not null and has_authority(authority));
drop policy if exists staff_notif_mark on notifications;
create policy staff_notif_mark on notifications for update using (
  authority is not null and has_authority(authority)) with check (true);

-- ── RLS الرسائل للموظّفين ── قضايا ضمن سلطتهم (لهم إحالةٌ فيها) · خيط الجهة 'body'.
drop policy if exists staff_msg_read on messages;
create policy staff_msg_read on messages for select using (
  exists (select 1 from referrals r where r.case_id = messages.case_id and has_authority(r.authority)));
drop policy if exists staff_msg_write on messages;
create policy staff_msg_write on messages for insert with check (
  thread = 'body'
  and exists (select 1 from referrals r where r.case_id = messages.case_id and has_authority(r.authority)));

-- 2) مُشغّل: إشعار موظّفي السلطة حقيقيّاً عند وصول إحالةٍ جديدة.
create or replace function public._notify_staff_new_referral() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into notifications (case_id, authority, type, title, body, target_tab, sent_at)
  values (new.case_id, new.authority, 'referral_in',
    'إحالةٌ جديدة بانتظار الإسناد',
    'وصلت إحالةُ تدبير (' || coalesce(new.service::text, '') || ') — راجِعها وأسنِدها لمختص.',
    'requests', now());
  return new;
end $$;
drop trigger if exists trg_notify_staff_new_referral on referrals;
create trigger trg_notify_staff_new_referral after insert on referrals
  for each row execute function public._notify_staff_new_referral();

-- 3) الموظّف يقرأ قضايا سلطته (الرمز/الفئة/المنطقة) — لها إحالةٌ في سلطته.
drop policy if exists staff_case_read on protection_cases;
create policy staff_case_read on protection_cases for select using (
  exists (select 1 from referrals r where r.case_id = protection_cases.id and has_authority(r.authority)));
