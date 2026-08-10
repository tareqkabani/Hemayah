-- ============================================================
--  جهة اتصال الطوارئ — من نصٍّ صريحٍ في details إلى التخزين المشفّر (م15/16)
--
--  الفجوة: جدول emergency_contacts (مهاجرة 20260810000001) كان بذريّاً فقط —
--  لا RPC يكتب فيه، وبيانات جهة الطوارئ الحيّة تعيش نصّاً صريحاً في
--  protection_requests.details->'emergency_contact' (تُبتر عن الدارس/المقيّم
--  وتُعقَّم من حزمة القرار، لكنّ أصلها غير مشفّر ومتاح لكل من يقرأ details).
--
--  المعالجة على خمس طبقات:
--    1) مفتاح تشفيرٍ لكل بيئةٍ في Vault (supabase_vault — مثبَّتة في حزمة
--       Docker القياسية) يُولَّد عشوائياً عند أول تطبيقٍ ولا يسكن المستودع،
--       تنفيذاً لتعليق المخطط الأصلي «pgp_sym_encrypt — مفتاح في KMS/Vault»
--       (نمط subjects.*_enc المعتمد؛ أعمدته bytea بانتظار المفتاح ذاته).
--    2) دالتا التقديم (submit_protection_request وsubmit_paper_intake — وهي
--       الكاتب الحيّ الوحيد للمفتاح اليوم عبر الإدخال اليدوي) تعترضان
--       emergency_contact من details فتكتبانها مشفّرةً في الجدول وتحذفان
--       المفتاح من الحمولة قبل الإدراج.
--    3) Backfill: ترحيل ما في details القائمة إلى الجدول مشفّراً ثم بترها.
--    4) قراءة مقيَّدة: سياسة RLS لمرحلة التنفيذ على الأعمدة غير الحسّاسة
--       فقط (صلة القرابة)، أمّا الاسم والهاتف فلا يخرجان إلا عبر RPC كشفٍ
--       يفحص الأهلية ويقيّد كلّ كشفٍ في سجلّ التدقيق (م15/16).
--    5) بوابة التنفيذ تستهلك RPC الكشف بزرّ كشفٍ صريح (في الشيفرة).
--
--  ملاحظة تصميم: مقعد «موظف التنفيذ» (2000000007) يحمل دور case_officer
--  المشترك مع الفرز وإعداد القرار — لا سمة تفرّقه اليوم، فالتقييد يطابق
--  سياسة co_execution_read القائمة: case_officer + حالة في أطوار التنفيذ.
--  كلّ كشفٍ للاسم/الهاتف مقيَّد بالتدقيق فيُحاسَب على الاستعمال لا الوصول.
-- ============================================================

-- ── 1) مفتاح التشفير — يُولَّد عشوائياً في Vault إن لم يوجد ──
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'emergency_contact_key') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'emergency_contact_key');
  end if;
end $$;

-- قارئ المفتاح — SECURITY DEFINER يصل إلى Vault؛ محجوب عن كل عملاء API،
-- ولا يُستدعى إلا من دوال DEFINER أدناه (تعمل بهوية مالك المهاجرة).
create or replace function public._emergency_contact_key()
returns text
language sql stable security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'emergency_contact_key';
$$;
revoke all on function public._emergency_contact_key() from public, anon, authenticated;

-- ── 2) الكاتب الداخلي — تشفيرٌ وإحلال (جهة اتصالٍ واحدة لكل قضية) ──
--  يقبل شكلَي المفتاحين المتداولَين: rel (الإدخال اليدوي) وrelationship.
create or replace function public._store_emergency_contact(_case_id uuid, _ec jsonb)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  _name  text := nullif(btrim(coalesce(_ec->>'name', '')), '');
  _rel   text := nullif(btrim(coalesce(_ec->>'rel', _ec->>'relationship', '')), '');
  _phone text := nullif(btrim(coalesce(_ec->>'phone', '')), '');
  _key   text;
begin
  if _ec is null or jsonb_typeof(_ec) is distinct from 'object' then return; end if;
  if _name is null and _rel is null and _phone is null then return; end if;

  _key := public._emergency_contact_key();
  if _key is null then
    raise exception 'مفتاح تشفير جهة الطوارئ غير مهيّأ في Vault';
  end if;

  delete from emergency_contacts where case_id = _case_id;
  insert into emergency_contacts (case_id, name_enc, relationship, phone_enc)
  values (_case_id,
          case when _name  is null then null else pgp_sym_encrypt(_name,  _key) end,
          _rel,
          case when _phone is null then null else pgp_sym_encrypt(_phone, _key) end);
end $$;
revoke all on function public._store_emergency_contact(uuid, jsonb) from public, anon, authenticated;

-- ── 3) التقديم الإلكتروني — إعادة كتابة النسخة الأخيرة كاملةً مع اعتراض
--  emergency_contact: تُشفَّر في الجدول وتُحذف من details.
--  ⚠️ النسخة الأخيرة هي 20260808000006 (إشعار n_received من القالب عبر
--  notify_from_template) لا 20260807000001 — إعادة كتابة الأقدم تُسقط
--  محرّك الإشعارات (اصطاده e2e-full-journey: «لا أثر تدقيق للإشعار»).
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

-- ── 4) الإدخال اليدوي — إعادة كتابة نسخة 20260805000001 كاملةً بالاعتراض ذاته
--  (هذا هو الكاتب الحيّ الوحيد لجهة الطوارئ اليوم: مسار «طالب الحماية» الورقيّ).
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

  -- جهة الطوارئ لا تسكن details نصّاً صريحاً — تُعترض وتُشفَّر في جدولها (م15/16).
  _ec      := _details->'emergency_contact';
  _details := coalesce(_details, '{}'::jsonb) - 'emergency_contact';

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

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_paper_intake_' || _source, _ref);

  return query select _cid, _ref, _sec;
end $$;

-- ── 5) Backfill: ترحيل details القائمة إلى الجدول مشفّرةً ثم بترها ──
--  لا يمسّ صفوف emergency_contacts الموجودة (بذور الحزمة 11) — details أحدث
--  مصدرَي الحقيقة للحالات الحيّة، فتُرحَّل ثم يُبتر المفتاح من كل الصفوف.
do $$
declare
  r  record;
  _n int := 0;
begin
  for r in
    select pr.id, pr.case_id, pr.details->'emergency_contact' as ec
      from protection_requests pr
     where pr.details ? 'emergency_contact'
  loop
    perform public._store_emergency_contact(r.case_id, r.ec);
    update protection_requests set details = details - 'emergency_contact' where id = r.id;
    _n := _n + 1;
  end loop;
  if _n > 0 then
    raise notice 'رُحّلت جهة الطوارئ من % طلباً إلى التخزين المشفّر وبُترت من details', _n;
  end if;
end $$;

-- ── 6) القراءة المقيَّدة لمرحلة التنفيذ ──
--  السياسة تطابق co_execution_read (القاعدة القائمة لمرحلة التنفيذ)،
--  والمنحة عموديّة: صلة القرابة وحدها تُقرأ مباشرة — أعمدة *_enc لا تغادر
--  القاعدة إطلاقاً إلا مفكوكةً عبر RPC الكشف المقيَّد أدناه.
drop policy if exists ec_execution_read on emergency_contacts;
create policy ec_execution_read on emergency_contacts for select using (
  has_role(auth.uid(), 'case_officer')
  and exists (select 1 from protection_cases c
               where c.id = emergency_contacts.case_id
                 and c.status in ('accepted','signed','active','under_review','terminating')));
grant select (id, case_id, relationship, created_at) on emergency_contacts to authenticated;

-- ── 7) كشف الاسم والهاتف — RPC مقيَّد يقيّد كلّ كشفٍ في التدقيق (م15/16) ──
create or replace function public.execution_emergency_contact(_case_id uuid)
returns table(name text, relationship text, phone text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _st  case_status;
  _ref text;
  _key text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not case_officer'; end if;

  select c.status, c.ref_no into _st, _ref from protection_cases c where c.id = _case_id;
  if _st is null then raise exception 'case not found'; end if;
  if _st not in ('accepted','signed','active','under_review','terminating') then
    raise exception 'الحالة ليست في مرحلة التنفيذ (%).', _st;
  end if;

  if not exists (select 1 from emergency_contacts e where e.case_id = _case_id) then
    return;  -- لا جهة اتصال مسجّلة — ولا يُقيَّد كشفٌ لم يقع
  end if;

  _key := public._emergency_contact_key();
  if _key is null then
    raise exception 'مفتاح تشفير جهة الطوارئ غير مهيّأ في Vault';
  end if;

  -- قيد الكشف قبل الإرجاع — كل اطّلاعٍ على الاسم/الهاتف مُحاسَبٌ عليه (م15/16).
  insert into audit_log (actor_id, action, target)
  values (_uid, 'reveal_emergency_contact', _ref);

  return query
  select case when e.name_enc  is null then null else pgp_sym_decrypt(e.name_enc,  _key) end,
         e.relationship,
         case when e.phone_enc is null then null else pgp_sym_decrypt(e.phone_enc, _key) end
    from emergency_contacts e
   where e.case_id = _case_id
   order by e.created_at desc
   limit 1;
end $$;
revoke execute on function public.execution_emergency_contact(uuid) from public, anon;
grant execute on function public.execution_emergency_contact(uuid) to authenticated;

comment on function public.execution_emergency_contact(uuid) is
  'كشف جهة اتصال الطوارئ لمرحلة التنفيذ حصراً — يفكّ التشفير ويقيّد كلّ كشفٍ في audit_log (م15/16).';
