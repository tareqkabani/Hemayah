// بوابة الفرز المبدئي — تقرأ PortalConfig من @hemaya/domain وتركّب القشرة الموحّدة.
export const dynamic = "force-dynamic";
import { TriagePortal } from "@/components/TriagePortal";
import { getTriageData } from "@/lib/data";
import { getHolidays } from "@/lib/holidays";

export default async function Page() {
  const { roleKey, me, initialRows, prefs, initialReadKeys, initialMessages,
          registerTotal, registerTruncated } = await getTriageData();
  // التقويم الرسميّ — تُحقنه القشرة في حاسبة أيام العمل قبل أول حساب مهلة
  const holidays = await getHolidays();
  return (
    <TriagePortal
      holidays={holidays}
      roleKey={roleKey}
      me={me}
      initialRows={initialRows}
      prefs={prefs}
      basePath="/triage"
      initialReadKeys={initialReadKeys}
      initialMessages={initialMessages}
      registerTotal={registerTotal}
      registerTruncated={registerTruncated}
    />
  );
}
