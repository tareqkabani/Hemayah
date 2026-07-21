-- ============================================================
--  حالات اختبار حلقتي الاعتماد (النائب ثم الرئيس) قبل الطرح — ضد Supabase الفعلي
--  التشغيل:  docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--            -v ON_ERROR_STOP=1 -f - < supabase/tests/decision-approval-ring-tests.sql
--  قاعدة صاحب المنصة (22 يوليو): المعدّ يعرض على النائب والرئيس كليهما
--  قبل الطرح للتصويت، والتصويت بسبعة مقاعد تشملهما.
--  الأسلوب: معاملة تُدحرج — قضية اختبار تُنشأ داخلها.
-- ============================================================
\set QUIET on
begin;

create temp table t_ids as
select
  (select id from auth.users where email = '2000000005@nafath.local') as preparer,
  (select id from auth.users where email = '2000000009@nafath.local') as deputy,
  (select id from auth.users where email = '2000000008@nafath.local') as chair,
  (select id from auth.users where email = '2000000006@nafath.local') as member;

insert into protection_cases (ref_no, secret_code, category, status, source)
values ('REF-RING-9921','C-RING-9921','witness','in_decision','local');
insert into council_decisions (case_id, status, preparer_id)
select id, 'preparing', (select preparer from t_ids) from protection_cases where secret_code='C-RING-9921';

create temp table t_case as
select (select id from protection_cases where secret_code='C-RING-9921') as cid;

create or replace function pg_temp.impersonate(_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end $$;

-- ─── 1) المعدّ يرفع → حلقة النائب ───
do $$
declare i record; c record; _st text;
begin
  select * into i from t_ids; select * into c from t_case;
  perform pg_temp.impersonate(i.preparer);
  execute 'set local role authenticated';
  select status into _st from council_submit(c.cid, '["الحماية الأمنية"]'::jsonb, '30 يوماً', 'حيثيات الاختبار.');
  execute 'reset role';
  if _st <> 'pending_deputy' then raise exception 'اختبار 1 فشل (%)', _st; end if;
  raise notice 'اختبار 1 ✓ الرفع يذهب لحلقة النائب أولاً';
end $$;

-- ─── 2) لا طرح ولا اعتماد رئيس قبل دور كلٍّ منهما ───
do $$
declare i record; c record; _ok boolean := false;
begin
  select * into i from t_ids; select * into c from t_case;

  -- المعدّ لا يطرح والقرار في حلقة النائب
  perform pg_temp.impersonate(i.preparer);
  execute 'set local role authenticated';
  begin
    perform council_open_voting(c.cid);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%اعتماد النائب والرئيس%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 2أ فشل: طرحٌ قبل الحلقتين'; end if;

  -- الرئيس لا يعتمد والقرار في حلقة النائب
  _ok := false;
  perform pg_temp.impersonate(i.chair);
  execute 'set local role authenticated';
  begin
    perform council_approve_chair(c.cid);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%بانتظار اعتماد الرئيس%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 2ب فشل: الرئيس اعتمد قبل دوره'; end if;
  raise notice 'اختبار 2 ✓ الترتيب محروس: لا قفز فوق حلقة';
end $$;

-- ─── 3) اعتماد النائب → حلقة الرئيس (لا الطرح مباشرة) ───
do $$
declare i record; c record; _st text; _ok boolean := false;
begin
  select * into i from t_ids; select * into c from t_case;

  -- العضو العادي لا يملك الاعتماد
  perform pg_temp.impersonate(i.member);
  execute 'set local role authenticated';
  begin
    perform council_approve(c.cid);
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%نائب رئيس المركز حصراً%' then _ok := true; else raise; end if;
  end;
  execute 'reset role';
  if not _ok then raise exception 'اختبار 3أ فشل: غير النائب اعتمد'; end if;

  perform pg_temp.impersonate(i.deputy);
  execute 'set local role authenticated';
  select status into _st from council_approve(c.cid);
  execute 'reset role';
  if _st <> 'pending_chair' then raise exception 'اختبار 3ب فشل: اعتماد النائب لم يمرّ للرئيس (%)', _st; end if;

  if not exists (select 1 from council_decisions cd join t_case t on t.cid=cd.case_id
                 where cd.deputy_approved_at is not null and cd.chair_approved_at is null) then
    raise exception 'اختبار 3ج فشل: أختام الحلقة الأولى';
  end if;
  raise notice 'اختبار 3 ✓ اعتماد النائب يمرّر لحلقة الرئيس بختمه الزمني';
end $$;

-- ─── 4) اعتماد الرئيس → approved، وعندها فقط يُطرح ثم يصوّت الجميع ───
do $$
declare i record; c record; _st text;
begin
  select * into i from t_ids; select * into c from t_case;

  perform pg_temp.impersonate(i.chair);
  execute 'set local role authenticated';
  select status into _st from council_approve_chair(c.cid);
  execute 'reset role';
  if _st <> 'approved' then raise exception 'اختبار 4أ فشل (%)', _st; end if;

  perform pg_temp.impersonate(i.preparer);
  execute 'set local role authenticated';
  select status into _st from council_open_voting(c.cid);
  execute 'reset role';
  if _st <> 'voting' then raise exception 'اختبار 4ب فشل: الطرح بعد الحلقتين (%)', _st; end if;

  -- النائب والرئيس يصوّتان كالأعضاء (قاعدة السبعة مقاعد)
  perform pg_temp.impersonate(i.member);
  execute 'set local role authenticated';
  perform council_vote(c.cid, 'accept', null);
  execute 'reset role';
  perform pg_temp.impersonate(i.deputy);
  execute 'set local role authenticated';
  perform council_vote(c.cid, 'accept', null);
  execute 'reset role';
  perform pg_temp.impersonate(i.chair);
  execute 'set local role authenticated';
  perform council_vote(c.cid, 'accept', null);
  execute 'reset role';

  if (select count(distinct voter_id) from council_votes cv join t_case t on t.cid = cv.case_id) < 3 then
    raise exception 'اختبار 4ج فشل: أصوات القيادة لم تُسجَّل';
  end if;
  raise notice 'اختبار 4 ✓ الطرح بعد الحلقتين، والنائب والرئيس يصوّتان مع الأعضاء';
end $$;

-- ─── 5) الإعادة: الرئيس من حلقته بملاحظة إلزامية، وتصفير الختمين ───
do $$
declare i record; _cid2 uuid; _st text; _ok boolean := false;
begin
  select * into i from t_ids;
  insert into protection_cases (ref_no, secret_code, category, status, source)
  values ('REF-RING-9922','C-RING-9922','victim','in_decision','local') returning id into _cid2;
  insert into council_decisions (case_id, status, preparer_id) values (_cid2, 'preparing', i.preparer);

  perform pg_temp.impersonate(i.preparer);
  execute 'set local role authenticated';
  perform council_submit(_cid2, '["الحماية الأمنية"]'::jsonb, '30 يوماً', 'حيثيات.');
  execute 'reset role';
  perform pg_temp.impersonate(i.deputy);
  execute 'set local role authenticated';
  perform council_approve(_cid2);
  execute 'reset role';

  -- ملاحظة فارغة مرفوضة
  perform pg_temp.impersonate(i.chair);
  execute 'set local role authenticated';
  begin
    perform council_return(_cid2, '  ');
    raise exception 'FORCE';
  exception when others then
    if sqlerrm like '%إلزامية%' then _ok := true; else raise; end if;
  end;
  perform council_return(_cid2, 'تُستكمل حيثيات المدة قبل الطرح.');
  execute 'reset role';
  if not _ok then raise exception 'اختبار 5أ فشل: قبل ملاحظة فارغة'; end if;

  select cd.status into _st from council_decisions cd where cd.case_id = _cid2;
  if _st <> 'preparing' then raise exception 'اختبار 5ب فشل (%)', _st; end if;
  if exists (select 1 from council_decisions where case_id = _cid2
             and (deputy_approved_at is not null or chair_approved_at is not null)) then
    raise exception 'اختبار 5ج فشل: الختمان لم يُصفَّرا';
  end if;
  raise notice 'اختبار 5 ✓ إعادة الرئيس من حلقته بملاحظة إلزامية وتصفير الختمين';
end $$;

-- ─── 6) فتح المرفقات من قرّاء الحزمة (المعدّ/الأعضاء/القيادة) = تدقيق م15/16 ───
do $$
declare i record; c record; _n int; _b int; _ok boolean := false; _subject uuid;
begin
  select * into i from t_ids; select * into c from t_case;

  select count(*) into _b from audit_log where action='attachment_open';
  perform pg_temp.impersonate(i.preparer);
  execute 'set local role authenticated';
  perform record_attachment_open(c.cid, 'تقرير تقييم المخاطر');
  execute 'reset role';
  perform pg_temp.impersonate(i.member);
  execute 'set local role authenticated';
  perform record_attachment_open(c.cid, 'طلب الحماية المسبّب');
  execute 'reset role';
  perform pg_temp.impersonate(i.chair);
  execute 'set local role authenticated';
  perform record_attachment_open(c.cid, 'بيانات القضية والإجراءات النظامية');
  execute 'reset role';
  select count(*) into _n from audit_log where action='attachment_open';
  if _n - _b <> 3 then raise exception 'اختبار 6أ فشل: تدقيق قرّاء الحزمة (delta=%)', _n - _b; end if;

  -- غير المخوَّل (طالب الحماية) يبقى مرفوضاً
  select id into _subject from auth.users where email='1000000001@nafath.local';
  if _subject is not null then
    perform pg_temp.impersonate(_subject);
    execute 'set local role authenticated';
    begin
      perform record_attachment_open(c.cid, 'أي مستند');
      raise exception 'FORCE';
    exception when others then
      if sqlerrm like '%not assigned%' then _ok := true; else raise; end if;
    end;
    execute 'reset role';
    if not _ok then raise exception 'اختبار 6ب فشل: غير المخوَّل فتح مرفقاً'; end if;
  end if;
  raise notice 'اختبار 6 ✓ فتح المرفقات مسجَّل للمعدّ والعضو والرئيس، ومرفوض لغير المخوَّل';
end $$;

rollback;
\echo '✓✓ اختبارات حلقتي الاعتماد اجتازت كاملة — أُرجعت المعاملة، لا أثر في القاعدة'
