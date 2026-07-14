import { z } from "zod";

// مصدر الحقيقة لهذه القيم: @hemaya/domain (CATEGORY و APPLICANT_ROLE).
// نكرّرها هنا عمداً كي لا نجرّ barrel حزمة @hemaya (المقترن بـ Next)
// إلى فحص أنواع خدمةٍ مستقلّة. أبقِها متزامنة مع النطاق.
const CATEGORY_VALUES = ["reporter", "witness", "expert", "victim", "related"] as const;
const APPLICANT_ROLE_VALUES = ["أصيل", "وليّ", "وصيّ", "وكيل", "محامٍ"] as const;

/** جسم POST /v1/cases — تقديم طلب حماية. العميل يرسل رموزاً إنجليزيّة لا تسميات عربية. */
export const SubmitCaseSchema = z.object({
  applicantRole: z.enum(APPLICANT_ROLE_VALUES),
  category: z.enum(CATEGORY_VALUES),
  entity: z.string().trim().min(1, "الجهة مطلوبة."),
  crime: z.string().trim().min(1, "الجريمة مطلوبة."),
  reason: z.string().trim().min(1, "المسوّغات مطلوبة."),
  priorSubmit: z.boolean().default(false),
  caseNo: z.string().trim().optional(),
  details: z.record(z.unknown()).optional(),
});
export type SubmitCaseInput = z.infer<typeof SubmitCaseSchema>;

/** جسم POST /v1/cases/{ref}/triage — قرار الفرز (إجراء موظّف المركز). */
export const TriageSchema = z.object({
  decision: z.enum(["study", "refer", "close"]),
  reason: z.string().trim().optional(),
  formalCheck: z.record(z.boolean()).default({}),
  authority: z.string().trim().optional(),
});
export type TriageInput = z.infer<typeof TriageSchema>;

/** جسم POST /v1/auth/nafath/start — بدء تحدّي نفاذ. */
export const NafathStartSchema = z.object({
  nationalId: z.string().regex(/^\d{10}$/, "رقم الهوية يجب أن يكون 10 أرقام."),
});
export type NafathStartInput = z.infer<typeof NafathStartSchema>;

/** جسم POST /v1/auth/nafath/confirm — تأكيد المطابقة وإصدار الجلسة. */
export const NafathConfirmSchema = z.object({
  nationalId: z.string().regex(/^\d{10}$/, "رقم الهوية يجب أن يكون 10 أرقام."),
  sessionId: z.string().trim().min(1, "معرّف جلسة نفاذ مطلوب."),
});
export type NafathConfirmInput = z.infer<typeof NafathConfirmSchema>;

/** جسم دراسة/تقييم — submit_study و submit_assessment لهما نفس البنية. */
export const StudyAssessmentSchema = z.object({
  recommendation: z.string().trim().min(1, "التوصية مطلوبة."),
  rejectReasons: z.array(z.string()).default([]),
  proposedType: z.array(z.string()).default([]),
  proposedDuration: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type StudyAssessmentInput = z.infer<typeof StudyAssessmentSchema>;

/** مسوّدة قرار المجلس — council_save (المسوّغات اختياريّة في المسوّدة). */
export const CouncilDraftSchema = z.object({
  types: z.array(z.string()).default([]),
  duration: z.string().trim().optional(),
  reasoning: z.string().trim().optional(),
});
export type CouncilDraftInput = z.infer<typeof CouncilDraftSchema>;

/** رفع قرار المجلس للاعتماد — council_submit (المسوّغات مطلوبة). */
export const CouncilSubmitSchema = z.object({
  types: z.array(z.string()).default([]),
  duration: z.string().trim().optional(),
  reasoning: z.string().trim().min(1, "المسوّغات مطلوبة للرفع."),
});
export type CouncilSubmitInput = z.infer<typeof CouncilSubmitSchema>;

/** إعادة القرار للمُعِدّ — council_return. */
export const CouncilReturnSchema = z.object({ note: z.string().trim().min(1, "سبب الإعادة مطلوب.") });

/** تصويت عضو المجلس — council_vote. */
export const CouncilVoteSchema = z.object({
  choice: z.enum(["accept", "reject"]),
  note: z.string().trim().optional(),
});
export type CouncilVoteInput = z.infer<typeof CouncilVoteSchema>;

/** إصدار القرار — council_issue (السبب مطلوب عند الرفض؛ تفرضه القاعدة). */
export const CouncilIssueSchema = z.object({ reason: z.string().trim().optional() });

/** محضر اتصال — إدراج في contact_logs. */
export const ContactLogSchema = z.object({
  channel: z.string().trim().min(1, "قناة الاتصال مطلوبة."),
  summary: z.string().trim().min(1, "ملخّص المحضر مطلوب."),
});
export type ContactLogInput = z.infer<typeof ContactLogSchema>;

/** خيوط المراسلة (تعداد msg_thread في القاعدة): المركز أو الجهة المختصة. */
export const MESSAGE_THREADS = ["center", "body"] as const;

/** جسم POST /v1/cases/{ref}/messages — ردّ المستفيد (الاتّجاه out تفرضه القاعدة). */
export const MessageSendSchema = z.object({
  thread: z.enum(MESSAGE_THREADS).default("center"),
  body: z.string().trim().min(1, "نصّ الرسالة مطلوب."),
});
export type MessageSendInput = z.infer<typeof MessageSendSchema>;

/** جسم POST /v1/cases/{ref}/grievances — رفع تظلّم المستفيد أمام النائب العام. */
export const GrievanceFileSchema = z.object({
  scope: z.string().trim().optional(),          // محلّ الاعتراض (وسم اختياريّ)
  reason: z.string().trim().min(1, "سبب التظلّم مطلوب."),
});
export type GrievanceFileInput = z.infer<typeof GrievanceFileSchema>;

/** قيم مطابقة لتعداد referral_authority في القاعدة. */
export const REFERRAL_AUTHORITIES = ["hr", "health", "legal", "security", "moi", "ag", "technical", "competent"] as const;

/** جسم POST /v1/referrals/{id} — تحديث إحالة (إجراء جهة منفّذة). */
export const ReferralUpdateSchema = z.object({
  status: z.enum(["new", "assigned", "progress", "review", "done"]),
  assignee: z.string().trim().optional(),
  result: z.record(z.unknown()).optional(),
  note: z.string().trim().default(""),
});
export type ReferralUpdateInput = z.infer<typeof ReferralUpdateSchema>;
