import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";
const ROLES: AppRole[] = ["prosecutor_general"] as AppRole[];
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
