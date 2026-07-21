-- ============================================================
--  الإسناد المرن للدراسة والتقييم — سير العمل لا يتوقف بغياب أحد
--  المبدأ: لا سجلات إجازات ولا إدخال يدوي — النظام يعالج الغياب آلياً:
--  1) «الاسترداد الصامت»: مهمة لم تُعتمد خلال يوم عمل (م10) تُسحب وتُعاد
--     للأقل عبئاً من المتاحين، مع إشعار النائب وأثر تدقيق كامل (لا حذف).
--  2) «نظافة النصاب»: عند تقدّم القضية للقرار بالنصاب (دراسة + تقييم —
--     المشغّل القائم _auto_send_to_decision) تُوسم صفوف الباقين غير
--     المعتمدة «اكتُفي بالنصاب» فتختفي من طوابيرهم بدل بقائها طريقاً مسدوداً.
--  3) «سحب الاطّلاع»: من أُعيد إسناد مهمته يفقد الوصول للقضية فوراً
--     (مبدأ الحاجة إلى المعرفة) — العزل الصفّي يبقى تاماً.
--  المجدول: study_eval_watchdog() كل 30 دقيقة عبر pg_cron، معطّل افتراضياً
--  ويُفعَّل بيئةً ببيئة:  alter database postgres set app.settings.watchdog = 'on';
-- ============================================================

-- ─────────────────── أعمدة الإحلال (أثر تدقيق، لا حذف) ───────────────────
alter table studies     add column if not exists superseded_at timestamptz;
alter table studies     add column if not exists superseded_reason text;
alter table assessments add column if not exists superseded_at timestamptz;
alter table assessments add column if not exists superseded_reason text;

-- ─────────────────── أيام العمل (مرآة businessDaysBetween في domain) ───────────────────
-- عدد أيام العمل بين تاريخين — يتجاهل الجمعة والسبت؛ to<=from → صفر.
create or replace function public.business_days_between(_from timestamptz, _to timestamptz)
returns int language sql immutable as $$
  select coalesce(count(*) filter (where extract(dow from d) not in (5,6)), 0)::int
  from generate_series(date_trunc('day', _from) + interval '1 day',
                       date_trunc('day', _to), interval '1 day') d
$$;

-- ─────────────────── سحب الاطّلاع من المُحال عنه ───────────────────
create or replace function public.is_assigned_study(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from studies s
    where s.case_id = _case_id and s.studier_id = auth.uid() and s.superseded_at is null);
$$;

create or replace function public.is_assigned_assessment(_case_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assessments a
    where a.case_id = _case_id and a.evaluator_id = auth.uid() and a.superseded_at is null);
$$;

-- ─────────────────── العبء والإسناد يتجاهلان الصفوف المُحالة ───────────────────
create or replace function public.assign_study_eval(_case_id uuid, _per_role int default 2)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into studies (case_id, studier_id)
  select _case_id, x.user_id from (
    select ur.user_id,
      (select count(*) from studies s where s.studier_id = ur.user_id
        and s.submitted_at is null and s.superseded_at is null) as load
    from user_roles ur where ur.role = 'studier'
    order by load asc, ur.user_id asc
    limit _per_role
  ) x
  on conflict (case_id, studier_id) do nothing;

  insert into assessments (case_id, evaluator_id)
  select _case_id, x.user_id from (
    select ur.user_id,
      (select count(*) from assessments a where a.evaluator_id = ur.user_id
        and a.submitted_at is null and a.superseded_at is null) as load
    from user_roles ur where ur.role = 'evaluator'
    order by load asc, ur.user_id asc
    limit _per_role
  ) x
  on conflict (case_id, evaluator_id) do nothing;
end $$;

-- ─────────────────── طوابير المؤلّفين بلا الصفوف المُحالة ───────────────────
create or replace function public.my_study_tasks()
returns table (
  case_id uuid, secret_code text, ref_no text, category app_category,
  source case_source, foreign_info jsonb, peers bigint,
  assigned_at timestamptz, submitted_at timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.secret_code, c.ref_no, c.category, c.source,
    (select to_jsonb(f.*) from foreign_requests f where f.case_id = c.id limit 1),
    (select count(*) from studies s2 where s2.case_id = c.id and s2.superseded_at is null),
    s.created_at, s.submitted_at
  from studies s
  join protection_cases c on c.id = s.case_id
  where has_role(auth.uid(),'studier') and s.studier_id = auth.uid()
    and s.superseded_at is null
  order by (s.submitted_at is null) desc, s.created_at desc;
$$;

create or replace function public.my_assessment_tasks()
returns table (
  case_id uuid, secret_code text, ref_no text, category app_category,
  source case_source, foreign_info jsonb, peers bigint,
  assigned_at timestamptz, submitted_at timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.secret_code, c.ref_no, c.category, c.source,
    (select to_jsonb(f.*) from foreign_requests f where f.case_id = c.id limit 1),
    (select count(*) from assessments a2 where a2.case_id = c.id and a2.superseded_at is null),
    a.created_at, a.submitted_at
  from assessments a
  join protection_cases c on c.id = a.case_id
  where has_role(auth.uid(),'evaluator') and a.evaluator_id = auth.uid()
    and a.superseded_at is null
  order by (a.submitted_at is null) desc, a.created_at desc;
$$;

-- ─────────────────── إشعار قيادة المركز (النائب) ───────────────────
create or replace function public._notify_deputies(_case_id uuid, _title text, _body text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
  select _case_id, ur.user_id, 'assign', _title, _body, 'tasks', now()
  from user_roles ur where ur.role = 'deputy_chair';
$$;

-- ─────────────────── نظافة النصاب عند التقدّم للقرار ───────────────────
-- المشغّل القائم ينقل القضية عند (دراسة + تقييم) معتمدَين؛ نُكمله بوسم
-- صفوف الباقين غير المعتمدة «اكتُفي بالنصاب» فلا تبقى طرقاً مسدودة.
create or replace function public._auto_send_to_decision()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare _ns int; _na int; _cur case_status; _ref text;
begin
  select status, ref_no into _cur, _ref from protection_cases where id = NEW.case_id;
  if _cur is distinct from 'under_study' then return NEW; end if;
  select count(*) into _ns from studies
    where case_id = NEW.case_id and submitted_at is not null and superseded_at is null;
  select count(*) into _na from assessments
    where case_id = NEW.case_id and submitted_at is not null and superseded_at is null;
  if _ns >= 1 and _na >= 1 then
    update protection_cases set status = 'in_decision', updated_at = now() where id = NEW.case_id;
    insert into council_decisions (case_id, status) values (NEW.case_id, 'preparing')
      on conflict (case_id) do nothing;

    update studies set superseded_at = now(), superseded_reason = 'اكتُفي بالنصاب — تقدّمت القضية للقرار'
      where case_id = NEW.case_id and submitted_at is null and superseded_at is null;
    update assessments set superseded_at = now(), superseded_reason = 'اكتُفي بالنصاب — تقدّمت القضية للقرار'
      where case_id = NEW.case_id and submitted_at is null and superseded_at is null;

    insert into audit_log (actor_id, action, target)
      values (auth.uid(), 'auto_send_to_decision', _ref);
  end if;
  return NEW;
end $$;

-- ─────────────────── الاسترداد الصامت (المُجدوَل) ───────────────────
-- مهمة نشطة لم تُعتمد خلال يوم عمل في قضية ما تزال قيد الدراسة → تُحال
-- للأقل عبئاً ممن لا صفّ له على القضية؛ وإن لم يوجد بديل → إنذار عجز للنائب.
-- الحارس: يعمل فقط حين app.settings.watchdog = 'on' (يُفعَّل بيئةً ببيئة).
create or replace function public.study_eval_watchdog()
returns table (reassigned int, exhausted int)
language plpgsql security definer set search_path = public as $$
declare r record; _next uuid; _ref text; _secret text; _re int := 0; _ex int := 0;
begin
  if coalesce(current_setting('app.settings.watchdog', true), 'off') <> 'on' then
    return query select 0, 0; return;
  end if;

  for r in
    select 'study' as kind, s.id, s.case_id, s.studier_id as author_id, c.ref_no, c.secret_code
      from studies s join protection_cases c on c.id = s.case_id
     where c.status = 'under_study' and s.submitted_at is null and s.superseded_at is null
       and business_days_between(s.created_at, now()) >= 1
    union all
    select 'assessment', a.id, a.case_id, a.evaluator_id, c.ref_no, c.secret_code
      from assessments a join protection_cases c on c.id = a.case_id
     where c.status = 'under_study' and a.submitted_at is null and a.superseded_at is null
       and business_days_between(a.created_at, now()) >= 1
  loop
    _ref := r.ref_no; _secret := r.secret_code;

    if r.kind = 'study' then
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'studier'
         and not exists (select 1 from studies s2 where s2.case_id = r.case_id and s2.studier_id = ur.user_id)
       order by (select count(*) from studies s3 where s3.studier_id = ur.user_id
                   and s3.submitted_at is null and s3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      update studies set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — ' || case when _next is null then 'لا بديل متاح' else 'أُعيد الإسناد' end
        where id = r.id;

      if _next is not null then
        insert into studies (case_id, studier_id) values (r.case_id, _next); -- مشغّل الإسناد يُشعر الجديد
        _re := _re + 1;
        perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — دراسة',
          _secret || ' — مهمة دراسة تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
        insert into audit_log (actor_id, action, target) values (null, 'reassign_study', _ref);
      else
        _ex := _ex + 1;
        perform _notify_deputies(r.case_id, 'عجز طاقم الدراسة',
          _secret || ' — تجاوزت مهمة الدراسة مهلتها ولا دارس متاحاً بلا صفٍّ على القضية. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'study_pool_exhausted', _ref);
      end if;

    else
      select ur.user_id into _next
        from user_roles ur
       where ur.role = 'evaluator'
         and not exists (select 1 from assessments a2 where a2.case_id = r.case_id and a2.evaluator_id = ur.user_id)
       order by (select count(*) from assessments a3 where a3.evaluator_id = ur.user_id
                   and a3.submitted_at is null and a3.superseded_at is null) asc, ur.user_id asc
       limit 1;

      update assessments set superseded_at = now(),
        superseded_reason = 'تجاوز يوم العمل (م10) — ' || case when _next is null then 'لا بديل متاح' else 'أُعيد الإسناد' end
        where id = r.id;

      if _next is not null then
        insert into assessments (case_id, evaluator_id) values (r.case_id, _next);
        _re := _re + 1;
        perform _notify_deputies(r.case_id, 'إعادة إسناد آلية — تقييم',
          _secret || ' — مهمة تقييم تجاوزت يوم العمل (م10) فأُعيد إسنادها آلياً للأقل عبئاً.');
        insert into audit_log (actor_id, action, target) values (null, 'reassign_assessment', _ref);
      else
        _ex := _ex + 1;
        perform _notify_deputies(r.case_id, 'عجز طاقم التقييم',
          _secret || ' — تجاوزت مهمة التقييم مهلتها ولا مقيّم متاحاً بلا صفٍّ على القضية. يلزم تدخّل القيادة.');
        insert into audit_log (actor_id, action, target) values (null, 'assessment_pool_exhausted', _ref);
      end if;
    end if;
  end loop;

  return query select _re, _ex;
end $$;

-- الحارس يُشغَّل من المجدول/الخدمة حصراً — لا استدعاء من المستخدمين
revoke execute on function public.study_eval_watchdog() from public, anon, authenticated;
revoke execute on function public._notify_deputies(uuid, text, text) from public, anon, authenticated;

-- ─────────────────── الجدولة (pg_cron إن توافر) ───────────────────
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron غير متاح هنا — شغّل study_eval_watchdog() من مجدول خارجي: %', sqlerrm;
    return;
  end;
  if not exists (select 1 from cron.job where jobname = 'study-eval-watchdog') then
    perform cron.schedule('study-eval-watchdog', '*/30 * * * *', 'select public.study_eval_watchdog()');
  end if;
end $$;
