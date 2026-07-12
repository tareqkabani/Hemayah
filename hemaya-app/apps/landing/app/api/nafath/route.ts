import { NextResponse } from "next/server";
import { getNafath } from "@hemaya/auth";
import { createServiceClient, createServerClient } from "@hemaya/supabase";

// جسر الدخول الموحّد عبر نفاذ (mock) — يُنشئ جلسة Supabase حقيقيّة على localhost
// (الكوكي مشتركةٌ بين منافذ التطوير) فتقبلها البوّابة الوجهة دون طلب دخولٍ ثانٍ.
// خريطة الهوية→الدور نموذجٌ تجريبيّ يُستبدل بـRBAC من القاعدة في الإنتاج.

const DEV_PASSWORD = "nafath-staff-2026";
const emailFor = (nid: string) => `${nid}@nafath.local`;

// المسارات موحّدة خلف منفذ الشاشة الموحّدة (Multi-Zones) — التحويل نسبيّ فيصحّ محلياً وفي الإنتاج
const ORIGIN = {
  seeker: "/seeker",
  center: "/center",
  competent: "/entities",
  ag: "/ag",
  technical: "/technical",
  health: "/health",
  hr: "/hr",
  interior: "/interior",
  security: "/security",
};

type Spec = { role: string; portal: string; label: string; attrs?: Record<string, unknown> };
const DEMO: Record<string, Spec> = {
  "1000000001": { role: "subject", portal: ORIGIN.seeker, label: "طالب الحماية" },
  "2000000001": { role: "hotline_operator", portal: ORIGIN.center + "/paper-intake", label: "الاستقبال الورقيّ" },
  "2000000002": { role: "case_officer", portal: ORIGIN.center + "/triage", label: "الفرز المبدئي" },
  "2000000003": { role: "studier", portal: ORIGIN.center + "/study", label: "الدراسة — الدارس" },
  "2000000004": { role: "evaluator", portal: ORIGIN.center + "/assessment", label: "التقييم — المقيّم" },
  "2000000005": { role: "case_officer", portal: ORIGIN.center + "/decision", label: "إعداد القرار" },
  "2000000006": { role: "board_member", portal: ORIGIN.center + "/decision-vote", label: "أعضاء المجلس" },
  "2000000007": { role: "case_officer", portal: ORIGIN.center + "/execution", label: "التنفيذ والتجديد" },
  "2000000008": { role: "board_chair", portal: ORIGIN.center + "/oversight", label: "قيادة المركز — الرئيس" },
  "2000000009": { role: "deputy_chair", portal: ORIGIN.center + "/oversight-deputy", label: "قيادة المركز — النائب" },
  "2000000061": { role: "board_member", portal: ORIGIN.center + "/decision-vote", label: "أعضاء المجلس" },
  "2000000062": { role: "board_member", portal: ORIGIN.center + "/decision-vote", label: "أعضاء المجلس" },
  "2000000063": { role: "board_member", portal: ORIGIN.center + "/decision-vote", label: "أعضاء المجلس" },
  "2000000064": { role: "board_member", portal: ORIGIN.center + "/decision-vote", label: "أعضاء المجلس" },
  "3000000001": { role: "competent_body", portal: ORIGIN.competent, label: "الجهات المختصة", attrs: { authority: "competent" } },
  "3000000002": { role: "moh_specialist", portal: ORIGIN.health, label: "وزارة الصحة", attrs: { authority: "health" } },
  "3000000003": { role: "hr_specialist", portal: ORIGIN.hr, label: "الموارد البشرية", attrs: { authority: "hr" } },
  "3000000004": { role: "security_manager", portal: ORIGIN.security, label: "الإدارة الأمنية", attrs: { authority: "security" } },
  "3000000005": { role: "moi_officer", portal: ORIGIN.interior, label: "وزارة الداخلية", attrs: { authority: "moi" } },
  "4000000001": { role: "prosecutor_general", portal: ORIGIN.ag, label: "النائب العام" },
  "5000000001": { role: "advisor", portal: ORIGIN.technical, label: "المستشارون", attrs: { advisor: "a1" } },
  "5000000002": { role: "tech_manager", portal: ORIGIN.technical, label: "مدير المكتب الفني" },
};
const DEFAULT: Spec = { role: "subject", portal: ORIGIN.seeker, label: "طالب الحماية" };

// توجيه احتياطي بالدور الحقيقي: هوية خارج DEMO لمستخدمٍ قائمٍ تُوجَّه ببوابة دوره
// المخزّن في user_roles بدل زرع دور subject دخيل له. (بلا attrs كي لا تُمسّ سماته الفعلية)
const ROLE_PORTAL: Record<string, Omit<Spec, "role">> = {
  subject: { portal: ORIGIN.seeker, label: "طالب الحماية" },
  hotline_operator: { portal: ORIGIN.center + "/paper-intake", label: "الاستقبال الورقيّ" },
  case_officer: { portal: ORIGIN.center + "/triage", label: "موظف المركز" },
  studier: { portal: ORIGIN.center + "/study", label: "الدراسة — الدارس" },
  evaluator: { portal: ORIGIN.center + "/assessment", label: "التقييم — المقيّم" },
  board_member: { portal: ORIGIN.center + "/decision-vote", label: "أعضاء المجلس" },
  board_chair: { portal: ORIGIN.center + "/oversight", label: "قيادة المركز — الرئيس" },
  deputy_chair: { portal: ORIGIN.center + "/oversight-deputy", label: "قيادة المركز — النائب" },
  competent_body: { portal: ORIGIN.competent, label: "الجهات المختصة" },
  moh_specialist: { portal: ORIGIN.health, label: "وزارة الصحة" },
  hr_specialist: { portal: ORIGIN.hr, label: "الموارد البشرية" },
  security_manager: { portal: ORIGIN.security, label: "الإدارة الأمنية" },
  moi_officer: { portal: ORIGIN.interior, label: "وزارة الداخلية" },
  prosecutor_general: { portal: ORIGIN.ag, label: "النائب العام" },
  advisor: { portal: ORIGIN.technical, label: "المستشارون" },
  tech_manager: { portal: ORIGIN.technical, label: "مدير المكتب الفني" },
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const nid = String(body?.nationalId ?? "").trim();
  if (!/^\d{10}$/.test(nid)) {
    return NextResponse.json({ ok: false, error: "رقم الهوية يجب أن يكون 10 أرقام." }, { status: 400 });
  }
  let spec = DEMO[nid];
  const email = emailFor(nid);

  try {
    // 1) نفاذ (mock): الهوية
    const { sessionId } = await getNafath().login(nid);
    const identity = await getNafath().poll(sessionId);

    // 2) تهيئة المستخدم + دوره عبر service role (بذرة تجريبيّة؛ RBAC حقيقي في الإنتاج)
    const admin = createServiceClient();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { name: identity?.name, national_id: nid, source: "nafath-gateway" },
    });
    let userId = created?.user?.id;
    if (cErr) {
      if (!/already|exist|registered/i.test(cErr.message)) {
        return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
      }
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users?.find((u) => u.email === email)?.id;
    }
    if (userId) {
      if (!spec) {
        // هوية خارج DEMO: افحص الأدوار القائمة أولاً ووجّه بالدور الحقيقي دون أي زرع
        const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
        const real = roles?.map((r) => (r as { role: string }).role).find((role) => ROLE_PORTAL[role]);
        if (real) spec = { role: real, ...ROLE_PORTAL[real] };
      }
      spec ??= DEFAULT;
      const { data: existing } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", spec.role as never)
        .maybeSingle();
      if (!existing) {
        await admin.from("user_roles").insert({ user_id: userId, role: spec.role as never, attributes: spec.attrs ?? {} } as never);
      } else if (spec.attrs) {
        await admin.from("user_roles").update({ attributes: spec.attrs } as never).eq("user_id", userId).eq("role", spec.role as never);
      }
    }
    spec ??= DEFAULT;

    // 3) تسجيل الدخول — يضبط كوكي جلسة Supabase على localhost (مشتركة بين المنافذ)
    const supabase = createServerClient();
    const { error: sErr } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD });
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, portal: spec.portal, role: spec.role, label: spec.label });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "تعذّر الدخول عبر نفاذ." }, { status: 500 });
  }
}
