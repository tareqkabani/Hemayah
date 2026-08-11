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
      ('3000000001','competent_body',     '{"authority":"competent","entity":"prosecution","level":"clerk"}'::jsonb, 'موظف الفرع — النيابة'),
      -- رئيس الفرع: فاعلُ الدرجة الأولى في سلسلة الاعتماد (م7) — بلا حسابٍ
      -- بمستوى head تبقى decide_recommendation_approval بلا من يستدعيها.
      ('3000000006','competent_body',     '{"authority":"competent","entity":"prosecution","level":"head"}'::jsonb, 'رئيس الفرع — النيابة'),
      -- المقر: يشرف على كل فروع جهته ولا يعتمد (rec_hq_read قراءةٌ فقط) —
      -- وشاشاته صارت مقصورةً على مستواه بعد أن صار مبدّل الدور تابعاً لـcb_level.
      ('3000000007','competent_body',     '{"authority":"competent","entity":"prosecution","level":"hq"}'::jsonb,   'المقر — النيابة العامة'),
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
    -- دمجٌ لا استبدال: إعادة تشغيل البذرة يجب ألا تدهس سمات كتبتها مهاجرات
    -- لاحقة (authority=legal لموظف المركز، ag/technical للإشراف — درس 2026-08-10)
    on conflict (user_id, role) do update
      set attributes = coalesce(user_roles.attributes,'{}'::jsonb) || excluded.attributes;
  end loop;
end $$;

-- ── 1-ب) ربط مستخدم الجهة المختصّة بفرعه ──
--   سياسة rec_branch_rw تشترط branch_id (uuid من branches) وlevel ∈ {clerk,head}
--   في سمات competent_body — وبدونهما تُرجع cb_branch()‏ NULL فلا يمرّ أي صف.
--   مهاجرة 20260706000009 كانت تمنحهما، لكنها تسبق البذورَ في `db reset` فلا
--   تجد المستخدمَ بعد (وupsert القسم (1) صار يدمج السمات لا يستبدلها منذ #97،
--   لكنه لا يخترع ما ليس في البذرة) — فالمنح هنا، بعد الإدراج، هو الفعّال.
--   (branch_id يُخزَّن نصاً داخل jsonb.)
do $$
declare _b uuid; _u uuid;
begin
  select id into _b from branches
   where entity = 'prosecution' and region = 'RUH' and kind = 'region' limit 1;
  select id into _u from auth.users where email = '3000000001@nafath.local';
  if _b is not null and _u is not null then
    update user_roles
       -- الافتراضات أولاً والموجود يسود: حسابٌ مضبوطٌ مسبقاً (clerk مثلاً في
       -- فصل الأدوار لسلسلة الاعتماد) لا يُرقَّى قسراً إلى head — الترقية تمنح
       -- صلاحية اعتمادٍ لم يقصدها أحد، وتهدم قاعدة «الموظف لا يعتمد عملَ نفسه».
       set attributes = jsonb_build_object('level', 'head', 'branch_id', _b::text, 'entity', 'prosecution')
        || coalesce(attributes, '{}'::jsonb)
     where role = 'competent_body' and user_id = _u;
  end if;
end $$;

-- ── ١-ب٢) فرعُ حسابات الجهة المختصة (الموظف ورئيسه معاً) ──
-- كل سياسات RLS على recommendations موجَّهة بالفرع (cb_branch)، وسلسلةُ
-- الاعتماد تشترط أن يكون الموظفُ ورئيسُه في الفرع نفسه. الجسر يحلّ السمة
-- عند الدخول، لكن اختبارات القاعدة والانتحال لا تمرّ به — فتُحلّ هنا أيضاً.
do $$
declare _ruh uuid;
begin
  select id into _ruh from branches where entity = 'prosecution' and region = 'RUH' limit 1;
  if _ruh is null then return; end if;
  update user_roles ur
     set attributes = coalesce(ur.attributes, '{}'::jsonb) || jsonb_build_object('branch_id', _ruh::text)
    from auth.users u
   where u.id = ur.user_id and ur.role = 'competent_body'
     and u.email in ('3000000001@nafath.local', '3000000006@nafath.local');
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
      values (cid, 'شاهد', specs.channel, jsonb_build_object(
        'entity','النيابة العامة بالرياض', 'case_no','2026/'|| right(specs.ref,4),
        'crime','التستّر على جريمة اتّجار', 'prior_submit', true,
        'reason','بلاغ شاهدٍ عن واقعة تهديد'));

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
    values (cid,
      case r.category when 'witness' then 'شاهد' when 'victim' then 'مجني عليه'
                      when 'expert' then 'خبير' when 'reporter' then 'مبلّغ' else r.category end,
      'body', jsonb_build_object(
      'entity','النيابة العامة بمنطقة الرياض', 'case_no','ق-'|| right(r.ref,4) ||'/1447',
      'reg_no','17'|| right(r.ref,4), 'crime', r.waqia, 'prior_submit', true));

    insert into recommendations (case_id, source_body, decision, proposed_type, proposed_duration,
                                 factors9, raised_at, due_at, received_at, channel, notes)
    values (cid, 'النيابة العامة بمنطقة الرياض', 'توفير',
      '["الحماية الأمنية","إخفاء البيانات الشخصية","سلامة التنقّل (مرافق أمني)"]'::jsonb,
      null,
      '{"crimeType":"كبيرة موجبة للتوقيف","riskLevel":"شديد","extends":"نعم","extendsWho":"الزوج والأبناء","adapt":"نعم"}'::jsonb,
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

-- ── 3ب) ثلاث حالات «حزمة الاطّلاع» (حزمة التسليم 11 — 10 أغسطس 2026) ──
--   C-2026-0503: تباين آراء (دراسة كلي · تقييم جزئي · تقييم كلي) — مبلّغ/نزاهة/متوسط.
--   C-2026-0517: مسار الرفض (توصية بعدم التوفير + دراسة رفض + تقييم جزئي) — خبير/النيابة/منخفض.
--   C-2026-0524: عاجل الوجاهة (كلي ×2 + جزئي برفض الأسرة تغيير الإقامة) — شاهد/النيابة/حرِج.
--   كل حالة بحزمة كاملة: subjects بالديموغرافيا والمصادر + جهة طوارئ + طلب مفصّل
--   + توصية بنموذجها الموحّد (details) + الدراسات/التقييمات بمؤلّفين متمايزين — status=preparing.
do $$
declare
  officer uuid; s1 uuid; s2 uuid; e1 uuid; e2 uuid; e3 uuid; cid uuid;
begin
  select id into officer from auth.users where email = '2000000005@nafath.local';
  select id into s1 from auth.users where email = '2000000003@nafath.local';
  select id into s2 from auth.users where email = '2000000031@nafath.local';
  select id into e1 from auth.users where email = '2000000004@nafath.local';
  select id into e2 from auth.users where email = '2000000041@nafath.local';
  select id into e3 from auth.users where email = '2000000042@nafath.local';

  -- ① C-2026-0503 — تباين الآراء
  if not exists (select 1 from protection_cases where ref_no = 'REF-2026-0503') then
    insert into protection_cases (ref_no, secret_code, category, status, source, officer_id, classification)
    values ('REF-2026-0503', 'C-2026-0503', 'reporter', 'in_decision', 'local', officer, 'medium')
    returning id into cid;
    insert into subjects (case_id, subject_type, gender, nationality, birth_date, marital_status,
                          national_address, employer, job_title, education_level, source_flags)
    values (cid, 'principal', 'ذكر', 'سعودي', '1988-04-12', 'متزوج',
            '{"short":"RHTA3344","building":"3344","street":"شارع الأمير محمد","secondary":"7710","district":"حي الشاطئ","postal":"32413","city":"الدمّام"}'::jsonb,
            'أمانة المنطقة الشرقية', 'أخصائي مراجعة مالية', 'بكالوريوس',
            '{"nafath":"live","spl":"manual","hrdf":"manual"}'::jsonb);
    insert into emergency_contacts (case_id, relationship) values (cid, 'أخ');
    -- details بمفاتيح الكاتب الحيّ (submit_protection_request) حصراً — لا مفاتيح لا يكتبها أحد
    insert into protection_requests (case_id, applicant_role, channel, details)
    values (cid, 'مبلّغ', 'seeker', jsonb_build_object(
      'crime','فساد إداري ومالي',
      'entity','هيئة الرقابة ومكافحة الفساد', 'prior_submit', true,
      'case_no','2026/0503',
      'reason','تلقّيت تهديدات مبطّنة بعد تقديم البلاغ، وأخشى الإضرار بوظيفتي وسمعتي.',
      'files', jsonb_build_array('صورة البلاغ المقدّم', 'رسائل التهديد')));
    -- عوامل التوصية في factors9 بلهجة نموذج التوصية (كاتبها الحيّ) — لا في details اليتيم
    insert into recommendations (case_id, source_body, decision, proposed_type, proposed_duration,
                                 factors9, raised_at, due_at, received_at, channel, notes)
    values (cid, 'هيئة الرقابة ومكافحة الفساد', 'توفير',
            '["إخفاء البيانات الشخصية وما يدل على الهوية","توفير وسائل الإبلاغ الفوري عن الخطر"]'::jsonb,
            interval '30 days',
            jsonb_build_object(
              'health','سليم', 'criminal','لا سوابق', 'psych','قلق وظيفي عابر', 'reveal','لا يرغب في الكشف',
              'caseSummary','مخالفات مالية وإدارية في عقود تشغيل بلدية أسهم بلاغه في كشفها.',
              'caseStage','التحقيق', 'applicantRoleDesc','مصدر البلاغ الأول وموثِّق المستندات المالية.',
              'contacted','نعم', 'contactKind','هاتفياً',
              'crimeType','جريمة كبرى', 'crimeDesc','فساد إداري ومالي', 'hidden2','نعم (م2)',
              'threatExists','يوجد', 'threatType','تهديد وظيفي ومعنوي', 'riskLevel','متوسط',
              'extends','لا', 'extendsWho','لا يمتدّ',
              'reasons', jsonb_build_array('جدية التهديد قائمة', 'أهمية الإفادة محورية في إثبات الواقعة'),
              'alternatives','النقل الوظيفي داخل الجهة',
              'attachFiles', jsonb_build_array('محضر التواصل', 'مذكرة تقييم البلاغ')),
            now(), now() + interval '5 days', now(), 'electronic',
            'البلاغ جوهري لكشف شبكة المخالفات؛ تُرى حمايته إجرائياً مع إخفاء بياناته.');
    insert into studies (case_id, studier_id, recommendation, proposed_type, proposed_duration, notes,
                         found_recommendation, found_request, submitted_at)
    values (cid, s1, 'قبول كلي',
            '["إخفاء البيانات الشخصية وما يدل على الهوية","توفير وسائل الإبلاغ الفوري عن الخطر"]'::jsonb,
            interval '30 days',
            'اطّلعتُ على الطلب والتوصية؛ المسوّغات قائمة والمستندات متسقة، وتتحقق شروط م9.',
            true, true, now());
    insert into assessments (case_id, evaluator_id, recommendation, partial_reason, proposed_type, proposed_duration,
                             notes, found_recommendation, found_request, submitted_at)
    values
      (cid, e1, 'قبول جزئي', 'يُكتفى بالتدابير الإجرائية؛ لا حاجة لتغيير محل الإقامة في المرحلة الحالية.',
       '["إخفاء البيانات الشخصية وما يدل على الهوية"]'::jsonb, interval '30 days',
       'المقابلة تُظهر توازناً نفسياً مع قلق وظيفي؛ التدابير الإجرائية كافية حالياً.',
       true, true, now()),
      (cid, e2, 'قبول كلي', null,
       '["إخفاء البيانات الشخصية وما يدل على الهوية","توفير وسائل الإبلاغ الفوري عن الخطر"]'::jsonb,
       interval '30 days',
       'مؤشّرات الضغط المعنوي متصاعدة؛ يُوصى بالحماية بأنواعها المقترحة كاملة.',
       true, true, now());
    insert into council_decisions (case_id, preparer_id, status, types)
    values (cid, officer, 'preparing', '[]'::jsonb);
  end if;

  -- ② C-2026-0517 — مسار الرفض
  if not exists (select 1 from protection_cases where ref_no = 'REF-2026-0517') then
    insert into protection_cases (ref_no, secret_code, category, status, source, officer_id, classification)
    values ('REF-2026-0517', 'C-2026-0517', 'expert', 'in_decision', 'local', officer, 'low')
    returning id into cid;
    insert into subjects (case_id, subject_type, gender, nationality, birth_date, marital_status,
                          national_address, employer, job_title, education_level, source_flags)
    values (cid, 'principal', 'ذكر', 'سعودي', '1975-11-02', 'متزوج',
            '{"short":"MNRB5521","building":"5521","street":"طريق الهجرة","secondary":"6620","district":"حي العزيزية","postal":"42317","city":"المدينة المنورة"}'::jsonb,
            'مكتب خبرة معتمد', 'خبير خطوط ومستندات', 'ماجستير',
            '{"nafath":"live","spl":"manual","hrdf":"manual"}'::jsonb);
    insert into emergency_contacts (case_id, relationship) values (cid, 'زوجة');
    insert into protection_requests (case_id, applicant_role, channel, details)
    values (cid, 'خبير', 'seeker', jsonb_build_object(
      'crime','تزوير محرّرات رسمية',
      'entity','النيابة العامة', 'prior_submit', true,
      'case_no','2026/0517',
      'reason','أخشى ردّ فعل أطراف القضية بعد إيداع تقرير الخبرة.',
      'files', jsonb_build_array('صورة من تقرير الخبرة')));
    insert into recommendations (case_id, source_body, decision, proposed_type, proposed_duration,
                                 factors9, raised_at, due_at, received_at, channel, notes)
    values (cid, 'النيابة العامة بالمدينة المنورة', 'عدم توفير', '[]'::jsonb, null,
            jsonb_build_object(
              'health','سليم', 'criminal','لا سوابق', 'psych','لا ملاحظات', 'reveal','لا مانع لديه من الكشف',
              'caseSummary','قضية تزوير محرّرات رسمية أودع فيها الخبير تقريره الفني.',
              'caseStage','المحاكمة', 'applicantRoleDesc','خبير مستندات معيّن من الدائرة — إفادته فنية مساندة.',
              'contacted','نعم', 'contactKind','كتابياً',
              'crimeType','جريمة كبرى', 'crimeDesc','تزوير محرّرات رسمية', 'hidden2','لا',
              'threatExists','لا يوجد', 'riskLevel','منخفض',
              'extends','لا', 'extendsWho','لا يمتدّ',
              'reasons', jsonb_build_array('جدية التهديد غير مؤكدة', 'أهمية الإفادة مساندة'),
              'alternatives','الاكتفاء بالمتابعة الدورية وقنوات البلاغ المعتادة',
              'attachFiles', jsonb_build_array('محضر التواصل')),
            now(), now() + interval '5 days', now(), 'electronic',
            'لم يثبت تهديد فعلي؛ والإفادة فنية مساندة يمكن أداؤها دون تدابير خاصة.');
    insert into studies (case_id, studier_id, recommendation, reject_reasons, proposed_type, notes,
                         found_recommendation, found_request, submitted_at)
    values (cid, s2, 'رفض الحماية',
            '[{"t":"انتفاء جدية التهديد","note":"لم يثبت تهديد فعلي أو وشيك بعد التحرّي."},{"t":"كفاية القنوات المعتادة","note":"طبيعة الإفادة الفنية لا تستلزم تدابير م14."}]'::jsonb,
            '[]'::jsonb,
            'بعد الاطّلاع على الطلب والتوصية لم تتحقق عوامل م9؛ يُرى عدم توفير الحماية.',
            true, true, now());
    insert into assessments (case_id, evaluator_id, recommendation, partial_reason, proposed_type, proposed_duration,
                             notes, found_recommendation, found_request, submitted_at)
    values (cid, e1, 'قبول جزئي', 'قلق مهني محدود يُعالج بوسائل الإبلاغ الفوري دون بقية التدابير.',
            '["توفير وسائل الإبلاغ الفوري عن الخطر"]'::jsonb, interval '30 days',
            'أثر نفسي محدود؛ يُكتفى بتمكينه من الإبلاغ الفوري عند أي مستجد.',
            true, true, now());
    insert into council_decisions (case_id, preparer_id, status, types)
    values (cid, officer, 'preparing', '[]'::jsonb);
  end if;

  -- ③ C-2026-0524 — عاجل الوجاهة (حرِج)
  if not exists (select 1 from protection_cases where ref_no = 'REF-2026-0524') then
    insert into protection_cases (ref_no, secret_code, category, status, source, officer_id, classification)
    values ('REF-2026-0524', 'C-2026-0524', 'witness', 'in_decision', 'local', officer, 'critical')
    returning id into cid;
    insert into subjects (case_id, subject_type, gender, nationality, birth_date, marital_status,
                          national_address, employer, job_title, education_level, source_flags)
    values (cid, 'principal', 'ذكر', 'سعودي', '1992-07-30', 'متزوج',
            '{"short":"ABHA7789","building":"7789","street":"شارع الملك فيصل","secondary":"3312","district":"حي الموظفين","postal":"62521","city":"أبها"}'::jsonb,
            'قطاع خاص — نقل ولوجستيات', 'مشرف مستودعات', 'دبلوم',
            '{"nafath":"live","spl":"manual","hrdf":"manual"}'::jsonb);
    insert into emergency_contacts (case_id, relationship) values (cid, 'أب');
    insert into protection_requests (case_id, applicant_role, channel, details)
    values (cid, 'شاهد', 'seeker', jsonb_build_object(
      'crime','اتّجار بالمواد المخدّرة',
      'entity','النيابة العامة', 'prior_submit', true,
      'case_no','2026/0524',
      'reason','تلقّيت تهديدات مباشرة بالقتل أنا وأسرتي بعد الإدلاء بشهادتي.',
      'files', jsonb_build_array('محضر الشهادة', 'بلاغ التهديد')));
    insert into recommendations (case_id, source_body, decision, proposed_type, proposed_duration,
                                 factors9, raised_at, due_at, received_at, channel, notes)
    values (cid, 'النيابة العامة بعسير', 'توفير',
            '["الحماية الأمنية","المرافقة الأمنية وسلامة التنقّل","تغيير محل الإقامة"]'::jsonb, null,
            jsonb_build_object(
              'health','ضغط نفسي ظاهر', 'criminal','لا سوابق', 'psych','قلق حادّ لديه ولدى أسرته', 'reveal','لا يرغب في الكشف مطلقاً',
              'caseSummary','شبكة اتّجار بالمخدّرات؛ شهادته حاسمة في تحديد رؤوسها.',
              'caseStage','التحقيق', 'applicantRoleDesc','شاهد عيان رئيس — أقواله ركن الإدانة.',
              'contacted','نعم', 'contactKind','مقابلة ميدانية',
              'crimeType','جريمة كبرى', 'crimeDesc','اتّجار بالمواد المخدّرة', 'hidden2','نعم (م2)',
              'threatExists','يوجد', 'threatType','تهديد بالقتل', 'riskLevel','حرِج',
              'harmExists','يوجد', 'harmType','ترصّد مركبته',
              'extends','نعم', 'extendsWho','الزوجة والأبناء',
              'reasons', jsonb_build_array('جدية التهديد مؤكدة ومتكررة', 'أهمية الإفادة محورية', 'خطورة الجريمة عالية'),
              'alternatives','لا بدائل كافية',
              'attachFiles', jsonb_build_array('محضر المقابلة الميدانية', 'تقرير رصد التهديدات')),
            now(), now() + interval '5 days', now(), 'electronic',
            'التهديد منظّم وقابل للتنفيذ؛ تُرى الحماية العاجلة بأوسع تدابيرها.');
    insert into studies (case_id, studier_id, recommendation, proposed_type, proposed_duration, notes,
                         found_recommendation, found_request, submitted_at)
    values (cid, s1, 'قبول كلي',
            '["الحماية الأمنية","تغيير محل الإقامة","المرافقة الأمنية وسلامة التنقّل"]'::jsonb, null,
            'الخطر جسيم وممتد للأسرة؛ تتحقق عوامل م9 كاملة ويلزم أوسع تدابير م14.',
            true, true, now());
    insert into assessments (case_id, evaluator_id, recommendation, partial_reason, proposed_type, proposed_duration,
                             notes, found_recommendation, found_request, submitted_at)
    values
      (cid, e2, 'قبول كلي', null,
       '["الحماية الأمنية","حماية المسكن","تغيير محل الإقامة"]'::jsonb, null,
       'مؤشّرات خطر ميدانية مؤكدة؛ يُوصى بالتدابير كاملة حتى انتهاء القضية.',
       true, true, now()),
      (cid, e3, 'قبول جزئي', 'رفضت الأسرة تغيير محل الإقامة خارج المنطقة؛ يُستعاض بحماية المسكن والإرشاد.',
       '["حماية المسكن","الإرشاد القانوني والنفسي والاجتماعي"]'::jsonb, interval '30 days',
       'قلق حادّ لدى الشاهد وأسرته مع تمسّك بالبقاء في المنطقة.',
       true, true, now());
    insert into council_decisions (case_id, preparer_id, status, types)
    values (cid, officer, 'preparing', '[]'::jsonb);
  end if;
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

-- ── 3-ب) اتّساق البيانات بالرمز — تحديث مراجع 2026-07-21 (لهجة حيّة 2026-08-10) ──
--   بيانات كل رمز متّسقة بين طلب الحماية الكامل (protection_requests.details)
--   وعوامل التوصية الكاملة (recommendations.factors9) — REQ_DATA ↔ REC_FACTORS.
--   تحديثات idempotent: تُثري الصفوف القائمة ولا تُنشئ جديدة، وتُصفّي بقايا
--   المفاتيح اليتيمة (details→role/prior_entity وrecommendations.details).
do $$
declare r record; cid uuid;
begin
  -- الإثراء على عقد الكُتّاب الأحياء: الصفة في عمود applicant_role، وتفاصيل
  -- الطلب بمفاتيح submit_protection_request، وعوامل التوصية في factors9
  -- بلهجة النموذج الموحّد (recommendations.details بلا كاتب — لا يُبذر).
  for r in
    select * from (values
      ('C-2026-0481', 'أصيل — عن نفسه',
       -- طلب الحماية كما ورد من طالبه
       jsonb_build_object(
         'prior_submit', true, 'entity','النيابة العامة',
         'crime','الجرائم الاقتصادية · الماسة بالثقة العامة',
         'reason','تلقيّت تهديدات مباشرة بالقتل عقب إدلائي بشهادتي في القضية، وأخشى تنفيذها بحقّي وبحقّ أسرتي، وأطلب إخفاء بياناتي وتوفير حماية أمنية.',
         'files', jsonb_build_array('صورة محضر الشهادة','لقطات رسائل التهديد')),
       -- عوامل التوصية الكاملة من الجهة (factors9)
       jsonb_build_object(
         'health','سليم', 'criminal','لا يوجد', 'psych','لا توجد ملحوظات', 'reveal','لا يرغب',
         'caseStage','التحقيق',
         'caseSummary','قضية جرائم اقتصادية واختلاس أموال عامة بمبالغ جسيمة داخل جهة حكومية.',
         'applicantRoleDesc','شاهد رئيسي يملك معلومات وأدلّة جوهرية يصعب إثبات الواقعة بدونها.',
         'contacted','نعم', 'contactKind','حضوري',
         'crimeDesc','اختلاس وتلاعب مالي منظّم بمستندات رسمية مزوّرة.',
         'threatType','تهديد مباشر بالقتل', 'riskLevel','شديد', 'harmType','اعتداء جسدي',
         'extends','نعم', 'extendsWho','الزوج والأبناء',
         'alternatives','لا توجد',
         'crimeType','كبيرة موجبة للتوقيف', 'hidden2','نعم', 'threatExists','يوجد',
         'attachFiles', jsonb_build_array('بيانات القضية والإجراءات النظامية','تقرير تقييم المخاطر','تقرير طبي للحالة الصحية','معلومات التهديد (وسائط)','طلب الحماية المسبّب'))),
      ('C-2026-0492', 'أصيل — عن نفسه',
       jsonb_build_object(
         'prior_submit', true, 'entity','هيئة الرقابة ومكافحة الفساد',
         'crime','الفساد الإداري والمالي',
         'reason','بعد إبلاغي عن مخالفات مالية جسيمة في جهة عملي تعرّضت لمضايقات وتهديدات متكرّرة، وأخشى الفصل التعسفي وامتداد الضرر لأسرتي.',
         'files', jsonb_build_array('نسخة البلاغ','مستندات المخالفات')),
       jsonb_build_object(
         'health','سليم', 'criminal','لا يوجد', 'psych','لا توجد ملحوظات', 'reveal','لا يرغب',
         'caseStage','جمع الاستدلالات',
         'caseSummary','قضية فساد إداري ومالي ومخالفات جسيمة في جهة حكومية محل تحقّق الهيئة.',
         'applicantRoleDesc','مبلّغ رئيسي قدّم مستندات المخالفات ويُعتمد على إفادته في الإثبات.',
         'contacted','نعم', 'contactKind','اتصال هاتفي',
         'crimeDesc','مخالفات مالية وإدارية جسيمة وإساءة استعمال سلطة.',
         'threatType','تهديد ومضايقة وظيفية', 'riskLevel','شديد', 'harmType','مضايقات وتلويح بالفصل',
         'extends','نعم', 'extendsWho','الأسرة',
         'alternatives','لا توجد',
         'crimeType','كبيرة موجبة للتوقيف', 'hidden2','نعم', 'threatExists','يوجد',
         'attachFiles', jsonb_build_array('بيانات القضية والإجراءات النظامية','تقرير تقييم المخاطر','معلومات التهديد (وسائط)','طلب الحماية المسبّب'))),
      ('C-2026-0488', 'وليّ — نيابةً عن المشمول',
       jsonb_build_object(
         'prior_submit', true, 'entity','النيابة العامة',
         'crime','الاتجار بالأشخاص',
         'reason','الضحية تعرّضت لإيذاء جسدي وتهديد مستمرّ من شبكة منظّمة، ويُلتمس توفير الحماية وتأمين المسكن والدعم النفسي.',
         'files', jsonb_build_array('التقرير الطبي','محضر الضبط')),
       jsonb_build_object(
         'health','تحت رعاية طبية', 'criminal','لا يوجد', 'psych','حالة هشّة — تلزمها متابعة', 'reveal','لا يرغب',
         'caseStage','التحقيق',
         'caseSummary','قضية اتجار بالأشخاص منسوبة لشبكة منظّمة.',
         'applicantRoleDesc','ضحية رئيسة إفادتها جوهرية في تحديد أفراد الشبكة.',
         'contacted','نعم', 'contactKind','حضوري',
         'crimeDesc','استغلال وإيذاء جسدي من شبكة منظّمة عابرة.',
         'threatType','تهديد بالإيذاء الجسدي', 'riskLevel','شديد', 'harmType','إيذاء جسدي موثّق طبّياً',
         'extends','نعم', 'extendsWho','الأقارب من الدرجة الأولى',
         'alternatives','لا توجد',
         'crimeType','كبيرة موجبة للتوقيف', 'hidden2','نعم', 'threatExists','يوجد',
         'attachFiles', jsonb_build_array('بيانات القضية والإجراءات النظامية','تقرير تقييم المخاطر','تقرير طبي للحالة الصحية','طلب الحماية المسبّب'))),
      ('C-2026-0475', 'أصيل — عن نفسه',
       jsonb_build_object(
         'prior_submit', true, 'entity','النيابة العامة',
         'crime','الاتجار بالأشخاص',
         'reason','تعرّضت لإيذاءٍ وتهديد مستمرّ بعد تعاوني مع جهات التحقيق، وأطلب الحماية وتأمين التنقّل.',
         'files', jsonb_build_array('التقرير الطبي')),
       jsonb_build_object(
         'health','سليم', 'criminal','لا يوجد', 'psych','لا توجد ملحوظات', 'reveal','لا يرغب',
         'caseStage','التحقيق',
         'caseSummary','قضية اتجار بالأشخاص قيد التحقيق.',
         'applicantRoleDesc','ضحية إفادتها معتبرة في الإثبات.',
         'contacted','نعم', 'contactKind','اتصال هاتفي',
         'crimeDesc','استغلال وإيذاء من شبكة منظّمة.',
         'threatType','تهديد بالإيذاء', 'riskLevel','شديد', 'harmType','إيذاء موثّق',
         'extends','نعم', 'extendsWho','الأقارب من الدرجة الأولى',
         'alternatives','لا توجد',
         'crimeType','كبيرة موجبة للتوقيف', 'hidden2','نعم', 'threatExists','يوجد',
         'attachFiles', jsonb_build_array('تقرير تقييم المخاطر','طلب الحماية المسبّب'))),
      ('C-2026-0470', 'أصيل — عن نفسه',
       jsonb_build_object(
         'prior_submit', true, 'entity','النيابة العامة',
         'crime','تزوير المستندات الرسمية',
         'reason','بصفتي خبيراً فاحصاً للمستندات تلقّيت تهديدات بعد تقريري الفنّي، وأطلب حماية بياناتي وسلامة تنقّلي.',
         'files', jsonb_build_array('التقرير الفنّي')),
       jsonb_build_object(
         'health','سليم', 'criminal','لا يوجد', 'psych','لا توجد ملحوظات', 'reveal','لا يرغب',
         'caseStage','المحاكمة',
         'caseSummary','قضية تزوير مستندات رسمية معروضة على المحكمة.',
         'applicantRoleDesc','خبير فنّي تقريره ركنٌ في الإثبات.',
         'contacted','نعم', 'contactKind','حضوري',
         'crimeDesc','تزوير محرّرات رسمية واستعمالها.',
         'threatType','تهديد وترهيب', 'riskLevel','شديد', 'harmType','لا يوجد بعد',
         'extends','لا', 'extendsWho','لا يمتدّ',
         'alternatives','لا توجد',
         'crimeType','كبيرة موجبة للتوقيف', 'hidden2','نعم', 'threatExists','يوجد',
         'attachFiles', jsonb_build_array('تقرير تقييم المخاطر','طلب الحماية المسبّب')))
    ) as t(secret, role_ar, req_extra, rec_factors)
  loop
    select id into cid from protection_cases where secret_code = r.secret;
    if cid is null then continue; end if;
    update protection_requests
       set applicant_role = r.role_ar,
           details = (coalesce(details,'{}'::jsonb) - 'role' - 'prior_entity') || r.req_extra
     where case_id = cid;
    update recommendations
       set factors9 = coalesce(factors9,'{}'::jsonb) || r.rec_factors,
           details = null
     where case_id = cid;
  end loop;
end $$;

-- ── 5) إسناد التوصيات المبذورة لفروعها ──
--   الأقسام أعلاه تُدرج التوصيات بلا branch_id، وسياسة rec_branch_rw موجَّهة
--   بالفرع — فلا تظهر أيٌّ منها في بوابة الجهات المختصة. الإسناد هنا حتميٌّ من
--   نصوص البذور نفسها (لا تخمين مناطق): الأسماء المنسوبة لمنطقةٍ إلى نيابتها،
--   والنزاهة (جهة مركزية) إلى مركزها الرئيسي، و«النيابة العامة» المطلقة في
--   رحلات التظلّم (§4) إلى نيابة الرياض — فرع العرض الافتراضي — حصراً بمراجعها.
--   يُستكمل أيضاً branch_id على القضية نفسها (سياسة case_branch_read بالفرع؛
--   بدونه يعود تضمين protection_cases فارغاً فتظهر البطاقة بلا رمز ولا مرجع).
--   يبقى هذا القسم آخرَ الملف كي يلحق كلَّ ما بُذر قبله. idempotent.
do $$
declare _ruh uuid; _med uuid; _asr uuid; _nzh uuid;
begin
  select id into _ruh from branches where entity = 'prosecution' and region = 'RUH' and kind = 'region' limit 1;
  select id into _med from branches where entity = 'prosecution' and region = 'MED' and kind = 'region' limit 1;
  select id into _asr from branches where entity = 'prosecution' and region = 'ASR' and kind = 'region' limit 1;
  select id into _nzh from branches where entity = 'nazaha' and is_hq limit 1;

  update recommendations set branch_id = _ruh
   where branch_id is null and _ruh is not null
     and source_body in ('النيابة العامة بمنطقة الرياض', 'النيابة العامة بالرياض');
  update recommendations set branch_id = _med
   where branch_id is null and _med is not null
     and source_body = 'النيابة العامة بالمدينة المنورة';
  update recommendations set branch_id = _asr
   where branch_id is null and _asr is not null
     and source_body = 'النيابة العامة بعسير';
  update recommendations set branch_id = _nzh
   where branch_id is null and _nzh is not null
     and source_body like 'هيئة الرقابة ومكافحة الفساد%';
  update recommendations r set branch_id = _ruh
    from protection_cases pc
   where pc.id = r.case_id and r.branch_id is null and _ruh is not null
     and r.source_body = 'النيابة العامة'
     and pc.ref_no in ('REF-2026-4820', 'REF-2026-4790');

  -- ظلّ الفرع على القضية (توصية كل قضية واحدة — لا لبس في المصدر)
  update protection_cases pc set branch_id = r.branch_id
    from recommendations r
   where r.case_id = pc.id and pc.branch_id is null and r.branch_id is not null;
end $$;
