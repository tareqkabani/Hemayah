-- ============================================================
--  استلام توصية الجهة المختصّة (ردّ الإحالة) — CO
--  الفجوة: بعد قرار refer تُنشأ توصيةٌ مستحقّة (recommendations, decision=null)
--  لكن لا دالةَ تُسجّل ورودها — لا إلكترونيّاً من الجهة، ولا ورقيّاً بيد الموظف
--  نيابةً عن جهةٍ غير مرتبطة بالنظام — ولا مخرجَ من الحالة referred.
--  هنا:
--    1) توسعة recommendations بحقول الاستلام (من عبّأها · متى · بأيّ قناة).
--    2) دالة record_recommendation: تملأ التوصية وتُعيد الحالة referred → triage
--       لقرارٍ ثانٍ من الموظف (يُكمل للدراسة / يُغلق / يُحفظ) بحسب مضمون التوصية.
--       بلا محضر اتصال — فالاستلام مستندٌ رسميّ لا اتصالٌ بمواطن.
--  ملاحظة تصميم: triage_decide لم يُمسّ. القرار الثاني على الطلب المدنيّ المُحال
--  يمرّ لأنّ محضر الفرز الأوّل قائمٌ؛ والإعفاء يقتصر على فعل الاستلام (باختيار المستخدم).
-- ============================================================

-- ── 1) حقول الاستلام على التوصية (idempotent) ──
alter table recommendations add column if not exists received_at timestamptz;
alter table recommendations add column if not exists channel     text;   -- electronic | paper
alter table recommendations add column if not exists recorded_by uuid references auth.users(id);
alter table recommendations add column if not exists notes       text;

-- ── 2) دالة تسجيل التوصية الواردة (SECURITY DEFINER) ──
create or replace function public.record_recommendation(
  _case_id           uuid,
  _decision          text,                       -- 'توفير' | 'عدم توفير'
  _channel           text,                        -- 'electronic' | 'paper'
  _factors9          jsonb    default '{}'::jsonb, -- عوامل المادة 9
  _proposed_type     jsonb    default '[]'::jsonb, -- أنواع مقترحة (اقتراح)
  _proposed_duration interval default null,
  _notes             text     default null
) returns table(status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _cur case_status; _ref text; _rid uuid;
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
  select id into _rid from recommendations
   where case_id = _case_id and received_at is null
   order by created_at desc limit 1;
  if _rid is null then raise exception 'لا توجد توصيةٌ مُعلّقةٌ لهذه الحالة.'; end if;

  update recommendations
     set decision          = _decision,
         factors9          = coalesce(_factors9, factors9),
         proposed_type     = coalesce(_proposed_type, proposed_type),
         proposed_duration = coalesce(_proposed_duration, proposed_duration),
         received_at       = now(),
         channel           = _channel,
         recorded_by       = _uid,
         notes             = _notes
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

grant execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text) to authenticated;
