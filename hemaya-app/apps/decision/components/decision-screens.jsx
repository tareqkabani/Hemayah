'use client';
/* ============================================================
   مكوّنات عرض مرحلة القرار والإشعار — تحديث 15 يوليو 2026.
   منقولة من design decision-portal.jsx مع وصلها بالمخزن الحقيقي:
   حزمة الاطّلاع من HD.getPackage، المرفقات الداعمة (اختيارية) من
   HD.getAttachments مع رفعٍ حقيقيّ إلى Supabase Storage (decision-docs).
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { Card, Tag, InlineAlert, DeadlineTimer } from "@hemaya/ui";
import { createClient } from "@hemaya/supabase/src/browser";
import { HemayaDecision } from "./decision-store";
import { FoundLine } from "./FoundLine";

const HD = HemayaDecision;

export const DScreens = (function () {
  const SEATS = HD.SEATS, PREPARERS = HD.PREPARERS, VOTING_SEATS = HD.VOTING_SEATS, MAJORITY = HD.MAJORITY;

  const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
    <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
  );

  // آلة الحالة الخمسية: preparing → pending_deputy → approved → voting → issued
  const STATUS = {
    preparing:      { t: "قيد إعداد القرار",           tone: "neutral", icon: "edit_note" },
    pending_deputy: { t: "بانتظار اعتماد النائب",       tone: "warning", icon: "approval" },
    pending_chair:  { t: "بانتظار اعتماد الرئيس",       tone: "warning", icon: "workspace_premium" },
    approved:       { t: "معتمَد — بانتظار الطرح",      tone: "info",    icon: "task_alt" },
    voting:         { t: "مطروح للتصويت",               tone: "info",    icon: "how_to_vote" },
    issued:         { t: "صدر القرار",                  tone: "success", icon: "verified" },
  };
  const identOf = (scope, id) => (scope === "preparer" ? PREPARERS[id] : SEATS[id]) || PREPARERS.prep1 || { name: "—", t: "", org: "" };
  const seatsOf = (scope) => scope === "preparer" ? Object.keys(PREPARERS) : scope === "leadership" ? ["deputy", "chair"] : HD.MEMBER_SEATS;

  function useStore() { const [, f] = useState(0); useEffect(() => HD.subscribe(() => f((n) => n + 1)), []); }

  // ————— أدوات الزمن: تجميع اليوم/أمس/الأقدم + أيام العمل (الأحد–الخميس) للمُهل الحيّة —————
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  function dayGroup(ts) {
    if (!ts) return "الأقدم";
    const d = new Date(ts); if (isNaN(d)) return "الأقدم";
    const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
    return diff <= 0 ? "اليوم" : diff === 1 ? "أمس" : "الأقدم";
  }
  function bizDaysSince(ts) {
    if (!ts) return 0;
    const d = new Date(ts); if (isNaN(d)) return 0;
    let n = 0; const cur = new Date(dayStart(d)); const end = dayStart(new Date());
    while (cur.getTime() < end) { cur.setDate(cur.getDate() + 1); const wd = cur.getDay(); if (wd !== 5 && wd !== 6) n++; }
    return n;
  }

  // رمز سري مقنّع مع كشف مؤقت (يُخفى آلياً بعد 6 ثوانٍ) — للشريط العلوي
  function SecretChip({ code }) {
    const [show, setShow] = useState(false);
    useEffect(() => { if (show) { const tm = setTimeout(() => setShow(false), 6000); return () => clearTimeout(tm); } }, [show]);
    return (
      <span className="sec-chip" title="الرمز السري للطلب المفتوح — يحلّ محل هوية طالب الحماية. يُخفى آلياً بعد ثوانٍ من الكشف.">
        <I name="lock" size={13} color="var(--color-error)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-error)" }}>سري</span>
        <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)", minWidth: 86, textAlign: "center" }} dir="ltr">{show ? code : "••••••••••"}</span>
        <button className="sec-eye" onClick={() => setShow(!show)} aria-label={show ? "إخفاء الرمز" : "كشف الرمز مؤقتاً"}><I name={show ? "visibility_off" : "visibility"} size={16} /></button>
      </span>
    );
  }

  const Timer = ({ startTs }) => <DeadlineTimer label="مهلة التصويت — يوم عمل واحد" totalDays={1} daysElapsed={bizDaysSince(startTs)} articleRef="المادة 10" />;

  // ————— مرفقات داعمة (اختيارية) — رفعٌ حقيقيّ للمعدّ / معاينة موقَّعة للمجلس —————
  const ATT_GROUPS = [
    ["طلب الحماية", "assignment_ind", "request"],
    ["توصية الجهة المختصة", "recommend", "entityRec"],
    ["الدراسات", "balance", "study"],
    ["التقييمات", "psychology", "assessment"],
    ["قرار المركز المُعَدّ", "gavel", "decision"],
    ["مستندات داعمة", "attach_file", "other"],
  ];
  const groupIcon = (g) => (ATT_GROUPS.find((x) => x[2] === g) || ATT_GROUPS[5])[1];

  function AttachmentsPanel({ secret, editable, onView, viewed }) {
    const docs = HD.getAttachments(secret);
    const caseId = HD.caseIdOf(secret);
    const supabase = useRef(createClient()).current;
    const [customLbl, setCustomLbl] = useState("");
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(null);      // docId قيد الرفع ("+" للمرفق الجديد)
    const [err, setErr] = useState("");
    const [signed, setSigned] = useState(null);  // { url } للمعاينة الموقَّعة
    const seen = viewed || [];

    // مفتاح التخزين ASCII فقط (Supabase Storage يرفض المفاتيح غير اللاتينية) — الاسم العربيّ يُحفظ للعرض
    const upload = async (docId, group, label, f) => {
      if (!f || !caseId) return;
      const ext = ((f.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin").slice(0, 8);
      const path = `${caseId}/${docId}-${Date.now()}.${ext}`;
      setBusy(docId); setErr("");
      const { error } = await supabase.storage.from("decision-docs").upload(path, f, { upsert: true });
      setBusy(null);
      if (error) { setErr("تعذّر رفع الملف: " + error.message); return; }
      HD.setFile(secret, docId, group, label, f.name, path);
    };
    const onReplace = (doc, e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) upload(doc.id, doc.group, doc.label, f); };
    const onAdd = (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      const docId = "doc-" + Date.now();
      const label = customLbl.trim() || f.name;
      upload(docId, "other", label, f).then(() => setCustomLbl(""));
    };
    const openPreview = async (doc) => {
      setPreview(doc); setSigned(null); if (onView) onView(doc.id);
      if (doc.storagePath) {
        const { data } = await supabase.storage.from("decision-docs").createSignedUrl(doc.storagePath, 300);
        if (data && data.signedUrl) setSigned({ url: data.signedUrl });
      }
    };

    const row = (doc) => (
      <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", border: "1px solid var(--border-subtle)", borderInlineStart: "4px solid var(--color-primary)", borderRadius: "var(--radius-md)", background: "var(--surface-card)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--green-10)", color: "var(--color-primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><I name={groupIcon(doc.group)} size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}>{doc.label}</div>
          <div className="row" style={{ gap: 6, marginTop: 3 }}><I name="description" size={14} color="var(--color-primary)" /><span className="mono" style={{ fontSize: 12, color: "var(--text-body)" }}>{doc.fileName}</span>{doc.when && <span className="muted" style={{ fontSize: 11 }}>· {doc.when}</span>}</div>
        </div>
        {editable ? <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <label className="chip on" style={{ cursor: busy ? "wait" : "pointer", margin: 0 }}><I name={busy === doc.id ? "hourglass_top" : "autorenew"} size={15} /> استبدال<input type="file" style={{ display: "none" }} disabled={!!busy} onChange={(e) => onReplace(doc, e)} /></label>
          <button className="chip" style={{ padding: "8px 10px" }} title="إزالة" onClick={() => HD.setFile(secret, doc.id, doc.group, doc.label, null, null)}><I name="close" size={15} /></button>
        </div> : <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <button className={"chip" + (seen.indexOf(doc.id) >= 0 ? " on" : "")} style={{ margin: 0 }} onClick={() => openPreview(doc)}><I name="visibility" size={15} /> معاينة</button>
          {seen.indexOf(doc.id) >= 0 && <I name="check_circle" size={20} fill color="var(--color-success)" title="تمّت المعاينة" />}
        </div>}
      </div>
    );

    return (<div>
      <p className="sec-h" style={{ margin: "18px 0 10px" }}><I name="attach_file" size={18} color="var(--color-primary)" /> مرفقات داعمة <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>(اختيارية — مستندات مساندة للحزمة)</span></p>
      <div className="pkg-bar"><I name="attachment" size={16} /><span>مستندات داعمة يرفعها المعدّ إلى مستودعٍ آمن كما وردت بلا انتقاء — وكل إضافة/إزالة/اطّلاع مُسجَّل في التدقيق (م15/16).</span></div>
      {err && <InlineAlert kind="error" title="خطأ في الرفع" style={{ marginBottom: 12 }}>{err}</InlineAlert>}
      {ATT_GROUPS.map(([label, ic, grp]) => { const arr = docs.filter((x) => (x.group || "other") === grp); return arr.length ? (
        <div key={grp} style={{ marginTop: 14 }}>
          <p className="sec-h" style={{ margin: "0 0 8px", fontSize: 13 }}><I name={ic} size={16} color="var(--text-secondary)" /> {label}</p>
          <div style={{ display: "grid", gap: 8 }}>{arr.map(row)}</div>
        </div>) : null; })}
      {docs.length === 0 && !editable && <div className="muted" style={{ fontSize: 12.5 }}>لا مرفقات داعمة لهذا الطلب.</div>}
      {editable && <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <input value={customLbl} onChange={(e) => setCustomLbl(e.target.value)} placeholder="اسم المستند الداعم (اختياري — يُؤخذ اسم الملف إن تُرك)…" dir="auto" style={{ flex: 1 }} />
        <label className="btn btn-ghost" style={{ cursor: busy ? "wait" : "pointer" }}><I name={busy === null ? "upload_file" : "hourglass_top"} size={17} /> إضافة مرفق<input type="file" style={{ display: "none" }} disabled={!!busy} onChange={onAdd} /></label>
      </div>}
      {preview && <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,0.55)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-card)", borderRadius: "var(--radius-lg)", maxWidth: 620, width: "100%", maxHeight: "86vh", overflow: "auto", boxShadow: "var(--shadow-xl)" }}>
          <div className="row" style={{ gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-subtle)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--green-10)", color: "var(--color-primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><I name={groupIcon(preview.group)} size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{preview.label}</div><div className="mono muted" style={{ fontSize: 11.5 }}>{preview.fileName}</div></div>
            <button className="chip" style={{ margin: 0 }} onClick={() => setPreview(null)}><I name="close" size={16} /> إغلاق</button>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-page)", minHeight: 300, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
              <div><I name="picture_as_pdf" size={54} color="var(--color-primary)" /><div style={{ fontWeight: 700, color: "var(--text-strong)", marginTop: 10 }}>{preview.fileName}</div>
                {signed ? <a className="btn btn-primary" href={signed.url} target="_blank" rel="noreferrer" style={{ marginTop: 14, textDecoration: "none" }}><I name="open_in_new" size={17} /> فتح الملف المرفوع</a>
                  : <div className="muted" style={{ fontSize: 12.5, marginTop: 6, maxWidth: 360 }}>{preview.storagePath ? "جارٍ تجهيز رابط الاطّلاع الآمن…" : "معاينة المستند — الاطّلاع مُسجَّل في التدقيق (م15/16)."}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>}
    </div>);
  }

  // ————— حزمة الاطّلاع الحقيقية (من HD.getPackage) — حزمة 11: أربع مجموعات بطاقات قابلة للطي —————
  const recToneOf = (rec, partial) => {
    const r = String(rec || "");
    if (/رفض|deny|reject/i.test(r)) return "error";
    if (partial || /جزئ|partial/i.test(r)) return "warning";
    if (!r || r === "—") return "neutral";
    return "success";
  };

  // خريطة الحقول المعروضة ← أعمدتها (مرجع تطويري — لا يُعرض في الواجهة إطلاقاً).
  // حقول النموذجين تعيش في details jsonb وتكتبها RPCs حيّة، فمسارها details→key.
  const FIELD_COL = {
    "الجنس": "subjects.gender", "الجنسية": "subjects.nationality", "تاريخ الميلاد": "subjects.birth_date",
    "الحالة الاجتماعية": "subjects.marital_status", "المستوى التعليمي": "subjects.education_level",
    "العنوان المختصر": "subjects.national_address→short", "رقم المبنى": "subjects.national_address→building",
    "الشارع": "subjects.national_address→street", "الرقم الفرعي": "subjects.national_address→secondary",
    "الحي": "subjects.national_address→district", "الرمز البريدي": "subjects.national_address→postal", "المدينة": "subjects.national_address→city",
    "جهة العمل": "subjects.employer", "المسمى الوظيفي": "subjects.job_title",
    "صلة القرابة": "emergency_contacts.relationship", "الاسم (جهة الطوارئ)": "emergency_contacts.name_enc", "رقم الجوال (جهة الطوارئ)": "emergency_contacts.phone_enc",
    "صفة مقدم الطلب": "protection_requests.details→role", "دور طالب الحماية في القضية": "protection_cases.category",
    "قناة الورود": "protection_requests.channel", "نوع الجريمة محل القضية": "protection_requests.details→crime",
    "الجهة المختصة (بحسب الطلب)": "protection_requests.details→entity",
    "هل سبق التقديم للجهة المختصة؟": "protection_requests.details→prior_submit", "رقم القضية (إن وجد)": "protection_requests.details→case_no",
    "مستوى التهديد — بحسب الطالب": "protection_requests.details→threat", "امتداد الخطر إلى الغير (م5/4)": "protection_requests.details→extends",
    "مسوّغات طلب الحماية": "protection_requests.details→reason", "مرفقات الطلب": "protection_requests.details→files",
    "رقم الوارد": "protection_requests.details→incoming_no", "تاريخ الوارد": "protection_cases.created_at",
    "طلب نيابةً عن شخص": "protection_requests.details→onBehalf (العمر فقط — الاسم والهوية محجوبان)",
    "تصنيف الخطر المبدئي (من الفرز)": "protection_cases.classification",
    "الجهة المختصة": "recommendations.source_body", "ضابط الاتصال المعتمد": "recommendations.details→officer",
    "مرجع التوصية": "recommendations.details→rec_ref", "تاريخ الرفع": "recommendations.received_at", "اعتمدها": "recommendations.details→approved_by",
    "الحالة الصحية": "recommendations.details→health", "التاريخ الجنائي": "recommendations.details→criminal",
    "التاريخ النفسي": "recommendations.details→psych", "رغبة الكشف عن الهوية": "recommendations.details→reveal",
    "تفاصيل وأسباب الطلب": "recommendations.details→req_details", "رقم القضية": "recommendations.details→case_no ∪ protection_requests.details→case_no",
    "المرحلة الحالية للقضية": "recommendations.details→stage", "ملخّص القضية": "recommendations.details→case_summary",
    "دور مقدّم الطلب وأهمية معلوماته": "recommendations.details→role_desc",
    "هل تم التواصل مع مقدّم الطلب؟": "recommendations.details→contacted", "نوع الجريمة": "recommendations.details→crime_class",
    "الواقعة": "protection_requests.details→waqia", "الوصف الإجرامي": "recommendations.details→crime_desc",
    "إخفاء البيانات (م2)": "recommendations.details→hide_identity", "وجود خطر يهدّد طالب الحماية": "recommendations.details→threat_exists",
    "نوع الخطر": "recommendations.details→threat_type", "نوع الضرر": "recommendations.details→harm_type",
    "إلى من يمتدّ الخطر": "recommendations.details→extends_who", "عوامل المادة (9)": "recommendations.factors9",
    "توصية الجهة": "recommendations.decision", "أسباب التوصية": "recommendations.notes",
    "الأنواع المقترحة من الجهة": "recommendations.proposed_type", "الحلول البديلة": "recommendations.details→alt_solutions",
    "المدة المقترحة": "recommendations.proposed_duration", "مرفقات التوصية": "recommendations.details→attachments",
    "بالاطّلاع تبيّن — التوصية": "studies.found_recommendation ∪ assessments.found_recommendation",
    "بالاطّلاع تبيّن — الطلب": "studies.found_request ∪ assessments.found_request",
    "توصية المُعِدّ": "studies.recommendation ∪ assessments.recommendation",
    "سبب الجزئية": "studies.partial_reason ∪ assessments.partial_reason",
    "أسباب رفض الحماية": "studies.reject_reasons", "ملاحظات المُعِدّ": "studies.notes ∪ assessments.notes",
    "نطاق القرار المُعَدّ": "council_decisions.scope", "ما يُقبل وما يُستثنى": "council_decisions.scope_note",
  };
  void FIELD_COL;

  const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

  function fmtWhen(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }); }
    catch { return String(ts); }
  }

  // مدة interval من القاعدة → صياغة م14 الموحّدة («ثلاثون يوماً» لا «30 يوماً»)
  function fmtInterval(v) {
    if (!v) return "إلى حين انتهاء القضية";
    const s = String(v).trim();
    if (s === "30 days") return "ثلاثون يوماً";
    const m = s.match(/^(\d+)\s*days?$/);
    if (m) return m[1] + " يوماً";
    const mo = s.match(/^(\d+)\s*mons?$/);
    if (mo) return mo[1] + (mo[1] === "1" ? " شهر" : " أشهر");
    return s;
  }

  // ————— لبنات العرض المشتركة (نمط الحزمة: بطاقة <details> + شبكة حقول) —————
  // البطاقة القابلة للطي — الأساس البصري الموحّد للمجموعات الأربع
  function DocCard({ icon, title, subtitle, badges, meta, accent = "var(--color-primary)", defaultOpen = false, children }) {
    return (
      <details className="sc" open={defaultOpen || undefined} style={{ border: "1px solid var(--border-subtle)", borderInlineStart: "4px solid " + accent, borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" }}>
        <summary style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface-subtle)", flexWrap: "wrap", cursor: "pointer", listStyle: "none" }}>
          <I name={icon} size={20} color="var(--color-primary)" />
          <span><b style={{ color: "var(--text-strong)", fontSize: 14 }}>{title}</b>{subtitle && <span className="muted" style={{ display: "block", fontSize: 11.5 }}>{subtitle}</span>}</span>
          {badges}
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
            {meta && <span className="mono muted" style={{ fontSize: 11.5 }} dir="ltr">{meta}</span>}
            <span className="material-symbols-rounded sc-chev" style={{ fontSize: 20, color: "var(--text-secondary)" }}>expand_more</span>
          </span>
        </summary>
        <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)" }}>{children}</div>
      </details>
    );
  }

  /* عرض أقسام النموذج: rows [تسمية، قيمة، مصدر?] بشبكة موحّدة + شارة المصدر
     (نفاذ/سُبل/الموارد) + نصوص opin + قوائم مرقّمة + رقائق. لا اسم عمودٍ يُعرض. */
  function FormSections({ sections }) {
    if (!sections) return null;
    return (<React.Fragment>{sections.filter(Boolean).map((s, i) => (
      <div key={i} className="fsec">
        <p className="fsec-h"><I name={s.icon || "article"} size={16} color="var(--color-primary)" /> <span>{s.title}</span>{s.note && <span className="fsec-note">{s.note}</span>}</p>
        {s.rows && <div className="fgrid">{s.rows.filter((r) => r && r[1]).map(([k, v, src], j) => (
          <div className="frow" key={j}>
            <span className="fk">{k}</span>
            <span className="fv">{v}{src && <span className="fsrc"><I name="link" size={11} /> {src}</span>}</span>
          </div>))}</div>}
        {(s.blocks || []).filter((b) => b && b[1]).map(([bk, bv], j) => (
          <div key={"b" + j} style={{ marginTop: 10 }}>
            {bk && <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{bk}</span>}
            <div className="opin" style={{ marginTop: 0 }}>{bv}</div>
          </div>))}
        {s.text && <div className="opin" style={{ marginTop: s.rows ? 10 : 0 }}>{s.text}</div>}
        {s.list && <ol className="flist">{s.list.map((x, j) => <li key={j}>{x}</li>)}</ol>}
        {s.chips && s.chips.length > 0 && <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>{s.chips.map((c) => <Tag key={c} tone="info" size="sm" iconLeft={<I name="shield" size={12} />}>{c}</Tag>)}</div>}
      </div>))}</React.Fragment>);
  }

  // مرفقات مسمّاة داخل البطاقات — فتحها مُسجَّل في التدقيق (م15/16)
  const AttRow = ({ list, onOpen }) => (list && list.length) ? (
    <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      {list.map((a, j) => <button key={j} className="chip" style={{ margin: 0 }} onClick={() => onOpen && onOpen(a)}><I name="description" size={15} /> {a}</button>)}
    </div>) : null;

  const srcOf = (flags, k, label) => {
    const v = flags && flags[k];
    return v ? label + (v === "manual" ? " (يدوي)" : "") : label;
  };

  // ① بيانات طالب الحماية — بطاقة مستقلّة عن الطلب (الهوية محجوبة دوماً)
  function SubjectCard({ q, subject, emergency }) {
    const s = subject || {};
    const na = s.national_address || {};
    const flags = s.source_flags || {};
    const nafath = srcOf(flags, "nafath", "نفاذ"), spl = srcOf(flags, "spl", "سُبل"), hrdf = srcOf(flags, "hrdf", "الموارد البشرية");
    const empty = !subject;
    return (
      <DocCard icon="person" title="بيانات طالب الحماية" subtitle="الهوية محجوبة — لا كشف في هذه المرحلة (م15/16)"
        badges={<Tag tone="success" size="sm" iconLeft={<I name="verified_user" size={12} fill />}>موثّق عبر نفاذ</Tag>}
        meta={q.secret}>
        {empty ? <InlineAlert kind="info" title="لا بيانات مجلوبة">لم تُجلب البيانات الإثرائية لطالب الحماية بعد — تُعرض هنا متى توافر جلبها من نفاذ/سُبل/الموارد لهذا الطلب.</InlineAlert> :
          <FormSections sections={[
            { title: "بيانات مقدم الطلب", icon: "badge", note: "الهوية محجوبة — تُعرض الصفات غير المعرِّفة فقط",
              rows: [["الجنس", s.gender, nafath], ["الجنسية", s.nationality, nafath], ["تاريخ الميلاد", s.birth_date, nafath], ["الحالة الاجتماعية", s.marital_status, nafath], ["المستوى التعليمي", s.education_level, nafath]] },
            (na.short || na.city) && { title: "العنوان الوطني", icon: "location_on", note: "مرتبط بتدبير تغيير محل الإقامة",
              rows: [["العنوان المختصر", na.short, spl], ["رقم المبنى", na.building, spl], ["الشارع", na.street, spl], ["الرقم الفرعي", na.secondary, spl], ["الحي", na.district, spl], ["الرمز البريدي", na.postal, spl], ["المدينة", na.city, spl]] },
            (s.employer || s.job_title) && { title: "بيانات العمل", icon: "work", note: "تُستخدم لرصد الإجراءات الوظيفية المحظورة",
              rows: [["جهة العمل", s.employer, hrdf], ["المسمى الوظيفي", s.job_title, hrdf]] },
            { title: "جهة الاتصال في الحالات الطارئة", icon: "contact_emergency", note: "الاسم والهاتف محجوبان — يُكشفان للتنفيذ فقط",
              rows: emergency
                ? [["صلة القرابة", emergency.relationship || "مُسجّلة (محجوبة)"], ["بيانات التواصل", "محجوبة — تُكشف للتنفيذ فقط"]]
                : [["الحالة", "لا جهة اتصال مسجّلة لهذا الطلب"]] },
          ]} />}
      </DocCard>
    );
  }

  // ② طلب الحماية — كما ورد من مقدّمه (منفصل عن بيانات طالبه)
  function RequestCard({ q, request, onOpenDoc }) {
    const req = request;
    if (!req) return null;
    const dd = typeof req.details === "string" ? { reason: req.details } : req.details || {};
    const files = Array.isArray(dd.files) ? dd.files : [];
    const channel = req.channel === "seeker" ? "بوابة طالب الحماية" : req.channel === "body" ? "الجهة المختصة" : req.channel || "—";
    // طلب نيابةً عن شخص: تُعرض الواقعة والعمر فقط — الاسم والهوية محجوبان (م15/16)
    const ob = dd.onBehalf || dd.on_behalf || null;
    return (
      <DocCard icon="assignment_ind" title="طلب الحماية — كما ورد من مقدّمه"
        badges={<Tag tone="success" size="sm" iconLeft={<I name="verified" size={12} fill />}>موثّق عبر نفاذ</Tag>}
        meta={(q.ref || "—") + (req.submitted_at ? " · " + fmtWhen(req.submitted_at) : "")}>
        <FormSections sections={[
          (dd.incoming_no || q.createdAt) && { title: "بيانات الورود والإحالة", icon: "folder_shared", note: "مجلوبة آلياً · للقراءة",
            rows: [["رقم الوارد", dd.incoming_no], ["تاريخ الوارد", q.createdAt], ["تصنيف الخطر المبدئي (من الفرز)", q.risk !== "—" ? q.risk : null]] },
          { title: "تفاصيل الطلب — كما أدخلها مقدّمه", icon: "how_to_reg",
            rows: [
              ["قناة الورود", channel],
              ["صفة مقدم الطلب", dd.role],
              ["دور طالب الحماية في القضية", q.cat],
              ["طلب نيابةً عن شخص", ob ? "نعم" + (ob.age ? " — العمر: " + ob.age : "") + " (اسم الشخص وهويته محجوبان)" : null],
              ["نوع الجريمة محل القضية", dd.crime || dd.waqia],
              ["الجهة المختصة (بحسب الطلب)", dd.entity],
              ["هل سبق التقديم للجهة المختصة؟", dd.prior_submit === true ? "نعم — " + (dd.prior_entity || dd.entity || "الجهة المختصة") : dd.prior_submit === false ? "لا" : null],
              ["رقم القضية (إن وجد)", dd.case_no],
              ["مستوى التهديد — بحسب الطالب", dd.threat],
              ["امتداد الخطر إلى الغير (م5/4)", dd.extends],
            ],
            blocks: [["مسوّغات طلب الحماية — بنصّ مقدّمه", dd.reason]] },
        ]} />
        {files.length > 0 && <div className="fsec">
          <p className="fsec-h"><I name="attach_file" size={16} color="var(--color-primary)" /> <span>مرفقات الطلب</span><span className="fsec-note">اطّلاع داخل الشاشة — كل فتح مُسجَّل</span></p>
          <AttRow list={files} onOpen={onOpenDoc} />
        </div>}
        <div className="ro-field" style={{ marginTop: 12 }}>
          <span className="row" style={{ gap: 8 }}><I name="fact_check" size={17} color="var(--color-success)" fill /><span style={{ fontSize: 12.5, color: "var(--text-body)" }}>الإقراران مستوفيان — صحّة البيانات والموافقة على المعالجة</span></span>
          <Tag tone="neutral" size="sm" iconLeft={<I name="lock_clock" size={13} />}>ختم زمني موثّق</Tag>
        </div>
      </DocCard>
    );
  }

  // ③ توصية الجهة المختصة — بنموذجها الموحّد (استشارية — القرار خالص للمركز م9)
  function RecCard({ q, recommendation, request, onOpenDoc }) {
    const rec = recommendation;
    if (!rec) return null;
    const rd = rec.details || {};
    const dd = (request && request.details) || {};
    const types = Array.isArray(rec.proposed_type) ? rec.proposed_type : [];
    const atts = Array.isArray(rd.attachments) ? rd.attachments : [];
    const factors = rec.factors9 && typeof rec.factors9 === "object" ? Object.entries(rec.factors9) : [];
    const negative = String(rec.decision || "").indexOf("عدم") >= 0;
    return (
      <DocCard icon="recommend" title={q.foreign ? "خطاب اللجنة الدائمة — المسار الأجنبي (م6)" : "توصية الجهة المختصة — بنموذجها الموحّد"}
        badges={<Tag tone={negative ? "warning" : "success"} size="sm" iconLeft={<I name="recommend" size={12} />}>{rec.decision === "توفير" ? "توفير الحماية" : rec.decision || "—"}</Tag>}
        meta={(rd.rec_ref || "") + (rec.received_at ? (rd.rec_ref ? " · " : "") + fmtWhen(rec.received_at) : "")}>
        <FormSections sections={[
          { title: "الجهة صاحبة التوصية", icon: "account_balance",
            rows: [["الجهة المختصة", rec.source_body], ["ضابط الاتصال المعتمد", rd.officer], ["مرجع التوصية", rd.rec_ref], ["تاريخ الرفع", rec.received_at ? fmtWhen(rec.received_at) + " — ضمن مهلة 5 أيام العمل" : null], ["اعتمدها", rd.approved_by]] },
          { title: "بيانات مقدّم الطلب (محجوبة الهوية)", icon: "badge", note: "يُشار إليه بالرمز السري " + q.secret,
            rows: [["صفة مقدّم الطلب", q.cat], ["الحالة الصحية", rd.health], ["التاريخ الجنائي", rd.criminal], ["التاريخ النفسي", rd.psych], ["رغبة الكشف عن الهوية", rd.reveal]] },
          (rd.req_details || dd.reason) && { title: "تفاصيل وأسباب طلب الحماية", icon: "notes", text: rd.req_details || dd.reason },
          { title: "ملخّص القضية ودور مقدّم الطلب", icon: "cases",
            rows: [["رقم القضية", rd.case_no || dd.case_no], ["المرحلة الحالية للقضية", rd.stage]],
            blocks: [["ملخّص القضية", rd.case_summary], ["دور مقدّم الطلب وأهمية معلوماته", rd.role_desc]] },
          { title: "مسوّغات توفير الحماية", icon: "rule",
            rows: [
              ["هل تم التواصل مع مقدّم الطلب؟", rd.contacted],
              ["نوع الجريمة", rd.crime_class],
              ["الواقعة", dd.waqia],
              ["إخفاء البيانات (م2)", rd.hide_identity],
              ["وجود خطر يهدّد طالب الحماية", rd.threat_exists || (rd.threat_type ? "يوجد" : null)],
              ["نوع الخطر", rd.threat_type],
              ["مستوى الخطر", dd.threat],
              ["نوع الضرر", rd.harm_type],
              ["امتداد الخطر إلى الغير (م5/4)", rd.extends_who ? (rd.extends_who === "لا يمتدّ" ? "لا" : "نعم") : null],
              ["إلى من يمتدّ", rd.extends_who && rd.extends_who !== "لا يمتدّ" ? rd.extends_who : null],
              ...factors.map(([k, v]) => [k, String(v)]),
              ["توصية الجهة", rec.decision === "توفير" ? "توفير الحماية" : rec.decision],
            ],
            blocks: [["الوصف الإجرامي", rd.crime_desc || dd.crime], ["أسباب التوصية", rec.notes]] },
          { title: "أنواع الحماية المقترحة من الجهة (م14) — اقتراحٌ لا يُقيّد المجلس", icon: "shield",
            chips: types, rows: [["الحلول البديلة", rd.alt_solutions || "لا توجد"]] },
          { title: "مدة الحماية المقترحة", icon: "schedule", rows: [["المدة", fmtInterval(rec.proposed_duration)]] },
        ]} />
        {atts.length > 0 && <div className="fsec">
          <p className="fsec-h"><I name="attach_file" size={16} color="var(--color-primary)" /> <span>مرفقات التوصية</span><span className="fsec-note">اطّلاع داخل الشاشة — كل فتح مُسجَّل</span></p>
          <AttRow list={atts} onOpen={onOpenDoc} />
        </div>}
        {!q.foreign && <InlineAlert kind="info" title="توصية استشارية" style={{ marginTop: 12 }}>التوصية لا تُلزم المجلس ولا تُغلق الطلب آلياً — القرار خالصٌ للمركز (م9).</InlineAlert>}
      </DocCard>
    );
  }

  // ④ بطاقة دراسة/تقييم — التسمية بالدور والرقم فقط (لا تخصّصات؛ التوزيع بالعبء §6)
  function StudyCard({ role, index, rec, partial, proposed, duration, notes, when, foundRec = null, foundReq = null, rejectReasons = null }) {
    const isStudy = role === "studier";
    const title = (isStudy ? "دراسة" : "تقييم") + " (" + arNum(index) + ")";
    const by = (isStudy ? "دارس مستقل" : "مقيّم مستقل") + " (" + arNum(index) + ")";
    const tone = recToneOf(rec, partial);
    const tc = tone === "success" ? "var(--color-success)" : tone === "warning" ? "var(--color-warning)" : tone === "error" ? "var(--color-error)" : "var(--border-default)";
    return (
      <details className="sc" style={{ border: "1px solid var(--border-subtle)", borderInlineStart: "4px solid " + tc, borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" }}>
        <summary style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface-subtle)", flexWrap: "wrap", cursor: "pointer", listStyle: "none" }}>
          <I name={isStudy ? "balance" : "psychology"} size={20} color="var(--color-primary)" />
          <span><b style={{ color: "var(--text-strong)", fontSize: 14 }}>{title}</b><span className="muted" style={{ display: "block", fontSize: 11.5 }}>أعدّه: {by} — مستقلّ ومعزول</span></span>
          {rec && <Tag tone={tone} size="sm">{rec}</Tag>}
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
            {when && <span className="mono muted" style={{ fontSize: 11 }} dir="ltr">{when}</span>}
            <span className="material-symbols-rounded sc-chev" style={{ fontSize: 20, color: "var(--text-secondary)" }}>expand_more</span>
          </span>
        </summary>
        <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <FoundLine foundRec={foundRec} foundReq={foundReq} />
          {partial && <div className="fac" style={{ borderTop: "none", paddingTop: 0 }}><span className="fac-k">سبب الجزئية</span><span className="fac-v">{partial}</span></div>}
          {Array.isArray(rejectReasons) && rejectReasons.length > 0 && <div style={{ marginBottom: 10 }}>
            <div className="fac-k" style={{ marginBottom: 6 }}>أسباب رفض الحماية</div>
            <div style={{ display: "grid", gap: 6 }}>{rejectReasons.map((r, i) => (
              <div key={i} className="ro-field" style={{ display: "block" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{r.t || r.k || "—"}</span>
                {r.note && <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 3 }}>{r.note}</span>}
              </div>))}</div>
          </div>}
          {proposed && proposed.length > 0 && <div className="row" style={{ gap: 6, marginBottom: 10 }}>{proposed.map((t) => <Tag key={t} tone="info" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}</div>}
          {/* interval فارغ ملتبس عمداً (يرمز «إلى حين انتهاء القضية» أو «مدة محدّدة»
              المدوّنة في الملاحظات — عقد packages/study-eval/submit-params) فلا يُعرض */}
          {duration ? <div className="ro-field" style={{ marginBottom: notes ? 10 : 0 }}><span className="muted">المدّة المقترحة</span><b style={{ color: "var(--text-strong)" }}>{fmtInterval(duration)}</b></div> : null}
          {notes && <div className="opin" style={{ marginTop: 0, borderInlineStart: "3px solid " + tc }}>{notes}</div>}
        </div>
      </details>
    );
  }

  /* حزمة الاطّلاع — أربع مجموعات بطاقات قابلة للطي بالنمط الموحّد (حزمة 11):
     بيانات طالب الحماية · طلب الحماية · توصية الجهة · بطاقة لكل دراسة وكل تقييم،
     ثم المرفقات الداعمة (اختيارية). كل فتح مرفق = صف تدقيق (record_attachment_open).
     attachEditable: المعدّ في «preparing» يرفع/يزيل المرفقات الداعمة. */
  function ReviewPackage({ q, attachEditable, onView, viewed }) {
    const pkg = HD.getPackage(q.secret) || {};
    const docs = pkg.docs || {};
    const studies = pkg.studies || [], assessments = pkg.assessments || [];
    const auditOpen = (doc) => {
      // باني supabase كسول — لا يُرسل إلا عند then/await
      const supa = createClient();
      supa.rpc("record_attachment_open", { _case_id: HD.caseIdOf(q.secret), _doc: doc })
        .then(({ error }) => { if (error) console.error("attachment_open audit:", error.message); });
    };
    return (<div>
      <p className="sec-h" style={{ marginBottom: 10 }}><I name="folder_open" size={18} color="var(--color-primary)" /> حزمة الاطّلاع — مُجمَّعة آلياً</p>
      <div className="pkg-bar"><I name="smart_toy" size={16} /><span>يجمع النظام بيانات طالب الحماية وطلبه وتوصية الجهة ومخرجات الدراسة والتقييم كما وردت — بلا اختصار أو انتقاء أو توصية. كل فتح مُسجَّل في التدقيق (م15/16).</span></div>
      {q.foreign && <InlineAlert kind="warning" title="مسار أجنبي (المادة 6)" style={{ margin: "12px 0" }}>طلب وارد عبر اللجنة الدائمة للمساعدة القانونية. عند قبول المجلس تُرفع النتيجة توصيةً إلى النائب العام للبتّ النهائي (المعاملة بالمثل).</InlineAlert>}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <SubjectCard q={q} subject={pkg.subject} emergency={pkg.emergency} />
        <RequestCard q={q} request={docs.request} onOpenDoc={auditOpen} />
        <RecCard q={q} recommendation={docs.recommendation} request={docs.request} onOpenDoc={auditOpen} />
      </div>

      {studies.length > 0 && <div style={{ marginTop: 18 }}>
        <p className="sec-h" style={{ margin: "0 0 12px" }}><I name="balance" size={18} color="var(--color-primary)" /> الدراسات المُعدّة <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({studies.length} — كل دارس مستقلّ ومعزول)</span></p>
        <div style={{ display: "grid", gap: 12 }}>{studies.map((s, i) => <StudyCard key={i} role="studier" index={i + 1} rec={s.rec} partial={s.partial} proposed={s.proposed} duration={s.duration} notes={s.notes} when={s.when} foundRec={s.foundRec} foundReq={s.foundReq} rejectReasons={s.rejectReasons} />)}</div>
      </div>}

      {assessments.length > 0 && <div style={{ marginTop: 18 }}>
        <p className="sec-h" style={{ margin: "0 0 12px" }}><I name="psychology" size={18} color="var(--color-primary)" /> التقييمات المُعدّة <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({assessments.length} — كل مقيّم مستقلّ ومعزول)</span></p>
        <div style={{ display: "grid", gap: 12 }}>{assessments.map((a, i) => <StudyCard key={i} role="evaluator" index={i + 1} rec={a.rec} partial={a.partial} proposed={a.proposed} duration={a.duration} notes={a.notes} when={a.when} foundRec={a.foundRec} foundReq={a.foundReq} rejectReasons={a.rejectReasons} />)}</div>
      </div>}

      <AttachmentsPanel secret={q.secret} editable={!!attachEditable} onView={onView} viewed={viewed} />
    </div>);
  }

  // ————— سجلّ إجراءات القرار — خطّ زمني بتواريخ فعلية من القاعدة —————
  function DecisionTimeline({ d }) {
    const events = [];
    if (d.submittedAt) events.push({ icon: "send", t: "رُفع لاعتماد نائب الرئيس", when: d.submittedAt, ts: d.submittedAtTs, who: PREPARERS.prep1.name });
    (d.rejections || []).forEach((r) => events.push({ icon: "undo", t: "أُعيد للمعدّ للتعديل" + (r.bySeat === "chair" ? " — من حلقة الرئيس" : r.bySeat === "deputy" ? " — من حلقة النائب" : ""), m: r.note, when: r.when, ts: r.whenTs, who: (SEATS[r.bySeat] || {}).name || "قيادة المركز" }));
    if (d.approvals && d.approvals.deputy) events.push({ icon: "approval", t: "اعتمده نائب الرئيس (الحلقة الأولى)", when: d.approvals.deputy.when, ts: d.approvals.deputy.whenTs, who: SEATS.deputy.name });
    if (d.approvals && d.approvals.chair) events.push({ icon: "workspace_premium", t: "اعتمده رئيس المركز (الحلقة الثانية)", when: d.approvals.chair.when, ts: d.approvals.chair.whenTs, who: SEATS.chair.name });
    if (d.votingStartedAt) events.push({ icon: "how_to_vote", t: "طُرح على أعضاء المجلس للتصويت", when: d.votingStartedAt, ts: d.votingStartedAtTs, who: PREPARERS.prep1.name });
    if (d.issued) events.push({ icon: "verified", t: "صدر قرار المركز (" + d.issued.type + ") وأُشعِر الطرفان — م10", when: d.issued.when, ts: d.issued.whenTs, who: SEATS.chair.name });
    if (!events.length) return null;
    events.sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
    return (
      <div style={{ marginTop: 14 }}>
        <p className="sec-h" style={{ fontSize: 13, margin: "0 0 10px" }}><I name="history" size={16} color="var(--color-primary)" /> سجلّ إجراءات القرار</p>
        <div className="tl">
          {events.map((e, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-dot"><I name={e.icon} size={12} color="var(--color-primary)" fill /></div>
              <div className="tl-t">{e.t}</div>
              {e.m && <div className="tl-m">{e.m}</div>}
              <div className="tl-m"><I name="schedule" size={11} style={{ verticalAlign: "middle" }} /> {e.when || "—"} · {e.who}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ————— قرار المركز المُعَدّ — عرضٌ للقراءة —————
  function DecisionView({ decision, foreign }) {
    const d = decision || {};
    const approved = d.approvals && d.approvals.deputy && d.approvals.chair;
    return (
      <Card className="card pad" style={{ marginTop: 16 }}>
        <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> قرار المركز المُعَدّ</p>
        <div className="pkg-bar"><I name="verified_user" size={16} /><span>أعدّه <b>{PREPARERS.prep1.name}</b> (مستشار قانوني) إعداداً محايداً من الدراسات والتقييمات — بلا توصية بالقبول أو الرفض.{approved ? <React.Fragment> اعتمده <b>النائب والرئيس</b> ({d.approvals.chair.when}).</React.Fragment> : null}</span></div>
        {d.scope && <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">نطاق القرار المُعَدّ</span><Tag tone={d.scope === "رفض الحماية" ? "error" : d.scope === "قبول جزئي" ? "warning" : "success"} size="sm" iconLeft={<I name="gavel" size={12} />}>{d.scope}</Tag></div>}
        {d.scope === "قبول جزئي" && d.scopeNote && <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">ما يُقبل وما يُستثنى</span><div className="opin" style={{ marginTop: 0 }}>{d.scopeNote}</div></div>}
        <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">أنواع الحماية المقترحة (المادة 14)</span>
          <div className="row" style={{ gap: 6 }}>{(d.types || []).map((t) => <Tag key={t} tone="success" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}{(d.types || []).length === 0 && <span className="muted">—</span>}</div></div>
        <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">مدّة الحماية</span><b style={{ color: "var(--text-strong)" }}>{d.duration || "—"}</b></div>
        <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">حيثيات القرار</span><div className="opin" style={{ marginTop: 0 }}>{d.reasoning || "—"}</div></div>
        <div className="row" style={{ gap: 8 }}>
          <Tag tone={approved ? "success" : "warning"} size="sm" iconLeft={<I name={approved ? "verified" : "pending"} size={13} />}>{approved ? "اعتمده النائب والرئيس" : "في حلقتي الاعتماد"}</Tag>
          <Tag tone={(STATUS[d.status] || {}).tone || "neutral"} size="sm" iconLeft={<I name={(STATUS[d.status] || {}).icon || "gavel"} size={13} />}>{(STATUS[d.status] || {}).t || d.status}</Tag>
        </div>
        {foreign && <InlineAlert kind="warning" title="مسار أجنبي — المادة 6" style={{ marginTop: 12 }}>عند قبول المجلس تُرفع النتيجة توصيةً إلى النائب العام للبتّ النهائي (المعاملة بالمثل).</InlineAlert>}
        <DecisionTimeline d={d} />
      </Card>
    );
  }

  // ————— صندوق تصويت العضو (قبول/رفض — نقرة واحدة، الرفض بتسبيب) —————
  function VoteBox({ my, onCast, canVote, subject }) {
    const [vote, setVote] = useState("");
    const [note, setNote] = useState("");
    if (my) return (<Card className="card pad" style={{ marginTop: 16 }}>
      <InlineAlert kind={my.choice === "رفض" ? "warning" : "success"} title={"صوتك المسجّل: " + my.choice}>سُجّل صوتك مستقلّاً بختم زمني في التدقيق ({my.when}).{my.note ? " — السبب: " + my.note : ""} لا تطّلع على أصوات بقية الأعضاء ولا على الحصيلة؛ تظهر للنائب والرئيس فقط.</InlineAlert>
    </Card>);
    if (!canVote) return null;
    const isReject = vote === "رفض";
    const ready = vote && (!isReject || note.trim());
    return (<Card className="card pad" style={{ marginTop: 16 }}>
      <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> صوتك على {subject}</p>
      <InlineAlert kind="info" title="تصويت مستقلّ — نقرة واحدة" style={{ marginBottom: 14 }}>تدلي بصوتك بعد الاطّلاع الكامل، دون رؤية أصوات بقية الأعضاء. المهلة: يوم عمل واحد كحدٍّ أقصى من فتح التصويت.</InlineAlert>
      <div className="fld"><span className="fld-label">قرارك</span>
        <div className="chips">{["قبول", "رفض"].map((o) => <button key={o} className={"chip" + (vote === o ? " on" : "") + (o === "رفض" ? " danger" : "")} onClick={() => setVote(o)}>{o}</button>)}</div></div>
      {vote === "قبول" && <p className="muted" style={{ margin: "0 0 8px" }}>القبول = تبنّي القرار المُعَدّ كما عُرض. للتحفّظ على بندٍ اختر «رفض» واذكر السبب فيُعاد للمعدّ.</p>}
      {isReject && <div className="fld"><span className="fld-label">سبب الرفض <span style={{ color: "var(--color-error)" }}>· إلزامي</span></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="اذكر سبب الرفض أو التحفّظ — يُدوَّن للمعدّ والقيادة…" dir="auto" /></div>}
      <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!ready} onClick={() => onCast(vote, note.trim())}><I name="how_to_vote" size={18} /> اعتماد و ارسال</button></div>
    </Card>);
  }

  // ————— حصيلة تصويت المجلس (اطّلاع القيادة) + تصويت القيادة كأعضاء —————
  function CouncilTally({ result, votesFor, seat, onCast, onClose }) {
    const t = result;
    const my = votesFor && votesFor[seat];
    const [vote, setVote] = useState("");
    const [note, setNote] = useState("");
    const isReject = vote === "رفض";
    const VT = { "قبول": ["var(--success-10)", "var(--success-70)", "check_circle"], "رفض": ["var(--error-10)", "var(--error-70)", "cancel"] };
    return (<React.Fragment>
      <Card className="card pad" style={{ marginTop: 16 }}>
        <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> حصيلة تصويت المجلس <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>(اطّلاع القيادة)</span></p>
        <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span className="pill" style={{ background: "var(--success-10)", color: "var(--success-70)" }}><I name="thumb_up" size={14} /> قبول {t.accept}</span>
          <span className="pill" style={{ background: "var(--error-10)", color: "var(--error-70)" }}><I name="thumb_down" size={14} /> رفض {t.reject}</span>
          <span className="pill" style={{ background: "var(--surface-subtle)", color: "var(--text-secondary)" }}><I name="hourglass_top" size={14} /> لم يصوّت {t.pending}</span>
          <span className="muted" style={{ fontSize: 12 }}>الأغلبية الحاسمة: {MAJORITY}/{VOTING_SEATS.length}</span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: "var(--surface-subtle)", overflow: "hidden", display: "flex", marginBottom: 14 }}>
          <div style={{ width: (t.accept / VOTING_SEATS.length * 100) + "%", background: "var(--color-success)" }} />
          <div style={{ width: (t.reject / VOTING_SEATS.length * 100) + "%", background: "var(--color-error)" }} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>{VOTING_SEATS.map((s) => { const v = votesFor && votesFor[s]; const vt = v ? VT[v.choice] : null; return (
          <div key={s} className="row" style={{ justifyContent: "space-between", padding: "8px 12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
            <span className="row" style={{ gap: 8 }}><I name="account_circle" size={18} color="var(--text-secondary)" /><b style={{ fontSize: 13, color: "var(--text-strong)" }}>{SEATS[s].name}</b>{SEATS[s].kind === "lead" && <Tag tone="neutral" size="sm">{SEATS[s].t}</Tag>}</span>
            {v ? <span className="pill" style={{ background: vt[0], color: vt[1] }}><I name={vt[2]} size={13} /> {v.choice}{v.note ? " · متحفّظ" : ""}</span> : <span className="muted" style={{ fontSize: 12 }}>{t.deadlineClosed ? "لم يصوّت خلال المهلة" : "بانتظار التصويت"}</span>}
          </div>); })}</div>
        {t.closed ? <InlineAlert kind={t.outcome === "مقبول" ? "success" : "warning"} title={"أُغلق التصويت: " + t.outcome} style={{ marginTop: 14 }}>حُسم بأغلبية {t.outcome === "مقبول" ? t.accept : t.reject} من {VOTING_SEATS.length}{t.deadlineClosed ? " عند انتهاء يوم العمل (النصاب بالمصوّتين)" : ""}. يتولّى رئيس المركز إصدار قرار المركز أدناه.</InlineAlert>
          : <div className="row" style={{ justifyContent: "space-between", marginTop: 14, gap: 10, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 12.5 }}>لم تُبلَغ الأغلبية بعد ({Math.max(t.accept, t.reject)}/{MAJORITY}).</span>
              <button className="btn btn-ghost" onClick={onClose} disabled={t.cast === 0}><I name="timer_off" size={17} /> إغلاق بانتهاء يوم العمل</button>
            </div>}
      </Card>
      {!my && !t.closed && <Card className="card pad" style={{ marginTop: 14 }}>
        <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> صوتك كعضو مصوّت</p>
        <p className="muted" style={{ marginTop: 0 }}>أنت عضوٌ مصوّت في المجلس (وللرئيس ترجيح الجانب عند التعادل). أدلِ بصوتك المستقلّ:</p>
        <div className="chips">{["قبول", "رفض"].map((o) => <button key={o} className={"chip" + (vote === o ? " on" : "") + (o === "رفض" ? " danger" : "")} onClick={() => setVote(o)}>{o}</button>)}</div>
        {isReject && <div className="fld" style={{ marginTop: 12 }}><span className="fld-label">سبب الرفض · إلزامي</span><textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" /></div>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}><button className="btn btn-primary" disabled={!vote || (isReject && !note.trim())} onClick={() => onCast(vote, note.trim())}>اعتماد</button></div>
      </Card>}
      {my && <InlineAlert kind="info" title={"صوتك المسجّل كعضو: " + my.choice} style={{ marginTop: 14 }}>أدليت بصوتك ({my.when}).</InlineAlert>}
    </React.Fragment>);
  }

  return { I, STATUS, identOf, seatsOf, useStore, SecretChip, Timer, AttachmentsPanel, DocCard, FormSections, SubjectCard, RequestCard, RecCard, StudyCard, ReviewPackage, DecisionView, VoteBox, CouncilTally, dayGroup, bizDaysSince };
})();
