# نشر البيئة التجريبية على سيرفر داخلي — دليل التشغيل

منظومة «حماية» كاملة (12 بوابة + واجهة REST + قاعدة Supabase) على سيرفر Linux واحد داخل شبكة العمل. المستخدمون يصلون كل شيء عبر **منفذ واحد**: `http://<SERVER_HOST>:3000`.

> **تنبيه أمني:** الدخول عبر نفاذ التجريبي (mock) يقبل أي هوية من 10 أرقام — هذه البيئة للاختبار الداخلي ببيانات وهمية فقط، ويجب أن تبقى غير مكشوفة خارج الشبكة الداخلية.

## المتطلبات (مرة واحدة)

| المكوّن | الفحص | التثبيت إن غاب |
|---------|-------|----------------|
| Docker + compose | `docker ps` | حسب توزيعتك |
| Node.js ≥ 20 | `node -v` | [nodejs.org](https://nodejs.org) أو nvm |
| pnpm | `pnpm -v` | `corepack enable && corepack prepare pnpm@latest --activate` |
| Supabase CLI | `supabase -v` | `curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \| tar xz && sudo mv supabase /usr/local/bin/` |
| pm2 | `pm2 -v` | `npm i -g pm2` |

الذاكرة المنصوح بها: 8GB فأكثر (Supabase ~2GB + 12 تطبيق Node).

## خطوات النشر

```bash
# 1) اجلب الشيفرة (فرع main فقط — هو مصدر الحقيقة)
git clone https://github.com/tareqkabani/Hemayah.git && cd Hemayah

# 2) شغّل قاعدة Supabase (حاويات Docker) وطبّق الهجرات والبذور
supabase start
supabase db reset   # يطبّق الهجرات الـ38 + seed.sql (22 حساباً تجريبياً بالأدوار)

# 3) ولّد ملفات البيئة لكل البوابات (استبدل بعنوان السيرفر على الشبكة)
./deploy/staging/setup-env.sh 10.20.30.40

# 4) ثبّت الاعتماديات وابنِ الجميع
pnpm -C hemaya-app install
pnpm -C hemaya-app build

# 5) شغّل المنظومة وثبّتها للإقلاع التلقائي
pm2 start deploy/staging/ecosystem.config.cjs
pm2 save && pm2 startup   # نفّذ السطر الذي يطبعه startup

# 6) تحقق
./deploy/staging/verify.sh 10.20.30.40
```

افتح من أي جهاز على الشبكة: `http://10.20.30.40:3000` — الدخول من قائمة الهويات التجريبية (طالب الحماية: `1000000001`، الفرز: `2000000002`، الرئيس: `2000000008`، النائب العام: `4000000001`...).

## عمليات دورية

| العملية | الأمر |
|---------|-------|
| تحديث لنسخة أحدث | `git pull && pnpm -C hemaya-app install && pnpm -C hemaya-app build && pm2 restart all` |
| سجلّات بوابة | `pm2 logs hemaya-seeker` |
| حالة المنظومة | `pm2 status` |
| تصفير بيانات التجربة | `supabase db reset` (يعيد الهجرات والبذور من الصفر) |
| إيقاف كامل | `pm2 stop all && supabase stop` |

## ملاحظات معمارية

- **الموجّه**: بوابة `landing` (منفذ 3000) تعيد كتابة `/seeker` و`/center`... إلى بوابات المناطق داخلياً (Multi-Zones) — لا حاجة لـ nginx في التجريبية؛ أضِفه لاحقاً إن أردت TLS أو اسم نطاق داخلياً.
- **المنافذ المفتوحة للمستخدمين**: 3000 فقط (+ 55321 لوصول المتصفح لـ Supabase API). بقية منافذ البوابات (3002–3020) يكفي بقاؤها داخلية.
- **الأسرار**: `setup-env.sh` يولّد كلمة جسر نفاذ عشوائية في `deploy/staging/.bridge-password` (خارج git). ملفات `.env.local` كلها خارج git أيضاً.
- لوحة إدارة القاعدة (Supabase Studio): `http://<SERVER_HOST>:55323` — أبقِها للمشرفين فقط.
