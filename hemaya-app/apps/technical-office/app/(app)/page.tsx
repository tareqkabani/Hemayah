import { getUserRoles } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { TechnicalOfficePortal } from "@/components/GrievancePortal";
export const dynamic = "force-dynamic";

// الدور من المستخدم المسجَّل (فصل مهامّ). المستشار: هويّته من سمة دوره (attributes.advisor) —
// كلّ مستشارٍ حسابٌ مستقلّ يرى المُسنَد إليه فقط، بلا مبدّل ولا تداخل بين المستشارين.
export default async function Page() {
  const roles = await getUserRoles();
  if (roles.includes("tech_manager")) return <TechnicalOfficePortal role="head" />;

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("user_roles")
    .select("attributes")
    .eq("user_id", user!.id)
    .eq("role", "advisor")
    .single();
  const meAdvisor = ((data?.attributes as Record<string, unknown>)?.advisor as string) || "a1";
  return <TechnicalOfficePortal role="advisor" meAdvisor={meAdvisor} />;
}
