-- 20260808000005_entity_org_structure.sql — هيكل الجهات ووحداتها (المرحلة 2 من التسليم)
-- المرجع: design_handoff_admin_portal/schema_org_units.sql + org_units/org-units.js،
-- مُكيَّفاً بقرار «المعتمد ما في القاعدة»: #62 أرسى وحدات الاستقبال الرسمية في
-- branches نفسه (is_hq للمركزية + نيابات المناطق الـ13) ووحّد البيانات رجعياً —
-- فالأمين تطويرُ branches إلى نموذج الوحدات في مكانه، لا جدولٌ موازٍ (org_units)
-- يكرّره ويكسر كل الوصلات القائمة (RLS/الجسر/البوابات). القدرات واحدة:
-- هرمية (مقر ← منطقة ← فرع محافظة) + نمط لكل جهة + نقاط استقبال + إدارة أدمن.
-- فروع المحافظات: «بانتظار القائمة الرسمية» (#62) — تُضاف من بوابة الأدمن.

-- ══ 1) ترقية branches إلى نموذج الوحدات ══
alter table branches add column if not exists kind text
  check (kind in ('hq','region','branch'));
alter table branches add column if not exists parent_id uuid references branches(id) on delete restrict;
alter table branches add column if not exists city text;
alter table branches add column if not exists is_intake_point boolean not null default true;

comment on table branches is
  'وحدات الجهات المختصة (نموذج org_units من تسليم 7 أغسطس مطوَّراً في مكانه): '
  'hq مقرّ · region نيابة/وحدة منطقة · branch فرع محافظة (يُدار من بوابة الأدمن).';

-- تعبئة رجعية: الموسوم hq مقرّ، وغيره وحدة منطقة (واقع #62)
update branches set kind = case when is_hq then 'hq' else 'region' end where kind is null;
alter table branches alter column kind set not null;

-- نقاط الاستقبال بحسب النموذج: المركزية من مقرّها، والمناطقية من وحدات مناطقها
update branches b set is_intake_point = (
  case when b.is_hq then not exists (select 1 from branches r where r.entity = b.entity and not r.is_hq)
       else true end);

create index if not exists idx_branches_parent on branches (parent_id);
create index if not exists idx_branches_entity_kind on branches (entity, kind);

-- unique(entity, region) الموروث كان يعني «فرعاً واحداً لكل منطقة» — نموذج الوحدات
-- يبطله (فروع محافظات متعددة تحت المنطقة). يُستبدل بضمانات أدقّ:
--   مقرّ واحد لكل جهة · وحدة منطقة واحدة لكل (جهة، منطقة) · لا تكرار محافظة تحت الجهة
alter table branches drop constraint if exists branches_entity_region_key;
create unique index if not exists uq_branches_hq on branches (entity) where kind = 'hq';
create unique index if not exists uq_branches_region_unit on branches (entity, region) where kind = 'region';
create unique index if not exists uq_branches_city on branches (entity, city) where kind = 'branch';

-- ══ 2) نمط هيكل كل جهة (يُدار من بوابة الأدمن) ══
create table if not exists entity_structures (
  entity           competent_entity primary key,
  mode             text not null check (mode in ('central','regional')),
  approval_degrees int  not null default 1 check (approval_degrees between 1 and 3),
  note             text
);
comment on table entity_structures is
  'نمط هيكل كل جهة: central وحدة مقرّ واحدة · regional وحدات مناطق (وفروع محافظات لاحقاً). '
  'approval_degrees: درجات اعتماد التوصية داخل الجهة (البنية تدعم حتى 3، والمعمول به 1).';

insert into entity_structures (entity, mode, approval_degrees, note) values
  ('prosecution','regional',1,'نيابات مناطق (13) — فروع المحافظات تُضاف من بوابة الأدمن عند ورود القائمة الرسمية؛ الاعتماد بدرجة واحدة (رئيس الوحدة المباشر)'),
  ('state_security','central',1,'مركزية — المقرّ يستقبل ويعتمد'),
  ('moi','central',1,'مركزية — اللجنة الدائمة بالمقرّ'),
  ('nazaha','central',1,'مركزية — المقرّ يستقبل ويعتمد'),
  ('moj','central',1,'مركزية — المقرّ يستقبل ويعتمد')
on conflict (entity) do nothing;

alter table entity_structures enable row level security;
create policy estruct_read on entity_structures for select using (auth.role() = 'authenticated');
-- الكتابة عبر RPC الأدمن حصراً (لا سياسة كتابة مباشرة)

-- ══ 3) شجرة الوحدات — لإشراف وحدة المنطقة على فروعها حين تُضاف ══
create or replace function public.branch_subtree(_root uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive t as (
    select id from branches where id = _root
    union all
    select b.id from branches b join t on b.parent_id = t.id
  ) select id from t;
$$;
revoke execute on function public.branch_subtree(uuid) from public, anon;
grant execute on function public.branch_subtree(uuid) to authenticated;

-- إشراف هرمي: رئيس وحدة المنطقة يقرأ توصيات شجرته (فروع محافظاته) قراءةً —
-- الاعتماد يبقى بدرجة واحدة عند الوحدة المباشرة (entity_structures.approval_degrees=1)
create policy rec_subtree_read on recommendations for select using (
  has_role(auth.uid(), 'competent_body')
  and branch_id in (select branch_subtree(cb_branch()))
);

-- ══ 4) إدارة الوحدات من بوابة الأدمن (sysadmin — عبر RPC مؤثَّرة) ══
create or replace function public.admin_list_org()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare _out jsonb;
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  select jsonb_agg(jsonb_build_object(
    'entity', es.entity,
    'mode', es.mode,
    'approval_degrees', es.approval_degrees,
    'note', es.note,
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'kind', b.kind, 'region', b.region, 'city', b.city,
        'parent_id', b.parent_id, 'is_intake_point', b.is_intake_point, 'active', b.active,
        'recommendations', (select count(*) from recommendations r where r.branch_id = b.id))
        order by b.kind, b.region nulls first, b.name)
      from branches b where b.entity = es.entity), '[]'::jsonb))
    order by es.entity)
  into _out from entity_structures es;
  return coalesce(_out, '[]'::jsonb);
end $$;

-- إضافة فرع محافظة تحت وحدة منطقة (للجهات المناطقية — هذا باب القائمة الرسمية)
create or replace function public.admin_add_branch_unit(_parent uuid, _city text, _name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _p branches%rowtype; _id uuid; _mode text;
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  if _city is null or btrim(_city) = '' then raise exception 'اسم المحافظة/المدينة مطلوب'; end if;
  select * into _p from branches where id = _parent;
  if not found then raise exception 'الوحدة الأم غير موجودة'; end if;
  if _p.kind <> 'region' then raise exception 'فرع المحافظة يُضاف تحت وحدة منطقة حصراً'; end if;
  select mode into _mode from entity_structures where entity = _p.entity;
  if _mode <> 'regional' then raise exception 'الجهة مركزية — لا فروع لها'; end if;
  insert into branches (entity, region, name, is_hq, active, kind, parent_id, city, is_intake_point)
  values (_p.entity, _p.region,
          coalesce(nullif(btrim(_name), ''), 'نيابة ' || btrim(_city)),
          false, true, 'branch', _parent, btrim(_city), true)
  returning id into _id;
  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'org_unit_add', _p.entity::text || '/' || btrim(_city));
  return _id;
end $$;

-- تعديل وحدة: الاسم/نقطة الاستقبال/الإيقاف (لا حذف — سلامة الإشارات التاريخية)
create or replace function public.admin_update_unit(
  _id uuid, _name text default null, _intake boolean default null, _active boolean default null)
returns void
language plpgsql security definer set search_path = public as $$
declare _b branches%rowtype;
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  select * into _b from branches where id = _id;
  if not found then raise exception 'الوحدة غير موجودة'; end if;
  if _active is false and _b.kind = 'hq' then
    raise exception 'مقرّ الجهة لا يُوقف';
  end if;
  update branches set
    name = coalesce(nullif(btrim(coalesce(_name, '')), ''), name),
    is_intake_point = coalesce(_intake, is_intake_point),
    active = coalesce(_active, active)
  where id = _id;
  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'org_unit_update', _b.entity::text || '/' || _b.name);
end $$;

revoke execute on function public.admin_list_org() from public, anon;
revoke execute on function public.admin_add_branch_unit(uuid, text, text) from public, anon;
revoke execute on function public.admin_update_unit(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.admin_list_org() to authenticated;
grant execute on function public.admin_add_branch_unit(uuid, text, text) to authenticated;
grant execute on function public.admin_update_unit(uuid, text, boolean, boolean) to authenticated;
