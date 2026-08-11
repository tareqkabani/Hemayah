-- ============================================================
-- سُلّم التصعيد على التوقّف + عدّاد توقّفٍ مستقلّ عن الحارس
--
-- ما كشفه سجلّ التدقيق (2026-08-11): منذ نشأة القاعدة سُجِّل
--   study_eval_deadline_no_quorum ‏= 92 مرّة
--   deadline_close_study_eval     = 0  — لم يُقفل المُقفِلُ قضيةً قطّ
-- وسبع قضايا في under_study جميعها تجاوزت الميعاد وتنتظر النصاب.
--
-- السبب: مُقفِل الميعاد يشترط نصاباً أدنى (دراسة **و** تقييم) لا يملك
-- هو إنتاجه. فإن لم يُسلّم أيُّ مقيّم انتظرت القضية بلا حدّ، وتحوّل
-- «المُقفِل» إلى مُنبِّهٍ يكرّر نفسه يومياً على النائب وحده. والرفض في
-- ذاته سليمٌ نظاماً (لا قرار بلا مادّة يُبنى عليها)، والناقص ليس
-- إقفالاً آلياً آخر — بل سُلّم تصعيدٍ ينتقل بالمسؤولية حين يطول الصمت،
-- ورؤيةٌ تشغيليّة تُظهر التوقّف قبل أن يُكتشف بالصدفة.
--
-- ولذلك أيضاً: عدّاد التوقّف **لا يعيش داخل الحارس**. فمفتاح
-- app_settings.watchdog صار — بعد البثّ — قاطعَ خطّ الإنتاج كلّه لا
-- مجرّد مُسكِت تذكيرات؛ ولو كان العدّاد داخل الحارس لصمت معه، فلا
-- يبقى ما يُنبِّه إلى أنّ الخطّ متوقّف. ops_stall_report مستقلّة عنه
-- عمداً: تُقرأ من لوحة صحّة النظام ولو كان الحارس مُطفأً.
-- ============================================================

-- ─── 1) إنذارٌ يوميّ لأدوارٍ مُحدَّدة (تعميم نظير النائب) ───
-- نافذة «مرّة يومياً» تُقاس بالعنوان نفسه لكلّ قضية — فاختلاف عنوان
-- الدرجة يجعل لكلّ درجةٍ نافذتَها المستقلّة، وهو المقصود.
create or replace function public._notify_roles_once_daily(
  _case_id uuid, _title text, _body text, _roles app_role[], _crit boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if exists (select 1 from notifications n
             where n.case_id = _case_id and n.title = _title
               and n.sent_at > now() - interval '1 day') then
    return; -- أُنذروا خلال اليوم — لا إغراق كل نصف ساعة
  end if;

  insert into notifications (case_id, recipient_id, type, title, body, target_tab, crit, sent_at)
  select _case_id, ur.user_id, 'assign', _title, _body, 'tasks', _crit, now()
  from user_roles ur where ur.role = any(_roles);
end $function$;

revoke execute on function public._notify_roles_once_daily(uuid, text, text, app_role[], boolean)
  from public, anon, authenticated;

comment on function public._notify_roles_once_daily is
  'إنذار مرّةً واحدة يومياً لأصحاب أدوارٍ مُحدَّدة على قضية (النافذة بالعنوان نفسه — لكلّ درجة تصعيد عنوانها ونافذتها).';

-- ─── 2) تقرير التوقّف — مستقلّ عن الحارس ومفتاحه ───
create or replace function public.ops_stall_report()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare _out jsonb;
begin
  if not (has_role(auth.uid(), 'sysadmin')
          or has_role(auth.uid(), 'board_chair')
          or has_role(auth.uid(), 'deputy_chair')) then
    raise exception 'forbidden: ops report is for sysadmin and center leadership';
  end if;

  -- تجميعٌ صرف بلا أي معرِّف قضية أو رمز سرّي (لوحة الصحّة بلا بيانات مشمولين)
  with phase as (
    select c.id,
           (select min(t.created_at) from (
              select s.created_at from studies s where s.case_id = c.id
              union all
              select a.created_at from assessments a where a.case_id = c.id) t) as started_at,
           (select count(*) from studies s
             where s.case_id = c.id and s.submitted_at is not null and s.superseded_at is null) as ns,
           (select count(*) from assessments a
             where a.case_id = c.id and a.submitted_at is not null and a.superseded_at is null) as na
      from protection_cases c
     where c.status = 'under_study'
  ), aged as (
    select p.*, business_days_between(p.started_at, now()) as biz_days
      from phase p where p.started_at is not null
  ), stalled as (
    select * from aged where biz_days >= public.study_eval_deadline_days()
  )
  select jsonb_build_object(
    'under_study_total',   (select count(*) from phase),
    'stalled_total',       (select count(*) from stalled),
    'stalled_oldest_days', coalesce((select max(biz_days) from stalled), 0),
    'missing_study',       (select count(*) from stalled where ns = 0 and na > 0),
    'missing_assessment',  (select count(*) from stalled where na = 0 and ns > 0),
    'missing_both',        (select count(*) from stalled where ns = 0 and na = 0),
    -- بلغت النصاب ومع ذلك ما زالت واقفة ⇒ المُقفِل لم يعمل (الحارس مُطفأ
    -- أو pg_cron متوقّف). صفرٌ هو الوضع السليم؛ أيّ رقمٍ هنا عطلٌ تشغيليّ.
    'quorum_met_not_closed', (select count(*) from stalled where ns > 0 and na > 0),
    'watchdog',            coalesce((select value from app_settings where key = 'watchdog'), 'off'),
    'deadline_days',       public.study_eval_deadline_days()
  ) into _out;
  return _out;
end $function$;

revoke execute on function public.ops_stall_report() from public, anon;
grant execute on function public.ops_stall_report() to authenticated;

comment on function public.ops_stall_report is
  'تقرير توقّف مرحلة الدراسة والتقييم (تجميعٌ صرف بلا معرِّفات) — لا يعتمد على watchdog_enabled عمداً كي يظلّ التوقّف مرئياً حين يُطفأ الحارس. quorum_met_not_closed > 0 يعني أنّ المُقفِل لا يعمل.';

-- ─── 3) الحارس: سُلّم تصعيدٍ بدل إنذارٍ يوميٍّ واحدٍ لا ينتهي ───
-- إعادة إنشاءٍ كاملة فوق نسخة 20260811000007 (درس «آخر نسخة دالة»):
-- الفرق محصورٌ في فرع «بلا نصاب» — درجات التصعيد بحسب طول الصمت.
create or replace function public.study_eval_watchdog()
returns table(closed integer, alerted integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; _ns int; _na int; _closed int := 0; _alerted int := 0; _st case_status;
        _late int; _missing text; _title text; _roles app_role[]; _crit boolean;
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
          on conflict (case_id) do update set status = 'preparing', updated_at = now()
          where council_decisions.status = 'collecting';
        insert into audit_log (actor_id, action, target)
          values (null, 'auto_send_to_decision', r.ref_no);
      end if;

      _closed := _closed + 1;
    else
      -- ميعادٌ منقضٍ بلا نصاب أدنى: القضية تبقى مفتوحة (لا قرار بلا مادّة)،
      -- لكنّ المسؤولية تتصاعد كلّما طال الصمت — لا إنذارٌ واحدٌ يتكرّر أبداً.
      _late := business_days_between(r.phase_start, now()) - study_eval_deadline_days();
      _missing := case when _ns = 0 and _na = 0 then 'أي دراسة أو تقييم'
                       when _ns = 0 then 'أي دراسة'
                       else 'أي تقييم' end;

      if _late >= 5 then
        _title := 'توقّفٌ حرِج: ' || _late || ' يوم عمل بلا نصاب';
        _roles := array['deputy_chair','board_chair','sysadmin']::app_role[];
        _crit  := true;
      elsif _late >= 3 then
        _title := 'تصعيد: انقضاء الميعاد بلا نصاب (' || _late || ' يوم عمل)';
        _roles := array['deputy_chair','board_chair']::app_role[];
        _crit  := false;
      else
        _title := 'انقضاء الميعاد النظامي بلا نصاب';
        _roles := array['deputy_chair']::app_role[];
        _crit  := false;
      end if;

      perform _notify_roles_once_daily(r.id, _title,
        r.secret_code || ' — انقضى يوم العمل النظامي (م10) منذ ' || _late
        || ' يوم عمل ولم ترد ' || _missing
        || '؛ القضية موقوفة بانتظار النصاب الأدنى (دراسة وتقييم) ولا تتقدّم آلياً دونه. يلزم تنبيه الطاقم أو ندب بديل.',
        _roles, _crit);

      insert into audit_log (actor_id, action, target)
        values (null,
          case when _late >= 5 then 'study_eval_stall_critical'
               when _late >= 3 then 'study_eval_stall_escalated'
               else 'study_eval_deadline_no_quorum' end,
          r.ref_no);
      _alerted := _alerted + 1;
    end if;
  end loop;

  return query select _closed, _alerted;
end $function$;

revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;

comment on function public.study_eval_watchdog is
  'مُقفِل الميعاد النظامي (م10) وسُلّم التصعيد: عند اكتمال النصاب الأدنى يُوسم من لم يقدّم وتتقدّم القضية (collecting ← preparing)؛ وبلا نصاب تبقى مفتوحة ويتصاعد الإنذار — النائب، ثم الرئيس معه بعد 3 أيام عمل، ثم إنذارٌ حرِج لإدارة النظام بعد 5. يُطلقه pg_cron كل 30 دقيقة حين app_settings.watchdog=on؛ والرؤية لا تعتمد عليه (ops_stall_report).';

-- ─── 4) لوحة صحّة النظام: التوقّف مؤشّرٌ أوّليّ لا اكتشافٌ بالصدفة ───
create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _out jsonb; _stall jsonb;
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  _stall := public.ops_stall_report();
  select jsonb_build_object(
    'notifications_24h', (select count(*) from notifications where created_at > now() - interval '24 hours'),
    'notifications_total', (select count(*) from notifications),
    'audit_rows', (select count(*) from audit_log),
    'templates_active', (select count(*) from notification_templates where active),
    'templates_total', (select count(*) from notification_templates),
    'ccr_pending', (select count(*) from content_change_requests where status = 'pending'),
    'staff_accounts', (select count(distinct user_id) from user_roles where role <> 'subject'),
    'roles_granted', (select count(*) from user_roles where role <> 'subject'),
    'watchdog', (select coalesce((select value from app_settings where key = 'watchdog'), 'off')),
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    -- التوقّف: مرئيّ هنا ولو كان الحارس مُطفأً (ops_stall_report مستقلّة عنه)
    'stalled_total', _stall->'stalled_total',
    'stalled_oldest_days', _stall->'stalled_oldest_days',
    'stall_quorum_met_not_closed', _stall->'quorum_met_not_closed',
    'stall_missing_study', _stall->'missing_study',
    'stall_missing_assessment', _stall->'missing_assessment',
    'stall_missing_both', _stall->'missing_both',
    'cron_jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'last_status', (select d.status from cron.job_run_details d
                        where d.jobid = j.jobid order by d.runid desc limit 1),
        'last_run', (select to_char(d.start_time, 'YYYY-MM-DD HH24:MI') from cron.job_run_details d
                     where d.jobid = j.jobid order by d.runid desc limit 1)))
      from cron.job j), '[]'::jsonb)
  ) into _out;
  return _out;
end $function$;

comment on function public.admin_system_health is
  'مؤشرات تشغيلية للأدمن (بلا بيانات مشمولين) — تشمل عدّاد توقّف الدراسة والتقييم المستقلّ عن مفتاح الحارس.';

-- ─── 5) المفتاح ظاهراً لا افتراضاً مخبوءاً في الشيفرة ───
-- study_eval_deadline_days() ترجع 1 عند غياب المفتاح؛ وغيابُه يعني أنّ
-- مهلةً تحكم خطّ الإنتاج كلّه لا تظهر في شاشة إعدادات الأدمن ولا تُضبط
-- منها. يُدرَج بقيمته الافتراضية نفسها (لا تغيير سلوك) ليصير مرئياً.
insert into app_settings (key, value) values ('study_eval_deadline_days', '1')
on conflict (key) do nothing;
