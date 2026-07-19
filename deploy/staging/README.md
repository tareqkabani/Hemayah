# نشر البيئة التجريبية — ثلاثة سيرفرات داخلية عبر Portainer

منظومة «حماية» موزّعة على طبقاتك الثلاث. المستخدمون يصلون كل شيء عبر سيرفر الواجهات فقط: `http://<FRONT_HOST>:3000`.

```
المستخدمون ──▶ [سيرفر الواجهات :3000]───rewrites──▶ نفسه (11 بوابة داخلية)
                      │  /api/v1/*  ──▶ [سيرفر الـAPIs :3020]
                      │
    متصفح المستخدم ───┴─(auth/realtime)─▶ [سيرفر القاعدة :55321  Supabase]
```

> **تنبيه أمني:** نفاذ التجريبي يقبل أي هوية من 10 أرقام — البيئة للاختبار الداخلي ببيانات وهمية فقط، ولا تُكشف خارج الشبكة.

## 1) سيرفر قاعدة البيانات (مرة واحدة)

على السيرفر مباشرة (الحاويات ستظهر في Portainer تلقائياً):

```bash
# المتطلبات: Docker + Supabase CLI
mkdir -p ~/supa-cli && curl -sL https://github.com/supabase/cli/releases/download/v2.109.1/supabase_2.109.1_linux_amd64.tar.gz | tar -xzf - -C ~/supa-cli && sudo mv ~/supa-cli/supabase ~/supa-cli/supabase-go /usr/local/bin/ && rm -rf ~/supa-cli && supabase --version

git clone https://github.com/tareqkabani/Hemayah.git && cd Hemayah
supabase start          # يرفع مكدّس Supabase (Kong على 55321)
supabase db reset       # الهجرات الـ38 + البذور (22 حساباً بالأدوار)

# التقط القيم التالية لسيرفرَي الواجهات والـAPIs:
supabase status -o env | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)='
```

المنافذ المطلوبة عبر الشبكة: **55321** (للمتصفحات والسيرفرين)، و**55323** (لوحة Studio — للمشرفين فقط). أبقِ 55322 (Postgres) مغلقاً خارجياً.

> **⚠️ نسخ CLI الأحدث من 2.109 تربط المنافذ على `127.0.0.1` فقط** — فيصل سيرفر القاعدة نفسه إليها ولا يصل غيره، وتظهر «fetch failed» عند الدخول من الواجهات. العلاج المعتمد: انشر stack كشف المنافذ على **Portainer سيرفر القاعدة** — Compose path: `deploy/staging/db-proxy.stack.yml` بمتغيّر واحد `DB_BIND_IP` = عنوان السيرفر الشبكي (يُدخل مرة واحدة ويبقى). تحقّق بعده من أي جهاز: `curl http://<DB_HOST>:55321/auth/v1/health`.

## 2) سيرفر الـAPIs — stack في Portainer

Portainer ← **Stacks ← Add stack ← Repository**:
- Repository URL: `https://github.com/tareqkabani/Hemayah`
- Compose path: `deploy/staging/api.stack.yml`
- Environment variables:

| المتغيّر | القيمة |
|----------|--------|
| `DB_HOST` | عنوان سيرفر القاعدة |
| `SUPABASE_ANON_KEY` | من الخطوة 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | من الخطوة 1 |
| `NAFATH_BRIDGE_PASSWORD` | كلمة عشوائية قوية — **نفسها في السيرفرين** |

Deploy ← تحقق: `http://<API_HOST>:3020/v1/health` ترجع `{"status":"ok"}`.

## 3) سيرفر الواجهات — stack في Portainer

نفس الطريقة، Compose path: `deploy/staging/frontend.stack.yml`، بمتغيّرات:

| المتغيّر | القيمة |
|----------|--------|
| `PUBLIC_HOST` | اسم النطاق للمستخدمين، مثل `hemayah.pp.gov.sa` (يتطلب سجلّ DNS داخلياً → عنوان هذا السيرفر) |
| `FRONT_HOST` | عنوان IP هذا السيرفر |
| `DB_HOST` | عنوان سيرفر القاعدة |
| `API_HOST` | عنوان سيرفر الـAPIs |
| `SUPABASE_ANON_KEY` | من الخطوة 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | من الخطوة 1 |
| `NAFATH_BRIDGE_PASSWORD` | نفس قيمة سيرفر الـAPIs |
| `TLS_CERT_B64` / `TLS_KEY_B64` | اختياريان: شهادة الجهة ومفتاحها (base64 بسطر واحد: `base64 -w0 ملف`) — بدونهما تُولَّد شهادة ذاتية التوقيع (تحذير متصفح «متابعة») |

الوكيل `hemaya-proxy` يخدم **https على 443** (و80 يحوّل إليه) ويمرّر `/supabase/` للقاعدة عبر النطاق نفسه — منافذ السيرفر المطلوبة: **443** و**80**. رابط المستخدمين النهائي: **`https://<PUBLIC_HOST>`**.

> البناء الأول يستغرق دقائق (11 تطبيق Next.js) — تابعه من سجلّ الـ stack. الصورة تعيد البناء تلقائياً عند تحديثها من نفس الشاشة (Pull and redeploy).

تحقق نهائي من أي جهاز على الشبكة:

```bash
./deploy/staging/verify.sh <FRONT_HOST>          # من نسخة المستودع
# أو يدوياً: افتح http://<FRONT_HOST>:3000 وادخل بهوية 1000000001
```

## عمليات دورية

| العملية | أين | الأمر/الخطوة |
|---------|-----|--------------|
| تحديث لنسخة أحدث | Portainer على السيرفرين | الـ stack ← **Pull and redeploy** |
| تطبيق هجرات جديدة (تبقي البيانات) | سيرفر القاعدة | `cd Hemayah && git pull && supabase migration up` |
| انقطاع 55321 بعد تحديث CLI | Portainer سيرفر القاعدة | نشر/تشغيل stack ‏`db-proxy.stack.yml` (انظر تنبيه الخطوة 1) |
| تصفير بيانات التجربة | سيرفر القاعدة | `cd Hemayah && git pull && supabase db reset` |
| سجلّات | Portainer | Containers ← Logs |
| هويات تجريبية | — | طالب حماية `1000000001` · فرز `2000000002` · رئيس `2000000008` · نائب عام `4000000001` |

## البديل: كل شيء على سيرفر واحد

ما زال مدعوماً (للتجارب السريعة): شغّل الخطوات الثلاث على جهاز واحد، أو استخدم المسار غير المحوسَب: `setup-env.sh` + `pm2 start ecosystem.config.cjs` (يشغّل الكل عندما `HEMAYA_ROLE` غير مضبوط).

## ملاحظات

- متغيّرات `NEXT_PUBLIC_*` تُدمج في شيفرة المتصفح **وقت البناء** — تغيير `DB_HOST` أو `FRONT_HOST` يستلزم إعادة بناء stack الواجهات لا مجرد إعادة تشغيل.
- الموجّه (landing) يعيد كتابة مسارات البوابات داخل الحاوية نفسها؛ و`/api/v1/*` وحدها تعبر لسيرفر الـAPIs.
- أضِف nginx/TLS واسم نطاق داخلياً لاحقاً أمام 3000 إن رغبت — لا شيء في الحزمة يعترض ذلك.
