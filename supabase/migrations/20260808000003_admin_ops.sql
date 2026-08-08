-- 20260808000003_admin_ops.sql — عمليات بوابة مدير النظام (الدفعة الثانية)
-- الإعدادات وأعلام الميزات + سجل التدقيق التقني + صحة النظام.
-- app_settings يبقى محجوباً عن الوصول المباشر (قرار 20260727000007) —
-- الإدارة عبر دوال SECURITY DEFINER تفحص دور sysadmin، وكل تغيير مؤثَّر.
-- sysadmin_no_pii: لا دالة هنا تمسّ بيانات مشمولين — التدقيق التقني مرشَّح
-- بأفعال المحتوى والإعدادات والإشعارات (المستهدفات مفاتيح ومعرّفات مرمّزة).

-- ══ 1) الإعدادات: قراءة وكتابة لمدير النظام ══
create or replace function public.admin_get_settings()
returns table(key text, value text)
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  return query select s.key, s.value from app_settings s order by s.key;
end $$;

create or replace function public.admin_set_setting(_key text, _value text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  if _key is null or btrim(_key) = '' then raise exception 'المفتاح مطلوب'; end if;
  insert into app_settings as s (key, value) values (btrim(_key), coalesce(_value, ''))
  on conflict (key) do update set value = excluded.value;
  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'settings_set', btrim(_key) || '=' || coalesce(_value, ''));
end $$;

-- ══ 2) سجل التدقيق التقني ══
-- الأفعال التقنية فقط: محتوى المنصّة، الإشعارات، الإعدادات — لا أفعال القضايا
-- (كشف الهوية/القرارات/الإحالات تخصّ تدقيق الامتثال لا مدير النظام).
create or replace function public.admin_tech_audit(_limit int default 200)
returns table(id bigint, actor_id uuid, action text, target text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  return query
    select a.id, a.actor_id, a.action, a.target, a.created_at
    from audit_log a
    where a.action ~ '^(content_|notify_|settings_)'
    order by a.id desc
    limit least(greatest(coalesce(_limit, 200), 1), 1000);
end $$;

-- ══ 3) صحة النظام — عدّادات تشغيلية بلا أي PII ══
create or replace function public.admin_system_health()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare _out jsonb;
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
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
end $$;

revoke execute on function public.admin_get_settings() from public, anon;
revoke execute on function public.admin_set_setting(text, text) from public, anon;
revoke execute on function public.admin_tech_audit(int) from public, anon;
revoke execute on function public.admin_system_health() from public, anon;
grant execute on function public.admin_get_settings() to authenticated;
grant execute on function public.admin_set_setting(text, text) to authenticated;
grant execute on function public.admin_tech_audit(int) to authenticated;
grant execute on function public.admin_system_health() to authenticated;
