-- ============================================================
--  توسعة staff_case_read: المكتب الفني (technical) والنائب العام (ag) يقرآن
--  القضيّة المرتبطة بتظلّمٍ يخصّهما (لعرض الرمز السريّ والفئة الحقيقيّين).
--  يحافظ على كل الفروع القائمة (referrals · moi/foreign · competent/recommendations).
-- ============================================================
drop policy if exists staff_case_read on protection_cases;
create policy staff_case_read on protection_cases for select using (
  exists (select 1 from referrals r where r.case_id = protection_cases.id and has_authority(r.authority))
  or (has_authority('moi') and exists (select 1 from foreign_requests f where f.case_id = protection_cases.id))
  or (has_authority('competent') and exists (select 1 from recommendations rc where rc.case_id = protection_cases.id))
  or ((has_authority('technical') or has_authority('ag')) and exists (select 1 from grievances gr where gr.case_id = protection_cases.id)));
