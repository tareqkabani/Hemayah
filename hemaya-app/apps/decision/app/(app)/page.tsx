import { redirect } from "next/navigation";
import { getUserRoles } from "@hemaya/auth";

// موجِّه الجذر: يوجّه كلّ دورٍ إلى واجهته في المسار الجديد.
export const dynamic = "force-dynamic";
export default async function Home() {
  const roles = await getUserRoles();
  if (roles.includes("board_chair" as any) || roles.includes("deputy_chair" as any)) redirect("/decision-lead");
  if (roles.includes("board_member" as any)) redirect("/decision-vote");
  redirect("/decision"); // case_officer (معدّ القرار)
}
