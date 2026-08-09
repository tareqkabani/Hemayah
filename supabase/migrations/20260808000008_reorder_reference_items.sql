-- 20260808000008_reorder_reference_items.sql — إعادة ترتيب بنود قائمة مرجعية ذرّياً
-- بوابة الأدمن كانت تعيد الترتيب بحلقةٍ من UPDATEها صفّاً صفّاً في الخادم —
-- غير ذرّية: فشلٌ في الأثناء يترك القائمة نصف مرتّبة. تُستبدل بدالة واحدة
-- تحدّث كل الصفوف في عبارةٍ واحدة، محروسةٍ بنفس ضمانات RLS (sysadmin + غير مقفلة).

create or replace function public.admin_reorder_items(_list_key text, _keys text[])
returns void
language plpgsql security definer set search_path = public as $$
declare _locked boolean; _n int;
begin
  if not has_role(auth.uid(), 'sysadmin') then raise exception 'sysadmin only'; end if;
  select locked into _locked from reference_lists where list_key = _list_key;
  if _locked is null then raise exception 'قائمة غير معروفة: %', _list_key; end if;
  if _locked then raise exception 'القائمة مقفلة — الترتيب يمرّ بطلب اعتماد.'; end if;

  update reference_items ri
     set sort_order = k.ord
    from (select key, ord from unnest(_keys) with ordinality as t(key, ord)) k
   where ri.list_key = _list_key and ri.item_key = k.key;

  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'لم يُعَد ترتيب أي بند — تحقّق من المفاتيح.'; end if;

  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'content_reference_items_reorder', _list_key);
end $$;

revoke execute on function public.admin_reorder_items(text, text[]) from public, anon;
grant execute on function public.admin_reorder_items(text, text[]) to authenticated;
