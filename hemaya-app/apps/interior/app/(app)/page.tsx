import { InteriorPortal } from "@/components/InteriorPortal";
import { getForeignRequests } from "@/lib/foreign-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const initialData = await getForeignRequests();
  return <InteriorPortal initialData={initialData} />;
}
