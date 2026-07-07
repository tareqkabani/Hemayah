-- ============================================================
--  إصلاح تكرارٍ لا نهائيّ في RLS: staff_case_read(protection_cases) يشير إلى grievances،
--  وسياسة grievance_seeker على grievances تشير إلى protection_cases → حلقة.
--  الحلّ: دوالّ SECURITY DEFINER (تتجاوز RLS في الاستعلام الداخليّ) تكسر الحلقة — كـ has_authority.
-- ============================================================

create or replace function public.owns_case(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from protection_cases c where c.id = _case_id and c.submitted_by = auth.uid());
$$;

create or replace function public.case_has_grievance(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from grievances g where g.case_id = _case_id);
$$;

-- سياسات طالب الحماية على grievances عبر الدالّة (لا إشارة مباشرة لـ protection_cases).
drop policy if exists grievance_seeker_insert on grievances;
create policy grievance_seeker_insert on grievances for insert with check (owns_case(case_id));
drop policy if exists grievance_seeker_read on grievances;
create policy grievance_seeker_read on grievances for select using (owns_case(case_id));

-- staff_case_read: فرع التظلّم عبر الدالّة (لا إشارة مباشرة لـ grievances).
drop policy if exists staff_case_read on protection_cases;
create policy staff_case_read on protection_cases for select using (
  exists (select 1 from referrals r where r.case_id = protection_cases.id and has_authority(r.authority))
  or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = protection_cases.id))
  or (has_authority('competent') and exists (select 1 from recommendations rc where rc.case_id = protection_cases.id))
  or ((has_authority('technical') or has_authority('ag')) and case_has_grievance(protection_cases.id)));
