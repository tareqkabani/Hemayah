-- ============================================================
--  إصلاح: جسر ضمّ الحالة الورقية لصاحبها عند دخول نفاذ كان معطَّلاً
--
--  العطب (أُدخل في 20260810000003، 10 أغسطس 2026):
--    دالّة claim_paper_cases تضمّ الحالات الورقية لحساب صاحبها عند أوّل
--    دخولٍ بنفاذ، وتطابق على `protection_requests.details->'identity'->>'nid'`.
--    ومهاجرة مزامنة subjects نقلت الهوية إلى جدول subjects مشفّرةً و**بترتها
--    من details** (للحالات القائمة بالـbackfill، وللجديدة في submit_paper_intake).
--    فصارت الدالّة تطابق في موضعٍ فارغ: **تُرجع صفراً دائماً، بلا خطأ ولا أثر.**
--
--  القياس على قاعدة التطوير قبل الإصلاح:
--    طلبات ورقية: 5 · منها ما يحمل identity في details: 0
--    حالات ورقية بلا مالك: 5 · منها ما تطابقه الدالّة: 0
--
--  الأثر: حبسٌ لا تجاوز. حارسا م11 (seeker_sign_agreement) وم21 (owns_case)
--  يشترطان submitted_by = auth.uid()، فالحالة غير المضمومة لا تُوقَّع ولا
--  يُتظلَّم عليها — لكنّ صاحبها لا يستطيع بلوغها أصلاً: بوابته تظهر فارغة.
--  لا يظهر ذلك في التجريبية (نفاذ محاكاة)، ويظهر فور تشغيل نفاذ الحقيقي.
--
--  لماذا ليس إصلاحاً بسطر: `pgp_sym_encrypt` عشوائيّ — تشفير الرقم نفسه
--  مرّتين يعطي نصّين مختلفين، فلا تُطابَق الهوية بمقارنة النصّ المشفَّر.
--  الحلّ عمود تجزئةٍ حتميّ (HMAC-SHA256 بمفتاح Vault نفسه) بجانب المشفَّر:
--  يُطابَق ولا يُفشي الرقم، والمفتاح لازمٌ لحسابه فلا يُخمَّن بقاموس.
-- ============================================================

-- ── 1) عمود البحث الحتميّ ──
alter table subjects add column if not exists national_id_hash bytea;

comment on column subjects.national_id_hash is
  'HMAC-SHA256 لرقم الهوية بمفتاح Vault — للمطابقة عند ضمّ الحالة الورقية لصاحبها. لا يُفشي الرقم ولا يُعكَس، ويلزم المفتاح لحسابه.';

create index if not exists subjects_nid_hash_idx
  on subjects (national_id_hash) where national_id_hash is not null;

create or replace function public._subject_nid_hash(_nid text)
returns bytea
language plpgsql stable security definer set search_path = public, extensions
as $$
declare _k text; _n text := nullif(btrim(coalesce(_nid, '')), '');
begin
  if _n is null then return null; end if;
  _k := public._subject_identity_key();
  if _k is null then
    raise exception 'مفتاح تشفير هوية طالب الحماية غير مهيّأ في Vault';
  end if;
  return extensions.hmac(_n, _k, 'sha256');
end $$;
revoke all on function public._subject_nid_hash(text) from public, anon, authenticated;

-- ── 2) الكاتب — إعادة كتابة نسخة 20260810000003 كاملةً + التجزئة ──
--  ⚠️ درس «آخر نسخة دالة»: التعريف أدناه هو نصّ 20260810000003 بحرفه،
--  بزيادةٍ واحدة: عمود national_id_hash. لا يُقتطع منه شيء.
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
                        national_id_hash,
                        gender, nationality, birth_date, marital_status,
                        national_address, employer, job_title, education_level, source_flags)
  values (_case_id, 'principal',
          case when _name    is null then null else pgp_sym_encrypt(_name,    _key) end,
          case when _nid     is null then null else pgp_sym_encrypt(_nid,     _key) end,
          case when _contact is null then null else pgp_sym_encrypt(_contact, _key) end,
          -- التجزئة الحتميّة — بها وحدها يجد صاحبُ الحالة حالتَه عند دخول نفاذ
          public._subject_nid_hash(_nid),
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

-- ── 3) Backfill: تجزئة الصفوف القائمة من فكّ تشفيرها ──
--  يمرّ داخل الخادم ولا يخرج الرقم منه، ويتخطّى ما تعذّر فكّه بدل أن يُسقط
--  المهاجرة كلَّها (صفٌّ بمفتاحٍ قديم لا يمنع إصلاح الباقي).
do $$
declare r record; _key text; _plain text; _ok int := 0; _skip int := 0;
begin
  _key := public._subject_identity_key();
  if _key is null then
    raise notice 'لا مفتاح في Vault — تُخطّى تعبئة التجزئة';
    return;
  end if;
  for r in select id, national_id_enc from subjects
            where national_id_enc is not null and national_id_hash is null
  loop
    begin
      _plain := pgp_sym_decrypt(r.national_id_enc, _key);
      update subjects set national_id_hash = public._subject_nid_hash(_plain) where id = r.id;
      _ok := _ok + 1;
    exception when others then
      _skip := _skip + 1;
    end;
  end loop;
  raise notice 'تعبئة تجزئة الهوية: % صفّاً · تُخطّي %', _ok, _skip;
end $$;

-- ── 4) الجسر — إعادة كتابته على التجزئة ──
--  التغييرات عن 20260727000002:
--    · المطابقة من subjects.national_id_hash بدل details المبتور.
--    · وسم protection_cases.identity_verified إن كان العمود موجوداً (يصل مع
--      وحدة الإدخال اليدوي) — بـSQL ديناميّ كي تصحّ المهاجرة قبله وبعده.
--    · جهة الطوارئ ما زالت تُبتر من details، فلا يُلمس شيءٌ خارج ما يخصّ الضمّ.
create or replace function public.claim_paper_cases(_user_id uuid, _nid text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _n integer := 0;
  _hash bytea;
  _has_iv boolean;
  r record;
begin
  -- استدعاء الجسر عبر service_role فقط — الربط يقع بعد توثيق نفاذ لا بادعاء المستخدم
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden: service bridge only';
  end if;
  if _user_id is null or _nid is null or btrim(_nid) = '' then
    raise exception 'user and national id are required';
  end if;

  _hash := public._subject_nid_hash(_nid);
  if _hash is null then return 0; end if;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'protection_cases'
       and column_name = 'identity_verified') into _has_iv;

  for r in
    select pc.id, pc.ref_no
      from protection_cases pc
      join protection_requests pr on pr.case_id = pc.id
      join subjects s on s.case_id = pc.id and s.subject_type = 'principal'
     where pc.submitted_by is null
       and pr.channel = 'paper'
       and s.national_id_hash = _hash
       for update of pc
  loop
    update protection_cases
       set submitted_by = _user_id, updated_at = now()
     where id = r.id;

    -- الهوية صارت موثّقةً نفاذياً: الوسم في سجلّ الطلب وفي مصدر الحقيقة
    -- الجديد (عمود القضية) معاً، وsource_flags يتبع.
    update protection_requests
       set details = jsonb_set(
                       jsonb_set(coalesce(details, '{}'::jsonb), '{verified}', 'true'::jsonb, true),
                       '{identity_verified}', 'true'::jsonb, true)
     where case_id = r.id;

    update subjects
       set source_flags = coalesce(source_flags, '{}'::jsonb) || jsonb_build_object('nafath', 'live')
     where case_id = r.id and subject_type = 'principal';

    if _has_iv then
      execute 'update protection_cases set identity_verified = true where id = $1' using r.id;
    end if;

    insert into audit_log (actor_id, action, target)
    values (_user_id, 'claim_paper_case_nafath', r.ref_no);

    insert into notifications (case_id, type, title, body, target_tab, sent_at)
    values (r.id, 'identity_verified', 'فُعّلت هويتك على طلبك الورقيّ',
            'وُثّقت هويتك عبر نفاذ ورُبط طلبك الورقيّ بحسابك — يمكنك الآن متابعته وتوقيع الاتفاقية والتظلّم من بوابتك.',
            'requests', now());

    _n := _n + 1;
  end loop;

  return _n;
end $$;

revoke execute on function public.claim_paper_cases(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_paper_cases(uuid, text) to service_role;
