-- ============================================================
--  بوابة وزارة الداخلية — اللجنة الدائمة للطلبات الأجنبية (المسار الأجنبي · م6)
--  تسجيل الطلب الأجنبي وإحالته للمركز، وتبليغ السلطة الأجنبية بقرار النائب.
-- ============================================================

-- إثراء الجدول بالحقول التشغيليّة (الأصل: id/case_id/country/reciprocity/pg_decision).
alter table public.foreign_requests add column if not exists ref text;
alter table public.foreign_requests add column if not exists secret text;
alter table public.foreign_requests add column if not exists authority text;
alter table public.foreign_requests add column if not exists auth_kind text;
alter table public.foreign_requests add column if not exists category text;
alter table public.foreign_requests add column if not exists city text;
alter table public.foreign_requests add column if not exists foreign_ref text;
alter table public.foreign_requests add column if not exists basis text;
alter table public.foreign_requests add column if not exists summary text;
alter table public.foreign_requests add column if not exists status text default 'inbox';
alter table public.foreign_requests add column if not exists updated_at timestamptz default now();

alter table public.foreign_requests enable row level security;
drop policy if exists foreign_moi_rw on public.foreign_requests;
create policy foreign_moi_rw on public.foreign_requests for select using (has_authority('moi'));

-- ── تسجيل الطلب الأجنبي وإحالته للمركز (م6) ──
create or replace function public.register_foreign(_id uuid, _basis text)
returns foreign_requests
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row foreign_requests;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_authority('moi') then raise exception 'forbidden: not moi committee'; end if;
  update foreign_requests set status='sent', basis=coalesce(_basis,basis), reciprocity=true, updated_at=now()
   where id=_id and status in ('inbox','draft')
   returning * into _row;
  if _row.id is null then raise exception 'foreign request not found or not registrable'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'foreign_register', coalesce(_row.ref,_id::text));
  return _row;
end $$;
grant execute on function public.register_foreign(uuid, text) to authenticated;

-- ── تبليغ السلطة الأجنبية بقرار النائب (موافقة/اعتذار) ──
create or replace function public.notify_foreign(_id uuid, _decision text)
returns foreign_requests
language plpgsql security definer set search_path = public, extensions as $$
declare _uid uuid := auth.uid(); _row foreign_requests;
begin
  if _uid is null then raise exception 'unauthenticated'; end if;
  if not has_authority('moi') then raise exception 'forbidden: not moi committee'; end if;
  update foreign_requests set status='notified', pg_decision=_decision, updated_at=now()
   where id=_id returning * into _row;
  if _row.id is null then raise exception 'foreign request not found'; end if;
  insert into audit_log (actor_id, action, target) values (_uid, 'foreign_notify_'||coalesce(_decision,'-'), coalesce(_row.ref,_id::text));
  return _row;
end $$;
grant execute on function public.notify_foreign(uuid, text) to authenticated;

-- ── بذور الطلبات الأجنبية (تُحاكي ورودها من السلطات الأجنبية) ──
insert into foreign_requests (ref, secret, country, authority, auth_kind, category, city, foreign_ref, basis, summary, status, reciprocity)
values
 ('MOI-2026-0042','F-2026-0042','الأردن','النيابة العامة — عمّان','سلطة قضائية','witness','الرياض','JOR/MLA/2026/188','اتفاقية ثنائية','طلب حماية لشاهد في قضية غسل أموال عابرة للحدود يقيم بالمملكة بعد تهديدات موثّقة.','inbox',null),
 ('MOI-2026-0039','F-2026-0039','الإمارات','النيابة الاتحادية','سلطة قضائية','expert','جدة','UAE/2026/77','اتفاقية الرياض العربية','خبير فنّي في قضية احتيال ماليّ، طُلب إدراجه ضمن الحماية أثناء وجوده بالمملكة.','draft',null),
 ('MOI-2026-0035','F-2026-0035','مصر','النيابة العامة','سلطة قضائية','reporter','الدمام','EG/2026/305','مبدأ المعاملة بالمثل','مبلّغ عن فساد في عقود حكومية انتقل للمملكة ويُطلب شموله بالحماية.','sent',true),
 ('MOI-2026-0031','F-2026-0031','فرنسا','وزارة العدل — باريس','سلطة تنفيذية','victim','الرياض','FR/2026/A-91','اتفاقية الأمم المتحدة لمكافحة الفساد','ضحية اتجار بالبشر في قضية دولية يقيم بالمملكة، تُطلب الحماية الأمنية له.','studying',true),
 ('MOI-2026-0024','F-2026-0024','المغرب','رئاسة النيابة العامة','سلطة قضائية','witness','الرياض','MA/2026/52','اتفاقية ثنائية','شاهد في قضية مخدّرات عابرة للحدود — وافق النائب على توفير الحماية بالمعاملة بالمثل.','approved',true),
 ('MOI-2026-0019','F-2026-0019','الأردن','النيابة العامة — إربد','سلطة قضائية','expert','مكة','JOR/MLA/2026/140','مبدأ المعاملة بالمثل','لم تتوافر شروط المعاملة بالمثل ولم يكتمل سند الطلب — صدر اعتذار مسبّب.','declined',true)
on conflict do nothing;

update foreign_requests set pg_decision='approved' where ref='MOI-2026-0024';
update foreign_requests set pg_decision='declined' where ref='MOI-2026-0019';
