-- ============================================================
--  تقسيةٌ وفق مُدقِّق Supabase (تدقيق 2026-08-25 · تحذيرات WARN)
--  ثلاثُ فئاتٍ قابلةٌ للإغلاق؛ ورابعةٌ مقبولةٌ بالتصميم (موثّقةٌ أدناه).
--
--  (١) function_search_path_mutable — أربعُ دوالِّ عرضٍ INVOKER بلا
--      search_path (خارج تغطية دوالّ SECURITY DEFINER الـ236). تثبيتُه
--      يمنع اختطافَ الاسم عبر search_path المستدعي.
--
--  (٢) rls_policy_always_true — سياستا الإشعارات بـ WITH CHECK (true).
--      الثغرةُ سُدّت أصلاً بصلاحيةٍ عموديّة (20260825000002)، لكن نصَّ
--      السياسة يبقى يرصده المُدقِّق. نُحاذي WITH CHECK مع USING فيصير
--      النصُّ صادقاً ويُطفأ التحذير (دفاعٌ في العمق فوق حصر العمود).
--
--  (٣) anon_security_definer_function_executable — 52 دالّةً SECURITY
--      DEFINER قابلةً للتنفيذ من anon عبر RPC (has_role عاد HTTP 200).
--      دوالُّ الأعمال تحرس نفسها (auth.uid() → unauthenticated)، لكن
--      الدوالَّ المساعِدة (has_role/is_council/cb_*) تُفشي منطقاً لـanon.
--      المنصّةُ كلُّها خلف نفاذ فلا دالّةَ تحتاج anon: نمنح authenticated
--      صراحةً ثم نسحب التنفيذ عن anon وpublic (على القائم والمستقبل).
--
--  (٤) authenticated_security_definer_function_executable — مقبولٌ
--      بالتصميم: معماريّةُ المنصّة «دوالّ SECURITY DEFINER تفرض الدور
--      وauth.uid() ذرّياً» — وهي واجهةُ الكتابة كلُّها. سحبُ التنفيذ عن
--      authenticated يُعطّل كلَّ العمليات. يبقى التحذيرُ مقبولاً موثّقاً.
--
--  idempotent · بلا أثرٍ على البيانات.
-- ============================================================

-- (١) search_path على دوالّ العرض الأربع (بلا حاجةٍ لتواقيعها).
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('category_ar','source_ar','_scope_ar','render_template_text')
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

-- (٢) محاذاة WITH CHECK مع USING لسياستَي وسم الإشعار.
drop policy if exists seeker_notif_mark on notifications;
create policy seeker_notif_mark on notifications for update
  using (
    authority is null
    and exists (select 1 from protection_cases c
                where c.id = notifications.case_id and c.submitted_by = auth.uid()))
  with check (
    authority is null
    and exists (select 1 from protection_cases c
                where c.id = notifications.case_id and c.submitted_by = auth.uid()));

drop policy if exists staff_notif_mark on notifications;
create policy staff_notif_mark on notifications for update
  using (authority is not null and has_authority(authority))
  with check (authority is not null and has_authority(authority));

-- (٣) سحبُ تنفيذ الدوالّ عن anon وpublic؛ إبقاؤه لـauthenticated.
--     الترتيب حاسم: نمنح authenticated صراحةً أوّلاً كي لا يفقده بسحب public
--     (فالكثيرُ ورثه عبر PUBLIC لا بمنحٍ مباشر).
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from anon, public;

-- المستقبل: دوالُّ المهاجرات القادمة تأخذ التنفيذ لـauthenticated لا لـpublic.
alter default privileges in schema public grant execute on functions to authenticated;
alter default privileges in schema public revoke execute on functions from public;
