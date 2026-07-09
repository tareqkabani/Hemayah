-- ============================================================
--  بذرُ نموذج الفروع للجهات المختصة (كان غير مُهيّأ): فرع نيابة الرياض،
--  وربط مستخدم البوّابة به (level/branch)، وإسناد التوصيات القائمة إليه —
--  كي تعمل سياسة rec_branch_rw المُوجّهة بالفرع (لا توسيع للصلاحية).
-- ============================================================
do $$
declare _b uuid; _u uuid;
begin
  select id into _b from branches where entity='prosecution' and region='RUH' limit 1;
  if _b is null then
    insert into branches (id, entity, region, name, is_hq, active)
      values (gen_random_uuid(), 'prosecution', 'RUH', 'النيابة العامة — نيابة الرياض', false, true)
      returning id into _b;
  end if;
  select id into _u from auth.users where email='3000000001@nafath.local';
  update user_roles set attributes = coalesce(attributes,'{}'::jsonb)
      || jsonb_build_object('level','head','branch_id',_b::text,'entity','prosecution')
    where role='competent_body' and user_id=_u;
  update recommendations set branch_id=_b where branch_id is null and source_body like 'النيابة%';
end $$;
