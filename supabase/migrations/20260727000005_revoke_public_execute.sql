-- ============================================================
-- تحصينٌ بالعمق: سحب صلاحية التنفيذ الافتراضية من PUBLIC.
--
-- بوستجرس يمنح EXECUTE لـPUBLIC تلقائياً على كل دالةٍ جديدة، وPUBLIC
-- يشمل anon — فكل دوال العمليات كانت قابلةً للنداء من غير موثَّق.
--
-- ليست ثغرةً قائمة: كل دالةٍ من هذه تبدأ بحارس
--   if auth.uid() is null then raise exception 'unauthenticated'
-- وقد تحقّقنا عملياً أن نداء anon يُرفض. لكنّ بقاء المنحة يعني أنّ أيّ
-- دالةٍ تُضاف مستقبلاً تُولَد مكشوفةً لغير الموثَّقين، ولا يفصل بينها
-- وبين الاستغلال إلا سطرُ حراسةٍ واحدٌ قد يُنسى. نغلق الباب من أصله.
--
-- النمط المعتمد هنا هو نفسه المطبَّق في claim_paper_cases (هجرة
-- 20260727000002): سحبٌ من PUBLIC وanon، ثم منحٌ صريحٌ لمن يحتاجها.
-- ============================================================

do $$
declare
  f record;
  -- دوال العمليات التي تُغيّر الحالة أو تكشف بيانات — تُنادى من جلسةٍ موثَّقة حصراً
  _ops text[] := array[
    'submit_protection_request', 'submit_paper_intake', 'submit_entity_recommendation',
    'triage_decide', 'record_recommendation',
    'submit_study', 'submit_assessment',
    'seeker_sign_agreement', 'seeker_case_view',
    'record_secret_reveal', 'assign_study_eval', 'has_open_case'
  ];
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any(_ops)
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant  execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- الدوال المساعدة التي تقرؤها سياسات RLS تعمل بصلاحية المُعرِّف داخل
-- السياسة نفسها، فلا حاجة لإبقائها مفتوحةً للنداء المباشر من PUBLIC.
do $$
declare
  f record;
  _helpers text[] := array['cb_entity','cb_branch','cb_level','cb_entity_branches',
                           'is_assigned_study','is_assigned_assessment','is_assigned_grievance',
                           'case_in_decision','case_triage_register','case_triage_active','case_has_grievance'];
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any(_helpers)
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant  execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- الافتراضيّ لما يُنشأ لاحقاً: لا منحة تلقائية لـPUBLIC.
-- (يسري على ما ينشئه هذا الدور؛ يُكرَّر لأدوار النشر الأخرى عند الحاجة.)
alter default privileges in schema public revoke execute on functions from public;
