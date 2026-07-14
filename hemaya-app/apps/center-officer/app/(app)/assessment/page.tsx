import { requireRole } from "@hemaya/auth";
import { createServerClient } from "@hemaya/supabase";
import { StudyEvalPortal } from "@/components/StudyEvalPortal";
export const dynamic = "force-dynamic";

const CAT_AR: Record<string, string> = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

export default async function Page() {
  await requireRole("evaluator" as any, { denyPath: "/403" });

  // حالات التقييم الفعليّة (RLS: studier_under_study يشمل evaluator — status='under_study').
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: cases }, { data: mine }] = await Promise.all([
    supabase.from("protection_cases")
      .select("id, secret_code, category, source, created_at, protection_requests(details, applicant_role)")
      .eq("status", "under_study").order("created_at", { ascending: false }),
    supabase.from("assessments").select("case_id").eq("evaluator_id", user?.id ?? ""),
  ]);
  const done = new Set((mine ?? []).map((m: any) => m.case_id));

  const initialRows = (cases ?? []).map((c: any) => {
    const req = Array.isArray(c.protection_requests) ? c.protection_requests[0] : c.protection_requests;
    const d = (req?.details ?? {}) as Record<string, any>;
    return {
      real: true, caseId: c.id, secret: c.secret_code,
      cat: CAT_AR[c.category] || "شاهد",
      track: c.source === "foreign" ? "أجنبي" : "عادي",
      due: "متبقٍّ يوم عمل",
      status: done.has(c.id) ? "done" : "new",
      peers: 2,
      // بيانات الحالة الحقيقيّة الموروثة من الطلب (تُعرض في «معلومات الحالة» للقراءة).
      detail: {
        entity: d.entity || "—",
        crime: d.crime || "—",
        reason: d.reason || "",
        caseNo: d.case_no || "—",
        priorSubmit: !!d.prior_submit,
        applicantRole: req?.applicant_role || "—",
        recommendation: d.recommendation || null,
        createdAt: c.created_at,
        assess: d.assess || null,   // التقييم المهيكل (نوع الخطر/مستواه/الضرر…) إن وُجد
        rec: d.rec || null,         // تفاصيل توصية الجهة (الأنواع/المدة/الأسباب) إن وُجدت
      },
    };
  });

  return <StudyEvalPortal role="evaluator" initialRows={initialRows} />;
}
