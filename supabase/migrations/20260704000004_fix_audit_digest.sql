-- ============================================================
--  إصلاح: دالة سلسلة التدقيق تستدعي digest (pgcrypto) الموجودة في schema
--  «extensions» على Supabase. نضبط search_path لتشملها.
-- ============================================================
create or replace function audit_chain() returns trigger
language plpgsql set search_path = public, extensions as $$
declare prev text;
begin
  select hash into prev from audit_log order by id desc limit 1;
  new.prev_hash := coalesce(prev,'GENESIS');
  new.hash := encode(digest(new.prev_hash || coalesce(new.actor_id::text,'') ||
              new.action || coalesce(new.target,'') || new.created_at::text,'sha256'),'hex');
  return new;
end; $$;
