import type { CompetentEntity } from "@hemaya/supabase";

// ============================================================
//  الجهات المختصة الخمس ونماذجها التنظيمية (المصدر الواحد —
//  كانت المسمّيات منسوخة حرفياً في واجهة الفرز وداخل triage_decide).
//
//  النماذج بتأكيد الجهة المالكة (2026-08-06):
//    - regional: النيابة العامة — نيابات مناطق (والهيكل الهرمي الكامل
//      نيابات مناطق + فروع محافظات مرحلة تالية بانتظار القائمة الرسمية)
//    - central: الأربع الأخرى — وحدة مركزية واحدة بلا فروع؛ اختيار
//      المنطقة لا معنى له في الإحالة إليها (تبقى معلومة اختصاصٍ مكاني
//      على القضية لا عنوانَ توجيه).
// ============================================================

export type EntityOrgModel = "central" | "regional";

export type CompetentEntitySpec = {
  label: string;
  orgModel: EntityOrgModel;
  /** سابقة تسمية وحدة الاستقبال المناطقية («نيابة منطقة …») — للمناطقية فقط */
  unitPrefix?: string;
};

export const COMPETENT_ENTITIES: Record<CompetentEntity, CompetentEntitySpec> = {
  prosecution: { label: "النيابة العامة", orgModel: "regional", unitPrefix: "نيابة" },
  state_security: { label: "رئاسة أمن الدولة", orgModel: "central" },
  moi: { label: "وزارة الداخلية", orgModel: "central" },
  nazaha: { label: "هيئة الرقابة ومكافحة الفساد", orgModel: "central" },
  moj: { label: "وزارة العدل", orgModel: "central" },
};

/** المسمّيات العربية مرتّبةً كما تُعرض في واجهة الفرز. */
export const COMPETENT_ENTITY_LABELS: string[] = Object.values(COMPETENT_ENTITIES).map((e) => e.label);

/** مواصفة الجهة من مسمّاها العربي (كما تتداوله الواجهات والدالة triage_decide). */
export function entityByLabel(label: string): CompetentEntitySpec | undefined {
  return Object.values(COMPETENT_ENTITIES).find((e) => e.label === label);
}

/** هل الإحالة لهذه الجهة مركزية (بلا اختيار منطقة)؟ غير المعروفة تُعامل مناطقياً. */
export function isCentralEntity(label: string): boolean {
  return entityByLabel(label)?.orgModel === "central";
}
