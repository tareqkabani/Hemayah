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

/** خريطة البوابات (تطبيقٌ لكل بوابة) وأدوارها ومنافذها. */
export const PORTALS: Portal[] = [
  { app: "seeker", title: "بوابة طالب الحماية", port: 3000, roles: ["subject"] },
  { app: "attorney-general", title: "بوابة النائب العام", port: 3001, roles: ["prosecutor_general"] },
  { app: "center-officer", title: "موظف المركز (فرز · دراسة · قرار)", port: 3002,
    roles: ["case_officer", "studier", "evaluator", "board_member", "board_chair", "deputy_chair", "hotline_operator"] },
  { app: "center-leadership", title: "قيادة المركز", port: 3003, roles: ["board_chair", "deputy_chair"] },
  { app: "center-execution", title: "التنفيذ والتجديد", port: 3004, roles: ["case_officer"] },
  { app: "technical-office", title: "المكتب الفني (التظلّمات)", port: 3005, roles: ["advisor", "tech_manager"] },
  { app: "security-admin", title: "الإدارة الأمنية", port: 3006, roles: ["security_officer", "security_manager"] },
  { app: "interior", title: "وزارة الداخلية (المسار الأجنبي)", port: 3007, roles: ["moi_officer"] },
  { app: "health", title: "وزارة الصحة", port: 3008, roles: ["moh_specialist", "moh_manager"] },
  { app: "hr", title: "وزارة الموارد البشرية", port: 3009, roles: ["hr_specialist", "hr_manager"] },
  { app: "competent-entities", title: "الجهات المختصة", port: 3010, roles: ["competent_body"] },
];
