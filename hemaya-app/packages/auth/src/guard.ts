import { redirect } from "next/navigation";
import { createServerClient } from "@hemaya/supabase";
import type { AppRole } from "@hemaya/supabase";
import { getUserRoles } from "./roles";

/** يضمن وجود جلسة، وإلا يعيد التوجيه للدخول. يعيد المستخدم. */
export async function requireUser(loginPath = "/login") {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPath);
  return user;
}

/** يضمن أن للمستخدم أحد الأدوار المطلوبة، وإلا يعيد التوجيه. أقل امتياز. */
export async function requireRole(
  allowed: AppRole | AppRole[],
  opts?: { loginPath?: string; denyPath?: string },
) {
  const user = await requireUser(opts?.loginPath);
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  const mine = await getUserRoles();
  if (!roles.some((r) => mine.includes(r))) {
    redirect(opts?.denyPath ?? "/403");
  }
  return { user, roles: mine };
}
