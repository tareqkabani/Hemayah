-- ============================================================
-- حزمة 2026-08-09 — المحور ٥: تسليم الملف الكامل للدراسة والتقييم
--
-- «ما ينتقل للدراسة ليس ملخّصاً بل الملف كاملاً» — الدارس والمقيّم يبنيان
-- رأيهما على المستند لا على حقلين. لا تُنسَخ البيانات: الملف يُقرأ من جداوله
-- الأصلية (protection_requests · recommendations · triage_reviews ·
-- contact_logs) عبر دالة عرض مقيّدة بالإسناد تحجب هوية طالب الحماية
-- وتكشف الرمز السري فقط. الـdossier عقدُ عرضٍ لا نموذجُ تخزين.
--
-- والمدخل الثاني: التوصية الورقية المربوطة بطلبٍ مُحال — ركنا القبول
-- مكتملان لحظة تسجيلها (طلب مسبّب + توصية واردة)، فتُحال للدراسة
-- والتقييم مباشرةً بدل العودة لقرار فرزٍ ثانٍ.
-- ============================================================

-- ── 1) الملف الكامل الوارد من الفرز — للدارس/المقيّم المُسنَد إليه فقط ──
create or replace function public.study_dossier(_case_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _out jsonb;
begin
  -- العزل: الملف لمن أُسندت إليه الحالة (دارساً أو مقيّماً) لا لغيره.
  if not (is_assigned_study(_case_id) or is_assigned_assessment(_case_id)) then
    raise exception 'forbidden: not assigned to this case';
  end if;

  select jsonb_build_object(
    'case', jsonb_build_object(
      'secret', c.secret_code,
      'category', c.category,
      'status', c.status,
      'created_at', c.created_at
    ),
    -- من الطلب: وقائع القضية دون هوية صاحبها (تُحجب identity وجهة الاتصال والنيابة)
    'request', (
      select jsonb_build_object(
        'channel', r.channel,
        'submitted_at', r.submitted_at,
        'paper_source', r.details->>'paper_source',
        'paper_channel', r.details->>'channel',
        'crime', r.details->>'crime',
        'reason', r.details->>'reason',
        'case_no', r.details->>'case_no',
        'city', r.details->>'city',
        'entity', r.details->>'entity',
        'prior_submit', r.details->>'prior_submit',
        'reg_no', r.details->>'reg_no',
        'received_date', r.details->>'received_date',
        'attachments', coalesce(r.details->'attachments', '[]'::jsonb),
        'unverified', coalesce((r.details->'identity'->>'verified')::boolean, true) is false
      )
      from protection_requests r
      where r.case_id = _case_id
      order by r.submitted_at desc limit 1
    ),
    -- إجراء الفرز الأخير: القرار والملاحظة والموظف من آخر مراجعة؛ والفحص
    -- الشكليّ من آخر مراجعةٍ حملته فعلاً — فهو يُملأ في القرار الأول (الإحالة)
    -- بينما القرار الثاني (recDriven) يمرّ بلا فحصٍ جديد.
    'review', (
      select jsonb_build_object(
        'decision', tr.decision,
        'note', tr.reason,
        'authority', tr.authority,
        'formal_check', coalesce((
          select tr2.formal_check from triage_reviews tr2
          where tr2.case_id = _case_id and tr2.formal_check <> '{}'::jsonb
          order by tr2.created_at desc limit 1
        ), '{}'::jsonb),
        'decided_at', tr.created_at,
        'officer', (select u.raw_user_meta_data->>'name' from auth.users u where u.id = tr.officer_id)
      )
      from triage_reviews tr
      where tr.case_id = _case_id
      order by tr.created_at desc limit 1
    ),
    -- محاضر الاتصال كاملةً بطوابعها ومُعدّيها
    'calls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'at', l.created_at,
        'channel', l.channel,
        'result', l.result,
        'note', l.summary,
        'by', (select u.raw_user_meta_data->>'name' from auth.users u where u.id = l.officer_id)
      ) order by l.created_at)
      from contact_logs l where l.case_id = _case_id
    ), '[]'::jsonb),
    -- توصية الجهة (الأحدث): مضمونها وقناتها وبيانات ورودها
    'recommendation', (
      select jsonb_build_object(
        'source_body', rc.source_body,
        'decision', rc.decision,
        'notes', rc.notes,
        'channel', rc.channel,
        'raised_at', rc.raised_at,
        'received_at', rc.received_at,
        'receipt_meta', rc.receipt_meta
      )
      from recommendations rc
      where rc.case_id = _case_id
      order by rc.raised_at desc limit 1
    )
  ) into _out
  from protection_cases c where c.id = _case_id;

  if _out is null then raise exception 'case not found'; end if;
  return _out;
end $$;

revoke execute on function public.study_dossier(uuid) from public, anon;
grant execute on function public.study_dossier(uuid) to authenticated;

-- ── 2) التوصية الورقية المربوطة → الدراسة والتقييم مباشرةً ──
-- التغيير الوحيد عن التعريف السابق (20260805000001): القناة الورقية تنقل
-- الحالة إلى under_study (فيُسند الدارس والمقيّم آلياً بالمحفّز
-- trg_assign_study_eval) بدل العودة إلى triage لقرارٍ ثانٍ — لأنّ موظف
-- المركز أكمل التفريغ والتحقق لتوّه، وركنا القبول (م7/1) مكتملان.
-- القناة الإلكترونية تبقى على مسارها: عودةٌ للفرز لقرارٍ ثانٍ.
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
  _next case_status;
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

  if _channel = 'paper' then
    -- إحالةٌ مباشرةٌ للدراسة والتقييم — المحفّز trg_assign_study_eval يُسند آلياً بالعبء.
    _next := 'under_study';
  else
    -- عودةٌ للفرز لقرارٍ ثانٍ (يكمل / يغلق / يحفظ) مستنيراً بالتوصية.
    _next := 'triage';
  end if;
  update protection_cases set status = _next, updated_at = now() where id = _case_id;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'record_recommendation_' || _channel, _ref);

  -- إشعارٌ محايدٌ للمستفيد (لا يكشف مضمون التوصية).
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'rec_received', 'وردت توصية الجهة المختصة',
    case when _next = 'under_study'
      then 'استُلمت توصية الجهة المختصة بشأن طلبك، وهو الآن قيد الدراسة والتقييم.'
      else 'استُلمت توصية الجهة المختصة بشأن طلبك، وهو الآن قيد اتخاذ القرار.'
    end,
    'requests', now());

  return query select _next;
end $$;

revoke execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text) from public, anon;
grant execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text) to authenticated;
