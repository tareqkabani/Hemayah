import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";
const ROLES: AppRole[] = ["moi_officer"] as AppRole[];
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { loginPath: "/login", denyPath: "/403" });
  return <>{children}</>;
}
