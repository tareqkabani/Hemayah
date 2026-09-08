-- ============================================================
--  إعادة تحصين الدوالّ الداخلية — سدّ انحدارٍ أحدثه المنحُ الشامل
--
--  ما وقع: مهاجرة تشديد اللِنتر (20260825000004) أرادت إغلاق anon وPUBLIC
--  فكتبت — بترتيبٍ مقصود — منحاً شاملاً أوّلاً:
--        grant execute on all functions in schema public to authenticated;
--        revoke execute on all functions in schema public from anon, public;
--  الشقّ الثاني صحيح، لكنّ الشقّ الأوّل **ألغى إحدى وعشرين منحةً مسحوبةً
--  عمداً** في مهاجراتٍ سابقة: `revoke ... from public, anon, authenticated`.
--  فصارت الدوالّ الداخلية كلُّها قابلةً للنداء من أيّ مستخدمٍ موثَّق —
--  ومنها قارئا مفتاحَي التشفير في Vault.
--
--  أُثبت عمليّاً على قاعدة التطوير بانتحال دور مستفيدٍ عاديّ (subject):
--    · _subject_identity_key()   → أعادت مفتاح تشفير هويات طالبي الحماية
--    · _emergency_contact_key()  → أعادت مفتاح تشفير جهات الطوارئ
--    · notify_from_template(...) → أدرجت إشعاراً مُلفَّقاً موجَّهاً للجهات
--    · study_eval_watchdog()     → نُفِّذت (إقفالٌ وتصعيدٌ بيد غير أهله)
--  وكذلك _store_subject/_store_emergency_contact تكتبان بيانات أيّ قضية
--  بلا حارس ملكيّة — إذ صُمِّمت لتُنادى من دوالٍّ أعلى لا من عميل.
--
--  العلاج هنا قاعدةٌ لا قائمة: كلّ دالّةٍ في public يبدأ اسمها بشرطةٍ
--  سفلية فهي داخليّةٌ بالاصطلاح المتّبع في هذا المستودع، تُسحب من
--  public وanon وauthenticated. ويُستثنى منها ما تقرؤه سياسةٌ صراحةً
--  (سياسة قراءة مرفقات الوارد تنادي _intake_path_readable بصلاحية
--  المستخدم نفسه، فسحبُها يكسر اطّلاع الدارس والمقيّم على الخطابات).
--  ويُضاف إليها بالاسم ما ليس داخليّاً بالاصطلاح لكنّه عمليّةٌ
--  ذاتُ امتياز: الحرّاس الآليّون ومحرّك القوالب وفرزُ الأصوات والإسناد.
--
--  ملاحظة: الدوالّ SECURITY DEFINER تُنادي بعضها بصلاحية المُعرِّف، فسحبُ
--  التنفيذ عن المستخدم لا يقطع التركيب الداخليّ. ودوالُّ المُشغِّلات
--  (triggers) لا يُفحص تنفيذها عند الإطلاق بل عند إنشاء المُشغِّل.
--
--  والمهاجرة تفحص نفسها في آخرها: تُخفق إن بقيت واحدةٌ مكشوفة.
-- ============================================================

do $$
declare
  f record;
  -- عملياتٌ ذاتُ امتياز لا يبدأ اسمها بشرطةٍ سفلية
  _ops text[] := array[
    'notify_from_template',       -- محرّك الإشعارات: نداؤه مباشرةً تلفيقٌ
    'render_template_text',       -- تعبئة القوالب
    'study_eval_watchdog',        -- إقفال الميعاد والتصعيد
    'recommendations_watchdog',   -- حارس التوصيات
    'watchdog_enabled',           -- مفتاح تشغيل الحرّاس
    'study_eval_deadline_days',   -- ميعاد م10 (إعدادٌ إداريّ)
    'assign_study_eval',          -- الإسناد الآليّ
    'pick_grievance_advisor',     -- انتقاء مستشار التظلّم
    'council_tally',              -- فرز الأصوات قبل الإصدار
    'claim_paper_cases'           -- جسر نفاذ (service_role حصراً)
  ];
  -- استثناءٌ واحد: تقرؤها سياسة تخزينٍ بصلاحية المستخدم نفسه
  _policy_helpers text[] := array['_intake_path_readable'];
  _n int := 0;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like '\_%' or p.proname = any(_ops))
       and not (p.proname = any(_policy_helpers))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    _n := _n + 1;
  end loop;
  raise notice 'أُعيد تحصين % دالّةً داخلية.', _n;
end $$;

-- الجسر يبقى بيد الخدمة وحدها (سُحب أعلاه ضمن العمليات، فيُعاد صراحةً).
grant execute on function public.claim_paper_cases(uuid, text) to service_role;

-- ── الفحص الذاتيّ: لا دالّةَ داخليةٍ مكشوفةٌ بعد اليوم ──
do $$
declare _leak text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into _leak
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname like '\_%'
     and p.proname <> '_intake_path_readable'
     and has_function_privilege('authenticated', p.oid, 'execute');
  if _leak is not null then
    raise exception 'ما زالت دوالُّ داخليةٌ مكشوفةً لـauthenticated: %', _leak;
  end if;

  select string_agg(p.proname, ', ' order by p.proname) into _leak
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('notify_from_template','render_template_text','study_eval_watchdog',
                       'recommendations_watchdog','watchdog_enabled','study_eval_deadline_days',
                       'assign_study_eval','pick_grievance_advisor','council_tally','claim_paper_cases')
     and has_function_privilege('authenticated', p.oid, 'execute');
  if _leak is not null then
    raise exception 'ما زالت عملياتٌ ذاتُ امتيازٍ مكشوفةً لـauthenticated: %', _leak;
  end if;

  -- وفي المقابل: ما تحتاجه الواجهات فعلاً يبقى مفتوحاً
  if not has_function_privilege('authenticated', 'public.submit_study(uuid,text,jsonb,jsonb,interval,text,text,boolean,boolean)', 'execute') then
    raise exception 'انكسر تنفيذ submit_study لـauthenticated'; end if;
  if not has_function_privilege('authenticated', 'public._intake_path_readable(text)', 'execute') then
    raise exception 'انكسرت سياسة قراءة مرفقات الوارد'; end if;
  if not has_function_privilege('service_role', 'public.claim_paper_cases(uuid,text)', 'execute') then
    raise exception 'انكسر جسر نفاذ لضمّ الحالات الورقية'; end if;

  raise notice '✓ الفحص الذاتيّ: الداخليّ مُقفَل والواجهات سليمة.';
end $$;

-- الافتراضيّ لما يُنشأ لاحقاً يبقى كما ضبطته 20260825000004 (منحٌ
-- لـauthenticated وسحبٌ من PUBLIC): الأغلب أنّ الدالّة الجديدة نقطةُ
-- نداءٍ للواجهة. وكلّ دالّةٍ داخليةٍ جديدة يجب أن تسحب تنفيذها صراحةً
-- في مهاجرتها — وهذا ما يفحصه اختبار subject-intake-tests.
