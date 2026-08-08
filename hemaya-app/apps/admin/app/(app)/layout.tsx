import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";
// بوابة مدير النظام — إدارة كاملة لمحتوى المنصّة تحت قيد sysadmin_no_pii
const ROLES: AppRole[] = ["sysadmin"] as AppRole[];
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
