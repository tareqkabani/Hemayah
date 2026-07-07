import { HealthPortal } from "@/components/HealthPortal";
import { getReferrals } from "@/lib/referrals-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const initialData = await getReferrals("health");
  return <HealthPortal initialData={initialData} />;
}
