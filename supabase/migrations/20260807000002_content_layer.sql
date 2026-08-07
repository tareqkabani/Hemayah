-- 20260807000002_content_layer.sql — طبقة محتوى المنصّة (القوائم · الإشعارات · الرسائل · النصوص)
-- المصدر: design_handoff_admin_portal/schema_content.sql (تسليم 7 أغسطس 2026)،
-- مكيَّفاً على مخططنا: has_role/app_role موجودان في 20260704000001، وأُضيف تدقيق
-- التعديلات (القاعدة الملزمة 5: كل تعديل محتوى = صفّ في audit_log).
-- المبدأ: يُخزَّن item_key لا النص — تحسين الصياغة لا يستلزم هجرة بيانات.

create table reference_lists (
  list_key    text primary key,                       -- applicant_role · protection_types …
  title       text not null,
  domain      text not null,                          -- intake|triage|decision|exec|gov
  legal_ref   text,                                   -- م14 · م9 …
  icon        text,
  scope       text[] default '{}',                    -- البوابات المستهلكة (توثيق)
  locked      boolean not null default false,         -- ثابت نظاميّ: التعديل يمرّ باعتماد
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table reference_items (
  id          uuid primary key default gen_random_uuid(),
  list_key    text not null references reference_lists(list_key) on delete cascade,
  item_key    text not null,                          -- المخزَّن في جداول الأعمال
  label       text not null,
  label_short text,
  sort_order  int  not null default 0,
  active      boolean not null default true,          -- إيقافٌ لا حذف (سلامة السجلات القديمة)
  meta        jsonb default '{}'::jsonb,              -- dur/note/… خصائص البند
  unique (list_key, item_key)
);

create table notification_templates (
  template_key text primary key,                      -- n_dec_accept …
  title        text not null,
  category     text not null,                         -- intake|entity|decision|grievance|exec|urgent|internal
  trigger_desc text not null,                         -- الحدث المُطلِق
  recipient    text not null,                         -- الفئة المستقبِلة
  channels     text[] not null default '{}',          -- platform|app|sms|official_mail|entity_portal|staff_portal
  legal_ref    text,
  sla          text,                                  -- المهلة النظامية المرتبطة
  subject      text not null,
  body         text not null,                         -- متغيّرات بصيغة {اسم_المتغير}
  variables    text[] default '{}',                   -- تُشتقّ من النصّ وتُخزَّن للتحقّق
  active       boolean not null default true,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz default now()
);

create table system_messages (
  message_key text primary key,                       -- s_contact_req …
  title       text not null,
  tone        text not null check (tone in ('error','warning','info','success')),
  screen      text not null,                          -- موضع الظهور
  legal_ref   text,
  body        text not null,
  active      boolean not null default true,
  updated_at  timestamptz default now()
);
comment on table system_messages is
  'نصوص لافتات المنع والتحقق. تعديل النصّ لا يغيّر شرط المنع نفسه — الشرط في منطق التطبيق.';

create table legal_texts (
  text_key     text primary key,                      -- l_agreement …
  title        text not null,
  legal_ref    text,
  screen       text not null,
  body         text not null,
  version      int  not null default 1,
  effective_at timestamptz,                           -- تاريخ السريان بعد الاعتماد
  active       boolean not null default true
);

-- طلب تعديل على محتوى مقفل (ثابت نظاميّ / نصّ نظاميّ) — لا يسري قبل الاعتماد
create table content_change_requests (
  id           uuid primary key default gen_random_uuid(),
  target_kind  text not null check (target_kind in ('reference_list','notification','system_message','legal_text')),
  target_key   text not null,
  payload      jsonb not null,                        -- الحالة المقترحة كاملة
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz default now(),
  status       text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  note         text
);

alter table reference_lists         enable row level security;
alter table reference_items         enable row level security;
alter table notification_templates  enable row level security;
alter table system_messages         enable row level security;
alter table legal_texts             enable row level security;
alter table content_change_requests enable row level security;

-- المحتوى غير سرّي: كل مستخدم موثّق يقرأه (الحقول والقوائم والنصوص تُعرض في الواجهات)
create policy content_read_lists  on reference_lists        for select using (auth.role() = 'authenticated');
create policy content_read_items  on reference_items        for select using (auth.role() = 'authenticated');
create policy content_read_notif  on notification_templates for select using (auth.role() = 'authenticated');
create policy content_read_sysmsg on system_messages        for select using (auth.role() = 'authenticated');
create policy content_read_legal  on legal_texts            for select using (auth.role() = 'authenticated');

-- الكتابة: مدير النظام فقط، وعلى المحتوى غير المقفل فقط
create policy content_write_items on reference_items for all using (
  has_role(auth.uid(),'sysadmin')
  and (select not locked from reference_lists rl where rl.list_key = reference_items.list_key))
  with check (
  has_role(auth.uid(),'sysadmin')
  and (select not locked from reference_lists rl where rl.list_key = reference_items.list_key));
create policy content_write_notif  on notification_templates for all using (has_role(auth.uid(),'sysadmin')) with check (has_role(auth.uid(),'sysadmin'));
create policy content_write_sysmsg on system_messages        for all using (has_role(auth.uid(),'sysadmin')) with check (has_role(auth.uid(),'sysadmin'));

-- المقفل والنصوص النظامية: طلب تعديل يرفعه مدير النظام ويعتمده رئيس المركز
create policy ccr_insert on content_change_requests for insert with check (has_role(auth.uid(),'sysadmin'));
create policy ccr_read   on content_change_requests for select using (
  has_role(auth.uid(),'sysadmin') or has_role(auth.uid(),'board_chair'));
create policy ccr_decide on content_change_requests for update using (has_role(auth.uid(),'board_chair'));

create index on reference_items (list_key, sort_order);
create index on notification_templates (category);
create index on content_change_requests (status, target_kind);

-- ══ تدقيق تعديلات المحتوى (القاعدة الملزمة 5) ══
-- صفٌّ في audit_log لكل إدراج/تعديل/إيقاف؛ target = مفتاح السجل المعدَّل.
-- (سلسلة prev_hash يتكفّل بها خطّاف audit_log القائم.)
create or replace function public.content_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare _key text;
begin
  _key := coalesce(to_jsonb(coalesce(new, old))->>tg_argv[0], '?');
  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'content_' || tg_table_name || '_' || lower(tg_op), _key);
  return coalesce(new, old);
end $$;

create trigger audit_reference_items after insert or update or delete on reference_items
  for each row execute function public.content_audit('item_key');
create trigger audit_notification_templates after insert or update or delete on notification_templates
  for each row execute function public.content_audit('template_key');
create trigger audit_system_messages after insert or update or delete on system_messages
  for each row execute function public.content_audit('message_key');
create trigger audit_legal_texts after insert or update or delete on legal_texts
  for each row execute function public.content_audit('text_key');
create trigger audit_content_change_requests after insert or update on content_change_requests
  for each row execute function public.content_audit('target_key');
