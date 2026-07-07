-- ============================================================
--  منصّة «حماية» — منح الصلاحيات (Grants)
--  المخطّط الأساسي يفعّل RLS لكنه لا يمنح صلاحيات الجداول للأدوار.
--  RLS يبقى بوّابة الصفوف؛ هذه المنح تفتح الوصول على مستوى الجدول.
--  مبدأ: anon (غير مُصادَق) ممنوع — كل البوابات تتطلّب دخول «نفاذ».
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- authenticated (المستخدمون بعد نفاذ): صلاحيات الجداول، وRLS يحكم الصفوف الظاهرة.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- service_role (خادميّ، يتجاوز RLS): كامل الصلاحيات للعمليات الإدارية.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- الكائنات المستقبلية تأخذ نفس المنح تلقائياً.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;

-- إعادة تأكيد عدم قابلية التعديل (تُلغى بعد المنح الشامل أعلاه):
-- التصنيفات وسجل التدقيق نُسخٌ تاريخية — لا تعديل ولا حذف.
revoke update, delete on risk_classifications from authenticated;
revoke update, delete on audit_log from authenticated, anon;

-- anon يبقى بلا وصولٍ للجداول (لا منح) — قصداً.
