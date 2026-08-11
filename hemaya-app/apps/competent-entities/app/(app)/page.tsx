import { getRoleAttributes } from "@hemaya/auth";
import { CompetentEntitiesPortal } from "@/components/CompetentEntitiesPortal";
export const dynamic = "force-dynamic";

// مستوى الحساب (cb_level) يحدّد شاشات البوابة: موظف الفرع · رئيس الفرع · المقر.
// القاعدة تحرس الصلاحية على أي حال (decide_recommendation_approval تشترط head)،
// وهذا يمنع عرض شاشةِ اعتمادٍ لمن لا يملكه.
export default async function Page() {
  const attrs = await getRoleAttributes();
  const level = typeof attrs.level === "string" ? attrs.level : "clerk";
  return <CompetentEntitiesPortal level={level} />;
}
