import { HrPortal } from "@/components/HrPortal";
import { getReferrals } from "@/lib/referrals-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const initialData = await getReferrals("hr");
  return <HrPortal initialData={initialData} />;
}
