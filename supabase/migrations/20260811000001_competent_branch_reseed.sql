-- ============================================================
-- إحياء ربط الجهة المختصّة بالفروع — نظير 20260706000009 الذي صار بلا أثر:
--
-- عند `supabase db reset` تسبق المهاجراتُ البذورَ، فمهاجرة الربط القديمة
-- تعمل قبل أن يوجد مستخدم 3000000001@nafath.local أو توصياتُ البذور أصلاً —
-- ثم يُنشئ seed.sql المستخدمَ بسمات {"authority":"competent"} فقط، فتُرجع
-- cb_branch()‏ NULL وتحجب rec_branch_rw كلَّ توصية عن بوابة الجهات المختصة.
-- كذلك بقيت توصيات البذور يتيمةَ branch_id لأن السدّ الرجعي في
-- 20260727000004 يربط ما طابق اسمَ فرعٍ بلا لبس فقط، وبادئة «النيابة العامة»
-- تطابق النيابات الثلاث عشرة كلَّها فتُستبعد.
--
-- البذور نفسها عولجت (seed.sql §1-ب و§5) فتغطي كل `db reset` قادم؛ وهذه
-- المهاجرة تسدّ رجعياً القواعدَ القائمة التي لن يُعاد بذرها (المحلية
-- والتجريبية). الإسناد حتميٌّ من نصوص البذور نفسها — لا تخمين مناطق —
-- وidempotent وبلا أثر على قاعدةٍ لا تحمل هذه البذور.
-- ============================================================

do $$
declare _ruh uuid; _med uuid; _asr uuid; _nzh uuid; _u uuid;
begin
  select id into _ruh from branches where entity = 'prosecution' and region = 'RUH' and kind = 'region' limit 1;
  select id into _med from branches where entity = 'prosecution' and region = 'MED' and kind = 'region' limit 1;
  select id into _asr from branches where entity = 'prosecution' and region = 'ASR' and kind = 'region' limit 1;
  select id into _nzh from branches where entity = 'nazaha' and is_hq limit 1;

  -- (١) سمتا الفرع والمستوى لمستخدم بوابة الجهة (rec_branch_rw تشترطهما)
  select id into _u from auth.users where email = '3000000001@nafath.local';
  if _ruh is not null and _u is not null then
    update user_roles
       set attributes = coalesce(attributes, '{}'::jsonb)
        || jsonb_build_object('level', 'head', 'branch_id', _ruh::text, 'entity', 'prosecution')
     where role = 'competent_body' and user_id = _u;
  end if;

  -- (٢) التوصيات اليتيمة من البذور: الأسماء المنسوبة لمنطقةٍ إلى نيابتها،
  --     والنزاهة (مركزية) إلى مركزها الرئيسي
  update recommendations set branch_id = _ruh
   where branch_id is null and _ruh is not null
     and source_body in ('النيابة العامة بمنطقة الرياض', 'النيابة العامة بالرياض');
  update recommendations set branch_id = _med
   where branch_id is null and _med is not null
     and source_body = 'النيابة العامة بالمدينة المنورة';
  update recommendations set branch_id = _asr
   where branch_id is null and _asr is not null
     and source_body = 'النيابة العامة بعسير';
  update recommendations set branch_id = _nzh
   where branch_id is null and _nzh is not null
     and source_body like 'هيئة الرقابة ومكافحة الفساد%';

  -- «النيابة العامة» المطلقة في رحلات التظلّم المبذورة (seed §4) إلى نيابة
  -- الرياض — فرع العرض الافتراضي — حصراً بمراجعها (لا تعميم على بيانات حيّة)
  update recommendations r set branch_id = _ruh
    from protection_cases pc
   where pc.id = r.case_id and r.branch_id is null and _ruh is not null
     and r.source_body = 'النيابة العامة'
     and pc.ref_no in ('REF-2026-4820', 'REF-2026-4790');

  -- (٣) ظلّ الفرع على القضية: case_branch_read موجَّهة بالفرع أيضاً، وبدونها
  --     يعود تضمين protection_cases فارغاً فتظهر البطاقة بلا رمز ولا مرجع.
  --     (توصية كل قضية واحدة — لا لبس في المصدر.)
  update protection_cases pc set branch_id = r.branch_id
    from recommendations r
   where r.case_id = pc.id and pc.branch_id is null and r.branch_id is not null;
end $$;
