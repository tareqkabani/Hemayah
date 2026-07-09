import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";

const ROLES: AppRole[] = ["case_officer","studier","evaluator","board_member","board_chair","deputy_chair","hotline_operator"] as AppRole[];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
