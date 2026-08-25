import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, type UnsafeUnwrappedCookies } from "next/headers";
import type { Database } from "./types";

/** عميل Supabase للخادم (Server Components · Route Handlers · Server Actions). يفرض RLS بجلسة المستخدم. */
export function createClient() {
  // Next 15: cookies() صار async. نُبقي createClient متزامناً (له 96 مستدعياً
  // عبر البوابات) بمخرَج الانتقال UnsafeUnwrappedCookies — وصولٌ متزامنٌ مدعومٌ
  // في 15.x. الترحيلُ الكاملُ إلى await مؤجَّلٌ لـNext 16.
  const cookieStore = cookies() as unknown as UnsafeUnwrappedCookies;
  return createServerClient<Database>(
    // الخادم يفضّل الرابط الداخلي وقت التشغيل (SUPABASE_INTERNAL_URL — غير مخبوز)
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component — يُحدّث الوسيط الجلسة */ }
        },
      },
    },
  );
}
