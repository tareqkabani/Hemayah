// بوابة المكتب الفني — تقرأ PortalConfig من @hemaya/domain وتركّب القشرة الموحّدة.
export const dynamic = "force-dynamic";
import { TechOfficePortal } from "@/components/TechOfficePortal";
import { getTechData } from "@/lib/data";

export default async function Page() {
  const d = await getTechData();
  return (
    <TechOfficePortal
      roleKey={d.roleKey}
      me={d.me}
      mySpec={d.mySpec}
      initialRows={d.initialRows}
      prefs={d.prefs}
      basePath="/technical"
      initialNotifs={d.initialNotifs}
      initialReadKeys={d.initialReadKeys}
      initialOfficeMsgs={d.initialOfficeMsgs}
      initialCaseMsgs={d.initialCaseMsgs}
      advisors={d.advisors}
    />
  );
}
