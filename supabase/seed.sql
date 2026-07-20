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
      ('5000000001','advisor',            '{"advisor":"a1","spec":"قانوني"}'::jsonb,        'م. عبدالله العتيبي'),
      ('5000000002','tech_manager',       '{}'::jsonb,                        'م. فهد الدوسري'),
      -- مستشارا مكتبٍ إضافيان: للإسناد الآليّ بالعبء واختبار العزل المتبادل
      ('5000000003','advisor',            '{"advisor":"a2","spec":"أمني"}'::jsonb,          'د. منى الزهراني'),
      ('5000000004','advisor',            '{"advisor":"a3","spec":"نفسي/اجتماعي"}'::jsonb,  'أ. سارة القحطاني')
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
    else
      -- الاسم الظاهر يتبع البذرة (idempotent — يصحّح أسماء الحسابات القائمة)
      update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('name', r.name)
      where id = uid;
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

-- ── 3) سيناريو بوابتي الدارس والمقيّم (HANDOFF-STUDY-EVAL) ──
--   شخصا العرض: أ. خالد العنزي EMP-4210 (دارس) · أ. منى الزهراني EMP-4233 (مقيّمة)،
--   وأقران إضافيون (لا يدخلون) ليصحّ عدّاد «أنت أحد N» مع العزل الصفّي التام.
--   قضايا under_study مُسنَدة يدوياً بحسب سيناريو العرض (المشغّل يُسنِد الجديدة آلياً):
--   C-2026-0481 عاجل (الدوران) · C-2026-0512 أجنبي م6 (دارس) · C-2026-0492 (دارس)
--   C-2026-0488 (مقيّمة) · C-2026-0475 دراسة معتمدة · C-2026-0470 تقييم معتمد.
do $$
declare
  r record; uid uuid;
  pwd text := crypt('nafath-staff-2026', gen_salt('bf'));
  officer uuid; sid1 uuid; sid2 uuid; sid3 uuid; eid1 uuid; eid2 uuid; eid3 uuid;
  cid uuid;
begin
  -- الرمز C-2026-0481 هو بطل سيناريو الدراسة والتقييم (قائمة القبول)؛
  -- قضية الإحالات التوضيحية (REF-2026-8101 في referrals_wiring) كانت تحمله —
  -- تُعاد تسميتها بما يوافق مرجعها كي يبقى الرمز فريداً (عرضيّ بحت).
  update protection_cases set secret_code = 'C-2026-8101'
    where ref_no = 'REF-2026-8101' and secret_code = 'C-2026-0481';
  update referrals set ref = replace(ref, '2026-0481', '2026-8101')
    where case_id = (select id from protection_cases where ref_no = 'REF-2026-8101')
      and ref like '%2026-0481';
  -- أقران بلا دخول (لعدّادات الأقران فقط)
  for r in
    select * from (values
      ('2000000031','studier',   'دارس مساند أول'),
      ('2000000032','studier',   'دارس مساند ثانٍ'),
      ('2000000041','evaluator', 'مقيّم مساند أول'),
      ('2000000042','evaluator', 'مقيّم مساند ثانٍ')
    ) as t(nid, role, name)
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
        r.nid || '@nafath.local', pwd, now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', r.name, 'national_id', r.nid, 'source', 'seed'),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', r.nid || '@nafath.local', 'email_verified', true),
        'email', now(), now(), now());
    end if;
    insert into user_roles (user_id, role) values (uid, r.role::app_role)
    on conflict (user_id, role) do nothing;
  end loop;

  select id into officer from auth.users where email = '2000000002@nafath.local';
  select id into sid1 from auth.users where email = '2000000003@nafath.local';
  select id into sid2 from auth.users where email = '2000000031@nafath.local';
  select id into sid3 from auth.users where email = '2000000032@nafath.local';
  select id into eid1 from auth.users where email = '2000000004@nafath.local';
  select id into eid2 from auth.users where email = '2000000041@nafath.local';
  select id into eid3 from auth.users where email = '2000000042@nafath.local';

  -- شخصا العرض + الرقم الوظيفي (idempotent)
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name":"خالد العنزي"}'::jsonb
    where id = sid1;
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name":"منى الزهراني"}'::jsonb
    where id = eid1;
  update user_roles set attributes = coalesce(attributes,'{}'::jsonb) || '{"emp":"EMP-4210"}'::jsonb
    where user_id = sid1 and role = 'studier';
  update user_roles set attributes = coalesce(attributes,'{}'::jsonb) || '{"emp":"EMP-4233"}'::jsonb
    where user_id = eid1 and role = 'evaluator';

  for r in
    select * from (values
      -- (ref, secret, category, source, واقعة, تهديد)
      ('REF-2026-0481','C-2026-0481','witness','urgent','فساد إداري ومالي','مرتفع'),
      ('REF-2026-0512','C-2026-0512','witness','foreign','غسل أموال عابر للحدود','مرتفع'),
      ('REF-2026-0492','C-2026-0492','reporter','local','رشوة في عقود حكومية','متوسط'),
      ('REF-2026-0475','C-2026-0475','victim','local','اتّجار بالأشخاص','مرتفع'),
      ('REF-2026-0488','C-2026-0488','victim','local','ابتزاز وتهديد','متوسط'),
      ('REF-2026-0470','C-2026-0470','expert','local','تزوير مستندات رسمية','متوسط')
    ) as t(ref, secret, category, source, waqia, threat)
  loop
    if exists (select 1 from protection_cases where ref_no = r.ref) then continue; end if;

    insert into protection_cases (ref_no, secret_code, category, status, source, officer_id, classification)
    values (r.ref, r.secret, r.category::app_category, 'under_study', r.source::case_source, officer, 'high')
    returning id into cid;

    insert into protection_requests (case_id, applicant_role, channel, details)
    values (cid, r.category, 'body', jsonb_build_object(
      'entity','النيابة العامة بمنطقة الرياض', 'case_no','ق-'|| right(r.ref,4) ||'/1447',
      'incoming_no','17'|| right(r.ref,4), 'crime', r.waqia, 'waqia', r.waqia,
      'threat', r.threat, 'extends','الزوج والأبناء'));

    insert into recommendations (case_id, source_body, decision, proposed_type, proposed_duration,
                                 factors9, raised_at, due_at, received_at, channel, notes)
    values (cid, 'النيابة العامة بمنطقة الرياض', 'توفير',
      '["الحماية الأمنية","إخفاء البيانات الشخصية","سلامة التنقّل (مرافق أمني)"]'::jsonb,
      null,
      '{"نوع الجريمة":"كبيرة موجبة للتوقيف","مستوى الخطر":"شديد","امتداد الخطر":"الزوج والأبناء","القدرة على التكيف":"نعم"}'::jsonb,
      now() - interval '2 days', now() + interval '3 days', now() - interval '1 day', 'electronic',
      'جسامة الجريمة وكونها موجبة للتوقيف · وجود خطر شديد ومباشر · أهمية شهادته للمصلحة العامة.');

    if r.source = 'foreign' then
      insert into foreign_requests (case_id, country, reciprocity, ref, secret, authority, auth_kind,
                                    category, city, foreign_ref, basis, summary, status)
      values (cid, 'الأردن', true, r.ref, r.secret, 'النيابة العامة — عمّان', 'قضائية',
              'witness', 'الرياض', 'JOR/MLA/2026/188', 'اتفاقية ثنائية',
              'طلب مساعدة قانونية لحماية شاهدٍ مقيمٍ في المملكة (المادة السادسة).', 'referred');
    end if;

    -- الإسناد بحسب سيناريو العرض (المشغّلات تولّد إشعارات الإسناد/المهلة آلياً)
    if r.secret = 'C-2026-0481' then
      insert into studies (case_id, studier_id, created_at) values
        (cid, sid1, now() - interval '4 hours'), (cid, sid2, now() - interval '4 hours'),
        (cid, sid3, now() - interval '4 hours');
      insert into assessments (case_id, evaluator_id, created_at) values
        (cid, eid1, now() - interval '4 hours'), (cid, eid2, now() - interval '4 hours');
    elsif r.secret = 'C-2026-0512' then
      insert into studies (case_id, studier_id, created_at) values
        (cid, sid1, now() - interval '3 hours'), (cid, sid2, now() - interval '3 hours');
      insert into assessments (case_id, evaluator_id, created_at) values
        (cid, eid2, now() - interval '3 hours'), (cid, eid3, now() - interval '3 hours');
    elsif r.secret = 'C-2026-0492' then
      insert into studies (case_id, studier_id, created_at) values
        (cid, sid1, now() - interval '1 day'), (cid, sid3, now() - interval '1 day');
      insert into assessments (case_id, evaluator_id, created_at) values
        (cid, eid3, now() - interval '1 day');
      update notifications set created_at = now() - interval '1 day',
        sent_at = now() - interval '1 day', read = true
        where case_id = cid and recipient_id = sid1;
    elsif r.secret = 'C-2026-0475' then
      insert into studies (case_id, studier_id, recommendation, proposed_type, notes, created_at, submitted_at)
      values (cid, sid1, 'قبول كلي', '["الحماية الأمنية","إخفاء البيانات الشخصية"]'::jsonb,
              'تتوافر مسوّغات الحماية وفق عوامل المادة 9.', now() - interval '4 days', now() - interval '2 days');
      insert into studies (case_id, studier_id, created_at) values
        (cid, sid2, now() - interval '4 days'), (cid, sid3, now() - interval '4 days');
      insert into assessments (case_id, evaluator_id, created_at) values
        (cid, eid2, now() - interval '4 days');
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, read, sent_at, created_at)
      values (cid, sid1, 'output', 'استُقبل مخرَجك',
        r.secret || ' — أُرسلت دراستك للتجميع الآلي تمهيداً لعرضها على المجلس.',
        'tasks', true, now() - interval '2 days', now() - interval '2 days');
      update notifications set created_at = now() - interval '4 days',
        sent_at = now() - interval '4 days', read = true
        where case_id = cid and recipient_id = sid1 and type = 'assign';
    elsif r.secret = 'C-2026-0488' then
      insert into assessments (case_id, evaluator_id, created_at) values
        (cid, eid1, now() - interval '1 day'), (cid, eid2, now() - interval '1 day'),
        (cid, eid3, now() - interval '1 day');
      insert into studies (case_id, studier_id, created_at) values
        (cid, sid2, now() - interval '1 day');
      update notifications set created_at = now() - interval '1 day',
        sent_at = now() - interval '1 day', read = true
        where case_id = cid and recipient_id = eid1;
    elsif r.secret = 'C-2026-0470' then
      insert into assessments (case_id, evaluator_id, recommendation, proposed_type, notes, created_at, submitted_at)
      values (cid, eid1, 'قبول كلي', '["الإرشاد القانوني والنفسي والاجتماعي"]'::jsonb,
              'لا مانع نفسيّ أو اجتماعيّ من تفعيل الحماية.', now() - interval '5 days', now() - interval '2 days');
      insert into assessments (case_id, evaluator_id, created_at) values
        (cid, eid3, now() - interval '5 days');
      insert into studies (case_id, studier_id, created_at) values
        (cid, sid3, now() - interval '5 days');
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, read, sent_at, created_at)
      values (cid, eid1, 'output', 'استُقبل مخرَجك',
        r.secret || ' — أُرسل تقييمك للتجميع الآلي تمهيداً لعرضه على المجلس.',
        'tasks', true, now() - interval '2 days', now() - interval '2 days');
      update notifications set created_at = now() - interval '5 days',
        sent_at = now() - interval '5 days', read = true
        where case_id = cid and recipient_id = eid1 and type = 'assign';
    end if;

    -- تذكير النائب بالميعاد على الطلب العاجل (مشغّل الإشعار يولّد فئة «msg» آلياً)
    if r.secret = 'C-2026-0481' then
      insert into leadership_messages (case_id, author_id, author_role, leader, direction, body)
      values
        (cid, sid1, 'studier', 'deputy', 'in',
         'يقترب ميعاد تسليم الدراسة للطلب C-2026-0481 — يوم عمل ضمن مظلّة 3 أيام (المادة 10). يُرجى إتمام الاعتماد في الوقت.'),
        (cid, eid1, 'evaluator', 'deputy', 'in',
         'يقترب ميعاد تسليم التقييم للطلب C-2026-0481 — يوم عمل ضمن مظلّة 3 أيام (المادة 10). يُرجى إتمام الاعتماد في الوقت.');
    end if;
  end loop;
end $$;

-- ── 4) ثلاث رحلات تظلّم مكتملة الحزمة لبوابة المكتب الفني ──
--   قضايا صدر فيها قرار مركزٍ (بحزمة توصية + دراسة + تقييم) ثم رُفع تظلّم:
--   مُشغّلات الورود تتولى مرجع GRV والإسناد بالأقلّ عبئاً وإشعارات المستشارين والمدير.
--   idempotent عبر ref_no.
do $$
declare
  seeker uuid; studier uuid; evaluator uuid; cid uuid;
  specs record;
begin
  select id into seeker    from auth.users where email = '1000000001@nafath.local';
  select id into studier   from auth.users where email = '2000000003@nafath.local';
  select id into evaluator from auth.users where email = '2000000004@nafath.local';

  for specs in
    select * from (values
      ('REF-2026-4820','C-2026-0479','witness'::app_category,'reject',
       'لديّ أدلّة على استمرار التهديد بعد تقديم الشهادة، وأرى أن الخطر ما زال قائماً ومباشراً على حياتي وأسرتي، وأطلب إعادة النظر في رفض طلبي.',
       'reject', 'النيابة العامة', 'high'::risk_level, 9),
      ('REF-2026-4790','C-2026-0473','victim'::app_category,'accept',
       'أنواع الحماية المقرّرة لا تشمل تغيير مكان الإقامة رغم أن التهديد مصدره أشخاص يعرفون سكني الحالي.',
       'types', 'النيابة العامة', 'critical'::risk_level, 13),
      ('REF-2026-4905','C-2026-0490','reporter'::app_category,'reject',
       'تعرّضت لمضايقات متكرّرة في محيط عملي بعد الإبلاغ، وأرى أن قرار الرفض لم يأخذ بالاعتبار أثر ذلك على استقراري النفسي والوظيفي.',
       'reject', 'هيئة الرقابة ومكافحة الفساد', 'medium'::risk_level, 11)
    ) as s(ref, secret, cat, dec_outcome, reason, scope, entity, risk, days_ago)
  loop
    if exists (select 1 from protection_cases where ref_no = specs.ref) then continue; end if;

    insert into protection_cases (ref_no, secret_code, category, status, source, submitted_by, classification, created_at)
    values (specs.ref, specs.secret, specs.cat,
            case specs.dec_outcome when 'accept' then 'accepted'::case_status else 'rejected'::case_status end,
            'local', seeker, specs.risk, now() - make_interval(days => specs.days_ago))
    returning id into cid;

    insert into recommendations (case_id, source_body, decision, notes, raised_at, received_at)
    values (cid, specs.entity, 'توفير',
      'توجد قضية جزائية قائمة لدى الجهة، وأهمية أقوال المعني مؤثّرة في الإثبات.',
      now() - make_interval(days => specs.days_ago - 1), now() - make_interval(days => specs.days_ago - 3));

    insert into studies (case_id, studier_id, recommendation, proposed_type, notes, submitted_at)
    values (cid, studier,
      case specs.dec_outcome when 'accept' then 'قبول' else 'رفض' end,
      '["الحماية الأمنية","إخفاء البيانات الشخصية"]'::jsonb,
      case specs.dec_outcome
        when 'accept' then 'الواقعة جسيمة والخطر مرتفع؛ تُقرّر الحماية الأمنية وإخفاء البيانات.'
        else 'الواقعة ذات أهمية، إلا أن عناصر المباشرة لم تكتمل في تاريخ الدراسة.' end,
      now() - make_interval(days => specs.days_ago - 4));

    insert into assessments (case_id, evaluator_id, recommendation, proposed_type, notes, submitted_at)
    values (cid, evaluator,
      case specs.dec_outcome when 'accept' then 'قبول' else 'رفض' end,
      '["الإرشاد القانوني/النفسي/الاجتماعي"]'::jsonb,
      case specs.dec_outcome
        when 'accept' then 'الأثر النفسي مرتفع والدعم الاجتماعي محدود؛ روعي ذلك في الأنواع المقترحة.'
        else 'يوجد أثر نفسي ملموس دون بلوغ عتبة الحماية الكاملة وقت التقييم.' end,
      now() - make_interval(days => specs.days_ago - 4));

    insert into council_decisions (case_id, status, types, reasoning, issued_type, issued_reason, issued_at)
    values (cid, 'issued',
      case specs.dec_outcome when 'accept' then '["الحماية الأمنية","إخفاء البيانات الشخصية"]'::jsonb else '[]'::jsonb end,
      case specs.dec_outcome when 'accept' then 'الاكتفاء بالحماية الأمنية وإخفاء البيانات في هذه المرحلة.' else null end,
      specs.dec_outcome,
      case specs.dec_outcome
        when 'accept' then 'قبول الطلب بأنواع حماية محدّدة دون تغيير مكان الإقامة.'
        else 'عدم اكتمال عناصر الخطر المباشر وفق المادة (التاسعة)، وكفاية التدابير الإجرائية العامة في هذه المرحلة.' end,
      now() - make_interval(days => specs.days_ago - 6));

    insert into grievances (case_id, against, scope, applicant_reason, filed_at)
    values (cid, case specs.scope when 'types' then 'الاعتراض على أنواع الحماية المقرّرة' else 'الاعتراض على رفض الطلب' end,
            specs.scope, specs.reason, now() - make_interval(days => specs.days_ago - 8));
  end loop;
end $$;
