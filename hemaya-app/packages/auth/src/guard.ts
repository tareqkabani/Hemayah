import { redirect } from "next/navigation";
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import type { AppRole } from "@hemaya/supabase";
import { getUserRoles } from "./roles";

/** يضمن وجود جلسة، وإلا يعيد التوجيه للبوّابة الموحّدة (نفاذ). يعيد المستخدم. */
export async function requireUser() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);
  return user;
}

/** يضمن أن للمستخدم أحد الأدوار المطلوبة، وإلا يعيد التوجيه. أقل امتياز. */
export async function requireRole(
  allowed: AppRole | AppRole[],
  opts?: { denyPath?: string },
) {
  const user = await requireUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  const mine = await getUserRoles();
  if (!roles.some((r) => mine.includes(r))) {
    redirect(opts?.denyPath ?? "/403");
  }
  return { user, roles: mine };
}
