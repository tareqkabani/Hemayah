// بوابة الفرز المبدئي — تقرأ PortalConfig من @hemaya/domain وتركّب القشرة الموحّدة.
export const dynamic = "force-dynamic";
import { TriagePortal } from "@/components/TriagePortal";
import { getTriageData } from "@/lib/data";

export default async function Page() {
  const { roleKey, me, initialRows, prefs } = await getTriageData();
  return <TriagePortal roleKey={roleKey} me={me} initialRows={initialRows} prefs={prefs} basePath="/triage" />;
}
