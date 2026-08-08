// بوابة مدير النظام — إدارة كاملة لمحتوى المنصّة على القشرة الموحّدة.
export const dynamic = "force-dynamic";
import { AdminPortal } from "@/components/AdminPortal";
import { getAdminData } from "@/lib/data";

export default async function Page() {
  const data = await getAdminData();
  return (
    <AdminPortal
      me={data.me}
      lists={data.lists}
      itemsByList={data.itemsByList}
      templates={data.templates}
      sysMessages={data.sysMessages}
      legalTexts={data.legalTexts}
      changeRequests={data.changeRequests}
    />
  );
}
