// جلب بيانات بوابة الفرز (خادمياً تحت RLS): دور المستخدم يحسم إعداد البوابة
// (موظف فرز يقرّر / قيادة viewOnly)، والقضايا من طابور الفرز المشترك.
import { createServerClient, GATEWAY_URL } from "@hemaya/supabase";
import { redirect } from "next/navigation";

// enum app_category → الفئة العربية المعروضة في البوابة
const CAT_AR: Record<string, string> = {
  witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function daysAgo(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - then) / 86400000);
  if (diff <= 0) return "اليوم";
  if (diff === 1) return "أمس";
  if (diff < 7) return `قبل ${diff} أيام`;
  if (diff < 14) return "قبل أسبوع";
  return "قبل أكثر من أسبوع";
}

export async function getTriageData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(GATEWAY_URL);

  const [rolesQ, casesQ, prefsQ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    // القضايا الفعليّة في طابور الفرز (RLS: co_triage_inbox — case_officer + status='triage')
    supabase
      .from("protection_cases")
      .select("id, ref_no, secret_code, category, status, source, created_at, protection_requests(channel, details)")
      .eq("status", "triage")
      .order("created_at", { ascending: false }),
    supabase.from("user_prefs").select("prefs").eq("user_id", user.id).maybeSingle(),
  ]);

  const roles = (rolesQ.data ?? []).map((r) => r.role as string);
  const roleKey = roles.includes("deputy_chair") || roles.includes("board_chair") ? "triage-lead" : "triage";

  const initialRows = (casesQ.data ?? []).map((c: any) => {
    const req = Array.isArray(c.protection_requests) ? c.protection_requests[0] : c.protection_requests;
    const details = (req?.details ?? {}) as Record<string, any>;
    const isPaper = req?.channel === "paper";
    const paperSrc = details.paper_source; // 'seeker' | 'entity'
    return {
      real: true,
      caseId: c.id,
      secret: c.secret_code,
      ref: c.ref_no,
      cat: CAT_AR[c.category] || "شاهد",
      source: paperSrc === "entity" ? "جهة" : "ذاتي",
      status: "triage",
      clerk: "c1",
      days: daysAgo(c.created_at),
      createdAt: c.created_at,
      prior: !!details.prior_submit,
      urgency: "عادي",
      paper: isPaper,
      crime: details.crime || "",
      reason: details.reason || "",
      entity: details.entity || "",
      caseNo: details.case_no || "",
      actions: [{ icon: "inbox", t: "ورود الطلب", m: isPaper ? "أُدخل ورقياً عبر وحدة الإدخال اليدوي" : "عبر نفاذ — قائمة الفرز المشتركة", when: fmtDate(c.created_at), who: "النظام" }],
      calls: [],
    };
  });

  return {
    roleKey,
    me: {
      id: user.id,
      name: String((user.user_metadata as Record<string, unknown>)?.name ?? "—"),
    },
    initialRows,
    prefs: (prefsQ.data?.prefs ?? {}) as Record<string, unknown>,
  };
}
