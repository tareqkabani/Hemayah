import { SecurityPortal } from "@/components/SecurityPortal";
import { getSecurityReferrals } from "@/lib/referrals-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const initialData = await getSecurityReferrals();
  return <SecurityPortal initialData={initialData} />;
}
