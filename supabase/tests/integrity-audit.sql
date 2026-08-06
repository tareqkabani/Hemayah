-- ============================================================
-- فحص سلامة النظام — قابلٌ لإعادة التشغيل في أيّ وقت وعلى أيّ بيئة.
--
--   docker exec -i supabase_db_Hemayah psql -U postgres -d postgres \
--     -q < supabase/tests/integrity-audit.sql
--
-- انبثق من تدقيق الحمل (2026-07-27). قاعدتان تعلّمناهما بالتجربة وبُنيت
-- عليهما كل الفحوص هنا:
--
--   1) NULL ليس شذوذاً: «case_id IS NULL» في الإشعارات النظامية مشروع،
--      و not exists(... where pc.id = n.case_id) يعدّه يتيماً زوراً.
--      كل فحصٍ هنا يستثني NULL صراحةً.
--   2) تجهيزات العرض ليست فساداً: هجرات المشروع تزرع قضايا جاهزة
--      (بلا سجلّ طلب أو بلا أصوات) لتغذية عروض البوابات. تُستثنى
--      بمراجعها كي لا تُغرق التقرير بإنذاراتٍ كاذبة تُخفي الحقيقيّ.
-- ============================================================

\pset footer off
\pset title 'فحص سلامة منصّة حماية'

-- مراجع تجهيزات العرض المزروعة بالهجرات (ليست بيانات تشغيل)
drop table if exists _fixtures;
create temp table _fixtures(ref text);
insert into _fixtures(ref) values
  ('REF-2026-8101'),('REF-2026-8102'),('REF-2026-8103'),('REF-2026-8104'),('REF-2026-8105'),  -- referrals_wiring
  ('REF-2026-4790'),('REF-2026-4820'),('REF-2026-4905'),                                       -- decision_approval_cycle
  ('REF-2026-9493'),('REF-2026-9495'),                                                         -- عروض إضافية
  ('REF-2026-0481');  -- seed.sql: قضية عرضٍ نُقلت للقرار دون المرور بمسار الدراسة،
                      -- فبقيت مهامّها معلّقةً بلا إلغاء (لا يقع هذا في المسار الحيّ:
                      -- المُشغِّل _auto_send_to_decision يُلغيها عند التقدّم).

drop view if exists _live;
create temp view _live as
  select * from protection_cases where ref_no not in (select ref from _fixtures);

\echo ''
\echo '━━━ 1) التكامل المرجعيّ والسلامة البنيوية ━━━'
select
  case when n = 0 then '✅ ' else '🚨 ' end || label || ' — ' || n as "الفحص"
from (
  select 'قضايا حيّة بلا سجلّ طلب' label,
         (select count(*) from _live c where not exists (select 1 from protection_requests r where r.case_id = c.id)) n
  union all select 'مراجع مكرّرة',
         (select count(*) from (select ref_no from protection_cases group by 1 having count(*) > 1) x)
  union all select 'رموز سرّية مكرّرة',
         (select count(*) from (select secret_code from protection_cases group by 1 having count(*) > 1) x)
  union all select 'إشعارات يتيمة فعلاً (تستثني case_id NULL المشروع)',
         (select count(*) from notifications n
           where n.case_id is not null
             and not exists (select 1 from protection_cases c where c.id = n.case_id))
  union all select 'جداول case_id بلا مفتاح أجنبي',
         (select count(*) from pg_class c
            join pg_attribute a on a.attrelid = c.oid and a.attname = 'case_id' and a.attnum > 0
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
             and not exists (select 1 from pg_constraint con
                              where con.conrelid = c.oid and con.contype = 'f'
                                and a.attnum = any(con.conkey)))
  union all select 'توصيات بلا فرع (تُحجب بـRLS عن جهتها)',
         (select count(*) from recommendations where branch_id is null)
  union all select 'جهات مركزية بغير وحدةٍ واحدة is_hq (درِفت النموذج التنظيمي)',
         (select count(*)
            from (values ('state_security'),('moi'),('nazaha'),('moj')) e(code)
           where (select count(*) from branches b
                   where b.entity = e.code::competent_entity and coalesce(b.active, true)) <> 1
              or not exists (select 1 from branches b
                              where b.entity = e.code::competent_entity
                                and b.is_hq and coalesce(b.active, true)))
  union all select 'حسابات جهة (clerk/head) بلا branch_id — لا يرون شيئاً',
         (select count(*) from user_roles
           where role = 'competent_body'
             and attributes->>'level' in ('clerk','head')
             and coalesce(attributes->>'branch_id','') = '')
) q order by n desc, label;

\echo ''
\echo '━━━ 2) آلة الحالة — اتّساق الحالات الحيّة ━━━'
select
  case when n = 0 then '✅ ' else '🚨 ' end || label || ' — ' || n as "الفحص"
from (
  select 'قضايا active بلا سندٍ (قرار قبول أو تظلّم مقبول)' label,
         (select count(*) from _live c where c.status = 'active'
            and not exists (select 1 from council_decisions d where d.case_id = c.id and d.issued_type = 'accept')
            and not exists (select 1 from grievances g where g.case_id = c.id and g.status = 'upheld')) n
  union all select 'قضايا rejected بلا سببٍ موثّق',
         (select count(*) from _live c where c.status = 'rejected'
            and not exists (select 1 from council_decisions d where d.case_id = c.id and d.issued_reason is not null))
  union all select 'قضايا محالة بلا توصيةٍ مُنشأة',
         (select count(*) from _live c where c.status = 'referred'
            and not exists (select 1 from recommendations r where r.case_id = c.id))
  union all select 'قرارات صادرة بلا أصوات',
         (select count(*) from council_decisions d join _live c on c.id = d.case_id
           where d.issued_at is not null
             and not exists (select 1 from council_votes v where v.case_id = d.case_id))
  union all select 'مهامّ دراسة معلّقة على قضايا غادرت الدراسة',
         (select count(*) from studies s join _live c on c.id = s.case_id
           where s.submitted_at is null and s.superseded_at is null and c.status <> 'under_study')
  union all select 'مهامّ تقييم معلّقة على قضايا غادرت الدراسة',
         (select count(*) from assessments a join _live c on c.id = a.case_id
           where a.submitted_at is null and a.superseded_at is null and c.status <> 'under_study')
) q order by n desc, label;

\echo ''
\echo '━━━ 3) الأمن — RLS والصلاحيات ━━━'
select
  case when n = 0 then '✅ ' else '🚨 ' end || label || ' — ' || n as "الفحص"
from (
  select 'جداول عامّة بلا RLS' label,
         (select count(*) from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
             and not c.relrowsecurity) n
  union all select 'دوال SECURITY DEFINER بلا search_path مثبّت',
         (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
                              where cfg like 'search_path=%'))
  union all select 'دوال حسّاسة ينفّذها anon',
         (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('claim_paper_cases','submit_paper_intake','triage_decide',
                               'submit_study','submit_assessment','record_recommendation')
             and has_function_privilege('anon', p.oid, 'EXECUTE'))
) q order by n desc, label;

\echo ''
\echo '━━━ 4) توزيع الحالات (للاطّلاع لا للحكم) ━━━'
select status::text as "الحالة", count(*) as "حيّة",
       (select count(*) from protection_cases f
         where f.status = c.status and f.ref_no in (select ref from _fixtures)) as "تجهيزات"
from _live c group by c.status order by 2 desc;

\echo ''
\echo '━━━ 5) عبء الفريق المفتوح ━━━'
select 'دارس' as "الدور", u.email as "العضو",
       count(*) filter (where s.submitted_at is null and s.superseded_at is null) as "مهامّ مفتوحة"
  from studies s join auth.users u on u.id = s.studier_id group by 1,2
union all
select 'مقيّم', u.email,
       count(*) filter (where a.submitted_at is null and a.superseded_at is null)
  from assessments a join auth.users u on u.id = a.evaluator_id group by 1,2
order by 1, 3 desc;
