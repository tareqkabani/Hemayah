import { createServerClient } from "@hemaya/supabase";
import type { AppRole } from "@hemaya/supabase";

/** أدوار المستخدم الحاليّ (من جدول user_roles عبر RLS). */
export async function getUserRoles(): Promise<AppRole[]> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function hasRole(role: AppRole): Promise<boolean> {
  return (await getUserRoles()).includes(role);
}
export async function hasAnyRole(roles: AppRole[]): Promise<boolean> {
  const mine = await getUserRoles();
  return roles.some((r) => mine.includes(r));
}

/** سمات ABAC لأول دورٍ يحمل السمات (محفظة/جهة/فرع/مقعد). */
export async function getRoleAttributes(): Promise<Record<string, unknown>> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase.from("user_roles").select("attributes").eq("user_id", user.id).limit(1).single();
  return (data?.attributes as Record<string, unknown>) ?? {};
}
