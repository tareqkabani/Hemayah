-- 20260808000007_assign_study_eval_guard.sql — سدّ ثغرة صلاحية assign_study_eval
--
-- الأصل (20260716000001:374) سحب التنفيذ من الجميع عمداً: «الإسناد يُطلقه
-- المُشغّل/البذر حصراً». لكنّ حلقة 20260727000005_revoke_public_execute
-- أدرجت الدالة في مصفوفة _ops التي تمنح authenticated تنفيذاً صريحاً —
-- فأُبطلت النيّة سهواً، وصار أيُّ مستخدمٍ موثَّق يقدر أن يفرض إسناد دارسين
-- ومقيّمين على أيّ قضية بمعرّفها (تجاوز الإسناد الآلي بالعبء والعزل).
--
-- الإصلاح: سحب التنفيذ من authenticated أيضاً. المسار الشرعي لا يتأثّر —
-- المُشغّل _assign_on_under_study نفسه SECURITY DEFINER (يملكه المُعرِّف)،
-- فحين يستدعي assign_study_eval يكون current_user هو المُعرِّف لا المستخدم،
-- وهو يملك الصلاحية دائماً. (وكذا study_eval_watchdog في إعادة الإسناد.)

revoke execute on function public.assign_study_eval(uuid, int) from public, anon, authenticated;

comment on function public.assign_study_eval is
  'إسنادٌ آليّ بالعبء — يُطلَق من مُشغّل under_study والحارس حصراً (SECURITY DEFINER)؛ لا يُنادى مباشرةً من العملاء.';
