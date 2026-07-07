/**
 * عقد مُحوِّل «نفاذ» (الهوية الوطنية الموحّدة) — تبعية صلبة للدخول والهوية.
 * INTEGRATIONS.md: صمّم خلف واجهة مُحوِّل حتى يُقلب mock→live بمفتاح إعداد واحد.
 */

export type IntgMode = "mock" | "live";

export interface NafathIdentity {
  nationalId: string;
  name: string;
  dob?: string; // ISO date
  nationality?: string;
}

export interface NafathLoginChallenge {
  sessionId: string;
  /** الرقم الذي يجب أن يطابقه المستخدم في تطبيق نفاذ */
  verificationNumber: number;
}

export interface NafathAdapter {
  readonly mode: IntgMode;
  /** يبدأ جلسة نفاذ لهوية وطنية ويُصدر رقم التحقّق (يُطابَق في تطبيق نفاذ). */
  login(nationalId: string): Promise<NafathLoginChallenge>;
  /** يستطلع نتيجة المطابقة؛ يُعيد الهوية عند الموافقة أو null إن لم تُنجَز بعد. */
  poll(sessionId: string): Promise<NafathIdentity | null>;
  /** تحقّق لازمٌ لتوقيع الاتفاقية (م11). */
  verifyForSignature(sessionId: string): Promise<boolean>;
}
