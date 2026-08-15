import { requireRole } from "@hemaya/auth";
import type { AppRole } from "@hemaya/supabase";

// intake_clerk يدخل البوابة لأجل شاشة الإدخال اليدوي وحدها — وبقيّة الشاشات
// تحرسها صفحاتها بأدوارها (لا قرار ولا تقييم لمنسوب الوحدة).
const ROLES: AppRole[] = ["case_officer","studier","evaluator","board_member","board_chair","deputy_chair","hotline_operator","intake_clerk"] as AppRole[];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(ROLES, { denyPath: "/403" });
  return <>{children}</>;
}
