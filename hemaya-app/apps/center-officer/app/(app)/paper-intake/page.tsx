import { requireRole } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { getLists } from "@hemaya/domain";
import type { AppRole } from "@hemaya/supabase";
import { PaperIntakePortal } from "@/components/PaperIntakePortal";
import { listInbox, listSent, listReferred, listUnclaimed } from "@/lib/paper-intake-actions";
import { getHolidays } from "@/lib/holidays";

export const dynamic = "force-dynamic";

// حارس الشاشة: منسوبو الوحدة وحدهم — مطابقٌ لـis_intake_staff في القاعدة.
const ROLES = ["intake_clerk", "case_officer", "hotline_operator"] as AppRole[];

// الجهات المختصّة ومسمّياتها: مصدرها الواحد components/intake/parts.jsx —
// كانت مكرّرةً هنا لحلقة النداءات الخمس، وقد سقطت الحلقة بنداء listReferred.

// بنود النماذج من طبقة المحتوى — لا ثوابت مكرّرة في الشيفرة.
const LIST_KEYS = [
  "applicant_role", "app_category", "competent_entity",
  "crime_type", "waqia", "protection_types", "duration",
];

export default async function Page() {
  const { user, roles } = await requireRole(ROLES, { denyPath: "/403" });
  const supabase = createServerClient();

  const [lists, inbox, sent, referred, unclaimed, holidays] = await Promise.all([
    getLists(supabase, LIST_KEYS),
    listInbox(),
    listSent(),
    // إحالات الفرز بانتظار توصية الجهة — قسم «الواردة» الثاني (قرار ٩).
    // نداءٌ واحد مُرقَّم بعد فجوة ٥ — كان خمسةً (واحداً لكلّ جهة) بلا حدٍّ ولا بحث.
    listReferred(),
    // الورقيّة التي لم تُضمّ لحساب صاحبها بعد — قسم «الواردة» الثالث (فجوة ٦).
    listUnclaimed(),
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
      sentTotal={sent.ok ? sent.total : 0}
      awaiting={referred.rows}
      awaitingTotal={referred.ok ? referred.total : 0}
      unclaimed={unclaimed.rows}
      holidays={holidays}
    />
  );
}
