-- ============================================================
-- مفتاح الحارس: من إعداد جلسة (GUC) إلى مفتاحٍ جدوليّ قابلٍ للضبط.
--
-- كان الحارس محكوماً بـ app.settings.watchdog، ووثّقت هجرته أن يُفعَّل بـ
--   alter database <db> set app.settings.watchdog = 'on';
-- غير أن دور postgres في Supabase لا يملك صلاحية ضبط هذا الإعداد:
--   ERROR: permission denied to set parameter "app.settings.watchdog"
-- فالمفتاح لم يكن قابلاً للتفعيل أصلاً، وبقي الحارس خاملاً منذ إنشائه
-- رغم أن مهمّته مجدولة في cron كل 30 دقيقة.
--
-- وقد صار الحارس شرطاً لازماً بعد ربط التقدّم للقرار باكتمال كل المهامّ
-- (هجرة 20260727000006)، إذ لم يعد ثمّة «اكتفاءٌ بالنصاب» يُزيح المتأخّر.
-- فيُنقل المفتاح إلى جدولٍ يُضبَط بـSQL عاديّ، مع إبقاء دعم GUC لمن يقدر.
-- ============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'مفاتيح تشغيلٍ عامّة — تُقرأ عبر دوال SECURITY DEFINER فقط';

alter table public.app_settings enable row level security;
revoke all on table public.app_settings from public, anon, authenticated;

-- المفتاح يُقرأ داخل الحارس (SECURITY DEFINER) فيتجاوز RLS؛ ولا يُقرأ من العملاء.
create or replace function public.watchdog_enabled()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select s.value from app_settings s where s.key = 'watchdog'),
    current_setting('app.settings.watchdog', true),
    'off'
  ) = 'on';
$$;
revoke execute on function public.watchdog_enabled() from public, anon, authenticated;

insert into public.app_settings (key, value) values ('watchdog', 'on')
  on conflict (key) do update set value = excluded.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.study_eval_watchdog()
 RETURNS TABLE(reassigned integer, exhausted integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; _next uuid; _ref text; _secret text; _re int := 0; _ex int := 0; _hit int;
begin
  if not public.watchdog_enabled() then
    return query select 0, 0; return;
  end if;

  for r in
    select 'study' as kind, s.id, s.case_id, s.studier_id as author_id, c.ref_no, c.secret_code
      from studies s join protection_cases c on c.id = s.case_id
     where c.status = 'under_study' and s.submitted_at is null and s.superseded_at is null
       and business_days_between(s.created_at, now()) >= 1
    union all
    select 'assessment', a.id, a.case_id, a.evaluator_id, c.ref_no, c.secret_code
      from assessments a join protection_cases c on c.id = a.case_id
     where c.status = 'under_study' and a.submitted_at is null and a.superseded_at is null
       and business_days_between(a.created_at, now()) >= 1
  loop
    _ref := r.ref_no; _secret := r.secret_code;

    if r.kind = 'study' then
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'studier'
         and not exists (select 1 from studies s2 where s2.case_id = r.case_id and s2.studier_id = ur.user_id)
       order by (select count(*) from studies s3 where s3.studier_id = ur.user_id
                   and s3.submitted_at is null and s3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      if _next is null then
        -- لا بديل: تبقى المهمة نشطة بيد صاحبها (أهون الشرّين) ويُنذَر النائب
        _ex := _ex + 1;
        perform _notify_deputies_once_daily(r.case_id, 'عجز طاقم الدراسة',
          _secret || ' — تجاوزت مهمة الدراسة مهلتها ولا دارس متاحاً بلا صفٍّ على القضية؛ بقيت بيد صاحبها. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'study_pool_exhausted', _ref);
        continue;
      end if;

      update studies set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — أُعيد الإسناد'
        where id = r.id and submitted_at is null and superseded_at is null;
      get diagnostics _hit = row_count;
      if _hit = 0 then continue; end if; -- اعتُمد في اللحظة الأخيرة — لا سحب

      insert into studies (case_id, studier_id) values (r.case_id, _next);
      _re := _re + 1;
      perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — دراسة',
        _secret || ' — مهمة دراسة تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
      insert into audit_log (actor_id, action, target) values (null, 'reassign_study', _ref);

    else
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'evaluator'
         and not exists (select 1 from assessments a2 where a2.case_id = r.case_id and a2.evaluator_id = ur.user_id)
       order by (select count(*) from assessments a3 where a3.evaluator_id = ur.user_id
                   and a3.submitted_at is null and a3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      if _next is null then
        _ex := _ex + 1;
        perform _notify_deputies_once_daily(r.case_id, 'عجز طاقم التقييم',
          _secret || ' — تجاوزت مهمة التقييم مهلتها ولا مقيّم متاحاً بلا صفٍّ على القضية؛ بقيت بيد صاحبها. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'assessment_pool_exhausted', _ref);
        continue;
      end if;

      update assessments set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — أُعيد الإسناد'
        where id = r.id and submitted_at is null and superseded_at is null;
      get diagnostics _hit = row_count;
      if _hit = 0 then continue; end if;

      insert into assessments (case_id, evaluator_id) values (r.case_id, _next);
      _re := _re + 1;
      perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — تقييم',
        _secret || ' — مهمة تقييم تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
      insert into audit_log (actor_id, action, target) values (null, 'reassign_assessment', _ref);
    end if;
  end loop;

  return query select _re, _ex;
end $function$;

revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;
