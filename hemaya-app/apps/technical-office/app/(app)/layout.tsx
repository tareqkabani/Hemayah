import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";
// المستشارون (دراسة التظلّمات) ومدير المكتب (الإشراف والبتّ) — بوابتان بدورين منفصلين.
const ROLES: AppRole[] = ["advisor", "tech_manager"] as AppRole[];
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
