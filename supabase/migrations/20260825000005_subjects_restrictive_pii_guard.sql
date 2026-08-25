-- ============================================================
--  حارسٌ صارمٌ يمنع كشفَ هويّة المشمولين عن مدير النظام (HMY-15)
--  (تدقيق أمنيّ 2026-08-25)
--
--  الحال: على subjects سياسةٌ مسموحةٌ واحدة sysadmin_no_pii بـ using(false).
--  سياساتُ PostgreSQL المسموحة تُجمَع بـOR، وسياسةٌ using(false) لا تمنع
--  شيئاً — الحمايةُ الفعليّة تأتي من **غياب** أيّ سياسةٍ أخرى (رفضٌ افتراضيّ).
--  فالاسمُ يَعِد بمنعٍ لا تُنفّذه الصيغة.
--
--  الإصلاح: سياسةٌ **مقيِّدة (RESTRICTIVE)** — تُضاف بـAND فوق أيّ سياسةٍ
--  مسموحةٍ حاليّةٍ أو مستقبليّة. فلو أُضيفت سهواً سياسةُ قراءةٍ على subjects،
--  يبقى مدير النظام محجوباً عن هويّة الشهود (ضمانةٌ حقيقيّة لا اسميّة).
--  الدوالُّ SECURITY DEFINER تقرأ بصلاحية المالك فلا تتأثّر.
--
--  idempotent · بلا أثرٍ على البيانات.
-- ============================================================

drop policy if exists sysadmin_no_pii on subjects;
create policy sysadmin_no_pii on subjects as restrictive for all to authenticated
  using (not has_role(auth.uid(), 'sysadmin'))
  with check (not has_role(auth.uid(), 'sysadmin'));
