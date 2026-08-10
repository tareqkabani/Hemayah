-- ============================================================
--  حزمة التسليم 11 (10 أغسطس 2026) — «حزمة الاطّلاع» لدى معدّ قرار المركز
--  المرجع: design_handoff_decision_review/README.md + schema.sql (الملحق)
--
--  1) subjects: أعمدة بيانات طالب الحماية (نفاذ/سُبل/الموارد البشرية) —
--     لا موطن لها اليوم في المخطّط، وبطاقة «بيانات طالب الحماية» تعرضها.
--  2) emergency_contacts: جدول جهة اتصال الطوارئ — RLS صمّاء (لا سياسات قراءة)
--     إلى حين بوابة التنفيذ؛ القراءة اليوم عبر service على غير المشفّر فقط.
--  3) council_decisions/board_decisions: نطاق القرار المُعَدّ (قبول كلي |
--     قبول جزئي | رفض الحماية) + «ما يُقبل وما يُستثنى» عند الجزئي.
--  4) council_save/council_submit: توقيع جديد يحمل النطاق؛ الرفع للاعتماد
--     يشترط النطاق، والجزئي يشترط نصّ الاستثناء، والرفض يعفي من الأنواع.
--  5) council_issue: نسخ النطاق إلى board_decisions عند الإصدار.
--
--  ملاحظة معمارية مقصودة (تُخالف حرفيّة ملحق التصميم لا روحه): حقول نموذجي
--  الطلب والتوصية تعيش هنا في details jsonb وتكتبها RPCs حيّة
--  (submit_protection_request وأخواتها) — فخريطة FIELD_COL في الواجهة تربطها
--  بمسار العمود (details→key) بدل أعمدة موازية تُنشئ مصدرَي حقيقة.
--  دورة الاعتماد السداسية (نائب ← رئيس قبل الطرح) باقية كما هي — قاعدة ملزمة.
-- ============================================================

-- ── 1) subjects: بيانات طالب الحماية (غير المشفّرة) ─────────
alter table subjects add column if not exists gender           text;
alter table subjects add column if not exists nationality      text;
alter table subjects add column if not exists birth_date       date;
alter table subjects add column if not exists marital_status   text;
alter table subjects add column if not exists national_address jsonb;  -- short·building·street·secondary·district·postal·city (سُبل)
alter table subjects add column if not exists employer         text;   -- الموارد البشرية
alter table subjects add column if not exists job_title        text;   -- الموارد البشرية
alter table subjects add column if not exists education_level  text;
alter table subjects add column if not exists source_flags     jsonb default '{}'::jsonb; -- nafath|spl|hrdf : live|manual

comment on column subjects.source_flags is
  'مصدر كل مجموعة: nafath|spl|hrdf → live|manual — مفتاح قلب manual→live بلا إعادة تصميم.';

-- ── 2) جهة الاتصال في الحالات الطارئة (تُكشف للتنفيذ فقط) ────
create table if not exists emergency_contacts (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references protection_cases(id) on delete cascade,
  name_enc     bytea,
  relationship text,
  phone_enc    bytea,
  created_at   timestamptz default now()
);
alter table emergency_contacts enable row level security;
-- لا سياسات قراءة/كتابة بعد — deny-all إلى حين بوابة التنفيذ (م15/16)؛
-- والكتابة عبر RPCs SECURITY DEFINER حصراً.
revoke all on emergency_contacts from anon, authenticated;
comment on table emergency_contacts is
  'جهة اتصال الطوارئ — قراءتها لدور التنفيذ فقط (سياساته تُضاف مع بوابته)؛ الاسم والهاتف مشفّران.';

-- ── 3) نطاق القرار المُعَدّ ──────────────────────────────────
alter table council_decisions add column if not exists scope      text;
alter table council_decisions add column if not exists scope_note text;
alter table council_decisions drop constraint if exists council_decisions_scope_check;
alter table council_decisions add constraint council_decisions_scope_check
  check (scope is null or scope in ('قبول كلي','قبول جزئي','رفض الحماية'));

alter table board_decisions add column if not exists scope      text;
alter table board_decisions add column if not exists scope_note text;
alter table board_decisions drop constraint if exists board_decisions_scope_check;
alter table board_decisions add constraint board_decisions_scope_check
  check (scope is null or scope in ('قبول كلي','قبول جزئي','رفض الحماية'));
alter table board_decisions drop constraint if exists board_decisions_scope_note_check;
-- شرط الملحق: scope='قبول جزئي' ⇒ scope_note موجود (السجلّ الصادر مكتمل دوماً)
alter table board_decisions add constraint board_decisions_scope_note_check
  check (scope is distinct from 'قبول جزئي' or nullif(btrim(scope_note), '') is not null);

comment on column council_decisions.scope is
  'نطاق القرار المُعَدّ (حزمة 11): قبول كلي | قبول جزئي | رفض الحماية — المعدّ يُعِدّ والقرار النهائي للمجلس.';
comment on column council_decisions.scope_note is 'ما يُقبل وما يُستثنى — إلزامي عند «قبول جزئي» (يُفرَض في council_submit).';

-- ── 4) council_save/council_submit بتوقيع يحمل النطاق ────────
-- التوقيع القديم (4 وسائط) يُحذف كي لا يلتبس التحميل على PostgREST.
drop function if exists public.council_save(uuid, jsonb, text, text);
create or replace function public.council_save(
  _case_id uuid, _types jsonb, _duration text, _reasoning text,
  _scope text default null, _scope_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  if _scope is not null and _scope not in ('قبول كلي','قبول جزئي','رفض الحماية') then
    raise exception 'نطاق غير معروف: %', _scope;
  end if;
  update council_decisions
     set types = coalesce(_types, types), duration = _duration, reasoning = _reasoning,
         scope = _scope, scope_note = nullif(btrim(coalesce(_scope_note, '')), ''),
         preparer_id = coalesce(preparer_id, _uid), updated_at = now()
   where case_id = _case_id and status = 'preparing'
     and (preparer_id is null or preparer_id = _uid);
  if not found then raise exception 'القرار ليس في الإعداد أو ليس مُسنَداً إليك.'; end if;
end $$;
revoke all on function public.council_save(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.council_save(uuid, jsonb, text, text, text, text) to authenticated;

drop function if exists public.council_submit(uuid, jsonb, text, text);
create or replace function public.council_submit(
  _case_id uuid, _types jsonb, _duration text, _reasoning text,
  _scope text default null, _scope_note text default null)
returns table(status text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'case_officer') then raise exception 'forbidden: not preparer'; end if;
  if _scope is null or _scope not in ('قبول كلي','قبول جزئي','رفض الحماية') then
    raise exception 'نطاق القرار المُعَدّ مطلوب: قبول كلي | قبول جزئي | رفض الحماية.';
  end if;
  if _scope = 'قبول جزئي' and nullif(btrim(coalesce(_scope_note, '')), '') is null then
    raise exception 'مع «قبول جزئي» يلزم بيان ما يُقبل وما يُستثنى.';
  end if;
  -- الرفض لا يقترح تدابير (تُصفَّر جبراً)؛ وفيما عداه أنواع م14 مطلوبة
  if _scope = 'رفض الحماية' then
    _types := '[]'::jsonb; _duration := null;
  elsif _types is null or jsonb_array_length(_types) = 0 then
    raise exception 'أنواع الحماية (م14) مطلوبة.';
  end if;
  if _reasoning is null or btrim(_reasoning) = '' then raise exception 'حيثيات القرار مطلوبة.'; end if;
  select ref_no into _ref from protection_cases where id = _case_id;
  update council_decisions cd
     set types = coalesce(_types, '[]'::jsonb), duration = _duration, reasoning = _reasoning,
         scope = _scope, scope_note = nullif(btrim(coalesce(_scope_note, '')), ''),
         status = 'pending_deputy', submitted_at = now(),
         preparer_id = coalesce(cd.preparer_id, _uid),
         deputy_approved_at = null, chair_approved_at = null, updated_at = now()
   where cd.case_id = _case_id and cd.status = 'preparing'
     and (cd.preparer_id is null or cd.preparer_id = _uid);
  if not found then raise exception 'القرار ليس في الإعداد أو ليس مُسنَداً إليك.'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'council_submit_for_approval', _ref);
  return query select 'pending_deputy'::text;
end $$;
revoke all on function public.council_submit(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.council_submit(uuid, jsonb, text, text, text, text) to authenticated;

-- ── 5) council_issue: النوع الفعلي بحسب النطاق + نسخه للسجلّ الصادر ──
-- (النصّ الحيّ من 20260808000001 + عمودا scope/scope_note في board_decisions)
-- قاعدة الاتساق: «قبول» المجلس = تبنّي القرار المُعَدّ كما عُرض (نصّ صندوق
-- التصويت) — فإن كان نطاقه «رفض الحماية» صدر القرار رفضاً مسبَّباً بحيثياته
-- المعتمدة، لا قبولاً بلا تدابير. ورفض المجلس للقرار المُعَدّ يُصدر رفضاً
-- للحماية بتسبيب الرئيس، ونطاق السجلّ الصادر حينها «رفض الحماية» لا نطاق
-- المسوّدة التي لم تُتبنَّ.
create or replace function public.council_issue(_case_id uuid, _reason text)
returns table(outcome text) language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _ref text; _t record; _st text; _newcase case_status; _sec text; _vars jsonb;
        _scope text; _scope_note text; _reasoning text; _eff text;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'board_chair') then raise exception 'غير مصرَّح: الإصدار بيد رئيس المركز حصراً.'; end if;
  select cd.status, cd.scope, cd.scope_note, cd.reasoning into _st, _scope, _scope_note, _reasoning
    from council_decisions cd where cd.case_id = _case_id for update;
  if _st <> 'voting' then raise exception 'القرار ليس في التصويت (%).', _st; end if;
  select * into _t from public.council_tally(_case_id);
  if not _t.closed then raise exception 'لم يُغلق التصويت بعد (بلوغ 4/7 أو انتهاء المهلة).'; end if;

  -- النوع الفعلي للإصدار: تبنّي مُعَدٍّ نطاقُه الرفض ⇒ رفض
  _eff := case when _t.outcome = 'accept' and _scope = 'رفض الحماية' then 'reject' else _t.outcome end;
  if _eff = 'reject' and (_reason is null or btrim(_reason) = '') then
    if _t.outcome = 'accept' then
      -- تبنّى المجلس الرفض المُعَدّ — حيثياته المعتمدة هي التسبيب المكتوب (م21)
      _reason := _reasoning;
    else
      raise exception 'قرار الرفض يتطلّب تسبيباً مكتوباً (م21).';
    end if;
  end if;
  select ref_no, secret_code into _ref, _sec from protection_cases where id = _case_id;

  update council_decisions
     set status = 'issued', issued_type = _eff, issued_reason = _reason, issued_at = now(), updated_at = now()
   where case_id = _case_id;

  _newcase := case _eff when 'accept' then 'accepted'::case_status else 'rejected'::case_status end;
  update protection_cases set status = _newcase, updated_at = now() where id = _case_id;

  insert into board_decisions (case_id, type, justification, decided_at, scope, scope_note)
  values (_case_id, case _eff when 'accept' then 'accept'::decision_type else 'reject'::decision_type end,
          coalesce(_reason, 'قرار المجلس'), now(),
          case when _t.outcome = 'accept' then _scope else 'رفض الحماية' end,
          case when _t.outcome = 'accept' then _scope_note else null end);

  -- إشعار الطرف الأول: طالب الحماية (فوريّ — م10) — من notification_templates
  _vars := jsonb_build_object(
    'رقم_الطلب', coalesce(_ref, '—'),
    'تاريخ_القرار', to_char(now(), 'YYYY-MM-DD'),
    'أسباب_الرفض', coalesce(nullif(btrim(_reason), ''), '—'),
    'مهلة_التظلم', '10 أيام');
  perform notify_from_template(
    case _eff when 'accept' then 'n_dec_accept' else 'n_dec_reject' end,
    _vars, _case_id, 'decision', 'requests');

  -- قرار القبول يستتبع دعوة توقيع الاتفاقية (م11)
  if _eff = 'accept' then
    perform notify_from_template('n_agreement', _vars, _case_id, 'agreement', 'requests');
  end if;

  -- إشعار الطرف الثاني: الجهة المختصة الموصية (إن وُجدت توصية على القضية)
  if exists (select 1 from recommendations rc where rc.case_id = _case_id) then
    perform notify_from_template('n_dec_entity',
      jsonb_build_object('الرمز_السري', coalesce(_sec, ''),
        'نتيجة_القرار', case _eff when 'accept' then 'قبول الحماية' else 'عدم القبول' end),
      _case_id, 'decision', 'incoming', null, 'competent'::referral_authority);
  end if;

  insert into audit_log (actor_id, action, target) values (_uid, 'council_issue_' || _eff, _ref);
  return query select _eff;
end $$;
