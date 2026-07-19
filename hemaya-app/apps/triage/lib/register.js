// سجلّ الفرز — استعلامٌ وخريطة تحويلٍ واحدة يستعملها الخادم (data.ts)
// والعميل (تحديث Realtime) على السواء، تحت RLS نفسها.
import { businessDaysBetween } from "@hemaya/domain";

export const REGISTER_STATUSES = ["triage", "referred", "under_study", "closed"];

export const CASE_SELECT = `id, ref_no, secret_code, category, status, source, created_at,
  protection_requests(channel, details, submitted_at),
  recommendations(source_body, decision, received_at, channel, notes, raised_at, due_at),
  triage_reviews(decision, reason, authority, created_at),
  contact_logs(id, channel, result, summary, created_at)`;

const CAT_AR = { witness: "شاهد", reporter: "مبلّغ", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

export function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export function daysAgoLabel(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "اليوم";
  if (diff === 1) return "أمس";
  if (diff < 7) return `قبل ${diff} أيام`;
  if (diff < 14) return "قبل أسبوع";
  return "قبل أكثر من أسبوع";
}

const one = (v) => (Array.isArray(v) ? v[0] ?? null : v);
const many = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** صفوف Supabase → صيغة شاشات الفرز. دورة إعادة المعالجة: refer → ورود
 *  التوصية يعيد الحالة 'triage' (قرار ثانٍ) فتُعرض 'replied'. */
export function mapCases(rows, now = new Date()) {
  return (rows || []).map((c) => {
    const req = one(c.protection_requests);
    const details = (req && req.details) || {};
    const isPaper = req && req.channel === "paper";
    const recs = many(c.recommendations).sort((a, b) => (a.raised_at < b.raised_at ? 1 : -1));
    const rec = recs[0] || null;
    const reviews = many(c.triage_reviews).sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    const logs = many(c.contact_logs).sort((a, b) => (a.created_at > b.created_at ? 1 : -1));

    const uiStatus =
      c.status === "referred" ? "pending"
      : c.status === "under_study" ? "study"
      : c.status === "closed" ? "closed"
      : rec && rec.received_at ? "replied" : "triage";

    const sla = uiStatus === "pending" && rec
      ? { totalDays: 5, daysElapsed: businessDaysBetween(new Date(rec.raised_at), now) }
      : null;

    const reply = rec && rec.received_at
      ? {
          outcome: rec.decision === "توفير" ? "case" : "nocase",
          text: rec.notes || (rec.decision === "توفير"
            ? "توجد قضية جزائية قائمة، ونوصي بشمول الشخص بالحماية."
            : "لا توجد قضية قائمة لدى مقدّم الطلب وفق سجلّاتنا الحالية."),
          when: fmtDate(rec.received_at),
        }
      : null;

    const closeReview = [...reviews].reverse().find((r) => r.decision === "close");

    // الخط الزمني من الوقائع الفعلية (بطوابعها) — لا نصوص مُلفّقة
    const events = [{
      ts: c.created_at, icon: "inbox", t: "ورود الطلب",
      m: isPaper ? "أُدخل ورقياً عبر وحدة الإدخال اليدوي" : "عبر نفاذ — قائمة الفرز المشتركة", who: "النظام",
    }];
    for (const rv of reviews) {
      if (rv.decision === "refer") events.push({ ts: rv.created_at, icon: "send", t: "إحالة لجهة مختصة لطلب توصية", m: rv.authority || "الجهة المختصة", who: "موظف الفرز" });
      if (rv.decision === "study") events.push({ ts: rv.created_at, icon: "check_circle", t: "قبول وإسناد للدراسة والتقييم", m: rv.reason || "استوفى الشروط الشكلية والاختصاص", who: "موظف الفرز" });
      if (rv.decision === "close") events.push({ ts: rv.created_at, icon: "archive", t: "حفظ الطلب", m: rv.reason || "بسببٍ موثّق", who: "موظف الفرز" });
    }
    if (rec && rec.received_at)
      events.push({ ts: rec.received_at, icon: "mark_email_read", t: "ورود توصية الجهة", m: rec.decision === "توفير" ? "توجد قضية قائمة — توصية بالحماية" : "لا قضية قائمة", who: rec.source_body || "الجهة المختصة" });
    events.sort((a, b) => (a.ts > b.ts ? 1 : -1));

    return {
      real: true,
      caseId: c.id,
      secret: c.secret_code,
      ref: c.ref_no,
      cat: CAT_AR[c.category] || "شاهد",
      source: (details.paper_source === "entity") ? "جهة" : "ذاتي",
      status: uiStatus,
      clerk: "c1",
      days: daysAgoLabel(c.created_at),
      createdAt: c.created_at,
      prior: !!details.prior_submit,
      urgency: "عادي",
      paper: !!isPaper,
      crime: details.crime || "",
      city: details.city || "",
      reason: details.reason || "",
      entity: (rec && rec.source_body) || details.entity || "",
      caseNo: details.case_no || "",
      sla,
      reply,
      closeReason: closeReview ? closeReview.reason : undefined,
      actions: events.map((e) => ({ icon: e.icon, t: e.t, m: e.m, when: fmtDate(e.ts), who: e.who })),
      calls: logs.map((l) => ({
        date: fmtDate(l.created_at),
        channel: l.channel === "phone" ? "phone" : "platform",
        result: l.result || "answered",
        note: l.summary === "—" ? "" : l.summary,
        by: "موظف الفرز",
        real: true,
      })),
    };
  });
}

/** جلب السجلّ (يصلح للخادم والعميل — RLS واحدة). */
export async function fetchRegister(supabase, now = new Date()) {
  const { data } = await supabase
    .from("protection_cases")
    .select(CASE_SELECT)
    .in("status", REGISTER_STATUSES)
    .order("created_at", { ascending: false });
  return mapCases(data || [], now);
}
