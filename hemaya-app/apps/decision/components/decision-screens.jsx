'use client';
/* ============================================================
   مكوّنات عرض مرحلة القرار (المسار الجديد) — منقولة من decision-portal.jsx.
   window/HP/PlatformsCode → @hemaya/ui. رفع المرفقات حقيقيّ إلى Supabase Storage.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, RiskLevel } from "@hemaya/ui";
import { createClient } from "@hemaya/supabase/src/browser";
import { HemayaDecision } from "./decision-store";

const HD = HemayaDecision;

export const DScreens = (function () {
  const SEATS = HD.SEATS, PREPARERS = HD.PREPARERS, VOTING_SEATS = HD.VOTING_SEATS, MAJORITY = HD.MAJORITY;

  const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
    <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
  );

  const STATUS = {
    preparing: { t: "قيد الإعداد",      tone: "neutral", icon: "edit_note" },
    voting:    { t: "مطروح للتصويت",     tone: "info",    icon: "how_to_vote" },
    issued:    { t: "صدر القرار",        tone: "success", icon: "verified" },
  };
  const identOf = (scope, id) => (scope === "preparer" ? PREPARERS[id] : SEATS[id]) || { name: "—", t: "", org: "" };
  const seatsOf = (scope) => scope === "preparer" ? Object.keys(PREPARERS) : scope === "leadership" ? ["deputy", "chair"] : HD.MEMBER_SEATS;

  function useStore() { const [, f] = useState(0); useEffect(() => HD.subscribe(() => f((n) => n + 1)), []); }

  // ————— حزمة مرفقات القرار — رفعٌ حقيقيّ (تحرير) / اطّلاع بمعاينة (قراءة) —————
  function AttachmentsPanel({ secret, editable, applicant, certified, onCertify, onView, viewed }) {
    const docs = HD.caseDocuments(secret);
    const d = HD.getDecision(secret) || {};
    const req = HD.queueBySecret(secret) || {};
    const supabase = useRef(createClient()).current;
    const [customLbl, setCustomLbl] = useState("");
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(null);   // docId قيد الرفع
    const [err, setErr] = useState("");
    const [signed, setSigned] = useState(null); // { url } للمعاينة
    const seen = viewed || [];
    const reqIds = docs.filter((x) => x.required).map((x) => x.id);
    const attachedReq = reqIds.filter((id) => (docs.find((x) => x.id === id) || {}).fileName).length;
    const allAttached = reqIds.length > 0 && attachedReq === reqIds.length;
    const GROUPS = [["طلب الحماية", "assignment_ind", "request"], ["توصية الجهة المختصة", "recommend", "entityRec"], ["الدراسات", "balance", "study"], ["التقييمات", "psychology", "assessment"], ["قرار المركز المُعَدّ", "gavel", "decision"], ["مستندات إضافية", "attach_file", "other"]];

    const onPick = async (docId, e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f || !req.id) return;
      const doc = docs.find((x) => x.id === docId) || {};
      // مفتاح التخزين ASCII فقط (Supabase Storage يرفض المفاتيح غير اللاتينية) — الاسم العربيّ يُحفظ للعرض
      const ext = ((f.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin").slice(0, 8);
      const path = `${req.id}/${docId}-${Date.now()}.${ext}`;
      setBusy(docId); setErr("");
      const { error } = await supabase.storage.from("decision-docs").upload(path, f, { upsert: true });
      setBusy(null);
      if (error) { setErr("تعذّر رفع الملف: " + error.message); return; }
      HD.setFile(secret, docId, f.name, path, { group: doc.group, label: doc.label, required: doc.required });
    };
    const openPreview = async (doc) => {
      setPreview(doc); setSigned(null); if (onView) onView(doc.id);
      if (doc.storagePath) {
        const { data } = await supabase.storage.from("decision-docs").createSignedUrl(doc.storagePath, 300);
        if (data && data.signedUrl) setSigned({ url: data.signedUrl });
      }
    };
    const addCustom = () => { if (!customLbl.trim()) return; HD.addDocSlot(secret, { label: customLbl.trim(), group: "other", required: false }); setCustomLbl(""); };

    const row = (doc) => {
      const on = !!doc.fileName;
      return (<div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", border: "1px solid var(--border-subtle)", borderInlineStart: "4px solid " + (on ? "var(--color-primary)" : "var(--border-default)"), borderRadius: "var(--radius-md)", background: on ? "var(--surface-card)" : "var(--surface-subtle)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: on ? "var(--green-10)" : "var(--surface-subtle)", color: on ? "var(--color-primary)" : "var(--text-secondary)", display: "grid", placeItems: "center", flexShrink: 0 }}><I name={doc.icon} size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}>{doc.label}{doc.required && !on && <span style={{ color: "var(--color-error)", fontSize: 11.5, fontWeight: 700 }}> · إلزامي</span>}</div>
          {on ? <div className="row" style={{ gap: 6, marginTop: 3 }}><I name="description" size={14} color="var(--color-primary)" /><span className="mono" style={{ fontSize: 12, color: "var(--text-body)" }}>{doc.fileName}</span></div>
            : <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{editable ? (busy === doc.id ? "جارٍ الرفع…" : "لم يُرفق بعد") : "لم يُرفق"}</div>}</div>
        {editable ? <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <label className={"chip" + (on ? " on" : "")} style={{ cursor: busy ? "wait" : "pointer", margin: 0 }}><I name={busy === doc.id ? "hourglass_top" : on ? "autorenew" : "upload_file"} size={15} /> {on ? "استبدال" : "إضافة مرفق"}<input type="file" style={{ display: "none" }} disabled={!!busy} onChange={(e) => onPick(doc.id, e)} /></label>
          {on && <button className="chip" style={{ padding: "8px 10px" }} title="إزالة" onClick={() => HD.setFile(secret, doc.id, null)}><I name="close" size={15} /></button>}
        </div> : (on ? <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <button className={"chip" + (seen.indexOf(doc.id) >= 0 ? " on" : "")} style={{ margin: 0 }} onClick={() => openPreview(doc)}><I name="visibility" size={15} /> معاينة</button>
          {seen.indexOf(doc.id) >= 0 && <I name="check_circle" size={20} fill color="var(--color-success)" title="تمّت المعاينة" />}
        </div> : <I name="remove_circle_outline" size={20} color="var(--text-secondary)" />)}
      </div>);
    };

    return (<div>
      <p className="sec-h" style={{ marginBottom: 10 }}><I name="folder_open" size={18} color="var(--color-primary)" /> مرفقات القضية — {editable ? "يرفعها المعدّ" : "رفعها المعدّ"}
        {!editable && d.packageConfirmed && <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--color-primary)", background: "var(--green-10)", padding: "3px 10px", borderRadius: "var(--radius-full)" }}><I name="verified" size={14} fill /> إقرار اكتمال موثّق{d.packageConfirmedAt ? " · " + d.packageConfirmedAt : ""}</span>}</p>
      {applicant && (applicant.name || applicant.nid) && <div className="fac" style={{ marginBottom: 8 }}><span className="fac-k"><I name="badge" size={15} /> مرجع طالب الحماية</span><span className="fac-v">{applicant.name}{applicant.nid ? " · " : ""}<span className="mono">{applicant.nid}</span></span></div>}
      <div className="pkg-bar"><I name="attachment" size={16} /><span>كل مستند — من طلب الحماية حتى قرار المركز — يُرفَق كملف يُرفع فعلياً إلى مستودعٍ آمن. يُرفقها المعدّ كما وردت بلا انتقاء، وكل إضافة/إزالة مُسجَّلة في التدقيق (م15/16).</span></div>
      {err && <InlineAlert kind="error" title="خطأ في الرفع" style={{ marginBottom: 12 }}>{err}</InlineAlert>}
      {editable && <div className="row" style={{ margin: "12px 0" }}>
        <span className="pill" style={{ background: allAttached ? "var(--success-10)" : "var(--warning-10)", color: allAttached ? "var(--success-70)" : "var(--color-warning)" }}><I name={allAttached ? "task_alt" : "pending"} size={14} /> {attachedReq}/{reqIds.length} مرفقاً مطلوباً</span>
      </div>}
      {GROUPS.map(([label, ic, grp]) => { const arr = docs.filter((x) => x.group === grp); return arr.length ? (
        <div key={grp} style={{ marginTop: 14 }}>
          <p className="sec-h" style={{ margin: "0 0 8px", fontSize: 13 }}><I name={ic} size={16} color="var(--text-secondary)" /> {label}</p>
          <div style={{ display: "grid", gap: 8 }}>{arr.map(row)}</div>
        </div>) : null; })}
      {editable && <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <input value={customLbl} onChange={(e) => setCustomLbl(e.target.value)} placeholder="اسم مستند إضافي (اختياري)…" dir="auto" style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={addCustom} disabled={!customLbl.trim()}><I name="add" size={17} /> إضافة مرفق</button>
      </div>}
      {editable && <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16, padding: "13px 15px", border: "1px dashed var(--color-primary)", borderRadius: "var(--radius-md)", background: "var(--green-10)", cursor: allAttached ? "pointer" : "not-allowed", opacity: allAttached ? 1 : .55 }}>
        <input type="checkbox" checked={!!certified} disabled={!allAttached} onChange={(e) => onCertify(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--color-primary)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.6 }}><b style={{ color: "var(--text-strong)" }}>أُقِرّ باكتمال المرفقات وعدم انتقائها.</b> يُسجَّل هذا الإقرار في التدقيق بالرمز السري.{!allAttached && <span className="muted" style={{ display: "block", marginTop: 3 }}>يُفعَّل بعد رفع كل المرفقات المطلوبة.</span>}</span>
      </label>}
      {preview && <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,0.55)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-card)", borderRadius: "var(--radius-lg)", maxWidth: 620, width: "100%", maxHeight: "86vh", overflow: "auto", boxShadow: "var(--shadow-xl)" }}>
          <div className="row" style={{ gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-subtle)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--green-10)", color: "var(--color-primary)", display: "grid", placeItems: "center", flexShrink: 0 }}><I name={preview.icon} size={20} /></div>
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
        {t.closed ? <InlineAlert kind={t.outcome === "مقبول" ? "success" : "warning"} title={"أُغلق التصويت: " + t.outcome} style={{ marginTop: 14 }}>حُسم بأغلبية {t.outcome === "مقبول" ? t.accept : t.reject} من {VOTING_SEATS.length}{t.deadlineClosed ? " عند انتهاء يوم العمل (النصاب بالمصوّتين)" : ""}. أصدِر قرار المركز أدناه.</InlineAlert>
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

  const Timer = () => <DeadlineTimer label="مهلة التصويت — يوم عمل واحد" totalDays={1} daysElapsed={0} articleRef="المادة 10" />;

  return { AttachmentsPanel, VoteBox, CouncilTally, Timer, I, STATUS, identOf, seatsOf, useStore };
})();
