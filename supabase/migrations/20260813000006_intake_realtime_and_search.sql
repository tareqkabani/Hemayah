-- ============================================================
--  «الواردة» طابورٌ حيّ + بحثٌ وترقيم في «المرسلة» (فجوتا الإنتاج ٣ و٥)
--
--  ٣) Realtime: معيار القبول في التسليم ينصّ «تفريغ صفٍّ من الواردة
--     يُخرجه من الطابور **فوراً لكل المنسوبين**». وهو غير مستوفًى: الشاشة
--     تُحدَّث لمن يعمل عليها وحده، فيبقى الصفّ ظاهراً عند زميله حتى يُحدِّث
--     صفحته. الصحّة محميّةٌ (الاستلام وحارس التفريغ يمنعان الازدواج) —
--     الناقص انتعاشُ الواجهة. يُضاف الجدول لنشر supabase_realtime.
--
--     ⚠️ replica identity: التحديث يبثّ الصفّ القديم بمفتاحه فقط افتراضاً،
--     وشاشة الواردة تُرشِّح على entered_case_id — فبلا full لا يُعرف أنّ
--     الصفّ خرج من الطابور.
--
--  ٥) البحث والترقيم: «المرسلة» كانت تُرجع كلّ الصفوف دفعةً واحدة بلا
--     بحثٍ ولا صفحات — تثقل بعد أشهر ويُتصفَّح القيدُ بصرياً.
-- ============================================================

-- ── 1) بثّ الواردة ──
do $$ begin
  alter publication supabase_realtime add table intake_inbox;
exception when duplicate_object then null; end $$;

alter table intake_inbox replica identity full;

-- ── 2) «المرسلة» ببحثٍ وترقيم ──
-- الصيغة القديمة تُسقط أولاً: بقاؤها مع الجديدة ذات القيم الافتراضية
-- يجعل النداء غامضاً على PostgREST (درس triage_decide المتكرر).
drop function if exists public.intake_sent_list();

create or replace function public.intake_sent_list(
  _q      text default null,    -- بحثٌ بالرمز السري أو رقم القيد
  _dest   text default null,    -- 'triage' | 'study' | null = الكلّ
  _limit  int  default 25,
  _offset int  default 0
)
returns table(
  id                uuid,
  secret_code       text,
  channel           text,
  doc_kind          text,
  reg_no            text,
  arrived_on        date,
  entity            text,
  entered_by_name   text,
  entered_by_role   text,
  entered_at        timestamptz,
  identity_verified boolean,
  case_status       text,
  total_count       bigint      -- الإجمالي المطابق — لبناء أزرار الصفحات
)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  _uid uuid := auth.uid();
  _needle text := nullif(btrim(coalesce(_q, '')), '');
  _lim int := least(greatest(coalesce(_limit, 25), 1), 100);
  _off int := greatest(coalesce(_offset, 0), 0);
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not is_intake_staff(_uid) then raise exception 'forbidden: not intake staff'; end if;

  return query
  with matched as (
    select i.id, c.secret_code, i.channel::text as ch, i.doc_kind::text as dk, i.reg_no,
           i.arrived_on, i.entity, i.entered_by_name, i.entered_by_role, i.entered_at,
           c.identity_verified, c.status::text as st
      from intake_inbox i
      join protection_cases c on c.id = i.entered_case_id
     where i.entered_case_id is not null
       -- الوجهة تُشتقّ من نوع المستند: توصيةٌ على طلبٍ مُحال تمضي للدراسة
       and (_dest is null
            or (_dest = 'study'  and i.doc_kind = 'rec')
            or (_dest = 'triage' and i.doc_kind <> 'rec'))
       and (_needle is null
            or c.secret_code ilike '%' || _needle || '%'
            or i.reg_no      ilike '%' || _needle || '%')
  )
  select m.id, m.secret_code, m.ch, m.dk, m.reg_no, m.arrived_on, m.entity,
         m.entered_by_name, m.entered_by_role, m.entered_at,
         m.identity_verified, m.st,
         count(*) over () as total_count
    from matched m
   order by m.entered_at desc
   limit _lim offset _off;
end $$;
revoke execute on function public.intake_sent_list(text, text, int, int) from public, anon;
grant  execute on function public.intake_sent_list(text, text, int, int) to authenticated;

-- فهرسٌ للبحث بالقيد (البحث بالرمز يمرّ على مفتاح protection_cases الفريد)
create index if not exists intake_inbox_regno_idx on intake_inbox (reg_no);
