import { getRoleAttributes } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { getLists } from "@hemaya/domain";
import { CompetentEntitiesPortal } from "@/components/CompetentEntitiesPortal";
export const dynamic = "force-dynamic";

// بنود نموذج التوصية من طبقة المحتوى — كانت مثبَّتةً في الشيفرة، فبندٌ
// يضيفه الأدمن من بوابته لا يبلغ هذه البوابة أبداً. (نفس القوائم التي
// تستهلكها وحدة الإدخال اليدوي — النموذج واحدٌ لهما.)
const LIST_KEYS = ["app_category", "crime_type", "waqia", "protection_types", "duration"];

// مستوى الحساب (cb_level) يحدّد شاشات البوابة: موظف الفرع · رئيس الفرع · المقر.
// القاعدة تحرس الصلاحية على أي حال (decide_recommendation_approval تشترط head)،
// وهذا يمنع عرض شاشةِ اعتمادٍ لمن لا يملكه.
export default async function Page() {
  const [attrs, lists] = await Promise.all([
    getRoleAttributes(),
    getLists(createServerClient(), LIST_KEYS),
  ]);
  const level = typeof attrs.level === "string" ? attrs.level : "clerk";
  return <CompetentEntitiesPortal level={level} lists={lists} />;
}
