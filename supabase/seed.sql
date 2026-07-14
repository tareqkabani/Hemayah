-- ============================================================
--  بذور بيئة التطوير — حسابات نفاذ التجريبية + أدوارها + قضايا مرحلة القرار
--  يُشغَّل آلياً بعد المهاجرات في `supabase db reset` ([db.seed] في config.toml).
--  الدخول: بوابة الدخول (landing:3000) برقم هوية من 10 أرقام؛
--  البريد = {هوية}@nafath.local وكلمة السر الموحّدة = nafath-staff-2026.
--  يُنشئ auth.users + auth.identities + user_roles لكل حساب.
--  idempotent: يجوز إعادة تشغيله دون تكرار.
-- ============================================================

-- ── 1) الحسابات والأدوار (مطابقة لخريطة DEMO في apps/landing/app/api/nafath/route.ts) ──
do $$
declare
  r   record;
  uid uuid;
  pwd text := crypt('nafath-staff-2026', gen_salt('bf'));
begin
  for r in
    select * from (values
      ('1000000001','subject',            '{}'::jsonb,                        'مستفيد تجريبي'),
      ('2000000001','hotline_operator',   '{}'::jsonb,                        'مشغّل الخط الساخن'),
      ('2000000002','case_officer',       '{}'::jsonb,                        'موظف الفرز'),
      ('2000000003','studier',            '{}'::jsonb,                        'الباحث القانوني'),
      ('2000000004','evaluator',          '{}'::jsonb,                        'المقيّم النفسي/الاجتماعي'),
      ('2000000005','case_officer',       '{}'::jsonb,                        'معدّ قرار المركز'),
      ('2000000006','board_member',       '{}'::jsonb,                        'عضو المجلس (نيابة 1)'),
      ('2000000007','case_officer',       '{}'::jsonb,                        'موظف التنفيذ'),
      ('2000000008','board_chair',        '{}'::jsonb,                        'رئيس المركز'),
      ('2000000009','deputy_chair',       '{}'::jsonb,                        'نائب رئيس المركز'),
      -- أعضاء مجلس إضافيون لاكتمال 7 مقاعد مصوّتة (5 أعضاء + نائب + رئيس)
      ('2000000061','board_member',       '{}'::jsonb,                        'عضو المجلس (نيابة 2)'),
      ('2000000062','board_member',       '{}'::jsonb,                        'عضو المجلس (الداخلية)'),
      ('2000000063','board_member',       '{}'::jsonb,                        'عضو المجلس (أمن الدولة)'),
      ('2000000064','board_member',       '{}'::jsonb,                        'عضو المجلس (نزاهة)'),
      ('3000000001','competent_body',     '{"authority":"competent"}'::jsonb, 'الجهة المختصّة'),
      ('3000000002','moh_specialist',     '{"authority":"health"}'::jsonb,    'أخصائي الصحة'),
      ('3000000003','hr_specialist',      '{"authority":"hr"}'::jsonb,        'أخصائي الموارد البشرية'),
      ('3000000004','security_manager',   '{"authority":"security"}'::jsonb,  'مدير الإدارة الأمنية'),
      ('3000000005','moi_officer',        '{"authority":"moi"}'::jsonb,       'ضابط وزارة الداخلية'),
      ('4000000001','prosecutor_general', '{}'::jsonb,                        'النائب العام'),
      ('5000000001','advisor',            '{"advisor":"a1"}'::jsonb,          'مستشار المكتب الفني'),
      ('5000000002','tech_manager',       '{}'::jsonb,                        'مدير المكتب الفني')
    ) as t(nid, role, attrs, name)
  loop
    select id into uid from auth.users where email = r.nid || '@nafath.local';
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        r.nid || '@nafath.local', pwd,
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', r.name, 'national_id', r.nid, 'source', 'seed'),
        '', '', '', ''
      );
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', r.nid || '@nafath.local', 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
    insert into user_roles (user_id, role, attributes)
    values (uid, r.role::app_role, r.attrs)
    on conflict (user_id, role) do update set attributes = excluded.attributes;
  end loop;
end $$;

-- ── 2) قضيتان في مرحلة القرار لتجربة المسار المختصر فوراً ──
--   أ) REF-2026-9001: council_decisions=preparing → يدخل المعدّ (2000000005) ويرسلها للتصويت مباشرةً.
--   ب) REF-2026-9002: council_decisions=voting     → يصوّت الأعضاء (2000000006/61..64 + النائب/الرئيس) فوراً.
--   كلتاهما بحزمة كاملة: دراسة + تقييم + توصية جهة (تظهر بطاقة «توصية الجهة»).
do $$
declare
  officer uuid; studier uuid; evaluator uuid; cid uuid;
begin
  select id into officer   from auth.users where email = '2000000005@nafath.local';
  select id into studier   from auth.users where email = '2000000003@nafath.local';
  select id into evaluator from auth.users where email = '2000000004@nafath.local';

  -- حلقة على القضيتين
  declare
    specs record;
  begin
    for specs in
      select * from (values
        ('REF-2026-9001','C-2026-9001','body',   'preparing', null::timestamptz),
        ('REF-2026-9002','C-2026-9002','seeker', 'voting',    now())
      ) as s(ref, secret, channel, dec_status, vstart)
    loop
      if exists (select 1 from protection_cases where ref_no = specs.ref) then continue; end if;

      insert into protection_cases (ref_no, secret_code, category, status, source, officer_id, classification)
      values (specs.ref, specs.secret, 'witness', 'in_decision', 'local', officer, 'high')
      returning id into cid;

      insert into protection_requests (case_id, applicant_role, channel, details)
      values (cid, 'witness', specs.channel, jsonb_build_object(
        'entity','النيابة العامة بالرياض', 'case_no','2026/'|| right(specs.ref,4),
        'crime','التستّر على جريمة اتّجار', 'waqia','بلاغ شاهدٍ عن واقعة تهديد',
        'threat','مرتفع', 'extends','يشمل أفراد الأسرة'));

      -- دراسة قانونية مُعتمَدة
      insert into studies (case_id, studier_id, recommendation, proposed_type, proposed_duration, notes, submitted_at)
      values (cid, studier, 'قبول كلي', '["إخفاء البيانات","الحماية الأمنية والمرافقة"]'::jsonb,
              interval '30 days', 'تتوافر مسوّغات الحماية وفق عوامل المادة 9؛ يُقترح تدبيرا الإخفاء والمرافقة.', now());

      -- تقييم نفسي/اجتماعي مُعتمَد
      insert into assessments (case_id, evaluator_id, recommendation, proposed_type, proposed_duration, notes, submitted_at)
      values (cid, evaluator, 'قبول كلي', '["الدعم المالي المؤقّت"]'::jsonb,
              interval '30 days', 'حالة نفسية تستدعي دعماً؛ لا مانع اجتماعي من تفعيل الحماية.', now());

      -- توصية الجهة المختصّة (تظهر في حزمة الاطّلاع)
      insert into recommendations (case_id, source_body, decision, proposed_type, proposed_duration,
                                   factors9, raised_at, due_at, received_at, channel, notes)
      values (cid, 'النيابة العامة بالرياض', 'توفير', '["إخفاء البيانات"]'::jsonb, interval '30 days',
              '{"خطورة الجريمة":"عالية","جدية التهديد":"مؤكدة","أهمية الإفادة":"محورية"}'::jsonb,
              now(), now() + interval '5 days', now(), 'electronic',
              'ترى الجهة توفير الحماية لأهمية إفادة الشاهد.');

      -- قرار المركز (preparing للقضية أ، voting للقضية ب)
      insert into council_decisions (case_id, preparer_id, status, types, duration, reasoning, voting_started_at)
      values (cid, officer, specs.dec_status,
              case when specs.dec_status = 'voting' then '["إخفاء البيانات","الحماية الأمنية والمرافقة"]'::jsonb else '[]'::jsonb end,
              case when specs.dec_status = 'voting' then '30 يوماً' else null end,
              case when specs.dec_status = 'voting' then 'استناداً إلى الدراسات والتقييمات وتوصية الجهة، أُعِدّ القرار وطُرح على المجلس للتصويت.' else null end,
              specs.vstart);
    end loop;
  end;
end $$;
