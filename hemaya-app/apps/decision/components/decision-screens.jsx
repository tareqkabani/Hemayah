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

  // ————— حزمة الاطّلاع الحقيقية (من HD.getPackage) —————
  const recToneOf = (rec, partial) => {
    const r = String(rec || "");
    if (/رفض|deny|reject/i.test(r)) return "error";
    if (partial || /جزئ|partial/i.test(r)) return "warning";
    if (!r || r === "—") return "neutral";
    return "success";
  };
  const factorRows = (factors) => {
    if (!factors) return [];
    if (Array.isArray(factors)) return factors.map((f, i) => Array.isArray(f) ? [String(f[0]), String(f[1])] : [String(i + 1), String(f)]);
    if (typeof factors === "object") return Object.keys(factors).map((k) => [k, String(factors[k])]);
    return [["عوامل م9", String(factors)]];
  };

  function StudyCard({ icon, title, rec, partial, proposed, duration, notes, when, foundRec = null, foundReq = null }) {
    const tone = recToneOf(rec, partial);
    const tc = tone === "success" ? "var(--color-success)" : tone === "warning" ? "var(--color-warning)" : tone === "error" ? "var(--color-error)" : "var(--border-default)";
    return (
      <div style={{ border: "1px solid var(--border-subtle)", borderInlineStart: "4px solid " + tc, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface-subtle)", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
          <I name={icon} size={20} color="var(--color-primary)" />
          <b style={{ color: "var(--text-strong)", fontSize: 14 }}>{title}</b>
          {rec && <Tag tone={tone} size="sm">{rec}</Tag>}
          {when && <span className="muted" style={{ marginInlineStart: "auto", fontSize: 11.5 }}>{when}</span>}
        </div>
        <div style={{ padding: 16 }}>
          <FoundLine foundRec={foundRec} foundReq={foundReq} />
          {partial && <div className="fac" style={{ borderTop: "none", paddingTop: 0 }}><span className="fac-k">سبب الجزئية</span><span className="fac-v">{partial}</span></div>}
          {proposed && proposed.length > 0 && <div className="row" style={{ gap: 6, marginBottom: duration || notes ? 10 : 0 }}>{proposed.map((t) => <Tag key={t} tone="info" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}</div>}
          {duration && <div className="ro-field" style={{ marginBottom: notes ? 10 : 0 }}><span className="muted">المدّة المقترحة</span><b style={{ color: "var(--text-strong)" }}>{duration}</b></div>}
          {notes && <div className="opin" style={{ marginTop: 0, borderInlineStart: "3px solid " + tc }}>{notes}</div>}
        </div>
      </div>
    );
  }

  /* حزمة الاطّلاع — تُعرض الأقسام المتوافرة فقط:
     طلب الحماية · توصية الجهة المختصة · الدراسات · التقييمات · مرفقات داعمة.
     attachEditable: المعدّ في «preparing» يرفع/يزيل المرفقات الداعمة. */
  function ReviewPackage({ q, attachEditable, onView, viewed }) {
    const pkg = HD.getPackage(q.secret) || {};
    const req = pkg.request, rec = pkg.recommendation;
    const studies = pkg.studies || [], assessments = pkg.assessments || [];
    return (<div>
      <p className="sec-h" style={{ marginBottom: 10 }}><I name="folder_open" size={18} color="var(--color-primary)" /> حزمة الاطّلاع — مُجمَّعة آلياً</p>
      <div className="pkg-bar"><I name="smart_toy" size={16} /><span>يجمع النظام مخرجات الدراسة والتقييم كما وردت بلا اختصار أو توصية. يطّلع المعدّ والمجلس على المحتوى الكامل، وكل فتح يُسجَّل في التدقيق (م15/16).</span></div>
      {q.foreign && <InlineAlert kind="warning" title="مسار أجنبي (المادة 6)" style={{ margin: "12px 0" }}>طلب وارد عبر اللجنة الدائمة للمساعدة القانونية. عند قبول المجلس تُرفع النتيجة توصيةً إلى النائب العام للبتّ النهائي (المعاملة بالمثل).</InlineAlert>}

      {req && <div style={{ marginTop: 14 }}>
        <p className="sec-h" style={{ margin: "0 0 8px" }}><I name="assignment_ind" size={18} color="var(--color-primary)" /> طلب الحماية</p>
        <div style={{ display: "grid", gap: 4 }}>
          {req.channel && <div className="fac"><span className="fac-k">قناة الورود</span><span className="fac-v">{req.channel}</span></div>}
          {req.when && <div className="fac"><span className="fac-k">تاريخ التقديم</span><span className="fac-v">{req.when}</span></div>}
        </div>
        {req.details && <div className="opin">{req.details}</div>}
      </div>}

      {rec && <div style={{ marginTop: 18 }}>
        <p className="sec-h" style={{ margin: "0 0 8px" }}><I name="recommend" size={18} color="var(--color-primary)" /> توصية الجهة المختصة</p>
        <div style={{ display: "grid", gap: 4 }}>
          <div className="fac"><span className="fac-k">الجهة</span><span className="fac-v">{rec.entity}</span></div>
          <div className="fac"><span className="fac-k">التوصية</span><span><Tag tone={recToneOf(rec.decision)} size="sm">{rec.decision}</Tag></span></div>
          {rec.duration && <div className="fac"><span className="fac-k">المدّة المقترحة</span><span className="fac-v">{rec.duration}</span></div>}
          {rec.channel && <div className="fac"><span className="fac-k">قناة الورود</span><span className="fac-v">{rec.channel}</span></div>}
          {rec.when && <div className="fac"><span className="fac-k">تاريخ الورود</span><span className="fac-v">{rec.when}</span></div>}
        </div>
        {rec.proposed && rec.proposed.length > 0 && <div className="row" style={{ gap: 6, marginTop: 10 }}>{rec.proposed.map((t) => <Tag key={t} tone="info" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}</div>}
        {factorRows(rec.factors).length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 10 }}>
          {factorRows(rec.factors).map(([k, v], j) => (<div key={j} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 11px", background: "var(--surface-subtle)", borderRadius: "var(--radius-md)" }}><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{k}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>{v}</span></div>))}
        </div>}
        {rec.notes && <div className="opin">{rec.notes}</div>}
      </div>}

      {studies.length > 0 && <div style={{ marginTop: 18 }}>
        <p className="sec-h" style={{ margin: "0 0 12px" }}><I name="balance" size={18} color="var(--color-primary)" /> الدراسات <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({studies.length} — كلّ مُعدّ مستقلّ ومعزول)</span></p>
        <div style={{ display: "grid", gap: 12 }}>{studies.map((s, i) => <StudyCard key={i} icon="balance" title={"الدراسة القانونية " + (studies.length > 1 ? (i + 1) : "")} rec={s.rec} partial={s.partial} proposed={s.proposed} duration={s.duration} notes={s.notes} when={s.when} foundRec={s.foundRec} foundReq={s.foundReq} />)}</div>
      </div>}

      {assessments.length > 0 && <div style={{ marginTop: 18 }}>
        <p className="sec-h" style={{ margin: "0 0 12px" }}><I name="psychology" size={18} color="var(--color-primary)" /> التقييمات <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({assessments.length})</span></p>
        <div style={{ display: "grid", gap: 12 }}>{assessments.map((a, i) => <StudyCard key={i} icon="psychology" title={"التقييم النفسي/الاجتماعي " + (assessments.length > 1 ? (i + 1) : "")} rec={a.rec} partial={a.partial} notes={a.notes} when={a.when} foundRec={a.foundRec} foundReq={a.foundReq} />)}</div>
      </div>}

      <AttachmentsPanel secret={q.secret} editable={!!attachEditable} onView={onView} viewed={viewed} />
    </div>);
  }

  // ————— سجلّ إجراءات القرار — خطّ زمني بتواريخ فعلية من القاعدة —————
  function DecisionTimeline({ d }) {
    const events = [];
    if (d.submittedAt) events.push({ icon: "send", t: "رُفع لاعتماد نائب الرئيس", when: d.submittedAt, ts: d.submittedAtTs, who: PREPARERS.prep1.name });
    (d.rejections || []).forEach((r) => events.push({ icon: "undo", t: "أُعيد للمعدّ للتعديل", m: r.note, when: r.when, ts: r.whenTs, who: SEATS.deputy.name }));
    if (d.approvals && d.approvals.deputy) events.push({ icon: "approval", t: "اعتمده نائب الرئيس", when: d.approvals.deputy.when, ts: d.approvals.deputy.whenTs, who: SEATS.deputy.name });
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
    const approved = d.approvals && d.approvals.deputy;
    return (
      <Card className="card pad" style={{ marginTop: 16 }}>
        <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> قرار المركز المُعَدّ</p>
        <div className="pkg-bar"><I name="verified_user" size={16} /><span>أعدّه <b>{PREPARERS.prep1.name}</b> (مستشار قانوني) إعداداً محايداً من الدراسات والتقييمات — بلا توصية بالقبول أو الرفض.{approved ? <React.Fragment> اعتمده <b>نائب رئيس المركز</b> ({approved.when}).</React.Fragment> : null}</span></div>
        <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">أنواع الحماية المقترحة (المادة 14)</span>
          <div className="row" style={{ gap: 6 }}>{(d.types || []).map((t) => <Tag key={t} tone="success" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}{(d.types || []).length === 0 && <span className="muted">—</span>}</div></div>
        <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">مدّة الحماية</span><b style={{ color: "var(--text-strong)" }}>{d.duration || "—"}</b></div>
        <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">حيثيات القرار</span><div className="opin" style={{ marginTop: 0 }}>{d.reasoning || "—"}</div></div>
        <div className="row" style={{ gap: 8 }}>
          <Tag tone={approved ? "success" : "warning"} size="sm" iconLeft={<I name={approved ? "verified" : "pending"} size={13} />}>{approved ? "اعتمده نائب الرئيس" : "بانتظار اعتماد نائب الرئيس"}</Tag>
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

  return { I, STATUS, identOf, seatsOf, useStore, SecretChip, Timer, AttachmentsPanel, StudyCard, ReviewPackage, DecisionView, VoteBox, CouncilTally, dayGroup, bizDaysSince };
})();
