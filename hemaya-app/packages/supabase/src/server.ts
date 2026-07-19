import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/** عميل Supabase للخادم (Server Components · Route Handlers · Server Actions). يفرض RLS بجلسة المستخدم. */
export function createClient() {
  const cookieStore = cookies();
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
