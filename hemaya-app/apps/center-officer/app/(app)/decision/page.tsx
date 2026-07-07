import { requireRole } from "@hemaya/auth";
import { DecisionPortal } from "@/components/DecisionPortal";
import { getCouncilData } from "@/lib/council-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole("case_officer" as any, { loginPath: "/login", denyPath: "/403" });
  const initialData = await getCouncilData();
  return <DecisionPortal scope="preparer" initialData={initialData} />;
}
