import { requireRole } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { getLists } from "@hemaya/domain";
import type { AppRole } from "@hemaya/supabase";
import { PaperIntakePortal } from "@/components/PaperIntakePortal";
import { listInbox, listSent, listReferredForEntity } from "@/lib/paper-intake-actions";
import { getHolidays } from "@/lib/holidays";

export const dynamic = "force-dynamic";

// حارس الشاشة: منسوبو الوحدة وحدهم — مطابقٌ لـis_intake_staff في القاعدة.
const ROLES = ["intake_clerk", "case_officer", "hotline_operator"] as AppRole[];

// الجهات المختصّة — الترتيب والمسمّى موحّدان مع جهات الإحالة في الفرز.
const ENTS: [string, string][] = [
  ["prosecution", "النيابة العامة"],
  ["state_security", "رئاسة أمن الدولة"],
  ["moi", "وزارة الداخلية"],
  ["nazaha", "هيئة الرقابة ومكافحة الفساد"],
  ["moj", "وزارة العدل"],
];

// بنود النماذج من طبقة المحتوى — لا ثوابت مكرّرة في الشيفرة.
const LIST_KEYS = [
  "applicant_role", "app_category", "competent_entity",
  "crime_type", "waqia", "protection_types", "duration",
];

export default async function Page() {
  const { user, roles } = await requireRole(ROLES, { denyPath: "/403" });
  const supabase = createServerClient();

  const [lists, inbox, sent, referred, holidays] = await Promise.all([
    getLists(supabase, LIST_KEYS),
    listInbox(),
    listSent(),
    // إحالات الفرز بانتظار توصية الجهة — قسم «الواردة» الثاني (قرار ٩).
    Promise.all(ENTS.map(async ([key, label]) => {
      const res = await listReferredForEntity(key);
      return res.ok ? res.rows.map((r) => ({ ...r, entKey: key, entName: label })) : [];
    })).then((xs) => xs.flat()),
    // التقويم الرسميّ — يُحقن في حاسبة أيام العمل قبل أول حساب مهلة
    getHolidays(),
  ]);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const me = {
    name: (meta.name as string) || (user.email ?? "").split("@")[0] || "منسوب الوحدة",
    role: roles.includes("intake_clerk" as AppRole)
      ? "موظف الاستقبال والإدخال"
      : roles.includes("hotline_operator" as AppRole)
        ? "مشغّل الخط الساخن"
        : "منسّق المركز",
    nid: (meta.national_id as string) || "",
  };

  return (
    <PaperIntakePortal
      me={me}
      lists={lists}
      inbox={inbox.rows}
      sent={sent.rows}
      awaiting={referred}
      holidays={holidays}
    />
  );
}
