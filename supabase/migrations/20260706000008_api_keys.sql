-- ============================================================
--  مفاتيح API — مصادقة نظام-لنظام للجهات الحكوميّة والشركاء.
--  المفتاح الخام يُعرَض مرّةً واحدة عند الإنشاء؛ نخزّن تجزئته (sha256) فقط.
--  الوصول للجدول عبر service_role/طبقة الـ API فقط — لا سياسات ⇒ منعٌ افتراضيّ
--  للعملاء المباشرين (نفس نهج الجداول الحسّاسة).
--  ملاحظة أمنيّة: المستهلك الآليّ ليس مستخدم Supabase، فلا ينطبق عليه عزل RLS
--  بالمستخدم؛ الصلاحيات (scopes) في طبقة الـ API هي حدّ الأمان له. لذا المفاتيح
--  مجزّأة وقابلة للإبطال والانتهاء ومُدقَّقة الاستخدام.
-- ============================================================

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                       -- تسمية للجهة (مثال: «وزارة الداخلية — تكامل»)
  prefix       text not null,                       -- بادئة المفتاح للتعرّف في السجلّات (ليست سرّاً)
  key_hash     text not null unique,                -- sha256 للمفتاح الخام كاملاً
  scopes       text[] not null default '{}',        -- مثال: {'cases:read'}
  active       boolean not null default true,
  expires_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

-- بحثٌ سريع بالتجزئة للمفاتيح الفعّالة فقط.
create index if not exists api_keys_active_hash_idx
  on public.api_keys (key_hash) where active;

alter table public.api_keys enable row level security;
-- لا سياسات: منعٌ افتراضيّ لكلّ العملاء المباشرين؛ الوصول عبر service_role فقط.

comment on table public.api_keys is
  'مفاتيح API للمصادقة نظام-لنظام (مجزّأة sha256). الوصول عبر طبقة الـ API/service_role فقط؛ الصلاحيات تحرس الوصول الآليّ.';
