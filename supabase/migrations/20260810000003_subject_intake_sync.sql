-- ============================================================
--  تعبئة subjects من مسارَي التقديم — سدّ فجوة «جدولٌ بلا كاتب»
--
--  الفجوة: subjects موطن بيانات الشخص منذ المخطط الأول (أعمدة *_enc المشفّرة)
--  ووسّعته حزمة 11 بأعمدة غير معرِّفة تعرضها بطاقة «بيانات طالب الحماية» في
--  بوابة القرار — لكن لا كاتب له إطلاقاً: هوية نفاذ تبقى في JWT فلا تراها
--  البوابات، وهوية الإدخال اليدوي تسكن protection_requests.details->'identity'
--  نصّاً صريحاً بلا قارئ (يبترها معقّما القرار والدارس/المقيّم) — فالبطاقة
--  فارغة دوماً والبيانات مبعثرة في غير موطنها.
--
--  المعالجة على نسق جهة الطوارئ (20260810000002) حرفياً:
--    1) مفتاح تشفير مستقل في Vault (subject_identity_key) — مفتاح لكل نطاق
--       بيانات؛ لا يُعاد استعمال مفتاح جهة الطوارئ كي يبقى أثر أي تسريب محصوراً.
--    2) كاتب داخلي _store_subject يطبّع لهجتَي identity المتداولتَين
--       (فرع «طالب الحماية»: nid/dob/email — فرع «جهة»: obGender/residence…
--       وقد وحّد النموذج مفاتيحهما عند البناء) فيشفّر المعرِّف (الاسم/الهوية/
--       التواصل) ويُسكن غير المعرِّف في أعمدته، مع source_flags بحسب المصدر
--       (nafath: live|manual · spl/hrdf: manual — التكاملات الحيّة لاحقة).
--    3) التقديم الإلكتروني يكتب هوية نفاذ (name/national_id من auth.users)
--       بوسم live؛ والإدخال اليدوي يعترض details->'identity' فيخزّنها مشفّرةً
--       ويبترها من الحمولة (لا قارئ لها — تحقّق مسح 2026-08-10).
--    4) Backfill: ترحيل الحالات القائمة من المسارين دون المساس بصفوف
--       subjects المبذورة (حزمة 11) — الإدراج عند غياب صف principal فقط.
--
--  لا RPC كشفٍ هنا: لا شاشة تحتاج الاسم/الهوية اليوم (بطاقة القرار غير
--  معرِّفة عمداً) — يُبنى كشفٌ مقيَّد بالتدقيق مع أول حاجة (نمط
--  execution_emergency_contact).
-- ============================================================

-- ── 1) مفتاح التشفير — يُولَّد عشوائياً في Vault إن لم يوجد ──
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'subject_identity_key') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'subject_identity_key');
  end if;
end $$;

create or replace function public._subject_identity_key()
returns text
language sql stable security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'subject_identity_key';
$$;
revoke all on function public._subject_identity_key() from public, anon, authenticated;

-- ── 2) الكاتب الداخلي — تطبيعٌ وتشفيرٌ وإحلال (صف principal واحد لكل قضية) ──
--  _identity: jsonb بلهجة نموذج الإدخال اليدوي (name·nid·phone·email·gender·
--  nationality·dob·marital·residence·employer·education·source_verified) —
--  والإلكتروني يمرّر منها name·nid فقط (هذا ما يمنحه نفاذ اليوم).
--  _nafath_flag: live (موثّق نفاذياً) | manual (مُدخَل يدوياً).
create or replace function public._store_subject(_case_id uuid, _identity jsonb, _nafath_flag text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  _name    text := nullif(btrim(coalesce(_identity->>'name', '')), '');
  _nid     text := nullif(btrim(coalesce(_identity->>'nid', '')), '');
  _contact text := nullif(concat_ws(' · ',
                     nullif(btrim(coalesce(_identity->>'phone', '')), ''),
                     nullif(btrim(coalesce(_identity->>'email', '')), '')), '');
  _residence text := nullif(btrim(coalesce(_identity->>'residence', '')), '');
  _employer  text := nullif(btrim(coalesce(_identity->>'employer', '')), '');
  _education text := nullif(btrim(coalesce(_identity->>'education', '')), '');
  _bd    date;
  _flags jsonb;
  _key   text;
begin
  if _identity is null or jsonb_typeof(_identity) is distinct from 'object' then return; end if;
  if _name is null and _nid is null and _contact is null then return; end if;

  _key := public._subject_identity_key();
  if _key is null then
    raise exception 'مفتاح تشفير هوية طالب الحماية غير مهيّأ في Vault';
  end if;

  -- تاريخ الميلاد المُدخَل يدوياً قد لا يكون تاريخاً صالحاً — يسقط بصمت لا الطلبُ كلُّه
  begin _bd := nullif(btrim(coalesce(_identity->>'dob', '')), '')::date;
  exception when others then _bd := null; end;

  -- وسم المصدر لكل مجموعة حاضرة: الهوية بحسب توثيقها، والعنوان/العمل يدويان
  -- إلى حين تكاملَي سُبل والموارد (source_flags مفتاح القلب لاحقاً بلا إعادة تصميم).
  _flags := jsonb_build_object('nafath', coalesce(_nafath_flag, 'manual'))
            || case when _residence is not null then jsonb_build_object('spl', 'manual') else '{}'::jsonb end
            || case when _employer is not null or _education is not null
                    then jsonb_build_object('hrdf', 'manual') else '{}'::jsonb end;

  delete from subjects where case_id = _case_id and subject_type = 'principal';
  insert into subjects (case_id, subject_type, full_name_enc, national_id_enc, contact_enc,
                        gender, nationality, birth_date, marital_status,
                        national_address, employer, job_title, education_level, source_flags)
  values (_case_id, 'principal',
          case when _name    is null then null else pgp_sym_encrypt(_name,    _key) end,
          case when _nid     is null then null else pgp_sym_encrypt(_nid,     _key) end,
          case when _contact is null then null else pgp_sym_encrypt(_contact, _key) end,
          nullif(btrim(coalesce(_identity->>'gender', '')), ''),
          nullif(btrim(coalesce(_identity->>'nationality', '')), ''),
          _bd,
          nullif(btrim(coalesce(_identity->>'marital', '')), ''),
          case when _residence is null then null else jsonb_build_object('city', _residence) end,
          _employer,
          null,   -- المسمى الوظيفي — لا مصدر له قبل تكامل الموارد البشرية
          _education,
          _flags);
end $$;
revoke all on function public._store_subject(uuid, jsonb, text) from public, anon, authenticated;

-- ── 3) التقديم الإلكتروني — إعادة كتابة النسخة الأخيرة كاملةً + هوية نفاذ ──
--  ⚠️ النسخة الأخيرة هي 20260810000002 (اعتراض جهة الطوارئ + قوالب الإشعارات)
--  — لا 20260808000006 ولا 20260807000001 (درس «آخر نسخة دالة»).
create or replace function public.submit_protection_request(
  _applicant_role text, _category app_category, _entity text, _crime text, _reason text,
  _prior_submit boolean, _case_no text, _details jsonb default '{}'::jsonb)
returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer
set search_path to 'public', 'extensions'
as $$
declare
  _uid   uuid := auth.uid();
  _cid   uuid;
  _ref   text;
  _sec   text;
  _yr    text := extract(year from now())::text;
  _tries int  := 0;
  _ec    jsonb;
  _meta  jsonb;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;

  -- الجهة المختصة إلزامية ⇔ سبق التقديم إليها؛ وعند «لا» تُصفَّر فلا تُخزَّن قيمة يتيمة.
  if _prior_submit is true and (_entity is null or btrim(_entity) = '') then
    raise exception 'اسم الجهة المختصة مطلوب عند سبق التقديم إليها.';
  end if;
  if _prior_submit is distinct from true then
    _entity := null;
  end if;

  -- جهة الطوارئ لا تسكن details نصّاً صريحاً — تُعترض هنا وتُشفَّر في جدولها (م15/16).
  _ec      := _details->'emergency_contact';
  _details := coalesce(_details, '{}'::jsonb) - 'emergency_contact';

  -- طلبٌ واحدٌ نشطٌ لكل شخص: الاعتراض على أيّ قرار يكون بالتظلّم (م21) لا بطلبٍ جديد.
  if has_open_case(_uid) then
    raise exception 'لديك طلبٌ قائمٌ قيد المعالجة — لا يُقبل طلبٌ جديد (منعاً للتكرار)؛ والاعتراض على القرار يكون بالتظلّم.';
  end if;

  -- توليد مرجعٍ ورمزٍ سرّيٍّ فريدين مع إعادة المحاولة عند أيّ تصادم (بذور/تدفّقات أخرى/تزامن).
  loop
    _tries := _tries + 1;
    _ref := 'REF-' || _yr || '-' || nextval('seeker_ref_seq')::text;
    _sec := 'C-'  || _yr || '-' || lpad(nextval('seeker_secret_seq')::text, 4, '0');
    begin
      insert into protection_cases (ref_no, secret_code, category, status, source, submitted_by)
      values (_ref, _sec, _category, 'triage', 'local', _uid)
      returning id into _cid;
      exit;
    exception when unique_violation then
      if _tries >= 100 then
        raise exception 'تعذّر توليد رمزٍ سرّيٍّ فريد بعد % محاولة', _tries;
      end if;
    end;
  end loop;

  insert into protection_requests (case_id, applicant_role, channel, details)
  values (_cid, _applicant_role, 'seeker',
          _details
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no));

  perform public._store_emergency_contact(_cid, _ec);

  -- هوية نفاذ من الجلسة إلى موطنها subjects (مشفّرةً) — بوسم live لأنها موثّقة.
  select u.raw_user_meta_data into _meta from auth.users u where u.id = _uid;
  perform public._store_subject(_cid,
    jsonb_build_object('name', _meta->>'name', 'nid', _meta->>'national_id'), 'live');

  insert into messages (case_id, thread, direction, body, sender_label)
  values (_cid, 'center', 'in',
          'مرحباً، تسلّمنا طلبك ونراجع بياناته في مرحلة الفرز المبدئي. سنتواصل معك إن لزم استيفاء.',
          'منسّق الحماية');

  -- إشعار الاستلام من القالب (كان نصاً حرفياً)
  perform notify_from_template('n_received',
    jsonb_build_object('رقم_الطلب', _ref, 'الرمز_السري', _sec,
      'تاريخ_التقديم', to_char(now(), 'YYYY-MM-DD'), 'مهلة_الفرز', '5 أيام عمل'),
    _cid, 'submission', 'requests');

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_protection_request', _ref);

  return query select _cid, _ref, _sec;
end $$;

-- ── 4) الإدخال اليدوي — إعادة كتابة نسخة 20260810000002 كاملةً + اعتراض الهوية ──
--  identity تُطبَّع في subjects مشفّرةً وتُبتر من details (لا قارئ لها البتّة؛
--  الفرز يتواصل عبر الرسائل ومحاضر الاتصال، والدارس/المقيّم والقرار يبترانها أصلاً).
--  «قناة الموقع القديم» موثّقة نفاذياً في المصدر (source_verified) فتوسَم live.
create or replace function public.submit_paper_intake(
  _source         text,          -- 'seeker' | 'entity'
  _applicant_role text,
  _category       app_category,
  _entity         text,
  _crime          text,
  _reason         text,
  _prior_submit   boolean,
  _case_no        text,
  _details        jsonb default '{}'::jsonb,
  _received_date  date  default null,   -- تاريخ الورود الفعلي — منه تُحسب المُهل (م10)
  _reg_no         text  default null    -- رقم القيد الإداري (سجلّ الوارد) / مرجع الموقع القديم
) returns table(case_id uuid, ref_no text, secret_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _cid uuid;
  _ref text;
  _sec text;
  _yr  text := extract(year from now())::text;
  _received timestamptz := coalesce(_received_date::timestamptz, now());
  _ec  jsonb;
  _id  jsonb;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'case_officer') or has_role(_uid, 'hotline_operator')) then
    raise exception 'forbidden: not intake officer';
  end if;
  if _crime is null or btrim(_crime) = '' or _reason is null or btrim(_reason) = '' then
    raise exception 'الجريمة والمسوّغات مطلوبة';
  end if;
  if _received_date is not null and _received_date > current_date then
    raise exception 'تاريخ الورود لا يكون مستقبلاً';
  end if;
  if _received_date is not null and _received_date < current_date - 365 then
    raise exception 'تاريخ الورود أقدم من سنة — تحقّق من المستند';
  end if;

  -- جهة الطوارئ والهوية لا تسكنان details نصّاً صريحاً — تُعترضان إلى جدوليهما.
  _ec      := _details->'emergency_contact';
  _id      := _details->'identity';
  _details := coalesce(_details, '{}'::jsonb) - 'emergency_contact' - 'identity';

  _ref := 'REF-' || _yr || '-' || nextval('paper_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('paper_secret_seq')::text, 4, '0');

  -- قضية في طابور الفرز، مؤرَّخة بتاريخ الورود الفعليّ — منه تبدأ المُهل
  -- والمؤقّتات في سجلّ الفرز، لا من لحظة الإدخال.
  insert into protection_cases (ref_no, secret_code, category, status, source, created_at)
  values (_ref, _sec, _category, 'triage', 'local', _received)
  returning id into _cid;

  insert into protection_requests (case_id, applicant_role, channel, submitted_at, details)
  values (_cid, _applicant_role, 'paper', _received,
          _details
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no, 'paper_source', _source,
                                  'intake_by', _uid, 'verified', false)
            || jsonb_strip_nulls(jsonb_build_object(
                 'received_date', _received_date, 'reg_no', _reg_no)));

  perform public._store_emergency_contact(_cid, _ec);
  perform public._store_subject(_cid, _id,
    case when coalesce(_id->>'source_verified', 'false') = 'true' then 'live' else 'manual' end);

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_paper_intake_' || _source, _ref);

  return query select _cid, _ref, _sec;
end $$;

-- ── 5) Backfill — الحالات القائمة من المسارين، دون دهس بذور حزمة 11 ──
do $$
declare
  r  record;
  _paper int := 0;
  _elec  int := 0;
begin
  -- الإدخال اليدوي: identity من details إلى subjects مشفّرةً ثم تُبتر من كل الصفوف.
  for r in
    select pr.id, pr.case_id, pr.details->'identity' as ident
      from protection_requests pr
     where pr.details ? 'identity'
  loop
    if not exists (select 1 from subjects s
                    where s.case_id = r.case_id and s.subject_type = 'principal') then
      perform public._store_subject(r.case_id, r.ident,
        case when coalesce(r.ident->>'source_verified', 'false') = 'true' then 'live' else 'manual' end);
      _paper := _paper + 1;
    end if;
    update protection_requests set details = details - 'identity' where id = r.id;
  end loop;

  -- الإلكتروني: هوية نفاذ من auth.users لكل قضيةٍ قدّمها صاحبها ولا صفّ لها.
  for r in
    select c.id as case_id, u.raw_user_meta_data as meta
      from protection_cases c
      join auth.users u on u.id = c.submitted_by
     where c.submitted_by is not null
       and not exists (select 1 from subjects s
                        where s.case_id = c.id and s.subject_type = 'principal')
       and exists (select 1 from protection_requests pr
                    where pr.case_id = c.id and pr.channel = 'seeker')
  loop
    perform public._store_subject(r.case_id,
      jsonb_build_object('name', r.meta->>'name', 'nid', r.meta->>'national_id'), 'live');
    _elec := _elec + 1;
  end loop;

  raise notice 'Backfill subjects: % من الإدخال اليدوي (وبُترت identity من details) · % من هوية نفاذ', _paper, _elec;
end $$;
