-- ============================================================
--  المكتب الفني (2/2) — دليل المستشارين ومراسلات المكتب — 19 يوليو 2026
--  1) tech_office_advisors(): كشف المدير بأسماء مستشاريه وأعبائهم (للتوزيع
--     والعمود «المستشار المُسنَد») — أسماء الموظفين لا هويّات متظلّمين.
--  2) office_messages: خيوط مؤمّنة معزولة بالتظلّم وقناته —
--     head: المستشار ↔ المدير · center: المكتب ↔ منسّق تظلّمات المركز ·
--     ag: المدير ↔ مكتب النائب العام (إحاطة).
--     خيط «المتظلّم» يمرّ عبر messages القائم (thread='center' بالرمز السري)
--     فيصل بوابة طالب الحماية بلا جدولٍ موازٍ.
--  3) الإرسال عبر send_office_message حصراً: مصفوفة دور↔قناة + عزل
--     المستشار + تدقيق + إشعار «msg» للطرف المقابل. المقروئية عبر
--     notification_reads (مفاتيح om:<id>) — النمط القائم.
-- ============================================================

-- ─────────────────── 1) دليل المستشارين (للمدير) ───────────────────
create or replace function public.tech_office_advisors()
returns table (user_id uuid, name text, spec text, open_load bigint, decided bigint)
language sql stable security definer set search_path = public as $$
  select ur.user_id,
    coalesce(u.raw_user_meta_data->>'name', u.email) as name,
    coalesce(ur.attributes->>'spec', '—') as spec,
    (select count(*) from grievances g where g.assigned_to = ur.user_id and g.office_decision is null) as open_load,
    (select count(*) from grievances g where g.assigned_to = ur.user_id and g.advisor_decision is not null) as decided
  from user_roles ur join auth.users u on u.id = ur.user_id
  where ur.role = 'advisor'
    and (has_role(auth.uid(), 'tech_manager') or has_authority('ag'))
  order by name;
$$;
grant execute on function public.tech_office_advisors() to authenticated;

-- ─────────────────── 2) مراسلات المكتب ───────────────────
create table if not exists office_messages (
  id           uuid primary key default gen_random_uuid(),
  grievance_id uuid not null references grievances(id) on delete cascade,
  channel      text not null check (channel in ('head','center','ag')),
  author_id    uuid not null references auth.users(id) on delete cascade,
  author_label text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_office_msgs_thread on office_messages (grievance_id, channel, created_at);
alter table office_messages enable row level security;

-- مساعد عزلٍ SECURITY DEFINER (درس fix_grievance_rls_recursion): تظلّمي المُسنَد؟
create or replace function public.owns_grievance(_grievance_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from grievances g where g.id = _grievance_id and g.assigned_to = auth.uid());
$$;

-- المستشار: خيوط تظلّماته (head/center) — لا يطّلع على إحاطة النائب العام
drop policy if exists om_advisor_read on office_messages;
create policy om_advisor_read on office_messages for select using (
  channel in ('head','center') and owns_grievance(grievance_id));
-- المدير: كل خيوط مكتبه
drop policy if exists om_head_read on office_messages;
create policy om_head_read on office_messages for select using (has_role(auth.uid(),'tech_manager'));
-- منسّق المركز: قناة المركز
drop policy if exists om_center_read on office_messages;
create policy om_center_read on office_messages for select using (
  channel = 'center' and has_role(auth.uid(),'case_officer'));
-- مكتب النائب العام: قناة الإحاطة
drop policy if exists om_ag_read on office_messages;
create policy om_ag_read on office_messages for select using (
  channel = 'ag' and has_authority('ag'));
-- لا إدراج مباشراً — عبر send_office_message حصراً

-- خيط «المتظلّم»: المكتب يقرأ رسائل قضايا تظلّماته (thread center) ويرسل بصفته
drop policy if exists tech_msg_read on messages;
create policy tech_msg_read on messages for select using (
  thread = 'center' and (
    is_assigned_grievance(case_id)
    or (has_role(auth.uid(),'tech_manager') and case_has_grievance(case_id))));
drop policy if exists tech_msg_write on messages;
create policy tech_msg_write on messages for insert with check (
  thread = 'center' and direction = 'in' and (
    is_assigned_grievance(case_id)
    or (has_role(auth.uid(),'tech_manager') and case_has_grievance(case_id))));

-- ─────────────────── 3) الإرسال المؤمّن ───────────────────
create or replace function public.send_office_message(_grievance_id uuid, _channel text, _body text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _g record; _id uuid; _label text; _is_office boolean := false;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(btrim(_body),'') = '' then raise exception 'رسالة فارغة'; end if;
  if _channel not in ('head','center','ag') then raise exception 'قناة غير معروفة'; end if;

  select * into _g from grievances where id = _grievance_id;
  if _g.id is null then raise exception 'تظلّم غير موجود'; end if;

  -- مصفوفة الدور ↔ القناة
  if has_role(_uid,'advisor') and _g.assigned_to = _uid and _channel in ('head','center') then
    _label := 'مستشار المكتب الفني'; _is_office := true;
  elsif has_role(_uid,'tech_manager') then
    _label := 'مدير المكتب الفني'; _is_office := true;
  elsif has_role(_uid,'case_officer') and _channel = 'center' then
    _label := 'منسّق التظلّمات — مركز الحماية';
  elsif has_authority('ag') and _channel = 'ag' then
    _label := 'مكتب النائب العام';
  else
    raise exception 'forbidden: القناة خارج صلاحيتك';
  end if;

  insert into office_messages (grievance_id, channel, author_id, author_label, body)
  values (_grievance_id, _channel, _uid, _label, btrim(_body))
  returning id into _id;

  insert into audit_log (actor_id, action, target) values (_uid, 'office_message', _g.ref);

  -- إشعار «msg» للطرف المقابل (لا للمرسِل)
  if _channel = 'head' then
    if has_role(_uid,'tech_manager') then
      if _g.assigned_to is not null then
        insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
        values (_g.case_id, _g.assigned_to, 'msg', 'رسالة من مدير المكتب الفني',
          left(btrim(_body),140) || ' — بشأن التظلّم ' || _g.ref || '.', 'messages', now());
      end if;
    else
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select _g.case_id, ur.user_id, 'msg', 'رسالة من مستشارٍ بمكتبك',
        left(btrim(_body),140) || ' — بشأن التظلّم ' || _g.ref || '.', 'messages', now()
      from user_roles ur where ur.role = 'tech_manager' and ur.user_id <> _uid;
    end if;
  elsif _channel = 'center' then
    if _is_office then
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select _g.case_id, ur.user_id, 'msg', 'رسالة من المكتب الفني — ' || _g.ref,
        left(btrim(_body),140), 'messages', now()
      from user_roles ur where ur.role = 'case_officer';
    else
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select _g.case_id, x.uid, 'msg', 'رسالة من منسّق تظلّمات المركز',
        left(btrim(_body),140) || ' — بشأن التظلّم ' || _g.ref || '.', 'messages', now()
      from (select _g.assigned_to as uid where _g.assigned_to is not null
            union select ur.user_id from user_roles ur where ur.role = 'tech_manager') x;
    end if;
  else -- ag
    if _is_office then
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select _g.case_id, ur.user_id, 'msg', 'إحاطة من مدير المكتب الفني — ' || _g.ref,
        left(btrim(_body),140), 'messages', now()
      from user_roles ur where ur.role = 'prosecutor_general';
    else
      insert into notifications (case_id, recipient_id, type, title, body, target_tab, sent_at)
      select _g.case_id, ur.user_id, 'msg', 'رسالة من مكتب النائب العام',
        left(btrim(_body),140) || ' — بشأن التظلّم ' || _g.ref || '.', 'messages', now()
      from user_roles ur where ur.role = 'tech_manager';
    end if;
  end if;

  return _id;
end $$;
grant execute on function public.send_office_message(uuid, text, text) to authenticated;
-- سياسات RLS تُقيَّم بحقوق المستعلِم — يلزم authenticated تنفيذ دالّة العزل
revoke execute on function public.owns_grievance(uuid) from public, anon;
grant execute on function public.owns_grievance(uuid) to authenticated;

-- ─────────────────── 4) البثّ الحيّ ───────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='office_messages') then
    alter publication supabase_realtime add table office_messages;
  end if;
end $$;
alter table office_messages replica identity full;
