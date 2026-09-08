-- ============================================================
--  هويّة الصفّ في قائمتَي «الواردة» — إصلاح تضاعف القضية في القائمة
--
--  العطب: intake_unclaimed_cases تصل intake_inbox وصلاً مباشراً على
--  entered_case_id، و«صفٌّ واحدٌ لكلّ قضية» ليس مضموناً هناك: القضية
--  الورقية يصلها مستندُ الطلب (doc_kind='req') تُنشَأ منه، ثمّ قد يصلها
--  خطابُ توصية الجهة (doc_kind='rec') فيُربَط بها — وكلاهما صفٌّ في
--  intake_inbox يشير إليها. فتتضاعف القضية في القائمة بعدد مستنداتها.
--
--  ظهر حيّاً على C-2026-0745: صفّان (1447/إد/LNK-1 طلباً · 1447/إد/LNK-R
--  توصيةً). والأثر أبعد من إنذار React «مفتاحان متطابقان»:
--    · الشاشة تعرض القضية مرّتين فيبدو الطابور أطول ممّا هو،
--    · وأحد الصفّين ينسب للقضية قناةَ الخطاب وقيدَه لا قناةَ الطلب وقيدَه،
--    · وكشفُ وسيلة الاتصال وتسجيلُ محاولة التواصل مفهرسان بـcaseId في
--      الشاشة، فيفتحان على الصفّين معاً ويُحسب أثرهما مرّتين.
--
--  العلاج: الصفّ يمثّل القضية، فيُنتقى مستندُ **الطلب** وحده جانبياً
--  (lateral … limit 1) بدل الوصل المتشعّب. ووصلُ subjects يصير exists —
--  فالأصيل واحدٌ يقيناً (_store_subject تحذف ثمّ تُدرج)، لكنّ exists تُغني
--  عن انتقاء صفٍّ بعينه وتُكافئ السلوك القديم في كلّ حال.
--
--  ⚠️ لا قيد وحدانيّة على intake_inbox.entered_case_id — ولا يجوز: ربطُ
--  خطاب التوصية بقضيةٍ قائمة سلوكٌ مقصود (EntityIntake · الربط بحالة).
--  فالضمانة محلّها الاستعلام لا الجدول.
-- ============================================================

create or replace function public.intake_unclaimed_cases()
returns table(
  case_id           uuid,
  secret_code       text,
  ref_no            text,
  channel           text,
  reg_no            text,
  arrived_on        date,
  days_waiting      int,
  identity_verified boolean,
  has_contact       boolean,
  outreach_count    int,
  last_outreach_at  timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not public.is_intake_staff(_uid) then
    raise exception 'forbidden: not intake officer';
  end if;

  return query
  select c.id,
         c.secret_code,
         c.ref_no,
         coalesce(i.channel::text, ''),
         coalesce(i.reg_no, ''),
         coalesce(i.arrived_on, c.created_at::date),
         greatest(0, public.business_days_between(
                       coalesce(i.arrived_on::timestamptz, c.created_at), now())),
         c.identity_verified,
         -- «هل لهذه القضية وسيلةُ اتصالٍ نطاردها؟» — exists انهيارٌ مكافئٌ
         -- تماماً للوصل القديم: كان يُظهر صفّاً صادقاً متى صدق أيُّ أصيل.
         -- (وانتقاء أصيلٍ بعينه اعتباطٌ: intake_reveal_subject_contact
         --  تأخذ limit 1 بلا ترتيب، فلا مرجع يُحتذى.)
         exists (select 1 from public.subjects sj
                  where sj.case_id = c.id
                    and sj.subject_type = 'principal'
                    and sj.contact_enc is not null),
         coalesce(o.cnt, 0)::int,
         o.last_at
    from public.protection_cases c
    -- مستندٌ واحدٌ يمثّل القضية: الطلب أوّلاً (خطاب التوصية يُربط بها لاحقاً)،
    -- ثمّ الأقدم ورودًا — وهو الذي أُنشئت منه.
    left join lateral (
      select ii.channel, ii.reg_no, ii.arrived_on
        from public.intake_inbox ii
       where ii.entered_case_id = c.id
       order by (ii.doc_kind <> 'req'), ii.arrived_on, ii.created_at
       limit 1
    ) i on true
    left join lateral (
      select count(*) as cnt, max(l.created_at) as last_at
        from public.case_outreach_log l
       where l.case_id = c.id
    ) o on true
   -- الورقيّ وحده: entered_by يميّزه، وsubmitted_by الفارغ يعني لا حساب بعد.
   where c.submitted_by is null
     and c.entered_by is not null
     -- المنتهية لا تُطارَد: لا اتفاقية ولا تظلّم بعدها.
     and c.status not in ('closed', 'rejected')
   order by coalesce(i.arrived_on, c.created_at::date);
end $$;

revoke execute on function public.intake_unclaimed_cases() from public, anon;
grant  execute on function public.intake_unclaimed_cases() to authenticated;

comment on function public.intake_unclaimed_cases() is
  'الحالات الورقية التي لم تُضمّ لحساب صاحبها بعد — صفٌّ واحدٌ لكلّ قضية: '
  'مستند الطلب وحده يمثّلها وإن تعدّدت مستنداتها الواردة. '
  'بلا بيانات شخصية: has_contact رايةٌ لا رقم.';

-- ───────────────── هويّة صفّ «مُحالة من الفرز» ─────────────────
--  ⚠️ تحصينٌ لا إصلاحُ عطبٍ حيّ — والتصريح بذلك واجب:
--  صفُّ هذه القائمة **توصيةٌ لا قضية**، فـcase_id ليس هويّته. لكنّ
--  «توصيةً معلّقةً واحدةً لكلّ قضية» مضمونٌ اليوم فعلاً — تحقّقتُ من
--  المسارات الثلاثة كلّها:
--    · triage_decide تشترط status='triage' وتصيّرها 'referred'، فلا
--      إحالةَ ثانيةٌ إلا بعودةٍ للفرز،
--    · والعودة الوحيدة (decide_recommendation_approval بالاعتماد) تختم
--      التوصية الأولى بـreceived_at قبل أن تُعيد الحالة،
--    · وsubmit_entity_recommendation تُنشئ قضيةً جديدة لا توصيةً ثانية.
--
--  فالضمانة **منبثقةٌ من ثلاث دوالّ لا مُعلَنةٌ بقيد**. وrecord_recommendation
--  تفضّ الالتباس أصلاً بـ«order by created_at desc limit 1» بلا نظرٍ في
--  الجهة — فلو انكسرت الضمانة يوماً أُودع خطابُ جهةٍ في توصية أخرى.
--  ومن ثمّ تُرجع الدالّة rec_id لتكون للصفّ هويّتُه، ولا يُستند إلى
--  انبثاقٍ في موضعٍ نُصلح فيه عطباً من صنفه نفسه.
--
--  والعلاج الجذريّ قيدٌ يُعلن الضمانة:
--    create unique index … on recommendations (case_id) where received_at is null
--  ولم أُقحمه هنا: هو قرارٌ نظاميّ (أتُحال القضية لجهتين معاً أم لا؟)
--  يخصّ صاحب النظام لا مُصلِح المفتاح.
--  تغيّر جدول الإرجاع يوجب الحذف قبل الإنشاء، والحذف يُسقط المنح فتُعاد.
drop function if exists public.intake_referred_list(text, text, text, int, int);

create or replace function public.intake_referred_list(
  _q      text default null,
  _entity text default null,
  _due    text default null,
  _limit  int  default 25,
  _offset int  default 0
)
returns table(
  rec_id      uuid,
  case_id     uuid,
  secret_code text,
  category    text,
  case_no     text,
  city        text,
  region      text,
  entity      text,
  referred_at timestamptz,
  due_at      timestamptz,
  is_over     boolean,
  total_count bigint
)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid  uuid := auth.uid();
  _like text := case when btrim(coalesce(_q, '')) = '' then null
                     else '%' || btrim(_q) || '%' end;
  _lim  int  := least(greatest(coalesce(_limit, 25), 1), 100);  -- سقفٌ مقيَّد: لا تُستنزف بـlimit ضخم
  _off  int  := greatest(coalesce(_offset, 0), 0);
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not public.is_intake_staff(_uid) then
    raise exception 'forbidden: not intake officer';
  end if;
  if _due is not null and _due not in ('over', 'open') then
    raise exception 'تصفية مهلةٍ غير معروفة: %', _due;
  end if;

  return query
  with matched as (
    select r.id                             as rec_id,
           c.id                             as case_id,
           c.secret_code,
           c.category::text                 as category,
           coalesce(d.details->>'case_no', '') as case_no,
           coalesce(d.details->>'city', '')    as city,
           b.region::text                   as region,
           b.entity::text                   as entity,
           r.raised_at                      as referred_at,
           r.due_at,
           (r.due_at is not null and r.due_at < now()) as is_over
      from recommendations r
      join protection_cases c on c.id = r.case_id
      join branches b         on b.id = r.branch_id
      left join lateral (
        select pr.details from protection_requests pr
         where pr.case_id = c.id
         order by pr.submitted_at desc limit 1
      ) d on true
     where r.received_at is null
       and c.status = 'referred'
       and (_entity is null or b.entity = _entity::competent_entity)
       -- البحث على الرمز السرّي ورقم القضية — وهما ما بين يدي الموظف في الخطاب
       and (_like is null
            or c.secret_code ilike _like
            or coalesce(d.details->>'case_no', '') ilike _like)
  )
  select m.rec_id, m.case_id, m.secret_code, m.category, m.case_no, m.city, m.region,
         m.entity, m.referred_at, m.due_at, m.is_over,
         count(*) over() as total_count
    from matched m
   where _due is null
      or (_due = 'over' and m.is_over)
      or (_due = 'open' and not m.is_over)
   order by m.referred_at
   limit _lim offset _off;
end $$;

revoke execute on function public.intake_referred_list(text, text, text, int, int) from public, anon;
grant  execute on function public.intake_referred_list(text, text, text, int, int) to authenticated;

comment on function public.intake_referred_list(text, text, text, int, int) is
  'المُحالة من الفرز بانتظار توصية الجهة — صفٌّ لكلّ توصيةٍ معلّقة (لا لكلّ '
  'قضية): القضية الواحدة تُحال لأكثر من جهة، ولكلّ جهةٍ خطابُها. rec_id هويّة '
  'الصفّ. بحثٌ وترقيمٌ على الخادم، وسقف limit مئة.';
