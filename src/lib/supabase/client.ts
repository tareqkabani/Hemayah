import { createBrowserClient } from "@supabase/ssr";

/**
 * عميل Supabase للمتصفّح (مكوّنات العميل).
 * يستعمل مفتاح anon العلنيّ فقط — RLS هو حارس الصلاحيات.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
