# منصّة «حماية» — دليل التثبيت والتشغيل

منصّة إدارة طلبات الحماية: طالب الحماية يقدّم طلبه عبر نفاذ، ويمرّ الطلب بالفرز ثمّ الدراسة والتقييم ثمّ قرار المجلس ثمّ التنفيذ والمتابعة، وكلّ جهةٍ لها بوّابتها.

هذا الدليل يشرح **تثبيت المنصّة من الصفر مع قاعدة البيانات**، والأدوات التي يحتاجها المطوّر، ثمّ النشر على الخوادم وما يجب تغييره قبل الإنتاج.

---

## 1) مكوّنات المنصّة

```
المستخدم ──▶ الشاشة الموحّدة :3000 (apps/landing) ──rewrites──▶ 15 بوّابة Next.js داخلية
                    │  /api/v1/*  ──▶ واجهة REST (Hono) :3020 (apps/api)
                    │
   متصفّح المستخدم ─┴──(auth / realtime / RPC)──▶ Supabase :55321 (Postgres 17 + Auth + Kong)
```

| المكوّن | المكان في المستودع | التقنية |
|---|---|---|
| قاعدة البيانات والمصادقة | `supabase/` | Supabase مستضاف ذاتياً: Postgres 17، مهاجرات SQL، RLS مفعّل على كلّ الجداول |
| البوّابات (16 تطبيقاً) | `hemaya-app/apps/*` | Next.js 15 + React 19، مونوريبو pnpm + Turbo |
| الحزم المشتركة | `hemaya-app/packages/*` | `domain` · `ui` · `auth` · `supabase` · `study-eval` · `recommendation` |
| واجهة REST | `hemaya-app/apps/api` | Hono على Node، طبقة رقيقة فوق دوالّ Supabase RPC |
| النشر | `deploy/` | Dockerfiles وملفات Portainer stack وسكربتات ترحيل المهاجرات |
| اختبارات البيئة | `deploy/testing/` | k6 للضغط، ZAP وtestssl وnmap وTrivy للفحص الأمني (كلّها عبر Docker) |

> ملاحظة: مجلّدا `src/` و`package.json` في الجذر بقايا نموذجٍ أوّليّ لا يدخل في النشر. المنصّة الفعليّة كلّها تحت `hemaya-app/` و`supabase/`.

---

## 2) الأدوات التي يحتاجها المطوّر

| الأداة | الإصدار | الغرض |
|---|---|---|
| Git | أيّ إصدار حديث | المستودع، وخطّافات `.githooks/` |
| Node.js | **22** (الحدّ الأدنى 20) | تشغيل البوّابات والـAPI، ونفس إصدار صور Docker |
| pnpm | **11.1.2** عبر `corepack enable` | مدير حزم المونوريبو (الإصدار مثبّت في `hemaya-app/package.json`) |
| Docker (Desktop أو Engine) | حديث | تشغيل مكدّس Supabase محلياً، وبناء صور النشر، وأدوات الاختبار |
| Supabase CLI | **2.109.x** | `supabase start` / `db reset` / `migration up` (الإصدارات الأحدث تربط المنافذ على 127.0.0.1 فقط، انظر `deploy/staging/README.md`) |
| psql (عميل Postgres) | 17 | تنفيذ اختبارات SQL وسكربتات الترحيل على خادمٍ قائم (اختياريّ محلياً) |
| TypeScript | 5.x (يُثبَّت مع الحزم) | `pnpm typecheck` قبل كلّ دمج |
| محرّر يدعم TypeScript | VS Code مثلاً | مع إضافة ESLint |

أوامر التثبيت على macOS:

```bash
brew install git node@22 supabase/tap/supabase libpq
corepack enable
```

على Linux ثبّت Node 22 من NodeSource وSupabase CLI من إصدارات GitHub (الأمر الكامل في `deploy/staging/README.md` §1).

---

## 3) التثبيت المحلّي خطوة بخطوة

### أ) استنساخ المستودع

```bash
git clone <رابط المستودع> Hemayah && cd Hemayah
git config core.hooksPath .githooks     # حارس يمنع الدفع المباشر إلى main
```

### ب) تشغيل قاعدة البيانات

من جذر المستودع (حيث `supabase/config.toml`):

```bash
supabase start        # يرفع Postgres + Auth + Kong + Studio (يستغرق دقائق أوّل مرّة)
supabase db reset     # يطبّق كلّ المهاجرات (107 ملفاً) ثمّ البذور supabase/seed.sql
supabase status       # يعرض الروابط والمفاتيح
```

المنافذ المحلية من `config.toml`:

| المنفذ | الخدمة |
|---|---|
| 55321 | واجهة Supabase (Kong): auth وrest وrealtime، وهو ما تتّصل به البوّابات |
| 55322 | Postgres مباشرة (لـpsql والاختبارات فقط) |
| 55323 | لوحة Studio |

التقط القيمتين اللتين تحتاجهما الخطوة التالية:

```bash
supabase status -o env | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)='
```

### ج) ملفات البيئة

الأسرع: السكربت الجاهز يقرأ المفاتيح من `supabase status` ويكتب `.env.local` لكلّ بوّابة و`.env` للـAPI:

```bash
./deploy/staging/setup-env.sh 127.0.0.1
```

أو يدوياً، أنشئ `hemaya-app/apps/<app>/.env.local` لكلّ بوّابة، و`hemaya-app/apps/api/.env` (قالبه في `.env.example`):

| المتغيّر | من يحتاجه | المعنى |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | الكلّ | رابط Supabase كما يراه المتصفّح، مثل `http://127.0.0.1:55321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | الكلّ | المفتاح العامّ، RLS يحرس ما يفعله |
| `SUPABASE_SERVICE_ROLE_KEY` | `landing` و`api` فقط | يتجاوز RLS كلّياً، سرّيّ مطلق، لا يُكتب لبقيّة البوّابات |
| `SUPABASE_INTERNAL_URL` | الخادم وقت التشغيل | رابط داخليّ يفضّله الخادم على الرابط العامّ (اختياريّ محلياً) |
| `NEXT_PUBLIC_GATEWAY_URL` | الكلّ | رابط الشاشة الموحّدة، محلياً `http://127.0.0.1:3000` |
| `SERVER_ACTIONS_ALLOWED_ORIGINS` | الكلّ | الأصول المسموح لها بمناداة Server Actions، محلياً `127.0.0.1:3000` |
| `NAFATH_BRIDGE_PASSWORD` | `landing` و`api` | سرّ مشترك بين الشاشة الموحّدة والـAPI لجسر نفاذ، نفس القيمة في الاثنين |
| `INTG_MODE` | `landing` | `mock` (الافتراضيّ) أو `real` لتكاملات نفاذ والعمل والموارد |
| `API_PORT` | `api` | منفذ واجهة REST، الافتراضيّ 3020 |
| `RATE_LIMIT_PER_MIN` | `api` | حدّ الطلبات في الدقيقة، اختياريّ |
| `SUPABASE_JWKS_URL` | `api` | رابط مفاتيح التحقّق من JWT، اختياريّ ويُشتقّ من رابط Supabase |
| `APP_ENV` | الكلّ | `production` يُفعّل تشديد التحقّق من سرّ الجسر |

### د) تثبيت الحزم وتشغيل البوّابات

```bash
cd hemaya-app
pnpm install --frozen-lockfile
pnpm dev                 # يشغّل كلّ التطبيقات معاً عبر Turbo
```

افتح `http://127.0.0.1:3000`. الشاشة الموحّدة تسأل عن رقم هوية نفاذ وتوجّه المستخدم إلى بوّابته بحسب دوره.

في وضع `mock` تُقبل أيّ هوية من 10 أرقام، وحسابات البذور الجاهزة:

| الهوية | الدور | البوّابة |
|---|---|---|
| 1000000001 | طالب حماية | seeker |
| 2000000002 | موظّف الفرز | triage |
| 2000000003 | الدارس | studier |
| 2000000004 | المقيّم | evaluator |
| 2000000005 | معدّ القرار | decision |
| 2000000008 | رئيس المركز | center-officer (الإشراف) |
| 2000000009 | نائب الرئيس | center-officer (الإشراف) |
| 2000000010 | كاتب الإدخال اليدويّ | center-officer (الإدخال الورقيّ) |
| 3000000001 | موظّف فرع النيابة | competent-entities |
| 3000000002 | أخصائيّ الصحّة | health |
| 3000000003 | أخصائيّ الموارد البشرية | hr |
| 4000000001 | النائب العامّ | attorney-general |

القائمة الكاملة (34 حساباً) في `supabase/seed.sql` §1، وكلمة سرّ حسابات الموظّفين موحّدة هناك للتطوير فقط.

### هـ) التطبيقات ومنافذها في التطوير

| التطبيق | المنفذ | التطبيق | المنفذ |
|---|---|---|---|
| landing (الشاشة الموحّدة) | 3000 | technical-office | 3008 |
| center-officer | 3002 | health | 3009 |
| competent-entities | 3006 | hr | 3010 |
| attorney-general | 3007 | interior | 3011 |
| security-admin | 3012 | seeker | 3013 |
| decision | 3014 | studier | 3015 |
| evaluator | 3016 | triage | 3017 |
| admin | 3018 | api (REST) | 3020 |

المستخدم لا يفتح هذه المنافذ مباشرة، فالشاشة الموحّدة تعيد كتابة المسارات إليها (Multi-Zones).

### و) الفحص قبل أيّ دمج

```bash
cd hemaya-app
pnpm typecheck                              # تعارض الأنواع في كلّ الحزم
pnpm -r --if-present run lint               # قواعد ESLint
pnpm --filter @hemaya/domain test           # اختبارات منطق البوّابات
docker exec -i supabase_db_Hemayah psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < ../supabase/tests/e2e-full-journey.sql   # رحلة كاملة داخل القاعدة
```

خطّ CI في `.github/workflows/ci.yml` يشغّل الفحوص الثلاثة الأولى مع فحص تسرّب الأسرار على كلّ طلب دمج.

---

## 4) تحديث قاعدة البيانات عند تغيّر المخطّط

- **مهاجرة جديدة:** ملفّ في `supabase/migrations/` باسم `YYYYMMDDNNNNNN_وصف.sql`، مكتوب ليُعاد بلا ضرر (idempotent).
- **محلياً:** `supabase db reset` يعيد البناء كاملاً، أو `supabase migration up` يطبّق الجديد فقط.
- **على خادمٍ قائم مع الإبقاء على البيانات:** `supabase migration up` من نسخة المستودع على خادم القاعدة، أو `DB_URL=... ./deploy/apply-migrations.sh --dry-run` ثمّ بلا `--dry-run`.
- **خادم معزول عن الإنترنت:** `deploy/staging/make-offline-bundle.sh` يولّد ملفّ SQL واحداً يُنفَّذ بـpsql وحده.
- **إعادة توليد أنواع TypeScript** بعد أيّ مهاجرة، إلى `hemaya-app/packages/supabase/src/types.gen.ts`:

```bash
supabase gen types typescript --local > hemaya-app/packages/supabase/src/types.gen.ts
```

الدليل الحيّ لكلّ نشرٍ سابق في `deploy/staging/RUNBOOK-*.md`، وأحدثها `RUNBOOK-2026-08-25.md`.

---

## 5) النشر على الخوادم

النمط المعتمد ثلاثة خوادم خلف Portainer، والشرح الكامل بالمتغيّرات في `deploy/staging/README.md`:

1. **خادم القاعدة:** Docker + Supabase CLI، ثمّ `supabase start` و`supabase db reset`. يُفتح 55321 للشبكة الداخلية فقط ويبقى 55322 مغلقاً.
2. **خادم الـAPI:** stack من `deploy/staging/api.stack.yml`، يبني `deploy/staging/docker/api.Dockerfile` ويخدم 3020.
3. **خادم الواجهات:** stack من `deploy/staging/frontend.stack.yml`، يبني البوّابات كلّها بـpm2 خلف وكيل https على 443 يمرّر `/supabase/` للقاعدة عبر النطاق نفسه.

نقاط تنتبه لها الشركة:

- متغيّرات `NEXT_PUBLIC_*` تُدمج في شيفرة المتصفّح **وقت البناء**، فتغييرها يستلزم إعادة بناء صورة الواجهات لا إعادة تشغيلها.
- مفتاح `service_role` لا يصل إلى أيّ حاوية سوى الشاشة الموحّدة والـAPI.
- التحقّق بعد النشر: `./deploy/staging/verify.sh <FRONT_HOST>` و`http://<API_HOST>:3020/v1/health`.
- البديل على خادمٍ واحد: `setup-env.sh` ثمّ `pm2 start deploy/staging/ecosystem.config.cjs`.

---

## 6) ما يجب تغييره قبل الإنتاج الحقيقيّ

1. **نفاذ الحقيقيّ:** وضع `mock` يقبل أيّ هوية من 10 أرقام، ولا يوجد مهايئ حقيقيّ في المستودع بعد. يجب كتابة مهايئ نفاذ الفعليّ في `hemaya-app/packages/auth/src/adapters/nafath.ts` وفق واجهة `NafathAdapter` في `types.ts`، ثمّ ضبط `INTG_MODE=real`. وكذلك مهايئا العمل والموارد البشرية في المجلّد نفسه.
2. **حسابات البذور:** `supabase/seed.sql` للتطوير والعرض فقط ولا يُطبَّق على قاعدة الإنتاج. أنشئ الحسابات والأدوار الحقيقية عبر بوّابة الإدارة `admin`.
3. **الأسرار:** ولّد `NAFATH_BRIDGE_PASSWORD` وكلمة سرّ Postgres ومفاتيح JWT جديدة، واضبط `APP_ENV=production`.
4. **شهادة TLS** الرسمية في `TLS_CERT_B64` و`TLS_KEY_B64` بدل الشهادة ذاتية التوقيع.
5. **التسجيل الذاتيّ:** `enable_signup = false` في `supabase/config.toml` يجب أن يبقى كذلك في إعداد Auth على الإنتاج.
6. **النسخ الاحتياطيّ** الدوريّ لـPostgres، وسياسة الاحتفاظ بسجلّ التدقيق.
7. **الفحص الأمنيّ قبل الفتح:** حزمة `deploy/testing/` (testssl وZAP وk6) وملاحظات `supabase/LINTER-ADVISORIES.md`.

---

## 7) خريطة المستودع

```
supabase/           config.toml · migrations/ (107) · seed.sql · tests/ (اختبارات SQL) · LINTER-ADVISORIES.md
hemaya-app/
  apps/             16 تطبيقاً: 15 بوّابة Next.js + api (Hono)
  packages/         domain · ui · auth · supabase · study-eval · recommendation
  docs/             ARCHITECTURE.md (المعمارية التفصيلية وقشرة البوّابة الموحّدة)
deploy/
  apply-migrations.sh · check-staging-list.sh
  staging/          README.md · api/frontend/db-proxy stacks · docker/ · RUNBOOK-*.md · setup-env.sh · verify.sh
  testing/          k6/ · scan/ (zap · testssl · nmap · trivy)
.github/workflows/  ci.yml (typecheck · lint · audit · gitleaks)
.githooks/          pre-push (يمنع الدفع المباشر إلى main ويتحقّق من قائمة النشر)
```

معيار العمل: كلّ تغيير يمرّ عبر فرعٍ وطلب دمجٍ يُراجَع، ولا دفع مباشراً إلى `main`.
