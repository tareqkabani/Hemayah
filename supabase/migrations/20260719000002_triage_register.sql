-- ============================================================
--  بوابة الفرز الموحّدة — السجلّ الكامل والمراسلات والمقروئية (19 يوليو 2026)
--  1) سجلّ الفرز للموظف: يرى دورة الطلب كاملةً لا الوارد فقط
--     (triage · referred · under_study · closed) — القرارات تبقى محكومة
--     بآلة الحالة في triage_decide (لا قرار إلا على 'triage').
--  2) توصيات مرحلة الفرز مقروءة للموظف (القرار الثاني «replied» يحتاجها).
--  3) مراسلات الموظف على القضية: خيط 'center' مع طالب الحماية
--     (direction من منظور المستفيد: in = من المركز) + خيط 'coord' الجديد
--     مع ضابط اتصال الجهة (out = من المركز، in = من الجهة).
--  4) نتيجة محضر الاتصال (تم الرد / لم يُرَد) عمودٌ فعليّ.
--  5) notification_reads: مقروئية الإشعارات المشتقة تصمد عبر الأجهزة.
--  6) recommendations إلى Realtime (تحديث «وردت التوصية» حيّاً).
-- ============================================================

-- مساعدا حالةٍ SECURITY DEFINER — يقطعان دورة RLS بين القضايا والتوصيات
-- (staff_case_read على القضايا تقرأ التوصيات؛ فلا يجوز لسياسات التوصيات
--  ونحوها أن تعود للقضايا عبر RLS — الدرس المعياري في المشروع).
create or replace function public.case_triage_register(_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from protection_cases c
    where c.id = _case_id and c.status in ('triage', 'referred', 'under_study', 'closed'));
$$;
create or replace function public.case_triage_active(_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from protection_cases c
    where c.id = _case_id and c.status in ('triage', 'referred', 'under_study'));
$$;

-- ── 1) سجلّ الفرز الكامل ──
drop policy if exists co_triage_inbox on protection_cases;
create policy co_triage_inbox on protection_cases for select using (
  has_role(auth.uid(), 'case_officer')
  and status in ('triage', 'referred', 'under_study', 'closed'));

drop policy if exists co_triage_req on protection_requests;
create policy co_triage_req on protection_requests for select using (
  has_role(auth.uid(), 'case_officer') and case_triage_register(case_id));

-- ── 2) توصيات مرحلة الفرز ──
drop policy if exists co_rec_triage_read on recommendations;
create policy co_rec_triage_read on recommendations for select using (
  has_role(auth.uid(), 'case_officer') and case_triage_register(case_id));

-- ── 3) مراسلات الموظف على القضية ──
alter type msg_thread add value if not exists 'coord';

drop policy if exists co_msg_read on messages;
create policy co_msg_read on messages for select using (
  has_role(auth.uid(), 'case_officer') and case_triage_register(case_id));

drop policy if exists co_msg_write on messages;
create policy co_msg_write on messages for insert with check (
  has_role(auth.uid(), 'case_officer') and case_triage_active(case_id));

-- القيادة (نائب/رئيس): اطّلاع على السجلّ ومراسلاته دون كتابة
drop policy if exists lead_triage_read on protection_cases;
create policy lead_triage_read on protection_cases for select using (
  (has_role(auth.uid(), 'deputy_chair') or has_role(auth.uid(), 'board_chair'))
  and status in ('triage', 'referred', 'under_study', 'closed'));
drop policy if exists lead_triage_req on protection_requests;
create policy lead_triage_req on protection_requests for select using (
  (has_role(auth.uid(), 'deputy_chair') or has_role(auth.uid(), 'board_chair'))
  and case_triage_register(case_id));
drop policy if exists lead_rec_read on recommendations;
create policy lead_rec_read on recommendations for select using (
  has_role(auth.uid(), 'deputy_chair') or has_role(auth.uid(), 'board_chair'));
drop policy if exists lead_msg_read on messages;
create policy lead_msg_read on messages for select using (
  has_role(auth.uid(), 'deputy_chair') or has_role(auth.uid(), 'board_chair'));
drop policy if exists lead_contact_read on contact_logs;
create policy lead_contact_read on contact_logs for select using (
  has_role(auth.uid(), 'deputy_chair') or has_role(auth.uid(), 'board_chair'));
drop policy if exists lead_review_read on triage_reviews;
create policy lead_review_read on triage_reviews for select using (
  has_role(auth.uid(), 'deputy_chair') or has_role(auth.uid(), 'board_chair'));

-- ── 4) نتيجة محضر الاتصال ──
alter table contact_logs add column if not exists result text not null default 'answered'
  check (result in ('answered', 'noanswer'));

-- ── 5) مقروئية الإشعارات المشتقة ──
create table if not exists notification_reads (
  user_id   uuid not null references auth.users(id) on delete cascade,
  notif_key text not null,
  read_at   timestamptz not null default now(),
  primary key (user_id, notif_key)
);
alter table notification_reads enable row level security;
drop policy if exists notif_reads_rw on notification_reads;
create policy notif_reads_rw on notification_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on notification_reads to authenticated;

-- ── 6) التوصيات إلى Realtime ──
do $$ begin
  if not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recommendations') then
    alter publication supabase_realtime add table recommendations;
  end if;
end $$;
alter table recommendations replica identity full;
