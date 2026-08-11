import { NextResponse } from "next/server";
import { getNafath, bridgePassword } from "@hemaya/auth";
import { createServiceClient, createServerClient } from "@hemaya/supabase";
import { PAPER_INTAKE_LABEL } from "@hemaya/domain";

// جسر الدخول الموحّد عبر نفاذ (mock) — يُنشئ جلسة Supabase حقيقيّة على localhost
// (الكوكي مشتركةٌ بين منافذ التطوير) فتقبلها البوّابة الوجهة دون طلب دخولٍ ثانٍ.
// خريطة الهوية→الدور نموذجٌ تجريبيّ يُستبدل بـRBAC من القاعدة في الإنتاج.

// كلمة الجسر من مصدرٍ واحد يرفض الافتراضيّ في الإنتاج (@hemaya/auth).
// كسولةٌ عمداً: نداءٌ بمستوى الوحدة يُنفَّذ أثناء next build (جمع بيانات الصفحات
// وNODE_ENV=production بلا أسرار وقت بناء الصورة) فيُسقط بناء الـstack — الحارس
// يظلّ فاعلاً عند أول طلبٍ فعليّ، وهو مقصد #42 (رفض الخدمة لا رفض البناء).
let _pw: string | null = null;
const DEV_PASSWORD = () => (_pw ??= bridgePassword());
const emailFor = (nid: string) => `${nid}@nafath.local`;

// المسارات موحّدة خلف منفذ الشاشة الموحّدة (Multi-Zones) — التحويل نسبيّ فيصحّ محلياً وفي الإنتاج
const ORIGIN = {
  seeker: "/seeker",
  center: "/center",
  triage: "/triage",
  decision: "/decision",
  studier: "/studier",
  evaluator: "/evaluator",
  competent: "/entities",
  ag: "/ag",
  technical: "/technical",
  health: "/health",
  hr: "/hr",
  interior: "/interior",
  security: "/security",
  admin: "/admin",
};

type Spec = { role: string; portal: string; label: string; attrs?: Record<string, unknown> };
const DEMO: Record<string, Spec> = {
  "1000000001": { role: "subject", portal: ORIGIN.seeker, label: "طالب الحماية" },
  "2000000001": { role: "hotline_operator", portal: ORIGIN.center + "/paper-intake", label: PAPER_INTAKE_LABEL },
  "2000000002": { role: "case_officer", portal: ORIGIN.triage, label: "الفرز المبدئي" },
  "2000000003": { role: "studier", portal: ORIGIN.studier, label: "الدراسة — الدارس" },
  "2000000004": { role: "evaluator", portal: ORIGIN.evaluator, label: "التقييم — المقيّم" },
  "2000000005": { role: "case_officer", portal: ORIGIN.decision, label: "إعداد القرار" },
  "2000000006": { role: "board_member", portal: ORIGIN.decision + "/decision-vote", label: "أعضاء المجلس" },
  "2000000007": { role: "case_officer", portal: ORIGIN.center + "/execution", label: "التنفيذ والتجديد" },
  "2000000008": { role: "board_chair", portal: ORIGIN.center + "/oversight", label: "قيادة المركز — الرئيس" },
  "2000000009": { role: "deputy_chair", portal: ORIGIN.center + "/oversight-deputy", label: "قيادة المركز — النائب" },
  "2000000061": { role: "board_member", portal: ORIGIN.decision + "/decision-vote", label: "أعضاء المجلس" },
  "2000000062": { role: "board_member", portal: ORIGIN.decision + "/decision-vote", label: "أعضاء المجلس" },
  "2000000063": { role: "board_member", portal: ORIGIN.decision + "/decision-vote", label: "أعضاء المجلس" },
  "2000000064": { role: "board_member", portal: ORIGIN.decision + "/decision-vote", label: "أعضاء المجلس" },
  // سمات الجهة يقرؤها RLS: entity لدوال cb_entity، وlevel لسياسات clerk/head/hq —
  // وbranch_id يُحلّ عند الدخول من جدول branches (انظر ensureCompetentBranch أدناه)
  "3000000001": { role: "competent_body", portal: ORIGIN.competent, label: "الجهات المختصة", attrs: { authority: "competent", entity: "prosecution", level: "clerk" } },
  // رئيس الفرع: هويةٌ مستقلّة لأن الاعتماد صلاحيةٌ لا عرضاً — decide_recommendation_approval
  // تشترط cb_level()='head'، وسلسلةُ الاعتماد بلا فاعلٍ ثانٍ تبقى حبراً.
  "3000000006": { role: "competent_body", portal: ORIGIN.competent, label: "الجهات المختصة — رئيس الفرع", attrs: { authority: "competent", entity: "prosecution", level: "head" } },
  "3000000007": { role: "competent_body", portal: ORIGIN.competent, label: "الجهات المختصة — المقر", attrs: { authority: "competent", entity: "prosecution", level: "hq" } },
  "3000000002": { role: "moh_specialist", portal: ORIGIN.health, label: "وزارة الصحة", attrs: { authority: "health" } },
  "3000000003": { role: "hr_specialist", portal: ORIGIN.hr, label: "الموارد البشرية", attrs: { authority: "hr" } },
  "3000000004": { role: "security_manager", portal: ORIGIN.security, label: "الإدارة الأمنية", attrs: { authority: "security" } },
  "3000000005": { role: "moi_officer", portal: ORIGIN.interior, label: "وزارة الداخلية", attrs: { authority: "moi" } },
  "4000000001": { role: "prosecutor_general", portal: ORIGIN.ag, label: "النائب العام" },
  "5000000001": { role: "advisor", portal: ORIGIN.technical, label: "المستشارون", attrs: { advisor: "a1", spec: "قانوني" } },
  "5000000002": { role: "tech_manager", portal: ORIGIN.technical, label: "مدير المكتب الفني" },
  "5000000003": { role: "advisor", portal: ORIGIN.technical, label: "المستشارون", attrs: { advisor: "a2", spec: "أمني" } },
  "5000000004": { role: "advisor", portal: ORIGIN.technical, label: "المستشارون", attrs: { advisor: "a3", spec: "نفسي/اجتماعي" } },
  "9000000001": { role: "sysadmin", portal: ORIGIN.admin, label: "مدير النظام" },
};
const DEFAULT: Spec = { role: "subject", portal: ORIGIN.seeker, label: "طالب الحماية" };

// توجيه احتياطي بالدور الحقيقي: هوية خارج DEMO لمستخدمٍ قائمٍ تُوجَّه ببوابة دوره
// المخزّن في user_roles بدل زرع دور subject دخيل له. (بلا attrs كي لا تُمسّ سماته الفعلية)
const ROLE_PORTAL: Record<string, Omit<Spec, "role">> = {
  subject: { portal: ORIGIN.seeker, label: "طالب الحماية" },
  hotline_operator: { portal: ORIGIN.center + "/paper-intake", label: PAPER_INTAKE_LABEL },
  case_officer: { portal: ORIGIN.triage, label: "موظف المركز" },
  studier: { portal: ORIGIN.studier, label: "الدراسة — الدارس" },
  evaluator: { portal: ORIGIN.evaluator, label: "التقييم — المقيّم" },
  board_member: { portal: ORIGIN.decision + "/decision-vote", label: "أعضاء المجلس" },
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
  sysadmin: { portal: ORIGIN.admin, label: "مدير النظام" },
};

// حساب الجهة المختصة بلا branch_id لا يرى شيئاً — كل سياسات RLS على
// recommendations موجَّهة بالفرع (cb_branch / cb_entity_branches). نُكمل
// السمة من جدول branches عند الدخول (فرع الرياض إن وُجد، وإلا أول فرع للجهة).
async function ensureCompetentBranch(admin: ReturnType<typeof createServiceClient>, userId: string) {
  const { data: roleRow } = await admin
    .from("user_roles").select("attributes")
    .eq("user_id", userId).eq("role", "competent_body" as never)
    .maybeSingle();
  const attrs = ((roleRow as { attributes?: Record<string, unknown> } | null)?.attributes ?? {}) as Record<string, unknown>;
  if (attrs.branch_id) return;
  // المقر لا يُنسَب لفرع: إشرافه يمرّ من cb_entity_branches لا cb_branch،
  // ونسبتُه لفرعٍ تجعله يبدو منسوباً إليه في شاشات العزل.
  if (attrs.level === "hq") return;
  const entity = (attrs.entity as string) || "prosecution";
  const { data: branches } = await admin
    .from("branches").select("id, region")
    .eq("entity", entity as never);
  const branch = branches?.find((b) => (b as { region: string }).region === "RUH") ?? branches?.[0];
  if (!branch) return; // لا فروع مزروعة لهذه الجهة — تُترك السمة ويكشفها الفحص لاحقاً
  await admin
    .from("user_roles")
    .update({ attributes: { ...attrs, branch_id: (branch as { id: string }).id } } as never)
    .eq("user_id", userId).eq("role", "competent_body" as never);
}

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
      password: DEV_PASSWORD(),
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
      if (spec.role === "competent_body") await ensureCompetentBranch(admin, userId);
      // طالب حماية وثّق هويته الآن عبر نفاذ: ضُمّ إليه حالاته الورقية غير المملوكة
      // (المُدخلة بوحدة الاستقبال بهويةٍ غير موثّقة) — وعد «تُفعَّل عبر نفاذ لاحقاً».
      if (spec.role === "subject") {
        const { error: clErr } = await admin.rpc("claim_paper_cases" as never, { _user_id: userId, _nid: nid } as never);
        if (clErr) console.error("claim_paper_cases:", clErr.message);
      }
    }
    spec ??= DEFAULT;

    // 3) تسجيل الدخول — يضبط كوكي جلسة Supabase على localhost (مشتركة بين المنافذ)
    const supabase = createServerClient();
    let { error: sErr } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD() });
    // معالجة ذاتية: حساب مزروع/قديم بكلمة جسر مختلفة (مثل بذور nafath-staff-2026
    // مع NAFATH_BRIDGE_PASSWORD مخصّصة) — نوحّد كلمته ثم نعيد المحاولة مرة واحدة
    if (sErr && /invalid login credentials/i.test(sErr.message) && userId) {
      await admin.auth.admin.updateUserById(userId, { password: DEV_PASSWORD() });
      ({ error: sErr } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD() }));
    }
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, portal: spec.portal, role: spec.role, label: spec.label });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "تعذّر الدخول عبر نفاذ." }, { status: 500 });
  }
}
