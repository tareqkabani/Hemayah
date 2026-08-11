/**
 * عقد عوامل توصية الجهة (recommendations.factors9) — كتابةً وقراءةً.
 *
 * كان للعمود كاتبان بلهجتين مختلفتين للبيانات المنطقية نفسها:
 *  - الإدخال الورقي (PaperIntakePortal): camelCase — threatExists · crimeType…
 *  - بوابة الجهة الإلكترونية: snake_case — threat · crime_type · attach_files…
 * فوُحّدت القراءة أولاً بـnormalizeFactors9، ثم وُحّدت الكتابة ببانٍ واحد
 * (buildFactors9) يُنتج اللهجة القانونية camelCase — فلا يولد اختلافٌ جديد.
 *
 * القاعدة: **الكتابة عبر buildFactors9 حصراً، والقراءة عبر normalizeFactors9
 * حصراً.** لا تقرأ مفتاحاً خاماً من الحمولة في أي شاشة — الصفوف القديمة
 * بلهجة snake_case ما زالت في القاعدة، والموحِّد وحده يعرف اللهجتين.
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
    hideIdentity: pick(f, "hideIdentity", "hidden2", "hidden_m2", "hide_identity"),
    threatExists: pick(f, "threatExists", "threat"),
    riskLevel: pick(f, "riskLevel", "risk_level"),
    threatType: pick(f, "threatType", "threat_type"),
    harmExists: pick(f, "harmExists", "harm"),
    harmType: pick(f, "harmType", "harm_type"),
    extendsOthers: pick(f, "extendsOthers", "extends", "extends_others"),
    extendsWho: pick(f, "extendsWho", "extends_who"),
    adapt: pick(f, "adapt"),
    caseSummary: pick(f, "caseSummary", "case_summary"),
    caseStage: pick(f, "caseStage", "case_stage"),
    roleDesc: pick(f, "roleDesc", "applicantRoleDesc", "role_desc"),
    contacted: pick(f, "contacted"),
    contactKind: pick(f, "contactKind", "contact_kind"),
    reasons: arr(f.reasons),
    alternatives: pick(f, "alternatives"),
    duration: pick(f, "duration"),
    durationNote: pick(f, "durationNote", "duration_note"),
    attachments: arr((f as any).attachFiles ?? (f as any).attach_files ?? (f as any).attachments),
  };
}

/** مدخلات باني العوامل — بأسماء الحقول القانونية (camelCase) لا بلهجة نموذجٍ بعينه. */
export type FactorsInput = Partial<Record<keyof RecommendationFactors, unknown>>;

/** ترتيب المفاتيح في الحمولة المكتوبة — ثابتٌ كي تتشابه الصفوف في القاعدة. */
const FACTOR_KEYS: (keyof RecommendationFactors)[] = [
  "health", "healthNote", "criminal", "criminalNote", "psych", "psychHistory", "reveal",
  "crimeType", "waqia", "crimeDesc", "hideIdentity",
  "threatExists", "riskLevel", "threatType", "harmExists", "harmType",
  "extendsOthers", "extendsWho", "adapt",
  "caseSummary", "caseStage", "roleDesc", "contacted", "contactKind",
  "reasons", "alternatives", "duration", "durationNote", "attachments",
];

const ARRAY_KEYS = new Set<keyof RecommendationFactors>(["waqia", "reasons", "attachments"]);

/**
 * يبني حمولة factors9 القانونية من مدخلات النموذج.
 * — يُسقط الخاوي (سلسلةً أو مصفوفةً) فلا تُخزَّن مفاتيح بلا قيمة؛
 * — يُنقّي المصفوفات من العناصر الفارغة؛
 * — لا يخترع قيمةً غائبة: ما لم يُمرَّر لا يُكتب.
 */
export function buildFactors9(input: FactorsInput | null | undefined): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const k of FACTOR_KEYS) {
    const raw = (input as Record<string, unknown>)[k];
    if (ARRAY_KEYS.has(k)) {
      const list = arr(raw);
      if (list.length) out[k] = list;
    } else {
      const v = s(raw);
      if (v) out[k] = v;
    }
  }
  return out;
}
