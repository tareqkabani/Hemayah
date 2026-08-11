-- ============================================================
--  بذر دفعة طالبي حماية تجريبيين — للاختبار المتكرر بعدة سيناريوهات.
--  الهويات: 1100000001 .. 11000000NN (NN = :count، الافتراضي 10)
--  الدخول من الشاشة الموحّدة (3000) برقم الهوية مباشرة.
--  idempotent: يجوز إعادة تشغيله دون تكرار.
--
--  التشغيل (من جذر المشروع):
--    docker exec -i supabase_db_Hemayah psql -U postgres \
--      -v count=10 -f - < supabase/snippets/seed-seekers.sql
-- ============================================================
\if :{?count} \else \set count 10 \endif
select set_config('seed.count', :'count', false) \g /dev/null

do $$
declare
  i   int;
  n   int := coalesce(nullif(current_setting('seed.count', true), ''), '10')::int;
  nid text;
  uid uuid;
  pwd text := crypt('nafath-staff-2026', gen_salt('bf'));
begin
  for i in 1..n loop
    nid := '11000000' || lpad(i::text, 2, '0');
    select id into uid from auth.users where email = nid || '@nafath.local';
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        nid || '@nafath.local', pwd,
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', 'طالب حماية تجريبي ' || i, 'national_id', nid, 'source', 'seed-seekers'),
        '', '', '', ''
      );
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', nid || '@nafath.local', 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
    insert into user_roles (user_id, role, attributes)
    values (uid, 'subject'::app_role, '{}'::jsonb)
    on conflict (user_id, role) do nothing;
  end loop;
  raise notice 'تم بذر % طالب حماية (الهويات 1100000001..%)', n, '11000000' || lpad(n::text, 2, '0');
end $$;

-- عرض الناتج
select u.raw_user_meta_data->>'national_id' as "الهوية",
       u.raw_user_meta_data->>'name'        as "الاسم"
from auth.users u
join user_roles r on r.user_id = u.id and r.role = 'subject'
where u.email like '11000000%@nafath.local'
order by 1;
