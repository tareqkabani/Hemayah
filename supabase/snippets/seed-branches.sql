-- ============================================================
--  بذر وحدات استقبال الإحالة للجهات المختصة + حسابات اختبار لكل جهة.
--  النماذج التنظيمية (بتأكيد المستخدم 2026-08-06):
--    - النيابة العامة: مناطقية (نيابات مناطق؛ والهيكل الهرمي الكامل
--      نيابات مناطق + فروع محافظات ينتظر القائمة الرسمية و parent_id)
--    - نزاهة / رئاسة أمن الدولة / وزارة الداخلية / وزارة العدل: مركزية —
--      وحدة واحدة بلا فروع، والبذرة تُوحّد أي وحدات متناثرة قائمة
--      (صنيعة الإنشاء التلقائي القديم في triage_decide) في المركز ثم تحذفها
--      بعد نقل كل الإشارات إليها (توصيات/اعتمادات/قضايا/سمات مستخدمين).
--  الحسابات لكل جهة (النمط 3X0000000N حيث N ترتيب الجهة):
--    31…  موظف (clerk)  — يعدّ التوصية      (المركزية: بالمركز؛ النيابة: نيابة الرياض)
--    32…  رئيس (head)   — يعتمدها
--    33…  المقر (hq)    — اطّلاع تجميعي قراءة فقط على كل وحدات جهته
--  idempotent — والدخول من الشاشة الموحّدة برقم الهوية مباشرة
--  (التوجيه الاحتياطي في بوابة نفاذ يقرأ الدور الحقيقي من user_roles).
--
--  التشغيل (محلياً أو على سيرفر القاعدة):
--    docker exec -i supabase_db_Hemayah psql -U postgres \
--      -f - < supabase/snippets/seed-branches.sql
-- ============================================================

do $$
declare
  ent  record;
  reg  record;
  acct record;
  _b   uuid;
  uid  uuid;
  nid  text;
  pwd  text := crypt('nafath-staff-2026', gen_salt('bf'));
begin
  for ent in
    select * from (values
      (1, 'prosecution',    'النيابة العامة',              'regional'),
      (2, 'state_security', 'رئاسة أمن الدولة',            'central'),
      (3, 'moi',            'وزارة الداخلية',              'central'),
      (4, 'nazaha',         'هيئة الرقابة ومكافحة الفساد', 'central'),
      (5, 'moj',            'وزارة العدل',                 'central')
    ) as e(idx, code, label, model)
  loop
    if ent.model = 'central' then
      -- ── الوحدة المركزية: الموسومة hq إن وُجدت، وإلا صفّ الرياض يُحوَّل، وإلا تُنشأ ──
      select id into _b from branches
       where entity = ent.code::competent_entity and is_hq limit 1;
      if _b is null then
        select id into _b from branches
         where entity = ent.code::competent_entity and region = 'RUH'::region_code limit 1;
      end if;
      if _b is null then
        insert into branches (entity, region, name, is_hq, active)
        values (ent.code::competent_entity, 'RUH'::region_code,
                ent.label || ' — المركز الرئيسي', true, true)
        returning id into _b;
      else
        update branches
           set name = ent.label || ' — المركز الرئيسي', is_hq = true, active = true
         where id = _b;
      end if;
      -- توحيد: نقل كل ما يشير لوحداتٍ أخرى للجهة إلى المركز ثم حذفها
      update recommendations set branch_id = _b
       where branch_id in (select id from branches where entity = ent.code::competent_entity and id <> _b);
      update recommendation_approvals set branch_id = _b
       where branch_id in (select id from branches where entity = ent.code::competent_entity and id <> _b);
      update protection_cases set branch_id = _b
       where branch_id in (select id from branches where entity = ent.code::competent_entity and id <> _b);
      update user_roles set attributes = attributes || jsonb_build_object('branch_id', _b::text)
       where attributes->>'branch_id' in
             (select id::text from branches where entity = ent.code::competent_entity and id <> _b);
      delete from branches where entity = ent.code::competent_entity and id <> _b;
    else
      -- ── وحدة استقبال لكل منطقة (نيابات المناطق) ──
      for reg in
        select * from (values
          ('RUH','نيابة منطقة الرياض'), ('MAK','نيابة منطقة مكة المكرمة'),
          ('MED','نيابة منطقة المدينة المنورة'), ('QAS','نيابة منطقة القصيم'),
          ('EAS','نيابة المنطقة الشرقية'), ('ASR','نيابة منطقة عسير'),
          ('TAB','نيابة منطقة تبوك'), ('HAI','نيابة منطقة حائل'),
          ('NOR','نيابة منطقة الحدود الشمالية'), ('JAZ','نيابة منطقة جازان'),
          ('NAJ','نيابة منطقة نجران'), ('BAH','نيابة منطقة الباحة'),
          ('JOF','نيابة منطقة الجوف')
        ) as r(code, label)
      loop
        insert into branches (entity, region, name, is_hq, active)
        values (ent.code::competent_entity, reg.code::region_code,
                ent.label || ' — ' || reg.label, false, true)
        on conflict (entity, region) do update set name = excluded.name, active = true;
      end loop;
      select id into _b from branches
       where entity = ent.code::competent_entity and region = 'RUH'::region_code
       limit 1;
    end if;

    -- ── حسابات الجهة الثلاثة ──
    for acct in
      select * from (values
        ('31', 'clerk', 'موظف'),
        ('32', 'head',  'رئيس'),
        ('33', 'hq',    'مقر')
      ) as a(prefix, level, label)
    loop
      nid := acct.prefix || '0000000' || ent.idx;
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
          jsonb_build_object('name', acct.label || ' — ' || ent.label,
                             'national_id', nid, 'source', 'seed-branches'),
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
      else
        -- الاسم الظاهر يتبع البذرة (idempotent — يصحّح أسماء الحسابات القائمة)
        update auth.users
           set raw_user_meta_data = raw_user_meta_data
               || jsonb_build_object('name', acct.label || ' — ' || ent.label)
         where id = uid;
      end if;
      insert into user_roles (user_id, role, attributes)
      values (uid, 'competent_body'::app_role,
              jsonb_build_object('authority', 'competent', 'entity', ent.code, 'level', acct.level)
              || case when acct.level in ('clerk','head')
                      then jsonb_build_object('branch_id', _b::text)
                      else '{}'::jsonb end)
      on conflict (user_id, role) do update set attributes = excluded.attributes;
    end loop;
  end loop;
end $$;

-- عرض الناتج
select entity as "الجهة", count(*) as "عدد الوحدات",
       bool_or(is_hq) as "مركزية؟"
from branches group by entity order by entity;
select u.raw_user_meta_data->>'national_id' as "الهوية",
       u.raw_user_meta_data->>'name'        as "الحساب",
       r.attributes->>'level'               as "المستوى"
from auth.users u
join user_roles r on r.user_id = u.id and r.role = 'competent_body'
order by 1;
-- حارس: لا توصيات يتيمة بلا وحدة
select count(*) as "توصيات بلا وحدة (يجب أن تكون 0)" from recommendations where branch_id is null;
