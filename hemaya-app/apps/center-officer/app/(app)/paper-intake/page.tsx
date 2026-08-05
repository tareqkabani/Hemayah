import { requireRole } from "@hemaya/auth";
import { PaperIntakePortal } from "@/components/PaperIntakePortal";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole(["case_officer", "hotline_operator"] as any, { denyPath: "/403" });
  return <PaperIntakePortal />;
}
