# دليل الترحيل المعزول — قاعدة بلا شبكة

قاعدة التجريبية على خوادم محلّية **معزولة عن الإنترنت**، فلا يُنفَّذ الترحيل عن بُعد.
هذا الدليل يُخرج ملفاً واحداً يُحمل إليها ويُنفَّذ بـ`psql` وحده — بلا مستودع ولا شبكة.

## ١) على جهازٍ متّصل — توليد الحزمة

```bash
git pull                                     # آخر main
./deploy/check-staging-list.sh               # يجب أن يمرّ قبل التوليد
./deploy/staging/make-offline-bundle.sh
```

يُخرج `deploy/staging/offline-bundle.sql` — احمله على وسيطٍ مُصرَّح به.

> الحدّ الافتراضي هو حالة التجريبية الموثَّقة `20260727000008`.
> **تحقّق من الحالة الفعلية أوّلاً** (الخطوة ٢)، فإن كانت أحدث فوّلد بـ
> `FROM_VERSION=<آخر نسخة مُطبَّقة> ./deploy/staging/make-offline-bundle.sh`.

## ٢) على الخادم المعزول — قبل التنفيذ

```bash
# أ) حالة القاعدة الفعلية
docker exec <db> psql -U postgres -d postgres -tAc \
  "select max(version) from supabase_migrations.schema_migrations;"

# ب) نسخةٌ احتياطية — إلزامية، فلا تراجع بلا نسخة
docker exec <db> pg_dump -U postgres -d postgres -Fc > backup-$(date +%F-%H%M).dump
```

## ٣) التنفيذ

```bash
docker exec -i <db> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - \
  < offline-bundle.sql | tee migrate-$(date +%F-%H%M).log
```

كل مهاجرةٍ في **معاملةٍ مستقلّة**: ما نجح ثبت وسُجّل. والتوقّف عند أوّل خطأ
يترك ما قبله مُطبَّقاً — فأصلح السبب ثمّ أعد التنفيذ، والمُطبَّق يُتخطّى بأمان.

## ٤) بعد التنفيذ

```bash
# النسخ المسجَّلة
docker exec <db> psql -U postgres -d postgres -tAc \
  "select version from supabase_migrations.schema_migrations order by version desc limit 12;"

# فحوصٌ جوهرية
docker exec <db> psql -U postgres -d postgres -tAc "
  select 'بنود الحماية='||count(*) from reference_items where list_key='protection_types' and active;
  select 'مفتاح Vault='||count(*) from vault.secrets where name='emergency_contact_key';
  select 'العطل='||count(*) from holidays;
  select 'دلو المرفقات='||count(*) from storage.buckets where id='intake-docs';
  select 'business_days_between='||provolatile::text from pg_proc where proname='business_days_between';"
```

المتوقَّع: `18` · `1` · `6` · `1` · `s`.

ثمّ **إعادة نشر** الواجهة والـAPI (Portainer ← Pull and redeploy) — الشيفرة
والمهاجرات يجب أن تتحرّكا معاً، وإلا نادت واجهةٌ دوالَّ غير موجودة.

## ⚠️ يُعلَن للقيادة قبل النشر

تقويم العطل (`20260813000005`) **يُطيل المُهل**: أيام العيدين واليوم الوطني ويوم
التأسيس لم تكن محسوبةً عطلاً. فقضايا موسومةٌ اليوم **«متجاوزة المهلة»** قد تعود
**«ضمن المهلة»**، وتتغيّر أرقام تقارير الالتزام. هذا هو الصواب — لكنّه تغيّرٌ
ظاهر يُعلَن لا يُمرَّر بصمت.

وبعد النشر: أدخِل **تعميم عطل الجهات الحكومية** من بوابة الأدمن ← «تقويم العطل».
المبذور ستة أيامٍ **مفردة** لا مُدداً (الأعياد قمريّة والمُدد بتعميمٍ سنويّ).

## حدود ما رُوجع هنا

- **مُتحقَّقٌ بالتنفيذ:** الاثنتا عشرة مهاجرة التي تلي `20260811000004` طُبّقت على
  استنساخٍ من قاعدة التطوير بلا خطأ (رمز الخروج ٠).
- **غير مُتحقَّق بالتنفيذ:** ما قبلها. ولا يمكن التحقّق منه على استنساخٍ حديث —
  إعادةُ تطبيق مهاجرةٍ قديمة فوق مخطّطٍ أحدث تفشل بحقّ (`20260806000001` مع
  `20260808000005`). البروفة الصالحة تكون على نسخةٍ من **التجريبية نفسها**.
  فإن أمكن: استنسخ نسختها الاحتياطية وجرّب عليها قبل التنفيذ الفعليّ.
