import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@hemaya/supabase/src/types.gen";

/** مستخدمٌ بشريّ مُصادَق عليه عبر توكن نفاذ (Supabase Auth). محكومٌ بـ RLS. */
export interface AuthUser {
  id: string;
  email: string | null;
  nationalId: string | null;
}

/**
 * هويّة الطالب. إمّا مستخدمٌ بشريّ (RLS تحرس بياناته) أو نظامٌ آليّ عبر مفتاح
 * API (الصلاحيات scopes تحرس وصوله، إذ لا ينطبق عليه عزل RLS بالمستخدم).
 */
export type Principal =
  | { type: "user"; user: AuthUser }
  | { type: "machine"; keyId: string; name: string; scopes: string[] };

/** مُعرّفٌ نصّيّ للهويّة — للتدقيق والسجلّات. */
export function principalId(p: Principal): string {
  return p.type === "user" ? p.user.id : `key:${p.keyId}`;
}

/** متغيّرات سياق Hono المشتركة عبر الـ middleware والنقاط. */
export interface Env {
  Variables: {
    principal: Principal;
    /** عميل Supabase المناسب: بهوية المستخدم (RLS) أو service (آليّ مُقيَّد بالصلاحيات). */
    db: SupabaseClient<Database>;
    /** مُعرّف الطلب — للتدقيق والتتبّع. */
    requestId: string;
  };
}
