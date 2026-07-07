-- المستخدم يقرأ أدواره الخاصّة (لحارس requireRole في الواجهة). آمن — نطاقه صفوفه فقط.
drop policy if exists user_roles_self_read on user_roles;
create policy user_roles_self_read on user_roles for select using (user_id = auth.uid());
