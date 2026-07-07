-- ============================================================
--  (و) مراسلات التنسيق بين جهات الإشراف: النائب العام (ag) ↔ المكتب الفني (technical) ↔ المركز (center).
--  قناةٌ مباشرة بين سلطتين (ليست مربوطةً بقضيّة — لأن طلبات الأجنبي case_id=null).
--  RLS: تقرأ/تكتب من كنتَ طرفاً فيها (has_coord). Realtime للمزامنة الحيّة.
-- ============================================================

create table if not exists public.coord_messages (
  id uuid primary key default gen_random_uuid(),
  from_authority text not null,
  to_authority text not null,
  sender_label text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.coord_messages enable row level security;

-- هل المستخدم الحاليّ يمثّل سلطة التنسيق المذكورة؟ (SECURITY DEFINER — يتجاوز RLS)
create or replace function public.has_coord(_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select case _key
    when 'ag' then has_authority('ag')
    when 'technical' then has_authority('technical')
    when 'center' then exists (
      select 1 from user_roles ur where ur.user_id = auth.uid()
        and ur.role in ('case_officer','board_chair','deputy_chair','board_member','studier','evaluator','hotline_operator'))
    else false end;
$$;

drop policy if exists coord_read on public.coord_messages;
create policy coord_read on public.coord_messages for select
  using (has_coord(from_authority) or has_coord(to_authority));
drop policy if exists coord_write on public.coord_messages;
create policy coord_write on public.coord_messages for insert
  with check (has_coord(from_authority) and from_authority <> to_authority);

do $$ begin
  if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='coord_messages') then
    alter publication supabase_realtime add table coord_messages;
  end if;
end $$;
alter table public.coord_messages replica identity full;
