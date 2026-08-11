-- ============================================================
--  تثبيت «سلسلة اعتماد رئيس الفرع» في المهاجرات — كائناتٌ كانت حيّةً
--  في قاعدة التطوير المشتركة بلا ملفٍ يسندها في أي فرع.
--
--  البنية كانت مُجمَّدةً أصلاً في 20260704000001 (جدولا approval_chains
--  وrecommendation_approvals + سياساتهما + عمود approval_status)، لكن
--  المنطق الذي يُحرّكها كُتب على القاعدة مباشرةً ولم يُلتقَط قط:
--    · العمودان recommendations.prepared_by / prepared_at
--    · submit_recommendation_for_approval  (الموظف يرفع للاعتماد)
--    · decide_recommendation_approval      (الرئيس يعتمد أو يعيد)
--    · branch_approval_queue               (صفّ الاعتماد للبوابة)
--    · حارسٌ في record_recommendation يُقفل القناة الإلكترونية عليها
--    · صفوف approval_chains للجهات الخمس (الدرجة 1 = رئيس الفرع)
--
--  أثر الانحراف المُثبَت: e2e-full-journey.sql يفشل على هذه القاعدة عند
--  الحارس (والباقي تتابعيٌّ «transaction is aborted»)، ولا يصل السلوكُ
--  البيئةَ التجريبية لأن سكربت النشر يعتمد قائمة ملفاتٍ صريحة — أي أن
--  المحلّي والتجريبيّ يفترقان في قاعدةٍ قانونية. وكان يزول بأول
--  `supabase db reset`. هذه المهاجرة تلتقط الحالة الحيّة كما هي حرفياً.
--
--  الأثر القانوني للسلسلة: التوصية الإلكترونية لا تصل المركز إلا مُعتمَدةً
--  من رئيس الفرع (صاحب الصلاحية)؛ المقرّ يشرف ولا يعتمد، والموظف لا
--  يعتمد عملَ نفسه. القناة الورقية تبقى على مسارها (م5/4) بلا مساس.
--
--  ⚠️ بوابة الجهات المختصة ما زالت تستدعي record_recommendation مباشرةً
--     للقناة الإلكترونية (entity-actions.ts:recordLinkedRecommendation)،
--     فتُصادف الحارسَ. وصلُ البوابة بالمسار الثنائي (شاشة رفعٍ للموظف +
--     شاشة اعتمادٍ للرئيس على branch_approval_queue) عملٌ مستقلّ لاحق —
--     مقصودٌ إبقاؤه خارج هذه المهاجرة كي تبقى التقاطاً أميناً لا تغييراً.
-- ============================================================

-- ── (١) عمودا الإعداد على التوصية ──
-- من أعدّ التوصية ومتى — تمييزُ المُعِدّ عن المعتمِد شرطُ «لا يعتمد أحدٌ عملَ نفسه».
alter table recommendations add column if not exists prepared_by uuid references auth.users(id);
alter table recommendations add column if not exists prepared_at timestamptz;

-- ── (٢) صفوف سلسلة الاعتماد: درجةٌ واحدة لكل جهة (رئيس الفرع) ──
-- البنية تدعم 1..ن؛ المُجمَّد الآن درجةٌ واحدة إلزامية بمهلةٍ فرعية يومٍ واحد
-- ضمن مظلّة م7. idempotent عبر قيد (entity, step_no) الفريد.
insert into approval_chains (entity, step_no, approver, sla, active)
select e, 1, 'branch_head', interval '1 day', true
  from unnest(enum_range(null::competent_entity)) as e
on conflict (entity, step_no) do nothing;

-- ── (٣) رفع التوصية لاعتماد رئيس الفرع (الموظف أو الرئيس) ──
create or replace function public.submit_recommendation_for_approval(
  _case_id           uuid,
  _decision          text,                          -- 'توفير' | 'عدم توفير'
  _factors9          jsonb    default '{}'::jsonb,
  _proposed_type     jsonb    default '[]'::jsonb,
  _proposed_duration interval default null,
  _notes             text     default null
) returns table(recommendation_id uuid, approval_status text, step_due_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid    uuid := auth.uid();
  _level  text;
  _branch uuid;
  _cur    case_status;
  _ref    text;
  _rid    uuid;
  _st     text;
  _rdue   timestamptz;
  _sla    interval;
  _due    timestamptz;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'competent_body') then raise exception 'forbidden: not competent_body'; end if;

  _level  := cb_level();
  _branch := cb_branch();
  -- المقر يشرف ولا يُعِدّ ولا يعتمد (نصّ المخطّط).
  if _level is null or _level not in ('clerk', 'head') then
    raise exception 'forbidden: إعداد التوصية لموظفي الفرع ورئيسه (المستوى الحالي: %)', coalesce(_level, '—');
  end if;
  if _branch is null then raise exception 'لا فرع مرتبطٌ بحسابك — تعذّر إعداد التوصية.'; end if;

  if _decision is null or _decision not in ('توفير', 'عدم توفير') then
    raise exception 'قرار التوصية مطلوب (توفير | عدم توفير).';
  end if;

  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _case_id for update;
  if _cur is null then raise exception 'case not found'; end if;
  if _cur <> 'referred' then raise exception 'الحالة ليست محالةً للجهة (%).', _cur; end if;

  -- التوصية المعلّقة لهذه الحالة، ولفرع المُعِدّ حصراً (عزل الفرع).
  select r.id, r.approval_status, r.due_at into _rid, _st, _rdue
    from recommendations r
   where r.case_id = _case_id and r.received_at is null and r.branch_id = _branch
   order by r.created_at desc limit 1;
  if _rid is null then
    raise exception 'لا توجد توصيةٌ معلّقةٌ لهذه الحالة في فرعك.';
  end if;
  if coalesce(_st, 'preparing') = 'pending_head' then
    raise exception 'التوصية مرفوعةٌ لاعتماد الرئيس بالفعل.';
  end if;
  if coalesce(_st, 'preparing') = 'approved' then
    raise exception 'التوصية اعتُمدت ورُفعت للمركز.';
  end if;

  -- مهلة الدرجة من السلسلة، مقيّدةً بسقف مظلّة م7 (لا تتجاوزها).
  select ac.sla into _sla from approval_chains ac
   where ac.entity = cb_entity() and ac.step_no = 1 and coalesce(ac.active, true);
  _due := now() + coalesce(_sla, interval '1 day');
  if _rdue is not null and _due > _rdue then _due := _rdue; end if;

  update recommendations
     set decision          = _decision,
         factors9          = coalesce(_factors9, factors9),
         proposed_type     = coalesce(_proposed_type, proposed_type),
         proposed_duration = coalesce(_proposed_duration, proposed_duration),
         notes             = _notes,
         prepared_by       = _uid,
         prepared_at       = now(),
         approval_status   = 'pending_head'
   where id = _rid;

  insert into recommendation_approvals (recommendation_id, branch_id, step_no, approver, due_at)
  values (_rid, _branch, 1, 'branch_head', _due);

  insert into audit_log (actor_id, action, target)
  values (_uid, 'recommendation_submitted_for_approval', _ref);

  return query select _rid, 'pending_head'::text, _due;
end $$;

-- ── (٤) بتّ رئيس الفرع: اعتمادٌ (= رفعٌ للمركز) أو إعادةٌ للموظف ──
create or replace function public.decide_recommendation_approval(
  _recommendation_id uuid,
  _decision          text,                          -- 'approved' | 'returned'
  _note              text default null
) returns table(new_approval_status text, new_case_status case_status)
language plpgsql security definer set search_path = public, extensions as $$
declare
  _uid    uuid := auth.uid();
  _branch uuid;
  _cid    uuid;
  _ref    text;
  _cur    case_status;
  _st     text;
  _aid    uuid;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_role(_uid, 'competent_body') then raise exception 'forbidden: not competent_body'; end if;
  -- صاحب الصلاحية وحده: رئيس الفرع. المقر يشرف ولا يعتمد، والموظف لا يعتمد عملَ نفسه.
  if cb_level() is distinct from 'head' then
    raise exception 'forbidden: الاعتماد صلاحية رئيس الفرع (المستوى الحالي: %)', coalesce(cb_level(), '—');
  end if;
  _branch := cb_branch();
  if _branch is null then raise exception 'لا فرع مرتبطٌ بحسابك.'; end if;

  if _decision is null or _decision not in ('approved', 'returned') then
    raise exception 'قرار الاعتماد مطلوب (approved | returned).';
  end if;
  if _decision = 'returned' and (_note is null or btrim(_note) = '') then
    raise exception 'الملاحظة إلزاميةٌ عند إعادة التوصية للموظف.';
  end if;

  select r.case_id, r.approval_status into _cid, _st
    from recommendations r
   where r.id = _recommendation_id and r.branch_id = _branch
   for update;
  if _cid is null then raise exception 'لا توصيةَ بهذا المعرّف في فرعك.'; end if;
  if coalesce(_st, 'preparing') <> 'pending_head' then
    raise exception 'التوصية ليست بانتظار اعتمادك (%).', coalesce(_st, 'preparing');
  end if;

  select c.status, c.ref_no into _cur, _ref from protection_cases c where c.id = _cid for update;
  if _cur <> 'referred' then raise exception 'الحالة لم تعد محالةً للجهة (%).', _cur; end if;

  -- إغلاق الدرجة المعلّقة (آخر درجةٍ مفتوحة لهذه التوصية).
  select ra.id into _aid from recommendation_approvals ra
   where ra.recommendation_id = _recommendation_id and ra.decided_at is null
   order by ra.created_at desc limit 1;
  if _aid is null then
    -- درجةٌ فُقدت (بياناتٌ سابقة للسلسلة): تُفتح وتُغلق في الحركة نفسها
    -- كي لا يبقى الاعتماد بلا أثرٍ يُدقَّق.
    insert into recommendation_approvals (recommendation_id, branch_id, step_no, approver, due_at)
    values (_recommendation_id, _branch, 1, 'branch_head', now()) returning id into _aid;
  end if;
  update recommendation_approvals
     set decision = _decision, note = _note, approver_id = _uid, decided_at = now()
   where id = _aid;

  if _decision = 'returned' then
    update recommendations set approval_status = 'returned' where id = _recommendation_id;
    insert into audit_log (actor_id, action, target)
    values (_uid, 'recommendation_returned_to_clerk', _ref);
    return query select 'returned'::text, _cur;
    return;
  end if;

  -- الاعتماد = الرفع للمركز. أثرُ القناة الإلكترونية كما في record_recommendation:
  -- ورودٌ فعليّ، وعودةٌ للفرز لقرارٍ ثانٍ مستنيرٍ بالتوصية.
  update recommendations
     set approval_status = 'approved',
         received_at     = now(),
         channel         = 'electronic',
         recorded_by     = _uid
   where id = _recommendation_id;

  update protection_cases set status = 'triage', updated_at = now() where id = _cid;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'recommendation_approved_and_raised', _ref);

  -- إشعارٌ محايدٌ للمستفيد (لا يكشف مضمون التوصية) — نصّ القناة الإلكترونية.
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_cid, 'rec_received', 'وردت توصية الجهة المختصة',
          'استُلمت توصية الجهة المختصة بشأن طلبك، وهو الآن قيد اتخاذ القرار.',
          'requests', now());

  return query select 'approved'::text, 'triage'::case_status;
end $$;

-- ── (٥) صفّ الاعتماد: ما هو بانتظار الرئيس وما أعاده للموظف ──
-- الموظف والرئيس يريان فرعهما، والمقرّ يطّلع على فروع جهته (إشراف بلا اعتماد).
create or replace function public.branch_approval_queue()
returns table(
  recommendation_id uuid, case_id uuid, ref_no text, secret_code text, category app_category,
  branch_id uuid, entity competent_entity, region region_code,
  approval_status text, decision text, factors9 jsonb, proposed_type jsonb,
  proposed_duration interval, notes text, prepared_by_name text, prepared_at timestamptz,
  step_due_at timestamptz, case_due_at timestamptz, last_note text)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.case_id, c.ref_no, c.secret_code, c.category,
         r.branch_id, b.entity, b.region,
         r.approval_status, r.decision, r.factors9, r.proposed_type, r.proposed_duration, r.notes,
         coalesce(u.raw_user_meta_data->>'name', 'موظف الفرع'),
         r.prepared_at,
         (select ra.due_at from recommendation_approvals ra
           where ra.recommendation_id = r.id and ra.decided_at is null
           order by ra.created_at desc limit 1),
         r.due_at,
         (select ra.note from recommendation_approvals ra
           where ra.recommendation_id = r.id and ra.decided_at is not null
           order by ra.decided_at desc limit 1)
    from recommendations r
    join protection_cases c on c.id = r.case_id
    left join branches b   on b.id = r.branch_id
    left join auth.users u on u.id = r.prepared_by
   where has_role(auth.uid(), 'competent_body')
     and r.approval_status in ('pending_head', 'returned')
     and (
       (cb_level() in ('clerk', 'head') and r.branch_id = cb_branch())
       or (cb_level() = 'hq' and r.branch_id in (select cb_entity_branches()))
     )
   order by (select ra.due_at from recommendation_approvals ra
              where ra.recommendation_id = r.id and ra.decided_at is null
              order by ra.created_at desc limit 1) nulls last, r.created_at;
$$;

-- ── (٦) إقفال القناة الإلكترونية على السلسلة في record_recommendation ──
-- نسخةٌ مطابقة لآخر تعريفٍ في 20260809000001، بفارقين اثنين فقط:
--   أ) القناة الإلكترونية ترفض الاستدعاءَ المباشر وتدلّ على المسار الثنائي.
--   ب) ما بعد ذلك ورقيٌّ حصراً، فوجهةُ الحالة under_study بلا تفريع.
-- القناة الورقية (م5/4) بلا أي تغيير في سلوكها.
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

  -- الصلاحية بحسب القناة: ورقيّ = الموظف نيابةً؛ إلكترونيّ = عبر السلسلة.
  if _channel = 'paper' then
    if not (has_role(_uid, 'case_officer') or has_role(_uid, 'hotline_operator')) then
      raise exception 'forbidden: not intake officer';
    end if;
  elsif _channel = 'electronic' then
    raise exception 'القناة الإلكترونية تمرّ بسلسلة اعتماد رئيس الفرع: استخدم submit_recommendation_for_approval ثم decide_recommendation_approval.';
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

  -- إحالةٌ مباشرةٌ للدراسة والتقييم — المحفّز trg_assign_study_eval يُسند آلياً بالعبء.
  -- (القناة الورقية وحدها تبلغ هذا الموضع بعد إقفال الإلكترونية أعلاه.)
  _next := 'under_study';
  update protection_cases set status = _next, updated_at = now() where id = _case_id;

  insert into audit_log (actor_id, action, target)
  values (_uid, 'record_recommendation_' || _channel, _ref);

  -- إشعارٌ محايدٌ للمستفيد (لا يكشف مضمون التوصية).
  insert into notifications (case_id, type, title, body, target_tab, sent_at)
  values (_case_id, 'rec_received', 'وردت توصية الجهة المختصة',
    'استُلمت توصية الجهة المختصة بشأن طلبك، وهو الآن قيد الدراسة والتقييم.',
    'requests', now());

  return query select _next;
end $$;

-- ── (٧) الصلاحيات: لا تنفيذ عاماً — المستخدم المُوثَّق فقط، والحرّاس داخل الدوال ──
revoke execute on function public.submit_recommendation_for_approval(uuid, text, jsonb, jsonb, interval, text) from public, anon;
grant  execute on function public.submit_recommendation_for_approval(uuid, text, jsonb, jsonb, interval, text) to authenticated;
revoke execute on function public.decide_recommendation_approval(uuid, text, text) from public, anon;
grant  execute on function public.decide_recommendation_approval(uuid, text, text) to authenticated;
revoke execute on function public.branch_approval_queue() from public, anon;
grant  execute on function public.branch_approval_queue() to authenticated;
revoke execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text) from public, anon;
grant  execute on function public.record_recommendation(uuid, text, text, jsonb, jsonb, interval, text, date, text, text, date, text) to authenticated;
