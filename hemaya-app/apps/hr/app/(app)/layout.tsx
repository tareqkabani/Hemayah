import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";
const ROLES: AppRole[] = ["hr_specialist"] as AppRole[];
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { loginPath: "/login", denyPath: "/403" });
  return <>{children}</>;
}
