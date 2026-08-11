-- ============================================================
-- البثّ للجميع + الإقفال الزمني (م10) — بديل الانتقاء بالعبء وإعادة الإسناد
--
-- القرار (2026-08-10، باعتماد المستخدم): نموذج الدراسة خفيف وطاقم المركز
-- صغير، فلا لزوم للانتقاء بالعبء — يُرسل الطلب لكل الدارسين والمقيّمين،
-- وتتقدّم القضية للقرار عند أول الحالتين:
--   (أ) ورود مخرجات الجميع (يتولاه مشغّل _auto_send_to_decision كما هو)، أو
--   (ب) انقضاء يوم العمل النظامي (م10) بشرط دراسة واحدة وتقييم واحد على
--       الأقل — ويُوسم من لم يقدّم «انقضى الميعاد النظامي» توثيقاً لا عقوبة.
--
-- تبعاً لذلك يتحوّل الحارس (study_eval_watchdog) من «مُعيد إسناد» — لم يعد
-- له معنى والجميع مُسنَد أصلاً ولا بديل خارج الطاقم — إلى «مُقفِل ميعاد»:
-- وظيفة أبسط وأصدق مع النظام. إن انقضى الميعاد بلا نصاب أدنى (لا دراسة أو
-- لا تقييم) تبقى القضية مفتوحة ويُنذَر النائب مرة يومياً، ثم يُقفلها أول
-- مخرَج وارد مع أول جولة حارس تالية.
--
-- مفتاح التفعيل نفسه (app_settings.watchdog) يحكم المُقفِل، ومهلة الإقفال
-- قابلة للضبط بمفتاح app_settings اختياري «study_eval_deadline_days»
-- (الافتراض 1 = يوم عمل واحد كما في م10؛ بيئة العرض قد تضعه 0 ليُقفل
-- الحارسُ القضيةَ في أول جولة بعد بلوغ النصاب الأدنى).
-- ============================================================

-- ─── 1) الإسناد: البثّ للجميع (‏_per_role يبقى معاملاً؛ null = الكل) ───
create or replace function public.assign_study_eval(_case_id uuid, _per_role integer default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into studies (case_id, studier_id)
  select _case_id, x.user_id from (
    select ur.user_id,
      (select count(*) from studies s where s.studier_id = ur.user_id
        and s.submitted_at is null and s.superseded_at is null) as load
    from user_roles ur where ur.role = 'studier'
    order by load asc, ur.user_id asc
    limit _per_role   -- null = بلا حدّ: الجميع
  ) x
  on conflict (case_id, studier_id) do nothing;

  insert into assessments (case_id, evaluator_id)
  select _case_id, x.user_id from (
    select ur.user_id,
      (select count(*) from assessments a where a.evaluator_id = ur.user_id
        and a.submitted_at is null and a.superseded_at is null) as load
    from user_roles ur where ur.role = 'evaluator'
    order by load asc, ur.user_id asc
    limit _per_role
  ) x
  on conflict (case_id, evaluator_id) do nothing;
end $$;

comment on function public.assign_study_eval is
  'بثّ الإسناد لكل الدارسين والمقيّمين (null = الكل؛ عددٌ للتقييد) — يُطلَق من مُشغّل under_study حصراً (SECURITY DEFINER)؛ لا يُنادى مباشرةً من العملاء (حارس 20260808000007 محفوظ بإبقاء التواقيع).';

-- ─── 2) مهلة الإقفال (أيام عمل؛ الافتراض 1 وفق م10) ───
create or replace function public.study_eval_deadline_days()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(0, coalesce(
    (select s.value::int from app_settings s
      where s.key = 'study_eval_deadline_days' and s.value ~ '^\d+$'),
    1));
$$;
-- السحب الصريح عُرفُ هذا المستودع لكل دالة مساعدة (نظير watchdog_enabled) —
-- الافتراض المتشدد يغطّيها، والتصريح دفاعٌ إن طُبّقت المهاجرة بدورٍ آخر.
revoke execute on function public.study_eval_deadline_days() from public, anon, authenticated;

-- ─── 3) الحارس: مُقفِل ميعاد لا مُعيد إسناد ───
drop function if exists public.study_eval_watchdog();

create function public.study_eval_watchdog()
returns table(closed integer, alerted integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare r record; _ns int; _na int; _closed int := 0; _alerted int := 0; _st case_status;
begin
  if not public.watchdog_enabled() then
    return query select 0, 0; return;
  end if;

  for r in
    select c.id, c.ref_no, c.secret_code,
           (select min(t.created_at) from (
              select s.created_at from studies s where s.case_id = c.id
              union all
              select a.created_at from assessments a where a.case_id = c.id) t) as phase_start
      from protection_cases c
     where c.status = 'under_study'
  loop
    -- لا صفوف إسناد بعد (لم يُشغَّل البثّ) أو الميعاد لم ينقضِ — لا شأن للمُقفِل
    if r.phase_start is null
       or business_days_between(r.phase_start, now()) < study_eval_deadline_days() then
      continue;
    end if;

    select count(*) into _ns from studies
      where case_id = r.id and submitted_at is not null and superseded_at is null;
    select count(*) into _na from assessments
      where case_id = r.id and submitted_at is not null and superseded_at is null;

    if _ns >= 1 and _na >= 1 then
      -- توثيق للمتأخرين قبل الوسم (توثيقاً لا عقوبة)
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select r.id, x.uid, 'deadline', 'انقضى الميعاد النظامي (م10)',
             r.secret_code || ' — أُقفل باب الدراسة والتقييم بانقضاء يوم العمل النظامي، وتقدّمت القضية بما ورد من مخرجات. وُثّق ذلك في السجل توثيقاً لا عقوبة.',
             'tasks', now()
      from (select studier_id as uid from studies
              where case_id = r.id and submitted_at is null and superseded_at is null
            union all
            select evaluator_id from assessments
              where case_id = r.id and submitted_at is null and superseded_at is null) x;

      -- الوسم؛ آخر UPDATE يُصفّر المعلّق فيُقدِّم مشغّلُ _auto_send_to_decision
      -- القضيةَ بنفسه (الشرط: رأي من كل دور ولا مهمة معلّقة)
      update studies set superseded_at = now(),
        superseded_reason = 'انقضى الميعاد النظامي (م10)'
        where case_id = r.id and submitted_at is null and superseded_at is null;
      update assessments set superseded_at = now(),
        superseded_reason = 'انقضى الميعاد النظامي (م10)'
        where case_id = r.id and submitted_at is null and superseded_at is null;

      insert into audit_log (actor_id, action, target)
        values (null, 'deadline_close_study_eval', r.ref_no);

      -- ضمانة حتمية: إن لم يُقدِّمها المشغّل لأي سبب نُقدِّمها هنا بالشرط نفسه
      select status into _st from protection_cases where id = r.id;
      if _st = 'under_study' then
        update protection_cases set status = 'in_decision', updated_at = now() where id = r.id;
        insert into council_decisions (case_id, status) values (r.id, 'preparing')
          on conflict (case_id) do nothing;
        insert into audit_log (actor_id, action, target)
          values (null, 'auto_send_to_decision', r.ref_no);
      end if;

      _closed := _closed + 1;
    else
      -- ميعاد منقضٍ بلا نصاب أدنى: القضية تبقى مفتوحة ويُنذَر النائب مرة يومياً؛
      -- أول مخرَج مكتمِل للنصاب تُقفِله الجولة التالية
      perform _notify_deputies_once_daily(r.id, 'انقضاء الميعاد النظامي بلا نصاب',
        r.secret_code || ' — انقضى يوم العمل النظامي (م10) ولم ترد '
        || case when _ns = 0 and _na = 0 then 'أي دراسة أو تقييم'
                when _ns = 0 then 'أي دراسة'
                else 'أي تقييم' end
        || '؛ القضية بانتظار النصاب الأدنى (دراسة وتقييم) لتُقفل آلياً. يلزم تنبيه الطاقم.');
      insert into audit_log (actor_id, action, target)
        values (null, 'study_eval_deadline_no_quorum', r.ref_no);
      _alerted := _alerted + 1;
    end if;
  end loop;

  return query select _closed, _alerted;
end $$;

-- إعادة الإنشاء تُخضع الدالة للافتراض المتشدد (postgres=X فقط) — والسحب
-- الصريح توثيقٌ للنية: الحارس يُطلقه pg_cron حصراً لا العملاء
revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;

comment on function public.study_eval_watchdog is
  'مُقفِل الميعاد النظامي (م10): بعد study_eval_deadline_days من بدء المرحلة يُوسم من لم يقدّم «انقضى الميعاد النظامي» وتتقدّم القضية إن اكتمل النصاب الأدنى (دراسة+تقييم)، وإلا أُنذر النائب مرة يومياً. يُطلقه pg_cron كل 30 دقيقة حين app_settings.watchdog=on.';

-- ─── 4) لَحاق القضايا الجارية: بثّ الإسناد لمن فاتهم في قضايا under_study ───
-- (إشعارات الإسناد تنطلق من مشغّل trg_notify_*_assign لكل صف جديد)

-- مساعدٌ للحاق: هل انقضى ميعاد المرحلة لهذه القضية أصلاً؟ (بدء المرحلة = أقدم
-- صفّ إسناد — النظيرُ نفسه المستعمَل في المُقفِل).
create or replace function public._study_eval_window_expired(_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    business_days_between(
      (select min(t.created_at) from (
         select s.created_at from studies s where s.case_id = _case_id
         union all
         select a.created_at from assessments a where a.case_id = _case_id) t),
      now()) >= public.study_eval_deadline_days(), false);
$$;
revoke execute on function public._study_eval_window_expired(uuid) from public, anon, authenticated;

insert into studies (case_id, studier_id)
select c.id, ur.user_id
from protection_cases c
cross join user_roles ur
where c.status = 'under_study' and ur.role = 'studier'
  and not public._study_eval_window_expired(c.id)
on conflict (case_id, studier_id) do nothing;

insert into assessments (case_id, evaluator_id)
select c.id, ur.user_id
from protection_cases c
cross join user_roles ur
where c.status = 'under_study' and ur.role = 'evaluator'
  and not public._study_eval_window_expired(c.id)
on conflict (case_id, evaluator_id) do nothing;

-- ─── 5) تثبيت مفتاح الحارس: مع البثّ يصير المُقفِل طريقَ التقدّم الوحيد ───
-- _auto_send_to_decision (20260727000006) يشترط _pending = 0 — أي تقديمَ كلِّ
-- الطاقم المبثوث له، وهو ما لا يقع عملياً. فلو كان المفتاح مطفأً بقيت كل
-- القضايا معلّقة في under_study بلا حدّ. التأكيد idempotent كما في 20260727000007.
insert into app_settings (key, value) values ('watchdog', 'on')
on conflict (key) do update set value = 'on';
