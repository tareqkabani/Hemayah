// جهات الإحالة والخدمات — مرجعٌ للتوصيات والتدابير (م14 + اللائحة).
export const REFERRAL_AUTHORITY_LABEL: Record<string, string> = {
  hr: "وزارة الموارد البشرية",
  health: "وزارة الصحة",
  legal: "الجهة القضائية",
  security: "الإدارة الأمنية",
  moi: "وزارة الداخلية",
};

export const REFERRAL_SERVICES = [
  { key: "transfer", label: "النقل / تغيير محل العمل", authority: "hr" },
  { key: "alt_work", label: "العمل البديل", authority: "hr" },
  { key: "housing", label: "الإسكان", authority: "hr" },
  { key: "psych", label: "الإرشاد النفسي", authority: "health" },
  { key: "social", label: "الإرشاد الاجتماعي", authority: "health" },
  { key: "medical", label: "الرعاية الطبية", authority: "health" },
  { key: "guard", label: "الحماية الشخصية والمرافقة", authority: "security" },
] as const;
