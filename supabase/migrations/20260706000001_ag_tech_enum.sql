-- ============================================================
--  توسعة enum السلطات لأدوار الإشراف الأعلى: النائب العام (ag) والمكتب الفني (technical).
--  ملاحظة: ALTER TYPE ADD VALUE لا يجوز استخدامه في نفس المعاملة التي تستهلك القيمة،
--  لذا يُعزَل في ملفٍ مستقلٍّ لا يستعملها (يُطبَّق قبل 20260706000002).
-- ============================================================
alter type referral_authority add value if not exists 'ag';
alter type referral_authority add value if not exists 'technical';
