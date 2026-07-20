import type { AppRole } from "@hemaya/supabase";

// ============================================================
//  تسميات الأدوار + إسنادها إلى البوابات (التطبيقات المنفصلة).
// ============================================================

export const ROLE_LABEL: Record<AppRole, string> = {
  prosecutor_general: "النائب العام",
  board_chair: "رئيس المركز/المجلس",
  deputy_chair: "نائب الرئيس",
  board_member: "عضو المجلس",
  case_officer: "موظف/منسّق المركز",
  security_officer: "ضابط الإدارة الأمنية",
  security_manager: "مدير الإدارة الأمنية",
  studier: "دارس",
  evaluator: "مقيّم",
  advisor: "مستشار المكتب الفني",
  tech_manager: "مدير المكتب الفني",
  hotline_operator: "مشغّل الخط الساخن",
  ciso: "مسؤول أمن المعلومات",
  sysadmin: "مدير النظام",
  competent_body: "منسوب جهة مختصة",
  moi_officer: "منسوب وزارة الداخلية",
  moh_specialist: "مختص وزارة الصحة",
  moh_manager: "مدير وزارة الصحة",
  hr_specialist: "مختص الموارد البشرية",
  hr_manager: "مدير الموارد البشرية",
  subject: "طالب الحماية / المشمول",
};

export interface Portal {
  app: string;
  title: string;
  port: number;
  roles: AppRole[];
}

/** خريطة البوابات (تطبيقٌ لكل بوابة) وأدوارها ومنافذها.
 *  المنافذ مطابقة لسكربتات dev في apps/*&#47;package.json — كلها خلف
 *  الشاشة الموحّدة (landing:3000) بمسارات Multi-Zones. */
export const PORTALS: Portal[] = [
  { app: "landing", title: "الشاشة الموحّدة (بوابة الدخول)", port: 3000, roles: [] },
  { app: "center-officer", title: "موظف المركز (فرز · دراسة · قرار)", port: 3002,
    roles: ["case_officer", "studier", "evaluator", "board_member", "board_chair", "deputy_chair", "hotline_operator"] },
  { app: "competent-entities", title: "الجهات المختصة", port: 3006, roles: ["competent_body"] },
  { app: "attorney-general", title: "بوابة النائب العام", port: 3007, roles: ["prosecutor_general"] },
  { app: "technical-office", title: "المكتب الفني (التظلّمات)", port: 3008, roles: ["advisor", "tech_manager"] },
  { app: "health", title: "وزارة الصحة", port: 3009, roles: ["moh_specialist", "moh_manager"] },
  { app: "hr", title: "وزارة الموارد البشرية", port: 3010, roles: ["hr_specialist", "hr_manager"] },
  { app: "interior", title: "وزارة الداخلية (المسار الأجنبي)", port: 3011, roles: ["moi_officer"] },
  { app: "security-admin", title: "الإدارة الأمنية", port: 3012, roles: ["security_officer", "security_manager"] },
  { app: "seeker", title: "بوابة طالب الحماية", port: 3013, roles: ["subject"] },
  { app: "decision", title: "دورة القرار (اعتماد · تصويت · إصدار)", port: 3014,
    roles: ["case_officer", "board_member", "board_chair", "deputy_chair"] },
  { app: "studier", title: "بوابة الدارس", port: 3015, roles: ["studier"] },
  { app: "evaluator", title: "بوابة المقيّم", port: 3016, roles: ["evaluator"] },
  { app: "triage", title: "بوابة الفرز المبدئي", port: 3017, roles: ["case_officer", "deputy_chair", "board_chair"] },
];
