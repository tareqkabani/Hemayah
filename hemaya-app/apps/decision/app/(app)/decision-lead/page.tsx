import { requireRole } from "@hemaya/auth";
import { DecisionPortal } from "@/components/DecisionPortal";
import { getDecisionData } from "@/lib/dec-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole(["board_chair", "deputy_chair"] as any, { denyPath: "/403" });
  const initialData = await getDecisionData();
  return <DecisionPortal scope="leadership" initialData={initialData} />;
}
