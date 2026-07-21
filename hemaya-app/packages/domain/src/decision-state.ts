// ============================================================
//  آلة حالة مرحلة «القرار والإشعار» (معلم CO-3) — تحديث 22 يوليو 2026.
//  قاعدة صاحب المنصة الملزمة: القرار المُعَدّ يُراجَع ويُعتمَد من نائب
//  رئيس المركز ثم من رئيس المركز قبل طرحه للتصويت، ويصوّت الأعضاء
//  بمن فيهم النائب والرئيس (7 مقاعد)، والإصدار الختامي بيد الرئيس.
//  تُفرَض الانتقالات server-side (RPCs SECURITY DEFINER) — هذا مرجع الواجهة.
// ============================================================

export const DECISION_STATUS = {
  preparing: "قيد إعداد القرار",
  pending_deputy: "بانتظار اعتماد نائب الرئيس",
  pending_chair: "بانتظار اعتماد رئيس المركز",
  approved: "معتمَد — بانتظار الطرح للتصويت",
  voting: "مطروح للتصويت",
  issued: "صادر ومُشعَر به",
} as const;
export type DecisionStatus = keyof typeof DECISION_STATUS;

export const DECISION_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  preparing: ["pending_deputy"],                 // submitForApproval — المعدّ
  pending_deputy: ["pending_chair", "preparing"], // approve — النائب · rejectApproval بملاحظة إلزامية
  pending_chair: ["approved", "preparing"],       // approveChair — الرئيس · rejectApproval بملاحظة إلزامية
  approved: ["voting"],                           // openVoting — المعدّ بعد الحلقتين
  voting: ["issued"],                             // issue — الرئيس بعد إغلاق التصويت
  issued: [],
};

export function canDecisionTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  return DECISION_TRANSITIONS[from]?.includes(to) ?? false;
}

/** الدور المخوَّل بكل فعل (المرجع النظاميّ — يُفرَض في القاعدة). */
export const DECISION_ACTION_ROLE = {
  submitForApproval: "case_officer",   // المعدّ: من preparing إلى pending_deputy
  approve: "deputy_chair",             // النائب: إلى pending_chair (حلقة الرئيس)
  approveChair: "board_chair",         // الرئيس: إلى approved (يعود للمعدّ للطرح)
  rejectApproval: "leadership",        // كلٌّ من حلقته: النائب من حلقته والرئيس من حلقته
  openVoting: "case_officer",          // المعدّ بعد approved
  castVote: "council",                 // الأعضاء + القيادة — أصوات معزولة
  closeByDeadline: "leadership",       // النائب/الرئيس بانتهاء يوم العمل
  issue: "board_chair",                // الرئيس وحده بعد الإغلاق + إشعار الطرفين (م10)
} as const;
export type DecisionAction = keyof typeof DECISION_ACTION_ROLE;

/** مراحل الشريط الست (تُعرض «المرحلة N من 6»). */
export const DECISION_STAGES = [
  "إعداد القرار",
  "اعتماد نائب الرئيس",
  "اعتماد رئيس المركز",
  "الطرح للتصويت",
  "تصويت المجلس",
  "إصدار القرار والإشعار",
] as const;

/** فهرس المرحلة الجارية (issued = 6 أي ما بعد الأخيرة — اكتمل المسار). */
export function decisionStageOf(status: DecisionStatus): number {
  return { preparing: 0, pending_deputy: 1, pending_chair: 2, approved: 3, voting: 4, issued: 6 }[status] ?? 0;
}

export const DECISION_MAJORITY = 4; // أغلبية حاسمة من مقاعد التصويت السبعة
export const DECISION_VOTING_SEATS = 7;

// ————————————————————————————————————————————————————————————
//  الإجراء المطلوب — دالة موحّدة تغذّي وسم «يتطلّب إجراء» وسطر
//  «الإجراء المطلوب منك» في اللوحة والبطاقات والجداول (نمط عام للبوابات).
// ————————————————————————————————————————————————————————————

export type DecisionScope = "preparer" | "members" | "leadership";

/** لقطة محايدة عن القرار يمرّرها المخزن (لا وصول لمخزن هنا — دالة نقيّة). */
export interface DecisionSnapshot {
  status: DecisionStatus;
  /** هل المستخدم الحالي هو معدّ هذا القرار؟ */
  mine?: boolean;
  /** هل سبق أن أُعيد من القيادة؟ (rejections غير فارغة) */
  returned?: boolean;
  /** هل أدلى المستخدم الحالي بصوته؟ */
  voted?: boolean;
  /** هل أُغلق التصويت (أغلبية أو مهلة)؟ */
  closed?: boolean;
  /** مقعد المستخدم في القيادة: deputy | chair (لغير القيادة يُهمَل). */
  leadSeat?: "deputy" | "chair";
}

/** نصّ الإجراء المطلوب من هذا المستخدم الآن — أو null إن لا إجراء عليه. */
export function nextDecisionAction(scope: DecisionScope, d: DecisionSnapshot): string | null {
  if (scope === "preparer") {
    if (!d.mine) return null;
    if (d.status === "preparing")
      return d.returned
        ? "تعديل القرار المُعاد إليك من القيادة وإعادة رفعه"
        : "إعداد قرار المركز من الدراسات والتقييمات ورفعه لنائب الرئيس";
    if (d.status === "approved") return "طرح القرار المعتمَد على أعضاء المجلس للتصويت";
    return null;
  }
  if (scope === "members") {
    if (d.status !== "voting") return null;
    return !d.closed && !d.voted ? "الاطّلاع على الحزمة والإدلاء بصوتك (قبول/رفض)" : null;
  }
  // leadership
  if (d.leadSeat === "deputy" && d.status === "pending_deputy")
    return "مراجعة القرار المُعَدّ واعتماده أو إعادته للمعدّ";
  if (d.leadSeat === "chair" && d.status === "pending_chair")
    return "مراجعة القرار بعد اعتماد النائب — اعتماده أو إعادته للمعدّ";
  if (d.status === "voting") {
    if (!d.closed && !d.voted) return "الإدلاء بصوتك كعضو في المجلس";
    if (d.closed && d.leadSeat === "chair") return "إصدار قرار المركز وإشعار الطرفين (م10)";
  }
  return null;
}
