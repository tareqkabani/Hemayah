import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * عميل Supabase للخادم (Server Components / Route Handlers / Actions).
 * يقرأ/يكتب جلسة المصادقة عبر الكوكيز — لازمٌ لحارس نفاذ لاحقاً (M2).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // استُدعيت من Server Component — يتكفّل middleware بتحديث الجلسة.
          }
        },
      },
    },
  );
}
