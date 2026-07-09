import { requireRole } from "@hemaya/auth";
import { OversightPortal } from "@/components/OversightPortal";
import { getCouncilData } from "@/lib/council-data";
import { getOversightStats } from "@/lib/oversight-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole("board_chair" as any, { denyPath: "/403" });
  const [council, stats] = await Promise.all([getCouncilData(), getOversightStats()]);
  return <OversightPortal role="chair" initialData={{ ...council, stats }} />;
}
