-- ============================================================
--  حصر قراءة طالب الحماية في خيطَيه (center · body) — 19 يوليو 2026
--  خيط 'coord' الجديد تنسيقٌ داخليّ (المركز ↔ ضابط اتصال الجهة) ولا يُعرض
--  لطالب الحماية؛ السياسة القديمة كانت تقرأ كل رسائل قضيته بلا تمييز.
-- ============================================================

drop policy if exists seeker_msg_read on messages;
create policy seeker_msg_read on messages for select using (
  thread in ('center', 'body')
  and exists (select 1 from protection_cases c
    where c.id = messages.case_id and c.submitted_by = auth.uid()));
