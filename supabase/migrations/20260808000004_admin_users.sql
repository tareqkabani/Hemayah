-- 20260808000004_admin_users.sql — إدارة حسابات المنسوبين وأدوارهم (بوابة الأدمن، الدفعة الثالثة)
-- نطاق التسليم: «ما يديره: حسابات المنسوبين وأدوارهم…» مع sysadmin_no_pii:
--   • طالبو الحماية (دور subject) لا يظهرون إطلاقاً — حساباتهم بيانات مشمولين.
--   • لا منح لدور subject من هنا (يُزرع عبر جسر الدخول حصراً).
--   • لا تعديل للحساب الذاتي (لا رفع صلاحيات ولا قفل النفس خارجاً).
--   • كل منحٍ وسحبٍ مؤثَّر في audit_log.

create or replace function public.admin_list_staff()
returns table(user_id uuid, email text, name text, roles jsonb, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  return query
    select u.id,
           u.email::text,
           coalesce(u.raw_user_meta_data ->> 'name', '—'),
           coalesce(jsonb_agg(jsonb_build_object('role', ur.role, 'attributes', coalesce(ur.attributes, '{}'::jsonb))
                    order by ur.role) filter (where ur.role is not null), '[]'::jsonb),
           u.created_at,
           u.last_sign_in_at
    from auth.users u
    join user_roles ur on ur.user_id = u.id and ur.role <> 'subject'
    where not exists (select 1 from user_roles s where s.user_id = u.id and s.role = 'subject')
    group by u.id, u.email, u.raw_user_meta_data, u.created_at, u.last_sign_in_at
    order by u.created_at;
end $$;

create or replace function public.admin_grant_role(_user uuid, _role app_role, _attrs jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  if _role = 'subject' then raise exception 'دور طالب الحماية لا يُمنح من بوابة الأدمن.'; end if;
  if _user = auth.uid() then raise exception 'لا تعديل لأدوار حسابك أنت — يتولاه مدير نظامٍ آخر.'; end if;
  if exists (select 1 from user_roles s where s.user_id = _user and s.role = 'subject') then
    raise exception 'الحساب مستفيدٌ (مشمول) — لا يُمنح أدوار منسوبين.';
  end if;
  insert into user_roles as ur (user_id, role, attributes)
  values (_user, _role, coalesce(_attrs, '{}'::jsonb))
  on conflict (user_id, role) do update set attributes = coalesce(_attrs, ur.attributes);
  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'role_grant_' || _role, _user::text);
end $$;

create or replace function public.admin_revoke_role(_user uuid, _role app_role)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  if _role = 'subject' then raise exception 'دور طالب الحماية لا يُدار من بوابة الأدمن.'; end if;
  if _user = auth.uid() then raise exception 'لا تعديل لأدوار حسابك أنت — يتولاه مدير نظامٍ آخر.'; end if;
  delete from user_roles where user_id = _user and role = _role;
  if not found then raise exception 'الدور غير ممنوح لهذا الحساب.'; end if;
  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'role_revoke_' || _role, _user::text);
end $$;

-- أفعال الأدوار تظهر في سجل التدقيق التقني لمدير النظام
create or replace function public.admin_tech_audit(_limit int default 200)
returns table(id bigint, actor_id uuid, action text, target text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  return query
    select a.id, a.actor_id, a.action, a.target, a.created_at
    from audit_log a
    where a.action ~ '^(content_|notify_|settings_|role_)'
    order by a.id desc
    limit least(greatest(coalesce(_limit, 200), 1), 1000);
end $$;

revoke execute on function public.admin_list_staff() from public, anon;
revoke execute on function public.admin_grant_role(uuid, app_role, jsonb) from public, anon;
revoke execute on function public.admin_revoke_role(uuid, app_role) from public, anon;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_grant_role(uuid, app_role, jsonb) to authenticated;
grant execute on function public.admin_revoke_role(uuid, app_role) to authenticated;
