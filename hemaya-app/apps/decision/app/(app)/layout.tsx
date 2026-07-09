import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";

// المسار الجديد: المعدّ (case_officer) · الأعضاء (board_member) · القيادة (board_chair/deputy_chair)
const ROLES: AppRole[] = ["case_officer", "board_member", "board_chair", "deputy_chair"] as AppRole[];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
