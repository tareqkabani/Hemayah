import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * عميل Supabase بصلاحية service_role — خادميّ حصراً (يتجاوز RLS).
 * يُستعمل لعمليات الإدارة: إنشاء مستخدم نفاذ، إسناد الأدوار، البذور.
 * لا يُستورَد أبداً في كود العميل.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
