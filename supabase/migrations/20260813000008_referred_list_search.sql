-- ============================================================
--  «مُحالة من الفرز» — بحثٌ وترقيمٌ وتصفية على الخادم (فجوة التسليم ٥)
--
--  نصّ التسليم طلب البحث والترقيم في «المرسلة» **و«مُحالة من الفرز»** معاً.
--  الأولى أُنجزت في 20260813000006؛ وهذه الثانية بقيت تُجلب هكذا:
--
--    Promise.all(ENTS.map(key => list_referred_for_entity(key))).flat()
--
--  خمسةُ نداءاتٍ لكلّ رسمةٍ للصفحة — واحدٌ لكلّ جهةٍ مختصّة — تُسطَّح في
--  الواجهة **بلا حدٍّ ولا بحثٍ ولا تصفية**. فالقائمة تُرجع كلّ ما انتظر
--  توصيتَه منذ إطلاق النظام، ويُتصفَّح القيدُ بصرياً بين السطور.
--
--  هنا نداءٌ واحد: بحثٌ بالرمز السرّي أو رقم القضية · تصفيةٌ بالجهة وبالمهلة
--  (متجاوزة / ضمن المهلة) · صفحاتٌ بعدّادٍ إجماليّ من نافذةٍ واحدة.
--
--  ⚠️ list_referred_for_entity **تبقى ولا تُمسّ**: خطوة الربط الإلزامية في
--  نموذج توصية الجهة (EntityIntake) تستدعيها بجهةٍ واحدة معلومة، وحاجتها
--  قائمةٌ لا يُغني عنها البحث المُرقَّم.
--
--  الترتيب بالأقدم أوّلاً: أطولُ انتظارٍ أولى بالمتابعة — وهو ترتيب
--  list_referred_for_entity نفسه فلا يختلف السلوك بين المدخلين.
-- ============================================================

create or replace function public.intake_referred_list(
  _q      text default null,   -- الرمز السرّي أو رقم القضية
  _entity text default null,   -- مفتاح الجهة المختصة · null = الكلّ
  _due    text default null,   -- 'over' متجاوزة · 'open' ضمن المهلة · null = الكلّ
  _limit  int  default 25,
  _offset int  default 0
)
returns table(
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
    select c.id                                as case_id,
           c.secret_code,
           c.category::text                    as category,
           coalesce(d.details->>'case_no', '') as case_no,
           coalesce(d.details->>'city', '')    as city,
           b.region::text                      as region,
           b.entity::text                      as entity,
           r.raised_at                         as referred_at,
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
  select m.case_id, m.secret_code, m.category, m.case_no, m.city, m.region,
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
  'قائمة «مُحالة من الفرز» بانتظار توصية الجهة — بحثٌ بالرمز/رقم القضية وتصفيةٌ '
  'بالجهة والمهلة وترقيمٌ بعدّادٍ إجماليّ (فجوة التسليم ٥). '
  'لا تُغني عن list_referred_for_entity: تلك لخطوة الربط بجهةٍ واحدة معلومة.';
