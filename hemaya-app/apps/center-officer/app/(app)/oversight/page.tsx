import { requireRole } from "@hemaya/auth";
import { OversightPortal } from "@/components/OversightPortal";
import { getOversightStats } from "@/lib/oversight-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole("board_chair" as any, { denyPath: "/403" });
  const stats = await getOversightStats();
  return <OversightPortal role="chair" initialData={{ stats }} />;
}
