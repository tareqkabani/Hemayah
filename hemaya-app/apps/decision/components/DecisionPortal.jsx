'use client';
/* ============================================================
   بوابة مرحلة القرار والإشعار — تحديث 15 يوليو 2026.
   القشرة المرجعية لبوابات الموظفين (منقولة من design decision-app.jsx):
   شريط جانبي قابل للطيّ + شريط علوي بعدّادات حيّة + إشعارات مشتقّة من
   المخزن الحقيقي + مراسلات خيوطها من القاعدة.
   آلة الحالة: preparing → pending_deputy → approved → voting → issued.
   النطاقات: preparer (معدّ) · members (أعضاء) · leadership (قيادة).
   البيانات حقيقيّة من Supabase (hydrate + أفعال الخادم).
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, RiskLevel } from "@hemaya/ui";
import { HemayaDecision } from "./decision-store";
import { DScreens } from "./decision-screens";
import * as DecActions from "@/lib/dec-actions";
import "./decision.css";

const HD = HemayaDecision;

const App = (function () {
  const S = DScreens;
  const { ReviewPackage, DecisionView, VoteBox, CouncilTally, Timer, I, STATUS, identOf, seatsOf, useStore, SecretChip, dayGroup, bizDaysSince } = S;
  const SEATS = HD.SEATS, PREPARERS = HD.PREPARERS, VOTING_SEATS = HD.VOTING_SEATS;
  const PROTECTION_TYPES = HD.PROTECTION_TYPES;
  const DECISION_STAGES = HD.DECISION_STAGES;
  const dOf = HD.dOf, stageOf = HD.stageOf;
  const allCases = () => HD.allCases();

  const SCOPE_META = {
    preparer:   { portal: "بوابة معد قرار المركز", sub: "معد قرار المركز" },
    members:    { portal: "بوابة أعضاء المجلس",    sub: "أعضاء المجلس" },
    leadership: { portal: "بوابة قيادة المجلس",    sub: "قيادة المجلس" },
  };
  const NAV = {
    preparer:   [{ id: "dashboard", t: "لوحة المعلومات", icon: "dashboard" }, { id: "cases", t: "طلبات للإعداد", icon: "assignment" }, { id: "messages", t: "المراسلات", icon: "forum" }, { id: "notifications", t: "الإشعارات", icon: "notifications" }, { id: "log", t: "سجل القرارات", icon: "history" }, { id: "profile", t: "الملف الشخصي", icon: "account_circle" }],
    members:    [{ id: "dashboard", t: "لوحة المعلومات", icon: "dashboard" }, { id: "cases", t: "المطروح للتصويت", icon: "how_to_vote" }, { id: "messages", t: "المراسلات", icon: "forum" }, { id: "notifications", t: "الإشعارات", icon: "notifications" }, { id: "log", t: "سجل القرارات", icon: "history" }, { id: "profile", t: "الملف الشخصي", icon: "account_circle" }],
    leadership: [{ id: "dashboard", t: "لوحة المعلومات", icon: "dashboard" }, { id: "approvals", t: "الاعتمادات", icon: "approval" }, { id: "cases", t: "التصويت والإصدار", icon: "gavel" }, { id: "messages", t: "المراسلات", icon: "forum" }, { id: "notifications", t: "الإشعارات", icon: "notifications" }, { id: "log", t: "سجل القرارات", icon: "history" }, { id: "profile", t: "الملف الشخصي", icon: "account_circle" }],
  };

  const foreignBadge = (q) => q.foreign ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginInlineStart: 7, padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--info-10)", color: "var(--color-info)", fontSize: 11, fontWeight: 700 }}><I name="public" size={12} fill /> أجنبي · م6</span> : null;
  // الهوية محجوبة في الخطّ الحقيقي — لا اسم لطالب الحماية في هذه المرحلة، فلا كشف
  const CaseHead = ({ q, timer }) => (
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
      <div className="row"><SecretCode code={q.secret} name="" canReveal={false} />{q.foreign && <Tag tone="info" size="sm" iconLeft={<I name="public" size={13} fill />}>أجنبي · م6</Tag>}{q.risk && q.risk !== "—" && <RiskLevel level={q.risk} />}</div>
      {timer}
    </div>
  );

  const modeFor = (scope, me, q) => scope === "preparer" ? "prepare" : (scope === "leadership" && ["pending_deputy", "pending_chair"].includes(dOf(q.secret).status)) ? "approve" : "session";
  const isApprovalAction = (scope, me, q) => { const s = dOf(q.secret).status; return scope === "leadership" && ((me === "deputy" && s === "pending_deputy") || (me === "chair" && s === "pending_chair")); };
  const poolOf = (scope) => scope === "preparer" ? allCases().filter((q) => { const d = dOf(q.secret); return d.mine || d.unclaimed; }) : allCases();

  // ————————————————— الإشعارات — مشتقّة من حالة المخزن الحقيقية —————————————————
  const NT = { info: ["var(--info-10)", "var(--color-info)"], primary: ["var(--green-10)", "var(--color-primary)"], warning: ["var(--warning-10)", "var(--color-warning)"], success: ["var(--success-10)", "var(--color-success)"], error: ["var(--error-10)", "var(--color-error)"] };
  const NOTIF_FILTERS = [{ id: "all", t: "الكل" }, { id: "unread", t: "غير المقروء" }, { id: "task", t: "المهام" }, { id: "deadline", t: "المهل" }, { id: "message", t: "الرسائل" }];

  function notifsOf(scope, seat) {
    const out = [];
    poolOf(scope).forEach((q) => {
      const d = dOf(q.secret);
      const res = HD.resultFor(q.secret);
      const act = HD.nextActionOf(scope, seat, q);
      if (act) {
        // «عاجل» بمهلة م10: المعدّ (إعداد/طرح) · النائب (اعتماد) · الرئيس (إصدار بعد الإغلاق)
        const urgent = (scope === "preparer" && (d.status === "preparing" || d.status === "approved"))
          || (seat === "deputy" && d.status === "pending_deputy")
          || (seat === "chair" && d.status === "pending_chair")
          || (seat === "chair" && d.status === "voting" && res.closed && !d.issued);
        const dest = isApprovalAction(scope, seat, q) ? "approvals" : "cases";
        const when = d.status === "voting" ? d.votingStartedAt
          : d.status === "pending_deputy" ? d.submittedAt
          : d.status === "pending_chair" ? (d.approvals && d.approvals.deputy && d.approvals.deputy.when) || d.submittedAt
          : d.status === "approved" ? (d.approvals && (d.approvals.chair || d.approvals.deputy) && (d.approvals.chair || d.approvals.deputy).when) : "";
        const whenTs = d.status === "voting" ? d.votingStartedAtTs
          : d.status === "pending_deputy" ? d.submittedAtTs
          : d.status === "pending_chair" ? (d.approvals && d.approvals.deputy && d.approvals.deputy.whenTs) || d.submittedAtTs
          : d.status === "approved" ? (d.approvals && (d.approvals.chair || d.approvals.deputy) && (d.approvals.chair || d.approvals.deputy).whenTs) : null;
        out.push({
          id: (urgent ? "urgent" : "task") + ":" + q.secret + ":" + d.status,
          cat: urgent ? "urgent" : "task",
          icon: urgent ? "timer" : d.status === "voting" ? "how_to_vote" : d.status === "pending_deputy" || d.status === "pending_chair" ? "approval" : d.status === "approved" ? "task_alt" : "assignment",
          tone: urgent ? "error" : "warning",
          t: urgent ? "مهلة نظامية جارية — إجراء مطلوب منك" : "بند يتطلّب إجراءك",
          d: "الإجراء المطلوب منك: " + act + " — الرمز السري " + q.secret + ".",
          time: when || "", ts: whenTs, group: dayGroup(whenTs),
          deadline: urgent ? { label: "مظلّة إصدار القرار والإشعار", total: 3, elapsed: bizDaysSince(whenTs), ref: "م10" } : null,
          action: dest, actionLabel: dest === "approvals" ? "مراجعة واعتماد" : "اتّخذ الإجراء",
        });
      }
      if (scope === "preparer" && d.status === "preparing" && (d.rejections || []).length && (d.mine || d.unclaimed)) {
        const last = d.rejections[d.rejections.length - 1];
        out.push({ id: "task:" + q.secret + ":returned:" + d.rejections.length, cat: "task", icon: "undo", tone: "warning", t: "أُعيد إليك القرار من القيادة", d: "الطلب " + q.secret + " — " + (last.note || "بملاحظات القيادة") + ".", time: last.when || "", ts: last.whenTs, group: dayGroup(last.whenTs), action: "cases", actionLabel: "تعديل وإعادة رفع" });
      }
      if (d.issued) {
        out.push({ id: "task:" + q.secret + ":issued", cat: "task", icon: "gavel", tone: "info", t: "صدر قرار المركز: " + d.issued.type, d: "صدر القرار في الطلب " + q.secret + " وأُشعِر الطرفان (م10).", time: d.issued.when || "", ts: d.issued.whenTs, group: dayGroup(d.issued.whenTs), action: "log", actionLabel: "سجل القرارات" });
      }
    });
    return out;
  }

  // ————————————————— المعدّ: إعداد القرار من الدراسات والتقييمات —————————————————
  function PrepareDecision({ q, back }) {
    const d = dOf(q.secret);
    const canEdit = d.status === "preparing";
    const [types, setTypes] = useState(d.types && d.types.length ? d.types : []);
    const [duration, setDuration] = useState(d.duration || "30 يوماً");
    const [reasoning, setReasoning] = useState(d.reasoning || HD.REASON_SKELETON);
    const toggleType = (t) => setTypes((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]);
    const ready = types.length > 0 && duration && reasoning.trim();
    const lastReject = (d.rejections || []).slice(-1)[0];
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع لقائمة الإعداد</button>
      <CaseHead q={q} timer={<Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><ReviewPackage q={q} attachEditable={canEdit} /></Card>
      {canEdit ? <Card className="card pad">
        <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> إعداد قرار المركز</p>
        {lastReject && <InlineAlert kind="warning" title="أُعيد إليك من نائب الرئيس للتعديل" style={{ marginBottom: 14 }}>{lastReject.note} <span className="muted">({lastReject.when})</span></InlineAlert>}
        <InlineAlert kind="info" title="دورك: إعدادٌ محايد — لا توصية ولا تصويت" style={{ marginBottom: 14 }}>تُعِدّ القرار من الدراسات والتقييمات أعلاه ثم ترفعه لنائب رئيس المركز للاطّلاع والاعتماد؛ وبعد اعتماده يعود إليك لطرحه على أعضاء المجلس للتصويت. القرار خالصٌ للمجلس (م4/8).</InlineAlert>
        <div className="fld"><span className="fld-label">أنواع الحماية المقترحة (المادة 14)</span>
          <div className="chips">{PROTECTION_TYPES.map((t) => <button key={t} className={"chip" + (types.includes(t) ? " on" : "")} onClick={() => toggleType(t)}>{t}</button>)}</div></div>
        <div className="fld"><span className="fld-label">مدّة الحماية</span>
          <div className="chips">{["30 يوماً", "90 يوماً", "إلى حين انتهاء القضية"].map((o) => <button key={o} className={"chip" + (duration === o ? " on" : "")} onClick={() => setDuration(o)}>{o}</button>)}</div></div>
        <div className="fld"><span className="fld-label">حيثيات القرار <span style={{ color: "var(--color-error)" }}>· إلزامي</span></span>
          <textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} dir="auto" style={{ minHeight: 120 }} /></div>
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => { HD.saveDecision(q.secret, { types, duration, reasoning }); }}><I name="save" size={17} /> حفظ المسوّدة</button>
          <button className="btn btn-primary" disabled={!ready} onClick={() => { HD.submitForApproval(q.secret, { types, duration, reasoning }); back(); }}><I name="send" size={17} /> رفع لنائب الرئيس للاعتماد</button>
        </div>
      </Card> : <React.Fragment>
        <DecisionView decision={d} foreign={q.foreign} />
        {d.status === "pending_deputy" && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="warning" title="بانتظار اعتماد نائب رئيس المركز">رُفع القرار المُعَدّ للاطّلاع والاعتماد — الحلقة الأولى (النائب) ثم الثانية (الرئيس)، وبعدهما يعود إليك لطرحه على أعضاء المجلس للتصويت، أو يُعاد إليك للتعديل بملاحظات القيادة.</InlineAlert></Card>}
        {d.status === "pending_chair" && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="warning" title="بانتظار اعتماد رئيس المركز">اعتمده نائب الرئيس{d.approvals && d.approvals.deputy ? " (" + d.approvals.deputy.when + ")" : ""} وهو الآن في حلقة اعتماد الرئيس — بعدها يعود إليك للطرح.</InlineAlert></Card>}
        {d.status === "approved" && <Card className="card pad" style={{ marginTop: 16 }}>
          <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> طرح القرار للتصويت</p>
          <InlineAlert kind="success" title={"اعتمده النائب والرئيس" + (d.approvals && d.approvals.chair ? " · " + d.approvals.chair.when : "")} style={{ marginBottom: 14 }}>اكتملت حلقتا المراجعة (نائب الرئيس ثم الرئيس) وعاد القرار إليك. بطرحه يُعرض على أعضاء المجلس للتصويت المستقلّ وتبدأ مهلة يوم العمل.</InlineAlert>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={() => { HD.openVoting(q.secret); back(); }}><I name="how_to_vote" size={17} /> طرح على أعضاء المجلس للتصويت</button>
          </div>
        </Card>}
        {(d.status === "voting" || d.status === "issued") && <InlineAlert kind={d.status === "issued" ? "success" : "info"} title={STATUS[d.status].t} style={{ marginTop: 16 }}>
          {d.status === "voting" ? "طُرح القرار على المجلس للتصويت — لا تعديل عليه الآن." : "صدر قرار المركز بناءً على التصويت وأُشعِر الطرفان."}
        </InlineAlert>}
      </React.Fragment>}
    </div>);
  }

  // ————————————————— القيادة: مراجعة واعتماد القرار المُعَدّ (نائب الرئيس حصراً) —————————————————
  function ApprovalReview({ q, me, back }) {
    const d = dOf(q.secret);
    const [rejecting, setRejecting] = useState(false);
    const [note, setNote] = useState("");
    const myTurn = (me === "deputy" && d.status === "pending_deputy") || (me === "chair" && d.status === "pending_chair");
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للاعتمادات</button>
      <CaseHead q={q} timer={<Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><ReviewPackage q={q} /></Card>
      <DecisionView decision={d} foreign={q.foreign} />
      <Card className="card pad" style={{ marginTop: 16 }}>
        <p className="sec-h"><I name="approval" size={18} color="var(--color-primary)" /> حلقتا المراجعة والاعتماد — النائب ثم الرئيس</p>
        {me === "deputy" && <InlineAlert kind="info" title="حلقة النائب (الأولى)" style={{ marginBottom: 12 }}>باعتمادك يمرّ القرار إلى رئيس المركز لمراجعته واعتماده، ثم يعود للمعدّ ليطرحه على أعضاء المجلس للتصويت.</InlineAlert>}
        {me === "chair" && <InlineAlert kind="info" title="حلقة الرئيس (الثانية)" style={{ marginBottom: 12 }}>القرار يصلك بعد اعتماد النائب{d.approvals && d.approvals.deputy ? " (" + d.approvals.deputy.when + ")" : ""}؛ باعتمادك يعود للمعدّ ليطرحه على أعضاء المجلس للتصويت.</InlineAlert>}
        {!myTurn ? <InlineAlert kind={["approved", "voting", "issued"].includes(d.status) ? "success" : "warning"} title="لا إجراء مطلوباً منك الآن">
          {d.status === "pending_deputy" && me === "chair" && "في حلقة النائب — يصلك بعد اعتماده."}
          {d.status === "pending_chair" && me === "deputy" && "اعتمدتَه وهو الآن في حلقة اعتماد الرئيس."}
          {d.status === "approved" && "اكتملت الحلقتان وعاد للمعدّ لطرحه للتصويت."}
          {(d.status === "voting" || d.status === "issued") && "اكتمل الاعتماد وطُرح للتصويت."}
          {d.status === "preparing" && "أُعيد للمعدّ للتعديل."}
        </InlineAlert> : rejecting ? <React.Fragment>
          <div className="fld"><span className="fld-label">سبب الإعادة للمعدّ <span style={{ color: "var(--color-error)" }}>· إلزامي</span></span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="وضّح ما يلزم تعديله في القرار…" dir="auto" /></div>
          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setRejecting(false)}>تراجع</button>
            <button className="btn btn-primary" disabled={!note.trim()} onClick={() => { HD.rejectApproval(q.secret, note.trim()); back(); }}><I name="undo" size={17} /> إعادة للمعدّ</button>
          </div>
        </React.Fragment> : <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setRejecting(true)}><I name="undo" size={17} /> إعادة للمعدّ للتعديل</button>
          {me === "deputy"
            ? <button className="btn btn-primary" onClick={() => { HD.approve(q.secret); back(); }}><I name="verified" size={18} /> اعتماد وتمرير لرئيس المركز</button>
            : <button className="btn btn-primary" onClick={() => { HD.approveChair(q.secret); back(); }}><I name="verified" size={18} /> اعتماد وإعادة للمعدّ لطرحه</button>}
        </div>}
      </Card>
    </div>);
  }

  // ————————————————— جلسة القرار (تصويت العضو / حصيلة القيادة وإصدار الرئيس) —————————————————
  function DecisionSession({ q, me, scope, back }) {
    const d = dOf(q.secret);
    const votesFor = HD.getVotes(q.secret);
    const res = HD.resultFor(q.secret);
    const [reason, setReason] = useState("");
    const [viewed, setViewed] = useState([]);
    const isLead = scope === "leadership";
    const attachments = HD.getAttachments(q.secret);
    // «المعاينة تفتح التصويت»: إن وُجدت مرفقات وجبت معاينتها كلّها قبل التصويت؛ وإلّا فُتح مباشرةً
    const allViewed = attachments.length === 0 || attachments.every((a) => viewed.indexOf(a.id) >= 0);
    const markViewed = (id) => setViewed((v) => v.indexOf(id) >= 0 ? v : v.concat([id]));
    const outcome = res.outcome;
    const rejectNotes = VOTING_SEATS.map((s) => votesFor[s]).filter((v) => v && v.choice === "رفض" && v.note).map((v) => v.note);
    const defReason = outcome === "مقبول" ? (d.reasoning || "") : "أسباب الرفض المستندة إلى مداولة المجلس:\n- " + (rejectNotes.length ? rejectNotes.join("\n- ") : "لم تتوافر مسوّغات كافية للحماية وفق عوامل المادة 9.");
    useEffect(() => { if (res.closed && isLead && !d.issued) setReason((r) => r || defReason); }, [res.closed, outcome]);
    const votable = d.status === "voting";
    const my = votesFor[me];
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع</button>
      <CaseHead q={q} timer={votable && !d.issued ? <Timer startTs={d.votingStartedAtTs} /> : <Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><ReviewPackage q={q} onView={markViewed} viewed={viewed} /></Card>
      <DecisionView decision={d} foreign={q.foreign} />
      {d.issued ? <Card className="card pad" style={{ marginTop: 16 }}>
        <InlineAlert kind={d.issued.type === "قبول" ? "success" : "warning"} title={"صدر قرار المركز: " + d.issued.type}>صدر القرار بناءً على تصويت المجلس وأُشعِر <b>طالب الحماية والجهة المختصة</b> ({d.issued.when}). {d.issued.type === "رفض" ? "مع حقّ التظلّم خلال 10 أيام (م21)." : ""}</InlineAlert>
      </Card> : !isLead ? <React.Fragment>
        {votable && d.voteOpen && !my && !allViewed && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="warning" title="المعاينة تفتح التصويت">افتح «معاينة» لكل مرفق داعم أعلاه ليُفتح التصويت بعد الاطّلاع الكامل ({viewed.length}/{attachments.length}).</InlineAlert></Card>}
        {votable ? <VoteBox my={my} canVote={!!d.voteOpen && allViewed} onCast={(c, n) => HD.castVote(q.secret, me, c, n)} subject="قرار المركز المُعَدّ" />
          : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="لم يُطرح للتصويت بعد">يُفتح التصويت بعد اعتماد نائب الرئيس للقرار المُعَدّ وطرح المعدّ له.</InlineAlert></Card>}
        {votable && !d.voteOpen && !my && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="انتهت مهلة التصويت">أُغلق باب التصويت على هذا القرار؛ لم يُسجَّل لك صوت خلاله.</InlineAlert></Card>}
      </React.Fragment> : votable ? <React.Fragment>
        <CouncilTally result={res} votesFor={votesFor} seat={me} onCast={(c, n) => HD.castVote(q.secret, me, c, n)} onClose={() => HD.closeByDeadline(q.secret)} />
        {res.closed && (me === "chair" ? <Card className="card pad" style={{ marginTop: 16 }}>
          <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> إصدار قرار المركز</p>
          {q.foreign && outcome === "مقبول" && <InlineAlert kind="warning" title="مسار أجنبي — تُرفع للنائب العام" style={{ marginBottom: 12 }}>القرار في الطلب الأجنبي توصية تُرفع إلى النائب العام للبتّ النهائي (المادة 6)، ثمّ تُبلَّغ عبر اللجنة الدائمة.</InlineAlert>}
          <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">حصيلة تصويت المجلس</span><b style={{ color: outcome === "مقبول" ? "var(--color-success)" : "var(--color-error)" }}>{outcome} · قبول {res.accept} / رفض {res.reject}</b></div>
          {outcome === "مقبول" ? <InlineAlert kind="success" title="قبول — وفق قرار المركز المُعَدّ" style={{ marginBottom: 12 }}>يصدر القبول باعتماد قرار المركز المُعَدّ (أنواع الحماية ومدّتها مبيّنة فيه). يُشعَر طالب الحماية والجهة (م10).</InlineAlert> : <InlineAlert kind="warning" title="قرار رفض مكتوب مسبّب" style={{ marginBottom: 12 }}>يُصدَر قرار رفضٍ مسبَّب يتضمّن حقّ التظلّم خلال 10 أيام (المادة 21).</InlineAlert>}
          <div className="fld"><span className="fld-label">تسبيب قرار المركز {outcome === "مرفوض" && <span style={{ color: "var(--color-error)" }}>· إلزامي</span>}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" style={{ minHeight: 100 }} /></div>
          <InlineAlert kind="info" title="اعتماد القرار">يُصدره رئيس المركز بعد إغلاق التصويت — والحصيلة تُحسم في القاعدة، والإصدار يُشعِر طالب الحماية والجهة (م10).</InlineAlert>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn btn-primary" disabled={outcome === "مرفوض" && !reason.trim()} onClick={() => { HD.issue(q.secret, { reason }); back(); }}><I name="verified" size={18} /> إصدار القرار وإشعار الطرفين</button>
          </div>
        </Card> : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="الإصدار بيد رئيس المركز">اكتمل التصويت وظهرت الحصيلة أعلاه. يتولّى <b>رئيس المركز</b> إصدار القرار وإشعار الطرفين (م10)؛ للنائب الاطّلاع والمتابعة.</InlineAlert></Card>)}
      </React.Fragment> : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title={STATUS[d.status].t}>يُطرح للتصويت بعد اعتماد النائب وطرح المعدّ للقرار.</InlineAlert></Card>}
    </div>);
  }

  // ————————————————— لوحة المعلومات (العمل الأبرز + عدّادات حيّة + المهلة + التحديثات) —————————————————
  function Stat({ icon, v, l, bg, fg, onClick }) { return <button className="dash-stat" onClick={onClick}><span className="ntf-ico" style={{ background: bg, color: fg }}><I name={icon} size={20} fill /></span><span><span className="dash-num">{v}</span><span className="dash-lbl" style={{ display: "block" }}>{l}</span></span></button>; }

  function Dashboard({ scope, me, go, open, notifs, readIds, markRead, unreadNotifs, unreadMsgs }) {
    const pool = poolOf(scope);
    const actionable = pool.map((q) => ({ q, act: HD.nextActionOf(scope, me, q) })).filter((x) => x.act);
    const hero = actionable[0] || null;
    const heroQ = hero ? hero.q : pool[0];
    const heroD = heroQ ? dOf(heroQ.secret) : null;
    const stage = heroD ? stageOf(heroD.status) : null;
    const ledes = {
      preparer: "تستقبل الدراسات والتقييمات المُجمَّعة وتُعِدّ عليها قرار المركز إعداداً محايداً، ثم ترفعه لنائب رئيس المركز للاعتماد؛ وبعد اعتماده يعود إليك لطرحه على أعضاء المجلس للتصويت. كل ما يتطلّب إجراءً منك يظهر هنا أولاً.",
      members: "تطّلع على قرارات المركز المطروحة وتدلي بصوتك (قبول/رفض) مستقلّاً — كل ما يتطلّب إجراءً منك يظهر هنا أولاً.",
      leadership: me === "deputy" ? "تطّلع على القرار المُعَدّ وتعتمده فيعود للمعدّ لطرحه للتصويت، وتصوّت كعضو — كل ما يتطلّب إجراءً منك يظهر هنا أولاً." : "تتابع الاعتماد (بيد النائب)، وتصوّت كعضو، ثم تُصدر قرار المركز وتُشعِر الطرفين — كل ما يتطلّب إجراءً منك يظهر هنا أولاً.",
    };
    const st = (s) => pool.filter((q) => dOf(q.secret).status === s).length;
    const readyToIssue = pool.filter((q) => { const d = dOf(q.secret); return d.status === "voting" && HD.resultFor(q.secret).closed && !d.issued; }).length;
    const pendingMyVote = pool.filter((q) => { const d = dOf(q.secret); return d.status === "voting" && d.voteOpen && !HD.getVotes(q.secret)[me]; }).length;
    const stats = scope === "preparer" ? [
      ["edit_note", st("preparing"), "بانتظار الإعداد", "var(--warning-10)", "var(--color-warning)", "cases"],
      ["task_alt", st("approved"), "بانتظار الطرح", "var(--green-10)", "var(--color-primary)", "cases"],
      ["how_to_vote", st("pending_deputy") + st("pending_chair") + st("voting"), "قيد الدورة", "var(--info-10)", "var(--color-info)", "cases"],
    ] : scope === "members" ? [
      ["how_to_vote", pendingMyVote, "بانتظار صوتك", "var(--warning-10)", "var(--color-warning)", "cases"],
      ["inbox", st("voting"), "مطروح للتصويت", "var(--info-10)", "var(--color-info)", "cases"],
      ["gavel", st("issued"), "قرارات صدرت", "var(--green-10)", "var(--color-primary)", "log"],
    ] : [
      ["approval", st("pending_deputy") + st("pending_chair"), "في حلقتي الاعتماد", "var(--warning-10)", "var(--color-warning)", "approvals"],
      ["how_to_vote", st("voting"), "مطروح للتصويت", "var(--info-10)", "var(--color-info)", "cases"],
      ["done_all", readyToIssue, "جاهز للإصدار", "var(--error-10)", "var(--color-error)", "cases"],
      ["gavel", st("issued"), "قرارات صدرت", "var(--green-10)", "var(--color-primary)", "log"],
    ];
    const midCycle = scope === "members" ? st("voting") > 0 : pool.some((q) => dOf(q.secret).status !== "issued");
    // المهلة الجارية — تُحسب بأيام العمل من الطابع الزمني الفعليّ للواقعة الجارية
    const eventTsOf = (d) => d.issued ? null : (d.votingStartedAtTs || (d.approvals && d.approvals.deputy && d.approvals.deputy.whenTs) || d.submittedAtTs || null);
    const votingTs = pool.map((q) => dOf(q.secret)).filter((d) => d.status === "voting" && d.voteOpen).map((d) => d.votingStartedAtTs).filter(Boolean)[0] || null;
    const cycleTs = (heroD && eventTsOf(heroD)) || pool.map((q) => eventTsOf(dOf(q.secret))).filter(Boolean)[0] || null;
    // «آخر التحديثات» — أحدث الإشعارات؛ النقر يفتح الوجهة ويعلّم الإشعار مقروءاً
    const updates = notifs.slice().sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)).slice(0, 4);
    return (<div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">{ledes[scope]}</p>
      {heroQ && <Card className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="ntf-ico" style={{ width: 46, height: 46, background: hero ? "var(--warning-10)" : "var(--green-10)", color: hero ? "var(--color-warning)" : "var(--color-primary)" }}><I name={hero ? "touch_app" : "task_alt"} size={22} fill /></span>
            <span>
              <span className="row" style={{ gap: 8, marginBottom: 4 }}>
                <b style={{ fontSize: 15, color: "var(--text-strong)" }}>{hero ? "العمل الأبرز لديك" : "لا إجراء مطلوباً منك الآن"}</b>
                {heroD && <Tag tone={STATUS[heroD.status].tone} size="sm" iconLeft={<I name={STATUS[heroD.status].icon} size={12} />}>{STATUS[heroD.status].t}</Tag>}
                {hero && <Tag tone="warning" size="sm" iconLeft={<I name="touch_app" size={12} />}>يتطلّب إجراء</Tag>}
              </span>
              <span className="muted" style={{ display: "block" }}>الرمز السري <span className="mono">{heroQ.secret}</span>{heroQ.cat && heroQ.cat !== "—" ? " · " + heroQ.cat : ""}{foreignBadge(heroQ)}</span>
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => open(heroQ, modeFor(scope, me, heroQ))}><I name={hero ? "touch_app" : "visibility"} size={18} /> {hero ? "اتّخذ الإجراء" : "عرض الطلب"}</button>
        </div>
        {hero && <div className="row" style={{ gap: 7, marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--warning-70)" }}><I name="arrow_left_alt" size={15} /> الإجراء المطلوب منك: {hero.act}</div>}
        {heroD && <React.Fragment>
          <div className="stp" aria-hidden="true">{DECISION_STAGES.map((_, i) => <span key={i} className={i < stage + 1 ? "on" : ""} />)}</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>المرحلة {Math.min(stage + 1, DECISION_STAGES.length)} من {DECISION_STAGES.length} — {DECISION_STAGES[Math.min(stage, DECISION_STAGES.length - 1)]}</div>
        </React.Fragment>}
      </Card>}
      <div className="dash-stats">
        {stats.map(([icon, v, l, bg, fg, dest], i) => <Stat key={i} icon={icon} v={v} l={l} bg={bg} fg={fg} onClick={() => go(dest)} />)}
      </div>
      <div className="dash-grid2">
        <Card className="card pad">
          <div className="row" style={{ gap: 8, marginBottom: 12 }}><I name="timer" size={18} color="var(--color-primary)" /><b style={{ fontSize: 13.5, color: "var(--text-strong)" }}>المهلة النظامية الجارية</b></div>
          {midCycle ? <React.Fragment>
            {scope === "members" ? <DeadlineTimer label="مهلة التصويت — يوم عمل واحد" totalDays={1} daysElapsed={bizDaysSince(votingTs)} articleRef="م10" /> : <DeadlineTimer label="مظلّة إصدار القرار والإشعار" totalDays={3} daysElapsed={bizDaysSince(cycleTs)} articleRef="م10" />}
            <p className="muted" style={{ margin: "12px 0 0", fontSize: 12 }}>{scope === "members" ? "يُغلق التصويت ببلوغ الأغلبية (4/7) أو انتهاء يوم العمل — أيّهما أسبق." : "من استلام مخرَج الدراسة والتقييم حتى إصدار القرار وإشعار الطرفين."}</p>
          </React.Fragment> : <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>لا مهل نظامية جارية الآن.</p>}
        </Card>
        <Card className="card" style={{ padding: "10px 8px" }}>
          <div className="row" style={{ gap: 8, padding: "6px 12px 8px", justifyContent: "space-between" }}>
            <span className="row" style={{ gap: 8 }}><I name="update" size={18} color="var(--color-primary)" /><b style={{ fontSize: 13.5, color: "var(--text-strong)" }}>آخر التحديثات</b></span>
            <button className="linkbtn" onClick={() => go("notifications")}>كل الإشعارات</button>
          </div>
          {updates.map((n) => { const [bg, fg] = NT[n.tone]; return (
            <button className="dash-ntf" key={n.id} onClick={() => { markRead(n.id); go(n.action || "notifications"); }}>
              <span className="ntf-ico" style={{ background: bg, color: fg, width: 30, height: 30 }}><I name={n.icon} size={16} fill /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.t}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.d}</span>
                {n.time && <span className="ntf-time">{n.time}</span>}
              </span>
              {!readIds.includes(n.id) && <span className="dot-unread" style={{ marginTop: 0 }} />}
            </button>); })}
          {updates.length === 0 && <p className="muted" style={{ margin: "6px 12px 10px", fontSize: 12.5 }}>لا تحديثات مسجّلة بعد.</p>}
        </Card>
      </div>
    </div>);
  }

  // ————————————————— القوائم (طلبات الإعداد / المطروح / التصويت والإصدار) —————————————————
  function Cases({ scope, me, open }) {
    if (scope === "preparer") {
      const mine = poolOf("preparer");
      return (<div>
        <h2 className="h2">طلبات إعداد القرار</h2>
        <p className="lede">طلبات اكتملت دراستها وتقييمها ومُسنَدة إليك (كلٌّ معزول). افتح الطلب لإعداد قرار المركز ورفعه لنائب الرئيس، ثم طرحه للتصويت بعد اعتماده.</p>
        {mine.length === 0 ? <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>لا طلبات مُسنَدة إليك بعد.</Card>
        : <Card className="card" style={{ overflow: "hidden" }}><div className="tbl-wrap"><table>
          <thead><tr><th>الرمز السري</th><th>الفئة</th><th>تصنيف الخطر</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{mine.map((q) => { const d = dOf(q.secret); const st = STATUS[d.status]; const act = HD.nextActionOf("preparer", me, q); return (
            <tr key={q.secret} className="clk" onClick={() => open(q, "prepare")}>
              <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{q.secret}{foreignBadge(q)}{act && <span style={{ display: "block", marginTop: 5, fontSize: 11.5, fontWeight: 600, color: "var(--warning-70)", fontFamily: "var(--font-sans)" }}>الإجراء المطلوب منك: {act}</span>}</td>
              <td>{q.cat && q.cat !== "—" ? <Tag tone="info" size="sm">{q.cat}</Tag> : <span className="muted">—</span>}</td>
              <td>{q.risk && q.risk !== "—" ? <RiskLevel level={q.risk} /> : <span className="muted">—</span>}</td>
              <td><div className="row" style={{ gap: 6 }}><Tag tone={st.tone} size="sm" iconLeft={<I name={st.icon} size={12} />}>{st.t}</Tag>{act && <Tag tone="warning" size="sm" iconLeft={<I name="touch_app" size={12} />}>يتطلّب إجراء</Tag>}</div></td>
              <td><span className="link">{d.status === "preparing" ? "إعداد القرار" : d.status === "approved" ? "طرح للتصويت" : "عرض"} <I name="chevron_left" size={16} /></span></td>
            </tr>); })}</tbody>
        </table></div></Card>}
      </div>);
    }
    const list = allCases().filter((q) => ["voting", "issued"].includes(dOf(q.secret).status));
    const statusCell = (q) => {
      const d = dOf(q.secret); if (d.issued) return <Tag tone={d.issued.type === "قبول" ? "success" : "warning"} size="sm">صدر: {d.issued.type}</Tag>;
      const r = HD.resultFor(q.secret);
      if (scope === "leadership") return r.closed ? <Tag tone={r.outcome === "مقبول" ? "success" : "warning"} size="sm">{r.outcome} · {r.accept}/{r.reject}</Tag> : <Tag tone="info" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>تصويت جارٍ · {r.cast}/{VOTING_SEATS.length}</Tag>;
      const my = HD.getVotes(q.secret)[me]; return my ? <Tag tone={my.choice === "رفض" ? "warning" : "success"} size="sm">صوتك: {my.choice}</Tag> : <Tag tone="warning" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>بانتظار صوتك</Tag>;
    };
    return (<div>
      <h2 className="h2">{scope === "leadership" ? "التصويت وإصدار القرار" : "المطروح للتصويت"}</h2>
      <p className="lede">{scope === "leadership" ? "قرارات معتمَدة مطروحة للتصويت — تصوّت كعضو ثم يُصدر الرئيس بعد الإغلاق." : "قرارات المركز المُعتمَدة المطروحة — أدلِ بصوتك مستقلّاً."}</p>
      <InlineAlert kind="warning" title="مهلة التصويت: يوم عمل واحد كحدّ أقصى" style={{ marginBottom: 16 }}>يُغلق التصويت ببلوغ الأغلبية الحاسمة (4/7) أو انتهاء يوم العمل — أيّهما أسبق. من لم يصوّت يُدوَّن دون تعطيل القرار.</InlineAlert>
      {list.length === 0 ? <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>لا قرارات مطروحة للتصويت حالياً.</Card>
      : <Card className="card" style={{ overflow: "hidden" }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>الفئة</th><th>تصنيف الخطر</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{list.map((q) => { const act = HD.nextActionOf(scope, me, q); return (
          <tr key={q.secret} className="clk" onClick={() => open(q, "session")}>
            <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{q.secret}{foreignBadge(q)}{act && <span style={{ display: "block", marginTop: 5, fontSize: 11.5, fontWeight: 600, color: "var(--warning-70)", fontFamily: "var(--font-sans)" }}>الإجراء المطلوب منك: {act}</span>}</td>
            <td>{q.cat && q.cat !== "—" ? <Tag tone="info" size="sm">{q.cat}</Tag> : <span className="muted">—</span>}</td>
            <td>{q.risk && q.risk !== "—" ? <RiskLevel level={q.risk} /> : <span className="muted">—</span>}</td>
            <td>{statusCell(q)}</td>
            <td><span className="link">{scope === "leadership" ? "الحصيلة والإصدار" : "الاطّلاع والتصويت"} <I name="chevron_left" size={16} /></span></td>
          </tr>); })}</tbody>
      </table></div></Card>}
    </div>);
  }

  // ————————————————— القيادة: الاعتمادات —————————————————
  function Approvals({ me, open }) {
    const pending = allCases().filter((q) => dOf(q.secret).status === (me === "deputy" ? "pending_deputy" : "pending_chair"));
    const later = allCases().filter((q) => { const s = dOf(q.secret).status; return me === "deputy" ? ["pending_chair", "approved", "voting", "issued"].includes(s) : ["pending_deputy", "approved", "voting", "issued"].includes(s); });
    return (<div>
      <h2 className="h2">اعتماد القرارات المُعَدّة</h2>
      <p className="lede">{me === "deputy" ? "الحلقة الأولى: تطّلع على قرار المركز المُعَدّ وتعتمده فيمرّ إلى رئيس المركز، ثم يعود للمعدّ ليطرحه على أعضاء المجلس للتصويت." : "الحلقة الثانية: يصلك القرار بعد اعتماد النائب لتراجعه وتعتمده، فيعود للمعدّ ليطرحه على أعضاء المجلس للتصويت."}</p>
      <Card className="card" style={{ overflow: "hidden", marginBottom: 16 }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>الفئة</th><th>المعدّ</th><th>تصنيف الخطر</th><th></th></tr></thead>
        <tbody>{pending.length ? pending.map((q) => (
          <tr key={q.secret} className="clk" onClick={() => open(q, "approve")}>
            <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{q.secret}{foreignBadge(q)}<span style={{ display: "block", marginTop: 5, fontSize: 11.5, fontWeight: 600, color: "var(--warning-70)", fontFamily: "var(--font-sans)" }}>الإجراء المطلوب منك: مراجعة القرار المُعَدّ واعتماده</span></td>
            <td>{q.cat && q.cat !== "—" ? <Tag tone="info" size="sm">{q.cat}</Tag> : <span className="muted">—</span>}</td>
            <td className="muted">{PREPARERS.prep1.name}</td>
            <td>{q.risk && q.risk !== "—" ? <RiskLevel level={q.risk} /> : <span className="muted">—</span>}</td>
            <td><span className="link">مراجعة واعتماد <I name="chevron_left" size={16} /></span></td>
          </tr>)) : <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 22 }}>{me === "deputy" ? "لا قرارات بانتظار اعتمادك." : "الاعتماد بيد نائب الرئيس — تتابع القرارات أدناه."}</td></tr>}</tbody>
      </table></div></Card>
      {later.length > 0 && <React.Fragment>
        <p className="sec-h" style={{ margin: "4px 0 10px" }}><I name="history" size={17} color="var(--text-secondary)" /> {me === "deputy" ? "قرارات تجاوزت مرحلة اعتمادك" : "القرارات في مسار الاعتماد والتصويت"}</p>
        <div style={{ display: "grid", gap: 8 }}>{later.map((q) => { const d = dOf(q.secret); return (
          <div key={q.secret} className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <span className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{q.secret}</span>{q.cat && q.cat !== "—" && <Tag tone="info" size="sm">{q.cat}</Tag>}
            <span style={{ marginInlineStart: "auto" }}><Tag tone={STATUS[d.status].tone} size="sm" iconLeft={<I name={STATUS[d.status].icon} size={12} />}>{STATUS[d.status].t}</Tag></span>
          </div>); })}</div>
      </React.Fragment>}
    </div>);
  }

  // ————————————————— الإشعارات (فلاتر + عاجل مثبّت + مهل حيّة + ثبات القراءة) —————————————————
  function Notifs({ go, notifs, readIds, markRead, markAllRead }) {
    const [flt, setFlt] = useState("all");
    const isUnread = (n) => !readIds.includes(n.id);
    const inCat = (n, f) => f === "deadline" ? (!!n.deadline || n.cat === "urgent") : n.cat === f;
    const match = (n) => flt === "all" ? true : flt === "unread" ? isUnread(n) : inCat(n, flt);
    const countOf = (f) => notifs.filter((n) => f === "all" ? true : f === "unread" ? isUnread(n) : inCat(n, f)).length;
    const openNtf = (n) => { markRead(n.id); if (n.action) go(n.action); };
    const visible = notifs.filter(match);
    const crit = visible.filter((n) => n.cat === "urgent");
    const rest = visible.filter((n) => n.cat !== "urgent");
    const Item = ({ n }) => {
      const [bg, fg] = NT[n.tone];
      const unread = isUnread(n);
      return (
        <button className={"ntf" + (n.cat === "urgent" ? " crit" : unread ? " unread" : "")} onClick={() => openNtf(n)}>
          <div className="ntf-ico" style={{ background: n.cat === "urgent" ? "var(--color-error)" : bg, color: n.cat === "urgent" ? "#fff" : fg }}><I name={n.icon} size={20} fill /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="ntf-t">{n.t}</span>
              {n.cat === "urgent" && <Tag tone="error" size="sm" iconLeft={<I name="priority_high" size={12} />}>عاجل</Tag>}
            </div>
            <div className="ntf-d">{n.d}</div>
            {n.deadline && <div style={{ marginTop: 10, maxWidth: 420 }}><DeadlineTimer label={n.deadline.label} totalDays={n.deadline.total} daysElapsed={n.deadline.elapsed} articleRef={n.deadline.ref} /></div>}
            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              {n.time && <span className="ntf-time">{n.time}</span>}
              {n.action && <span className="linkbtn" style={{ fontSize: 12.5 }}>{n.actionLabel || "فتح"} <I name="chevron_left" size={14} /></span>}
            </div>
          </div>
          {unread && <div className="dot-unread" />}
        </button>
      );
    };
    return (<div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات المهامّ والمهل النظامية والمراسلات في مرحلة القرار. انقر أي إشعار لفتح وجهته، والإشعارات العاجلة مثبّتة أعلى القائمة.</p>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          {NOTIF_FILTERS.map((f) => (<button key={f.id} className={"flt" + (flt === f.id ? " on" : "")} onClick={() => setFlt(f.id)}>{f.t}<span className="flt-n">{countOf(f.id)}</span></button>))}
        </div>
        <button className="btn btn-ghost sm" onClick={markAllRead}><I name="done_all" size={16} /> تعليم الكل كمقروء</button>
      </div>
      {crit.length > 0 && <div style={{ display: "grid", gap: 10, marginBottom: 4 }}>{crit.map((n) => <Item n={n} key={n.id} />)}</div>}
      {["اليوم", "أمس", "الأقدم"].map((g) => { const list = rest.filter((n) => (n.group || "الأقدم") === g).sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)); return list.length === 0 ? null : (
        <div key={g}>
          <div className="ntf-group">{g}</div>
          <div style={{ display: "grid", gap: 10 }}>{list.map((n) => <Item n={n} key={n.id} />)}</div>
        </div>); })}
      {visible.length === 0 && (
        <div className="ntf-empty">
          <I name="notifications_off" size={34} color="var(--text-disabled)" />
          <b style={{ color: "var(--text-strong)" }}>لا إشعارات هنا</b>
          <span style={{ fontSize: 13 }}>{flt === "unread" ? "قرأت كل إشعاراتك." : "لا إشعارات في هذا التصنيف بعد."}</span>
        </div>
      )}
    </div>);
  }

  // ————————————————— المراسلات (خيوط حقيقية معزولة بالمقعد؛ القيادة تطّلع على الجميع) —————————————————
  const counterpartOf = (scope, t) => scope === "leadership"
    ? (t.party === "preparer" ? { name: PREPARERS.prep1.name, role: PREPARERS.prep1.t } : { name: "عضو المجلس", role: "عضو المجلس" })
    : { name: (SEATS[t.with] || {}).name || t.with, role: (SEATS[t.with] || {}).t || "" };

  function Messages({ scope, me, unreadOf, markThreadRead }) {
    const [sel, setSel] = useState(null);
    const [draft, setDraft] = useState("");
    const [composing, setComposing] = useState(false);
    const [cCase, setCCase] = useState("");
    const [cWith, setCWith] = useState("");
    const threads = HD.getThreads(scope);
    const canCompose = scope !== "leadership";
    const composeCases = scope === "preparer" ? poolOf("preparer") : allCases().filter((q) => dOf(q.secret).status === "voting");
    const found = sel ? HD.findThread(sel) : null;
    const cur = sel ? (found || { id: sel, secret: sel.split("/")[0], party: sel.split("/")[1], with: sel.split("/")[3], msgs: [] }) : null;
    useEffect(() => { if (found) markThreadRead(found); }, [sel, found ? found.msgs.length : 0]);
    const send = () => { if (!draft.trim() || !cur) return; HD.sendMessage(cur.id, draft.trim()); setDraft(""); };
    const startCompose = () => { if (!cCase || !cWith) return; const id = HD.startThread(scope === "preparer" ? "preparer" : "member", cCase, cWith); setComposing(false); setCCase(""); setCWith(""); setSel(id); };

    if (cur) {
      const other = counterpartOf(scope, cur);
      return (<div>
        <button className="link" onClick={() => setSel(null)} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للمراسلات</button>
        <Card className="card" style={{ overflow: "hidden" }}>
          <div className="row" style={{ gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-subtle)" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surface-card)", display: "grid", placeItems: "center", flexShrink: 0 }}><I name="shield_person" size={20} color="var(--color-primary)" /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{other.name} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {other.role}</span></div>
              <div className="mono muted" style={{ fontSize: 11.5 }}>بشأن الطلب {cur.secret}</div></div>
            <Tag tone="info" size="sm" iconLeft={<I name="badge" size={12} />}>هوية وظيفية — طالب الحماية بالرمز السري</Tag>
            <Tag tone="error" size="sm" iconLeft={<I name="lock" size={12} />}>قناة مؤمّنة</Tag>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: 420, overflowY: "auto", background: "var(--surface-page)" }}>
            {cur.msgs.length === 0 && <div className="muted" style={{ textAlign: "center", fontSize: 13, padding: 18 }}>لا رسائل بعد — ابدأ المحادثة.</div>}
            {cur.msgs.map((m, i) => { const mine = !!m.fromMe; return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-start" : "flex-end" }}>
                <div style={{ maxWidth: "82%", background: mine ? "var(--color-primary)" : "var(--surface-card)", color: mine ? "#fff" : "var(--text-strong)", border: mine ? "none" : "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.65 }}>{m.t}</div>
                <span className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>{mine ? "أنت" : ((SEATS[m.from] || PREPARERS[m.from] || {}).name || other.name)} · {m.when}</span>
                {mine && <span className="muted" style={{ fontSize: 10.5, marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4 }}><I name="check_circle" size={12} color="var(--color-success)" /> سُلّمت — مسجّلة في التدقيق</span>}
              </div>); })}
          </div>
          <div className="row" style={{ gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="اكتب رسالتك…" dir="auto" style={{ flex: 1 }} />
            <button className="btn btn-primary" style={{ width: 44, padding: 0 }} onClick={send} disabled={!draft.trim()}><I name="send" size={18} /></button>
          </div>
        </Card>
      </div>);
    }

    return (<div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 className="h2" style={{ margin: 0 }}>المراسلات</h2>
        {canCompose && !composing && <button className="btn btn-primary" onClick={() => setComposing(true)}><I name="add_comment" size={18} /> بدء مراسلة</button>}
      </div>
      <p className="lede">{scope === "leadership" ? "قنوات مؤمّنة مع أعضاء المجلس ومعدّي القرار — تطّلع على جميع المراسلات وتردّ عليها. كلها مسجّلة في التدقيق." : "قناة مؤمّنة مع قيادة المجلس (النائب/الرئيس) للاستيضاح بشأن قرارٍ مطروح — معزولة عن بقية الأعضاء ومسجّلة في التدقيق."}</p>
      {composing && <Card className="card pad" style={{ marginBottom: 16 }}>
        <p className="sec-h"><I name="add_comment" size={18} color="var(--color-primary)" /> بدء مراسلة مع القيادة</p>
        <div className="fld"><span className="fld-label">{scope === "preparer" ? "الطلب المُسنَد إليك" : "الطلب المطروح للتصويت"}</span>
          <select value={cCase} onChange={(e) => setCCase(e.target.value)}>
            <option value="">— اختر الطلب —</option>{composeCases.map((q) => <option key={q.secret} value={q.secret}>{q.secret}{q.cat && q.cat !== "—" ? " · " + q.cat : ""}</option>)}</select></div>
        <div className="fld"><span className="fld-label">إلى</span><div className="chips">{["deputy", "chair"].map((k) => <button key={k} className={"chip" + (cWith === k ? " on" : "")} onClick={() => setCWith(k)}>{SEATS[k].name} · {SEATS[k].t}</button>)}</div></div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button className="btn btn-ghost" onClick={() => { setComposing(false); setCCase(""); setCWith(""); }}>إلغاء</button><button className="btn btn-primary" disabled={!cCase || !cWith} onClick={startCompose}><I name="forum" size={17} /> بدء المراسلة</button></div>
      </Card>}
      {threads.length === 0 && !composing && <div className="ntf-empty">
        <I name="forum" size={30} color="var(--text-disabled)" />
        <b style={{ color: "var(--text-strong)" }}>لا مراسلات في مقعدك بعد</b>
        <span style={{ fontSize: 13 }}>{canCompose ? "ابدأ مراسلة مع القيادة عند الحاجة للاستيضاح." : "تُفتح القنوات عند مراسلة الأعضاء أو المعدّين لك."}</span>
      </div>}
      <div style={{ display: "grid", gap: 10 }}>{threads.map((t) => { const last = t.msgs[t.msgs.length - 1] || { t: "مراسلة جديدة", when: "" }; const other = counterpartOf(scope, t); const un = unreadOf(t); return (
        <div key={t.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer" }} onClick={() => setSel(t.id)}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: un > 0 ? "var(--green-10)" : "var(--surface-subtle)", display: "grid", placeItems: "center", flexShrink: 0 }}><I name={scope === "leadership" ? (t.party === "preparer" ? "assignment_ind" : "account_circle") : "shield_person"} size={20} color="var(--color-primary)" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div className="row" style={{ justifyContent: "space-between", gap: 8 }}><span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-strong)" }}>{other.name} <span className="mono muted" style={{ fontWeight: 400 }}>· {t.secret}</span></span><span className="muted" style={{ fontSize: 11 }}>{last.when}</span></div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scope === "leadership" && t.party === "preparer" ? "معدّ القرار · " : ""}{last.t}</div></div>
          {un > 0 && <span className="nav-badge" style={{ marginInlineStart: 0 }}>{un}</span>}
          <I name="chevron_left" size={18} color="var(--text-secondary)" />
        </div>); })}</div>
    </div>);
  }

  // ————————————————— سجل القرارات —————————————————
  function DecisionsLog() {
    const rows = allCases().map((q) => ({ q, d: dOf(q.secret) })).filter((x) => x.d.issued).map((x) => ({ secret: x.q.secret, cat: x.q.cat, type: x.d.issued.type, when: x.d.issued.when }));
    const TONE = { "قبول": "success", "رفض": "error" };
    return (<div>
      <h2 className="h2">سجل القرارات</h2>
      <p className="lede">القرارات الصادرة عن المجلس وحالة الإشعار — غير قابلة للتعديل ومسجّلة في التدقيق (م24–32).</p>
      {rows.length === 0 ? <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>لا قرارات صادرة بعد.</Card>
      : <Card className="card" style={{ overflow: "hidden" }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>الفئة</th><th>القرار</th><th>التاريخ</th><th>الإشعار</th></tr></thead>
        <tbody>{rows.map((d, i) => (
          <tr key={i}><td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{d.secret}</td>
            <td>{d.cat && d.cat !== "—" ? <Tag tone="info" size="sm">{d.cat}</Tag> : <span className="muted">—</span>}</td>
            <td><Tag tone={TONE[d.type] || "info"} size="sm">{d.type}</Tag></td><td className="muted">{d.when}</td>
            <td><Tag tone="success" size="sm" iconLeft={<I name="mark_email_read" size={13} />}>أُشعر الطرفان — م10</Tag></td></tr>))}</tbody>
      </table></div></Card>}
    </div>);
  }

  // ————————————————— الملف الشخصي —————————————————
  function Profile({ scope, me }) {
    const id = identOf(scope, me);
    const note = scope === "preparer" ? "دورك إعدادٌ محايد: تستقبل الدراسات والتقييمات وتُعِدّ عليها قرار المركز دون توصية بالقبول أو الرفض ودون تصويت؛ ترفعه لنائب الرئيس للاعتماد، وبعد اعتماده تطرحه على أعضاء المجلس للتصويت." : scope === "leadership" ? "النائب يعتمد القرار المُعَدّ فيعود للمعدّ لطرحه، والقيادة تصوّت كأعضاء، والرئيس يُصدر قرار المركز عند اكتمال التصويت ويُشعِر الطرفين. للرئيس ترجيح الجانب عند التعادل." : "تصويتك مستقلّ (قبول/رفض) على قرار المركز المُعَدّ ولا تطّلع على أصوات بقية الأعضاء ولا الحصيلة؛ تظهر للنائب والرئيس فقط.";
    const auth = scope === "preparer" ? "إعداد قرار المركز من الدراسات والتقييمات + رفعه للاعتماد + طرحه للتصويت بعد الاعتماد (بلا تصويت ولا توصية)" : scope === "leadership" ? "اعتماد القرار (النائب) + التصويت كعضو + إصدار القرار والإشعار (الرئيس)" : "الاطّلاع الكامل + التصويت المستقلّ (قبول/رفض)";
    const fields = [["الاسم", id.name], ["الصفة", id.t], ["الجهة", id.org], ["نطاق العمل", "مرحلة القرار — إدارة البرنامج"], ["الصلاحية", auth], ["التوثيق", "نفاذ + MFA"]];
    return (<div>
      <h2 className="h2">الملف الشخصي</h2>
      <p className="lede">حسابك وصلاحياتك ونطاق عملك في مرحلة القرار.</p>
      <Card className="card pad">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>{fields.map(([l, v], i) => (<div className="ro-field" key={i}><span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{l}</span><span style={{ fontSize: 13, color: "var(--text-body)" }}>{v}</span></div>))}</div>
        <InlineAlert kind="info" title={scope === "preparer" ? "الحياد والفصل" : "استقلال الرأي"} style={{ marginTop: 14 }}>{note}</InlineAlert>
      </Card>
    </div>);
  }

  // ————————————————— القشرة والتنقّل —————————————————
  function Shell({ scope }) {
    useStore();
    const meReal = HD.getMe();
    const seatList = seatsOf(scope);
    const me = (meReal && meReal.seat) || seatList[0];
    const [active, setActive] = useState("dashboard");
    const [sel, setSel] = useState(null); // {q, mode}
    const [open, setOpen] = useState(false);
    const [confirmOut, setConfirmOut] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [readIds, setReadIds] = useState([]);
    const [msgRead, setMsgRead] = useState({});
    const nav = NAV[scope];
    const meta = SCOPE_META[scope];
    const id = identOf(scope, me);
    const nKey = "hdNtfRead-v1:" + scope + ":" + me, mKey = "hdMsgRead-v1:" + scope + ":" + me;
    // تحميل ثبات القراءة والطيّ بعد الترسية (SSR-safe — لا فرق خادم/عميل عند أول رسم)
    useEffect(() => { try { setCollapsed(localStorage.getItem("hdSideCollapsed-v1") === "1"); } catch (e) {} }, []);
    useEffect(() => {
      try {
        const a = localStorage.getItem(nKey); setReadIds(a ? JSON.parse(a) : []);
        const b = localStorage.getItem(mKey); setMsgRead(b ? JSON.parse(b) : {});
      } catch (e) { setReadIds([]); setMsgRead({}); }
    }, [nKey, mKey]);
    const toggleCollapse = () => setCollapsed((c) => { try { localStorage.setItem("hdSideCollapsed-v1", c ? "0" : "1"); } catch (e) {} return !c; });
    const persistN = (ids) => { setReadIds(ids); try { localStorage.setItem(nKey, JSON.stringify(ids)); } catch (e) {} };
    const persistM = (map) => { setMsgRead(map); try { localStorage.setItem(mKey, JSON.stringify(map)); } catch (e) {} };

    // المراسلات: غير المقروء لكل خيط (عدّاد قراءةٍ ثابت محلياً)
    const threads = HD.getThreads(scope);
    const unreadOf = (t) => { const seenN = msgRead[t.id] || 0; let n = 0; for (let i = seenN; i < t.msgs.length; i++) if (!t.msgs[i].fromMe) n++; return n; };
    const markThreadRead = (t) => { if ((msgRead[t.id] || 0) < t.msgs.length) persistM({ ...msgRead, [t.id]: t.msgs.length }); };
    const unreadMsgs = threads.reduce((a, t) => a + unreadOf(t), 0);

    // الإشعارات: مهام/مهل من المخزن + رسائل غير مقروءة
    const msgNotifs = threads.filter((t) => unreadOf(t) > 0 && t.msgs.length && !t.msgs[t.msgs.length - 1].fromMe).map((t) => ({
      id: "message:" + t.id + ":" + t.msgs.length, cat: "message", icon: "forum", tone: "primary",
      t: "رسالة جديدة في المراسلات", d: counterpartOf(scope, t).name + " — بشأن الطلب " + t.secret + ".",
      time: (t.msgs[t.msgs.length - 1] || {}).when || "", ts: (t.msgs[t.msgs.length - 1] || {}).whenTs, group: dayGroup((t.msgs[t.msgs.length - 1] || {}).whenTs),
      action: "messages", actionLabel: "فتح المراسلات",
    }));
    const notifs = notifsOf(scope, me).concat(msgNotifs);
    const markRead = (nid) => { if (!readIds.includes(nid)) persistN([...readIds, nid]); };
    const markAllRead = () => persistN(Array.from(new Set([...readIds, ...notifs.map((n) => n.id)])));
    const unreadNotifs = notifs.filter((n) => !readIds.includes(n.id)).length;

    // شارات القائمة الجانبية
    const actionable = poolOf(scope).filter((q) => HD.nextActionOf(scope, me, q));
    const apprCount = actionable.filter((q) => isApprovalAction(scope, me, q)).length;
    const casesCount = actionable.length - apprCount;
    const navBadge = (nid) => nid === "notifications" ? (unreadNotifs || null) : nid === "messages" ? (unreadMsgs || null) : nid === "approvals" ? (apprCount || null) : nid === "cases" ? (casesCount || null) : null;

    const scrollTop = () => { if (typeof window !== "undefined") window.scrollTo(0, 0); };
    const go = (a) => { setActive(a); setSel(null); setOpen(false); };
    const openCase = (q, mode) => { setSel({ q, mode }); scrollTop(); };
    const signout = () => { fetch("/auth/signout", { method: "POST" }).then(() => { window.location.href = "/"; }); };

    let body;
    if (sel && sel.mode === "prepare") { body = <PrepareDecision q={sel.q} back={() => { setSel(null); setActive("cases"); }} />; }
    else if (sel && sel.mode === "approve") { body = <ApprovalReview q={sel.q} me={me} back={() => { setSel(null); setActive("approvals"); }} />; }
    else if (sel && sel.mode === "session") { body = <DecisionSession q={sel.q} me={me} scope={scope} back={() => { setSel(null); setActive("cases"); }} />; }
    else if (active === "cases") { body = <Cases scope={scope} me={me} open={openCase} />; }
    else if (active === "approvals") { body = <Approvals me={me} open={openCase} />; }
    else if (active === "messages") { body = <Messages scope={scope} me={me} unreadOf={unreadOf} markThreadRead={markThreadRead} />; }
    else if (active === "notifications") { body = <Notifs go={go} notifs={notifs} readIds={readIds} markRead={markRead} markAllRead={markAllRead} />; }
    else if (active === "log") { body = <DecisionsLog />; }
    else if (active === "profile") { body = <Profile scope={scope} me={me} />; }
    else { body = <Dashboard scope={scope} me={me} go={go} open={openCase} notifs={notifs} readIds={readIds} markRead={markRead} unreadNotifs={unreadNotifs} unreadMsgs={unreadMsgs} />; }

    return (
      <div className="shell">
        <aside className={"side" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
          <div className="brand">
            <div className="brand-mark"><I name="shield_person" size={22} fill color="#fff" /></div>
            <div className="brand-txt brand-logos">
              {/* التطبيق يعمل خلف basePath /decision — وسم <img> يحتاج البادئة صراحةً */}
              <img src="/decision/brand/logo-center.png" alt="مركز حماية الشهود والمبلّغين والخبراء والضحايا — النيابة العامة" />
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>{meta.portal}</div>
            </div>
            <button className="collapse-btn" onClick={toggleCollapse} title={collapsed ? "توسيع القائمة" : "طيّ القائمة"} aria-label={collapsed ? "توسيع القائمة" : "طيّ القائمة"}><I name={collapsed ? "left_panel_open" : "left_panel_close"} size={20} /></button>
          </div>
          <nav className="nav">{nav.map((n) => { const b = navBadge(n.id); return (
            <button key={n.id} className={"nav-item" + (active === n.id && !sel ? " on" : "")} title={collapsed ? n.t : undefined} onClick={() => go(n.id)}>
              <I name={n.icon} size={20} /> <span className="nav-lbl">{n.t}</span>
              {b && <span className="nav-badge">{b}</span>}
            </button>); })}</nav>
          <div className="side-bottom">
            <div className="side-user" title={id.name + " — موثّق عبر نفاذ"}>
              <span className="su-av">{(id.name || "؟").trim().charAt(0)}</span>
              <span className="nav-lbl" style={{ minWidth: 0 }}>
                <span className="su-name" style={{ display: "block" }}>{id.name}</span>
                <span className="su-badge"><I name="verified_user" size={12} fill /> موثّق عبر نفاذ</span>
              </span>
            </div>
            <button className="logout-btn" title="تسجيل الخروج" onClick={() => setConfirmOut(true)}><I name="logout" size={19} /> <span className="nav-lbl">تسجيل الخروج</span></button>
            <div className="side-copy nav-lbl">© 2026 النيابة العامة</div>
          </div>
        </aside>
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
            {sel && sel.q && <SecretChip code={sel.q.secret} />}
            <span className="who">
              <button className="qa-btn" title="المراسلات" onClick={() => go("messages")}>
                <I name="forum" size={20} />
                {unreadMsgs > 0 && <span className="qa-badge">{unreadMsgs}</span>}
              </button>
              <button className="qa-btn" title="الإشعارات" onClick={() => go("notifications")}>
                <I name="notifications" size={20} />
                {unreadNotifs > 0 && <span className="qa-badge">{unreadNotifs}</span>}
              </button>
              <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
              <div className="avatar"><I name="person" size={20} /></div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{id.name}</span>
            </span>
          </header>
          <main className="content">{body}</main>
        </div>
        {confirmOut && (
          <div className="nf-scrim" onClick={() => setConfirmOut(false)}>
            <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
              <div className="row" style={{ justifyContent: "center", gap: 8 }}>
                <I name="logout" size={22} color="var(--color-error)" />
                <b style={{ fontSize: 16, color: "var(--text-strong)" }}>تسجيل الخروج</b>
              </div>
              <p className="muted" style={{ margin: "10px 0 18px", lineHeight: 1.6 }}>ستُنهى جلستك الموثّقة عبر نفاذ، وستحتاج للدخول مجدداً لمتابعة عملك في مرحلة القرار. هل تريد المتابعة؟</p>
              <button className="btn" style={{ width: "100%", background: "var(--color-error)", color: "#fff" }} onClick={signout}><I name="logout" size={18} /> تسجيل الخروج</button>
              <button className="linkbtn" style={{ marginTop: 12 }} onClick={() => setConfirmOut(false)}>إلغاء</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return Shell;
})();

// ————— الغلاف: يحقن أفعال الخادم ويُغذّي المخزن من props ثم يرندر —————
export function DecisionPortal({ scope, initialData }) {
  useState(() => { HD.hydrate(initialData); return true; }); // تغذية مرّةً واحدة (متطابقة خادم/عميل)
  useEffect(() => {
    HD.setActions({
      saveDecision: DecActions.saveDecision,
      submitForApproval: DecActions.submitForApproval,
      approve: DecActions.approve,
      approveChair: DecActions.approveChair,
      rejectApproval: DecActions.rejectApproval,
      openVoting: DecActions.openVoting,
      castVote: DecActions.castVote,
      closeDeadline: DecActions.closeDeadline,
      issue: DecActions.issue,
      setAttachment: DecActions.setAttachment,
      removeAttachment: DecActions.removeAttachment,
      sendMessage: DecActions.sendCouncilMessage,
    });
  }, []);
  return <App scope={scope} />;
}
