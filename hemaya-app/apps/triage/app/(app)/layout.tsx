import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";
// موظف الفرز يقرّر؛ القيادة (نائب/رئيس) اطّلاع وإشراف viewOnly
const ROLES: AppRole[] = ["case_officer", "deputy_chair", "board_chair"] as AppRole[];
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
