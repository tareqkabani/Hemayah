/**
 * توحيد قراءة عوامل توصية الجهة (recommendations.factors9).
 *
 * للعمود كاتبان بلهجتين مختلفتين من المفاتيح للبيانات المنطقية نفسها:
 *  - الإدخال الورقي (PaperIntakePortal): camelCase — threatExists · crimeType ·
 *    attachFiles · applicantRoleDesc … مع حقول الفحوص (health/criminal/reveal).
 *  - بوابة الجهة الإلكترونية (recordLinkedRecommendation): snake_case —
 *    threat · crime_type · attach_files · extends_others … (رقعة أضيق).
 *
 * كل شاشة كانت تجتهد بقراءتها (وبعضها يقرأ من recommendations.details الذي
 * لا كاتب له أصلاً فتُعرض شرطات) — هذا الموحِّد هو نقطة القراءة الوحيدة،
 * وأي مفتاح جديد في أي من الكاتبَين يُضاف هنا لا في الشاشات.
 */

export type RecommendationFactors = {
  /** الفحوص والتاريخ — يكتبها المسار الورقي فقط اليوم */
  health: string;
  healthNote: string;
  criminal: string;
  criminalNote: string;
  psych: string;
  psychHistory: string;
  reveal: string;
  /** الواقعة والجريمة */
  crimeType: string;
  waqia: string[];
  crimeDesc: string;
  hideIdentity: string;
  /** الخطر والضرر */
  threatExists: string;
  riskLevel: string;
  threatType: string;
  harmExists: string;
  harmType: string;
  extendsOthers: string;
  extendsWho: string;
  adapt: string;
  /** القضية ومقدّم الطلب */
  caseSummary: string;
  caseStage: string;
  roleDesc: string;
  contacted: string;
  contactKind: string;
  /** خلاصة التوصية */
  reasons: string[];
  alternatives: string;
  duration: string;
  durationNote: string;
  attachments: string[];
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : [];
/** أول قيمة نصية حاضرة من مفاتيح اللهجتين */
const pick = (f: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = s(f[k]);
    if (v) return v;
  }
  return "";
};

/**
 * يطبّع factors9 بأي من اللهجتين إلى الشكل القانوني الواحد.
 * يعيد null إذا لم تكن الحمولة كائناً (توصيات المسار الأجنبي/القديمة بلا عوامل).
 */
export function normalizeFactors9(f9: unknown): RecommendationFactors | null {
  if (!f9 || typeof f9 !== "object" || Array.isArray(f9)) return null;
  const f = f9 as Record<string, unknown>;
  return {
    health: pick(f, "health"),
    healthNote: pick(f, "healthNote", "health_note"),
    criminal: pick(f, "criminal"),
    criminalNote: pick(f, "criminalNote", "criminal_note"),
    psych: pick(f, "psych"),
    psychHistory: pick(f, "psychHistory", "psych_history"),
    reveal: pick(f, "reveal"),
    crimeType: pick(f, "crimeType", "crime_type"),
    waqia: arr(f.waqia),
    crimeDesc: pick(f, "crimeDesc", "crime_desc"),
    hideIdentity: pick(f, "hidden2", "hidden_m2", "hide_identity"),
    threatExists: pick(f, "threatExists", "threat"),
    riskLevel: pick(f, "riskLevel", "risk_level"),
    threatType: pick(f, "threatType", "threat_type"),
    harmExists: pick(f, "harmExists", "harm"),
    harmType: pick(f, "harmType", "harm_type"),
    extendsOthers: pick(f, "extends", "extends_others"),
    extendsWho: pick(f, "extendsWho", "extends_who"),
    adapt: pick(f, "adapt"),
    caseSummary: pick(f, "caseSummary", "case_summary"),
    caseStage: pick(f, "caseStage", "case_stage"),
    roleDesc: pick(f, "applicantRoleDesc", "role_desc"),
    contacted: pick(f, "contacted"),
    contactKind: pick(f, "contactKind", "contact_kind"),
    reasons: arr(f.reasons),
    alternatives: pick(f, "alternatives"),
    duration: pick(f, "duration"),
    durationNote: pick(f, "durationNote", "duration_note"),
    attachments: arr((f as any).attachFiles ?? (f as any).attach_files ?? (f as any).attachments),
  };
}
