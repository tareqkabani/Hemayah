-- ============================================================
--  الإدخال اليدوي للطلبات — مزامنة التصميم (قيد الورود + خطوة الربط)
--  الفجوتان (مرجع التصميم «بوابة موظف المركز/الإدخال اليدوي للطلبات»):
--    1) المُهل النظامية (م10) كانت تُحسب من لحظة الإدخال لا من تاريخ الورود
--       الفعلي للمستند الورقيّ — هنا يستقبل submit_paper_intake تاريخ الورود
--       ورقم القيد الإداري ويؤرّخ القضية بهما.
--    2) «توصية على طلبٍ مُحال» كانت تُنشئ سجلاً مكرّراً برمز جديد — هنا
--       دالة list_referred_for_entity تعرض الطلبات المُحالة بانتظار توصية
--       (خطوة الربط الإلزامية)، وrecord_recommendation يستقبل بيانات الخطاب
--       الرسمي وتاريخ الورود فتُدمج التوصية في سجلّ الطلب نفسه.
-- ============================================================

-- ── 1) قيد الورود على التقديم الورقيّ ──
-- إسقاط الصيغة القديمة أولاً: بقاؤها مع الجديدة ذات القيم الافتراضية
-- يجعل النداء غامضاً (ambiguous) على PostgREST (درس triage_decide).
drop function if exists public.submit_paper_intake(text, text, app_category, text, text, text, boolean, text, jsonb);

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

  _ref := 'REF-' || _yr || '-' || nextval('paper_ref_seq')::text;
  _sec := 'C-'  || _yr || '-' || lpad(nextval('paper_secret_seq')::text, 4, '0');

  -- قضية في طابور الفرز، مؤرَّخة بتاريخ الورود الفعليّ — منه تبدأ المُهل
  -- والمؤقّتات في سجلّ الفرز، لا من لحظة الإدخال.
  insert into protection_cases (ref_no, secret_code, category, status, source, created_at)
  values (_ref, _sec, _category, 'triage', 'local', _received)
  returning id into _cid;

  insert into protection_requests (case_id, applicant_role, channel, submitted_at, details)
  values (_cid, _applicant_role, 'paper', _received,
          coalesce(_details, '{}'::jsonb)
            || jsonb_build_object('entity', _entity, 'crime', _crime,
                                  'reason', _reason, 'prior_submit', _prior_submit,
                                  'case_no', _case_no, 'paper_source', _source,
                                  'intake_by', _uid, 'verified', false)
            || jsonb_strip_nulls(jsonb_build_object(
                 'received_date', _received_date, 'reg_no', _reg_no)));

  insert into audit_log (actor_id, action, target)
  values (_uid, 'submit_paper_intake_' || _source, _ref);

  return query select _cid, _ref, _sec;
end $$;

revoke execute on function public.submit_paper_intake(text, text, app_category, text, text, text, boolean, text, jsonb, date, text) from public, anon;
grant execute on function public.submit_paper_intake(text, text, app_category, text, text, text, boolean, text, jsonb, date, text) to authenticated;

-- ── 2) خطوة الربط الإلزامية — الطلبات المُحالة بانتظار توصية جهةٍ بعينها ──
-- تُقيَّد بموظّفي الاستقبال؛ SECURITY DEFINER لأنّ سياسات recommendations
-- موجَّهة بالفرع (rec_branch_rw) فلا يراها موظف المركز مباشرةً.
create or replace function public.list_referred_for_entity(_entity text)
returns table(
  case_id     uuid,
  secret_code text,
  category    app_category,
  case_no     text,
  city        text,
  region      text,
  referred_at timestamptz,
  due_at      timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not (has_role(_uid, 'case_officer') or has_role(_uid, 'hotline_operator')) then
    raise exception 'forbidden: not intake officer';
  end if;

  return query
  select c.id, c.secret_code, c.category,
         coalesce(d.details->>'case_no', ''),
         coalesce(d.details->>'city', ''),
         b.region::text,
         r.raised_at, r.due_at
    from recommendations r
    join protection_cases c on c.id = r.case_id
    join branches b on b.id = r.branch_id
    left join lateral (
      select pr.details from protection_requests pr
       where pr.case_id = c.id order by pr.submitted_at desc limit 1
    ) d on true
   where b.entity = _entity::competent_entity
     and r.received_at is null
     and c.status = 'referred'
   order by r.raised_at;
end $$;

revoke execute on function public.list_referred_for_entity(text) from public, anon;
grant execute on function public.list_referred_for_entity(text) to authenticated;

-- ── 3) استلام التوصية الورقيّة ببيانات الخطاب وتاريخ الورود الفعلي ──
alter table recommendations add column if not exists receipt_meta jsonb;

drop function if exists public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text);

create or replace function public.record_recommendation(
  _case_id           uuid,
  _decision          text,                         -- 'توفير' | 'عدم توفير'
  _channel           text,                         -- 'electronic' | 'paper'
  _factors9          jsonb    default '{}'::jsonb, -- عوامل المادة 9
  _proposed_type     jsonb    default '[]'::jsonb, -- أنواع مقترحة (اقتراح)
  _proposed_duration interval default null,
  _notes             text     default null,
  _received_date     date     default null,        -- تاريخ الورود الفعلي للخطاب — منه تُحسب المُهل
  _reg_no            text     default null,        -- رقم القيد الإداري (سجلّ الوارد)
  _letter_no         text     default null,        -- رقم خطاب الجهة الوارد بالبريد
  _letter_date       date     default null,        -- تاريخ الخطاب
  _letter_by         text     default null         -- مُعِدّ التوصية في الجهة (كما في الخطاب)
) returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _cur case_status;
  _ref text;
  _rid uuid;
  _raised timestamptz;
  _received timestamptz;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;

  -- الصلاحية بحسب القناة: ورقيّ = الموظف نيابةً؛ إلكترونيّ = الجهة نفسها.
  if _channel = 'paper' then
    if not (has_role(_uid, 'case_officer') or has_role(_uid, 'hotline_operator')) then
      raise exception 'forbidden: not intake officer';
    end if;
  elsif _channel = 'electronic' then
    if not has_role(_uid, 'competent_body') then
      raise exception 'forbidden: not competent_body';
    end if;
  else
    raise exception 'قناة غير معروفة: %', _channel;
  end if;

  if _decision is null or _decision not in ('توفير', 'عدم توفير') then
    raise exception 'قرار التوصية مطلوب (توفير | عدم توفير).';
  end if;

  -- شرط: الحالة محالةٌ للجهة فقط (لا محضر اتصالٍ مطلوب — استلامٌ لا اتصال).
  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'referred' then raise exception 'الحالة ليست محالةً للجهة (%).', _cur; end if;

  -- التوصية المُعلّقة لهذه الحالة (المُنشأة عند الإحالة، لم تُستلم بعد).
  select id, raised_at into _rid, _raised from recommendations
   where recommendations.case_id = _case_id and received_at is null
   order by created_at desc limit 1;
  if _rid is null then raise exception 'لا توجد توصيةٌ مُعلّقةٌ لهذه الحالة.'; end if;

  -- تاريخ الورود الفعلي (ورقيّ): لا يسبق الإحالة ولا يكون مستقبلاً.
  if _received_date is not null then
    if _received_date > current_date then
      raise exception 'تاريخ الورود لا يكون مستقبلاً';
    end if;
    if _raised is not null and _received_date < _raised::date then
      raise exception 'تاريخ ورود التوصية يسبق تاريخ الإحالة (%)', _raised::date;
    end if;
    _received := _received_date::timestamptz;
  else
    _received := now();
  end if;

  update recommendations
     set decision          = _decision,
         factors9          = coalesce(_factors9, factors9),
         proposed_type     = coalesce(_proposed_type, proposed_type),
         proposed_duration = coalesce(_proposed_duration, proposed_duration),
         received_at       = _received,
         channel           = _channel,
         recorded_by       = _uid,
         notes             = _notes,
         receipt_meta      = nullif(jsonb_strip_nulls(jsonb_build_object(
                               'received_date', _received_date, 'reg_no', _reg_no,
                               'letter_no', _letter_no, 'letter_date', _letter_date,
                               'letter_by', _letter_by)), '{}'::jsonb)
   where id = _rid;

  -- عودةٌ للفرز لقرارٍ ثانٍ (يكمل / يغلق / يحفظ) مستنيراً بالتوصية.
  update protection_cases set status = 'triage', updated_at = now() where id = _case_id;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'record_recommendation_' || _channel, _ref);

  -- إشعارٌ محايدٌ للمستفيد (لا يكشف مضمون التوصية).
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'rec_received', 'وردت توصية الجهة المختصة',
    'استُلمت توصية الجهة المختصة بشأن طلبك، وهو الآن قيد اتخاذ القرار.',
    'requests', now());

  return query select 'triage'::case_status;
end $$;

revoke execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text) from public, anon;
grant execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text) to authenticated;
