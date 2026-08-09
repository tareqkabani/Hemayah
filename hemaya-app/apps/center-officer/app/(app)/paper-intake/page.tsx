import { requireRole } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { getList } from "@hemaya/domain";
import { PaperIntakePortal } from "@/components/PaperIntakePortal";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole(["case_officer", "hotline_operator"] as any, { denyPath: "/403" });
  // صفة مقدّم الطلب من طبقة المحتوى (قائمة applicant_role) — النص للعرض والمخزَّن كما تتوقعه الدوال
  const supabase = createServerClient();
  const applicantRoles = (await getList(supabase, "applicant_role")).map((i) => i.label);
  return <PaperIntakePortal applicantRoles={applicantRoles} />;
}
