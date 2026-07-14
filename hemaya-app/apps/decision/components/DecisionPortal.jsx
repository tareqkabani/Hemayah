'use client';
/* ============================================================
   بوابة مرحلة القرار والإشعار — المسار الجديد (بطلب رئيس المركز).
   منقولة من decision-app.jsx: window/__decisionScreens/HP → @hemaya/ui + وحدات محلّية.
   النطاقات: preparer (معدّ) · members (أعضاء) · leadership (قيادة).
   المسار: إنشاء الطلب → رفع المرفقات → طرحٌ مباشرٌ للتصويت → إصدار الرئيس.
   البيانات حقيقيّة من Supabase (hydrate + أفعال الخادم).
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Card, Tag, InlineAlert, SecretCode, RiskLevel } from "@hemaya/ui";
import { HemayaDecision } from "./decision-store";
import { DScreens } from "./decision-screens";
import * as DecActions from "@/lib/dec-actions";
import "./decision.css";

const HD = HemayaDecision;

const App = (function () {
  const S = DScreens;
  const { AttachmentsPanel, VoteBox, CouncilTally, Timer, I, STATUS, identOf, seatsOf, useStore } = S;
  const SEATS = HD.SEATS, PREPARERS = HD.PREPARERS, VOTING_SEATS = HD.VOTING_SEATS;

  const SCOPE_META = {
    preparer:   { sub: "معدّ قرار المركز", foot: "إنشاء الطلب ورفع مستنداته كاملةً ثم طرحها مباشرةً للتصويت — بلا توصية ولا تصويت · القرار خالصٌ للمجلس." },
    members:    { sub: "أعضاء المجلس",     foot: "تصويت مستقلّ (قبول/رفض) بعد معاينة كل المرفقات · لا اطّلاع على أصوات الغير · مسجّل في التدقيق." },
    leadership: { sub: "قيادة المجلس",      foot: "اطّلاع على حصيلة التصويت · تصويت كأعضاء · إصدار القرار بيد الرئيس وإشعار الطرفين (م10)." },
  };
  const NAV = {
    preparer:   [{ id: "dashboard", t: "لوحة المعلومات", icon: "dashboard" }, { id: "cases", t: "طلباتي للإعداد", icon: "assignment" }, { id: "messages", t: "المراسلات", icon: "forum" }, { id: "notifications", t: "الإشعارات", icon: "notifications" }, { id: "log", t: "سجل القرارات", icon: "history" }, { id: "profile", t: "الملف الشخصي", icon: "account_circle" }],
    members:    [{ id: "dashboard", t: "لوحة المعلومات", icon: "dashboard" }, { id: "cases", t: "المطروح للتصويت", icon: "how_to_vote" }, { id: "messages", t: "المراسلات", icon: "forum" }, { id: "notifications", t: "الإشعارات", icon: "notifications" }, { id: "log", t: "سجل القرارات", icon: "history" }, { id: "profile", t: "الملف الشخصي", icon: "account_circle" }],
    leadership: [{ id: "dashboard", t: "لوحة المعلومات", icon: "dashboard" }, { id: "cases", t: "التصويت والإصدار", icon: "gavel" }, { id: "messages", t: "المراسلات", icon: "forum" }, { id: "notifications", t: "الإشعارات", icon: "notifications" }, { id: "log", t: "سجل القرارات", icon: "history" }, { id: "profile", t: "الملف الشخصي", icon: "account_circle" }],
  };

  const dOf = (s) => HD.getDecision(s) || { status: "preparing", preparer: "prep1", files: {}, docs: [], attachedDocs: [], packageConfirmed: false, votingStartedAt: null, deadlineClosed: false, issued: null };
  const CaseHead = ({ q, canReveal, timer }) => (
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
      <div className="row"><SecretCode code={q.secret} canReveal={!!canReveal} />{q.cat && q.cat !== "—" && <Tag tone="info" size="sm">{q.cat}</Tag>}{q.risk && q.risk !== "—" && <RiskLevel level={q.risk} />}</div>
      {timer}
    </div>
  );

  // ————— المعدّ: إنشاء طلب حماية جديد (المنطلق) —————
  function CreateRequest({ me, onCreated, back }) {
    const [name, setName] = useState("");
    const [nid, setNid] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const ready = name.trim().length > 2 && /^[0-9]{10}$/.test(nid.trim()) && !busy;
    const create = async () => {
      setBusy(true); setErr("");
      const secret = await HD.createRequest({ name: name.trim(), nid: nid.trim() });
      setBusy(false);
      if (secret) onCreated(secret); else setErr("تعذّر إنشاء الطلب — تحقّق من صلاحيتك ثم أعِد المحاولة.");
    };
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع</button>
      <h2 className="h2">إنشاء طلب حماية</h2>
      <p className="lede">المعدّ هو منطلق المنصّة: يُدخِل البيانات الأولية (اسم طالب الحماية ورقم الهوية) لتكون المرجع في النظام، ثم يُرفق المستندات ويطرحها للتصويت.</p>
      <Card className="card pad" style={{ marginBottom: 16 }}>
        <p className="sec-h"><I name="badge" size={18} color="var(--color-primary)" /> البيانات الأولية</p>
        <InlineAlert kind="info" title="مرجعٌ في النظام — هوية غير موثّقة بعد" style={{ marginBottom: 14 }}>يُدخِل المعدّ الاسم ورقم الهوية كمرجعٍ للطلب. توثيق الهوية عبر نفاذ لازمٌ لاحقاً للاتفاقية (م11) والتظلّم (م21).</InlineAlert>
        <div className="fld"><span className="fld-label">اسم طالب الحماية</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" dir="auto" /></div>
        <div className="fld"><span className="fld-label">رقم الهوية الوطنية</span><input value={nid} onChange={(e) => setNid(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} placeholder="1xxxxxxxxx" inputMode="numeric" dir="ltr" style={{ textAlign: "start" }} />
          {nid && !/^[0-9]{10}$/.test(nid) && <span style={{ fontSize: 12, color: "var(--color-error)" }}>رقم الهوية يجب أن يكون 10 أرقام.</span>}</div>
        {err && <InlineAlert kind="error" title="خطأ">{err}</InlineAlert>}
      </Card>
      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button className="btn btn-ghost" onClick={back}>إلغاء</button>
        <button className="btn btn-primary" disabled={!ready} onClick={create}><I name={busy ? "hourglass_top" : "arrow_back"} size={18} /> {busy ? "جارٍ الإنشاء…" : "إنشاء الطلب وإرفاق المستندات"}</button>
      </div>
    </div>);
  }

  // ————— المعدّ: الإعداد ورفع المرفقات + الطرح للتصويت —————
  function PrepareDecision({ q, back }) {
    const d = dOf(q.secret);
    const canEdit = d.status === "preparing";
    const [certified, setCertified] = useState(!!d.packageConfirmed);
    const docs = HD.caseDocuments(q.secret);
    const reqIds = HD.requiredDocIds(q.secret);
    const allAttached = reqIds.length > 0 && reqIds.every((id) => (docs.find((x) => x.id === id) || {}).fileName);
    const ready = allAttached && certified;
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع لقائمة الإعداد</button>
      <CaseHead q={q} canReveal={true} timer={<Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      {canEdit ? <React.Fragment>
        <Card className="card pad" style={{ marginBottom: 16 }}>
          <AttachmentsPanel secret={q.secret} editable applicant={q.applicant} certified={certified} onCertify={setCertified} />
        </Card>
        <Card className="card pad">
          <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> طرح الحزمة للتصويت</p>
          <InlineAlert kind="info" title="دورك: إنشاء الطلب وإرفاق مستنداته — لا توصية ولا تصويت" style={{ marginBottom: 14 }}>ترفع كل المستندات (من طلب الحماية حتى قرار المركز المُعَدّ) كمرفقات، ثم تطرحها مباشرةً على المجلس للتصويت. القرار خالصٌ للمجلس (م4/8).</InlineAlert>
          {!ready && <InlineAlert kind="warning" title="أكمِل المرفقات والإقرار" style={{ marginBottom: 12 }}>لا تُطرح الحزمة للتصويت حتى تُرفَق كل المستندات المطلوبة ويُؤكَّد إقرار الاكتمال (في لوحة المرفقات أعلاه).</InlineAlert>}
          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-primary" disabled={!ready} onClick={() => { HD.submitForVoting(q.secret); back(); }}><I name="how_to_vote" size={17} /> طرح المرفقات للتصويت</button>
          </div>
        </Card>
      </React.Fragment> : <React.Fragment>
        <Card className="card pad" style={{ marginBottom: 16 }}><AttachmentsPanel secret={q.secret} editable={false} applicant={q.applicant} /></Card>
        <InlineAlert kind={d.status === "issued" ? "success" : "info"} title={STATUS[d.status].t}>
          {d.status === "voting" && "طُرحت المرفقات على المجلس للتصويت — لا تعديل عليها الآن."}
          {d.status === "issued" && "صدر قرار المركز بناءً على التصويت وأُشعِر الطرفان."}
        </InlineAlert>
      </React.Fragment>}
    </div>);
  }

  // ————— جلسة القرار (تصويت العضو / حصيلة القيادة وإصدار الرئيس) —————
  function DecisionSession({ q, me, scope, back }) {
    const d = dOf(q.secret);
    const votesFor = HD.getVotes(q.secret);
    const res = HD.resultFor(q.secret);
    const [reason, setReason] = useState("");
    const [viewed, setViewed] = useState([]);
    const isLead = scope === "leadership";
    const reqDocIds = HD.requiredDocIds(q.secret);
    const allViewed = reqDocIds.length > 0 && reqDocIds.every((id) => viewed.indexOf(id) >= 0);
    const markViewed = (id) => setViewed((v) => v.indexOf(id) >= 0 ? v : v.concat([id]));
    const outcome = res.outcome;
    const rejectNotes = Object.keys(votesFor).map((s) => votesFor[s]).filter((v) => v && v.choice === "رفض" && v.note).map((v) => v.note);
    const defReason = outcome === "مقبول" ? "" : "أسباب الرفض المستندة إلى مداولة المجلس:\n- " + (rejectNotes.length ? rejectNotes.join("\n- ") : "لم تتوافر مسوّغات كافية للحماية وفق عوامل المادة 9.");
    useEffect(() => { if (res.closed && isLead && !d.issued) setReason((r) => r || defReason); }, [res.closed, outcome]);
    const votable = d.status === "voting";
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع</button>
      <CaseHead q={q} canReveal={isLead} timer={votable ? <Timer /> : <Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><AttachmentsPanel secret={q.secret} editable={false} applicant={q.applicant} onView={markViewed} viewed={viewed} /></Card>
      {d.issued ? <Card className="card pad" style={{ marginTop: 16 }}>
        <InlineAlert kind={d.issued.type === "قبول" ? "success" : "warning"} title={"صدر قرار المركز: " + d.issued.type}>صدر القرار بناءً على تصويت المجلس وأُشعِر <b>طالب الحماية والجهة المختصة</b> ({d.issued.when}). {d.issued.type === "رفض" ? "مع حقّ التظلّم خلال 10 أيام (م21)." : ""}</InlineAlert>
      </Card> : !isLead ? <React.Fragment>
        {votable && !votesFor[me] && !allViewed && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="warning" title="اطّلع على كل المرفقات لتفعيل التصويت">افتح «معاينة» لكل مرفق مطلوب ليُفتح التصويت بعد الاطّلاع الكامل ({viewed.filter((id) => reqDocIds.indexOf(id) >= 0).length}/{reqDocIds.length}).</InlineAlert></Card>}
        {votable ? <VoteBox my={votesFor[me]} canVote={!res.closed && allViewed} onCast={(c, n) => HD.castVote(q.secret, me, c, n)} subject="حزمة القرار المرفقة" />
          : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="لم يُطرح للتصويت بعد">القرار قيد الإعداد؛ يُفتح التصويت بعد رفع المعدّ للمرفقات وطرحها.</InlineAlert></Card>}
        {votable && res.closed && !votesFor[me] && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="انتهت مهلة التصويت">أُغلق باب التصويت على هذا القرار؛ لم يُسجَّل لك صوت خلاله.</InlineAlert></Card>}
      </React.Fragment> : votable ? <React.Fragment>
        <CouncilTally result={res} votesFor={votesFor} seat={me} onCast={(c, n) => HD.castVote(q.secret, me, c, n)} onClose={() => HD.closeByDeadline(q.secret)} />
        {res.closed && (me === "chair" ? <Card className="card pad" style={{ marginTop: 16 }}>
          <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> إصدار قرار المركز</p>
          <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">حصيلة تصويت المجلس</span><b style={{ color: outcome === "مقبول" ? "var(--color-success)" : "var(--color-error)" }}>{outcome} · قبول {res.accept} / رفض {res.reject}</b></div>
          {outcome === "مقبول" ? <InlineAlert kind="success" title="قبول — وفق قرار المركز المُعَدّ المرفق" style={{ marginBottom: 12 }}>يصدر القبول باعتماد قرار المركز المُعَدّ المرفق (أنواع الحماية ومدّتها مبيّنة فيه). يُشعَر طالب الحماية والجهة (م10).</InlineAlert> : <InlineAlert kind="warning" title="قرار رفض مكتوب مسبّب" style={{ marginBottom: 12 }}>يُصدَر قرار رفضٍ مسبَّب يتضمّن حقّ التظلّم خلال 10 أيام (المادة 21).</InlineAlert>}
          <div className="fld"><span className="fld-label">تسبيب قرار المركز {outcome === "مرفوض" && <span style={{ color: "var(--color-error)" }}>· إلزامي</span>}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" style={{ minHeight: 100 }} /></div>
          <InlineAlert kind="info" title="اعتماد القرار">يُصدره رئيس المركز بعد إغلاق التصويت — والإصدار يُشعِر طالب الحماية والجهة (م10).</InlineAlert>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn btn-primary" disabled={outcome === "مرفوض" && !reason.trim()} onClick={() => { HD.issue(q.secret, { type: outcome === "مقبول" ? "قبول" : "رفض", reason }); back(); }}><I name="verified" size={18} /> إصدار القرار وإشعار الطرفين</button>
          </div>
        </Card> : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="الإصدار بيد رئيس المركز">اكتمل التصويت وظهرت الحصيلة أعلاه. يتولّى <b>رئيس المركز</b> إصدار القرار وإشعار الطرفين (م10)؛ للنائب الاطّلاع والمتابعة.</InlineAlert></Card>)}
      </React.Fragment> : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title={STATUS[d.status].t}>يُطرح للتصويت بعد رفع المعدّ للمرفقات.</InlineAlert></Card>}
    </div>);
  }

  // ————— لوحات القوائم —————
  function Stat({ icon, v, l, bg, fg }) { return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></Card>; }

  function Dashboard({ scope, me, go, onCreate }) {
    if (scope === "preparer") {
      const mine = HD.allCases();
      const toPrep = mine.filter((q) => dOf(q.secret).status === "preparing");
      const inFlight = mine.filter((q) => ["voting", "issued"].includes(dOf(q.secret).status));
      return (<div>
        <h2 className="h2">لوحة المعلومات</h2>
        <p className="lede">بصفتك معدّ قرار (مستشار قانوني) ومنطلق المرحلة، تُنشئ طلب الحماية وتُرفِق مستنداته كاملةً ثم تطرحه مباشرةً على المجلس للتصويت — إعدادٌ محايد بلا توصية.</p>
        <Card className="card pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, background: "var(--green-10)", borderColor: "var(--color-primary)" }}>
          <div><b style={{ color: "var(--text-strong)" }}>إنشاء طلب حماية جديد</b><div className="muted" style={{ marginTop: 3 }}>أنشئ الطلب وأرفِق مستنداته ثم اطرحه للتصويت.</div></div>
          <button className="btn btn-primary" onClick={onCreate}><I name="note_add" size={18} /> إنشاء طلب حماية</button>
        </Card>
        <div className="stats">
          <Stat icon="assignment" v={toPrep.length} l="بانتظار الإعداد" bg="var(--warning-10)" fg="var(--color-warning)" />
          <Stat icon="send" v={inFlight.length} l="مطروحة/صدرت" bg="var(--info-10)" fg="var(--color-info)" />
          <Stat icon="folder_shared" v={mine.length} l="طلباتي" bg="var(--green-10)" fg="var(--color-primary)" />
        </div>
        <Card className="card pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><b style={{ color: "var(--text-strong)" }}>{toPrep.length} طلبات بانتظار إعداد قرارها</b><div className="muted" style={{ marginTop: 3 }}>افتح الطلب لرفع المستندات وطرحه للتصويت.</div></div>
          <button className="btn btn-primary" onClick={() => go("cases")}><I name="assignment" size={18} /> طلباتي للإعداد</button>
        </Card>
      </div>);
    }
    const voting = HD.allCases().filter((q) => dOf(q.secret).status === "voting");
    const issued = HD.allCases().filter((q) => dOf(q.secret).status === "issued");
    if (scope === "members") {
      const pending = voting.filter((q) => !HD.getVotes(q.secret)[me]);
      return (<div>
        <h2 className="h2">لوحة المعلومات</h2>
        <p className="lede">تطّلع على قرارات المركز المطروحة وتدلي بصوتك (قبول/رفض) مستقلّاً. الحصيلة وأصوات الأعضاء تظهر للنائب والرئيس فقط.</p>
        <div className="stats">
          <Stat icon="how_to_vote" v={pending.length} l="بانتظار صوتك" bg="var(--warning-10)" fg="var(--color-warning)" />
          <Stat icon="inbox" v={voting.length} l="مطروح للتصويت" bg="var(--info-10)" fg="var(--color-info)" />
          <Stat icon="gavel" v={issued.length} l="قرارات صدرت" bg="var(--green-10)" fg="var(--color-primary)" />
        </div>
        <Card className="card pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><b style={{ color: "var(--text-strong)" }}>{pending.length} بنود تنتظر صوتك</b><div className="muted" style={{ marginTop: 3 }}>المهلة: يوم عمل واحد من فتح التصويت.</div></div>
          <button className="btn btn-primary" onClick={() => go("cases")}><I name="how_to_vote" size={18} /> المطروح للتصويت</button>
        </Card>
      </div>);
    }
    return (<div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">تطّلع على حصيلة التصويت وتصوّت كعضو، ثم يُصدر <b>رئيس المركز</b> قرار المركز ويُشعِر الطرفين — ضمن مظلّة 3 أيام (م10).</p>
      <div className="stats">
        <Stat icon="how_to_vote" v={voting.length} l="مطروح للتصويت" bg="var(--info-10)" fg="var(--color-info)" />
        <Stat icon="gavel" v={issued.length} l="قرارات صدرت" bg="var(--green-10)" fg="var(--color-primary)" />
      </div>
      <Card className="card pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><b style={{ color: "var(--text-strong)" }}>{voting.length} قرارات مطروحة للتصويت</b><div className="muted" style={{ marginTop: 3 }}>اطّلع على الحصيلة، صوّت كعضو، ثم أصدِر (للرئيس).</div></div>
        <button className="btn btn-primary" onClick={() => go("cases")}><I name="gavel" size={18} /> التصويت والإصدار</button>
      </Card>
    </div>);
  }

  function Cases({ scope, me, open, onCreate }) {
    if (scope === "preparer") {
      const mine = HD.allCases();
      return (<div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
          <h2 className="h2" style={{ margin: 0 }}>طلبات إعداد القرار</h2>
          <button className="btn btn-primary" onClick={onCreate}><I name="note_add" size={18} /> إنشاء طلب حماية</button>
        </div>
        <p className="lede">طلباتك (كلٌّ معزول). أنشئ الطلب أو افتحه لرفع مستنداته ثم طرحه للتصويت.</p>
        {mine.length === 0 ? <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>لا طلبات بعد — ابدأ بإنشاء طلب حماية.</Card>
        : <Card className="card" style={{ overflow: "hidden" }}><div className="tbl-wrap"><table>
          <thead><tr><th>الرمز السري</th><th>طالب الحماية</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{mine.map((q) => { const d = dOf(q.secret); const st = STATUS[d.status]; return (
            <tr key={q.secret} className="clk" onClick={() => open(q, "prepare")}>
              <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{q.secret}</td>
              <td className="muted">{q.applicant ? q.applicant.name : "—"}</td>
              <td><Tag tone={st.tone} size="sm" iconLeft={<I name={st.icon} size={12} />}>{st.t}</Tag></td>
              <td><span className="link">{d.status === "preparing" ? "إعداد القرار" : "عرض"} <I name="chevron_left" size={16} /></span></td>
            </tr>); })}</tbody>
        </table></div></Card>}
      </div>);
    }
    const list = HD.allCases().filter((q) => ["voting", "issued"].includes(dOf(q.secret).status));
    const statusCell = (q) => {
      const d = dOf(q.secret); if (d.issued) return <Tag tone={d.issued.type === "قبول" ? "success" : "warning"} size="sm">صدر: {d.issued.type}</Tag>;
      const r = HD.resultFor(q.secret);
      if (scope === "leadership") return r.closed ? <Tag tone={r.outcome === "مقبول" ? "success" : "warning"} size="sm">{r.outcome} · {r.accept}/{r.reject}</Tag> : <Tag tone="info" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>تصويت جارٍ · {r.cast}/{VOTING_SEATS.length}</Tag>;
      const my = HD.getVotes(q.secret)[me]; return my ? <Tag tone={my.choice === "رفض" ? "warning" : "success"} size="sm">صوتك: {my.choice}</Tag> : <Tag tone="warning" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>بانتظار صوتك</Tag>;
    };
    return (<div>
      <h2 className="h2">{scope === "leadership" ? "التصويت وإصدار القرار" : "المطروح للتصويت"}</h2>
      <p className="lede">{scope === "leadership" ? "قرارات مطروحة للتصويت (تصوّت كعضو ثم تُصدر بعد الإغلاق — الإصدار بيد الرئيس)." : "قرارات المركز المطروحة — أدلِ بصوتك مستقلّاً بعد معاينة المرفقات."}</p>
      <InlineAlert kind="warning" title="مهلة التصويت: يوم عمل واحد كحدّ أقصى" style={{ marginBottom: 16 }}>يُغلق التصويت ببلوغ الأغلبية الحاسمة (4/7) أو انتهاء يوم العمل — أيّهما أسبق. من لم يصوّت يُدوَّن دون تعطيل القرار.</InlineAlert>
      {list.length === 0 ? <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>لا قرارات مطروحة للتصويت حالياً.</Card>
      : <Card className="card" style={{ overflow: "hidden" }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>طالب الحماية</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{list.map((q) => (
          <tr key={q.secret} className="clk" onClick={() => open(q, "session")}>
            <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{q.secret}</td>
            <td className="muted">{q.applicant ? q.applicant.name : "—"}</td>
            <td>{statusCell(q)}</td>
            <td><span className="link">{scope === "leadership" ? "الحصيلة والإصدار" : "الاطّلاع والتصويت"} <I name="chevron_left" size={16} /></span></td>
          </tr>))}</tbody>
      </table></div></Card>}
    </div>);
  }

  function Notifs({ scope }) {
    const base = {
      preparer: [{ icon: "note_add", t: "ابدأ بإنشاء طلب", d: "أنشئ طلب الحماية بالبيانات الأولية (اسم + هوية) ثم ارفع مستنداته كاملةً واطرحه للتصويت.", time: "إرشاد" }, { icon: "attachment", t: "اكتمال المرفقات إلزاميّ", d: "لا يُطرح الطلب للتصويت حتى تُرفَق كل المستندات المطلوبة ويُؤكَّد إقرار الاكتمال.", time: "إرشاد" }],
      members: [{ icon: "how_to_vote", t: "تصويت مستقلّ", d: "بعد معاينة كل المرفقات يُفتح التصويت (قبول/رفض). لا تطّلع على أصوات بقية الأعضاء.", time: "إرشاد" }, { icon: "visibility", t: "المعاينة تفتح التصويت", d: "افتح «معاينة» لكل مرفق مطلوب ليُفعَّل صندوق التصويت.", time: "إرشاد" }],
      leadership: [{ icon: "gavel", t: "الإصدار بيد الرئيس", d: "بعد إغلاق التصويت يُصدر رئيس المركز القرار ويُشعَر الطرفان (م10). النائب يطّلع ويصوّت ويتابع.", time: "إرشاد" }, { icon: "how_to_vote", t: "تصويت القيادة كأعضاء", d: "النائب والرئيس مقعدان مصوّتان ضمن المجلس السبعة.", time: "إرشاد" }],
    }[scope];
    return (<div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات المهامّ والمواعيد النظامية في مرحلة القرار.</p>
      <div style={{ display: "grid", gap: 10 }}>{base.map((n, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "14px 16px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", background: "var(--info-10)", color: "var(--color-info)" }}><I name={n.icon} size={20} fill /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{n.t}</div><div style={{ fontSize: 13, color: "var(--text-body)", marginTop: 2, lineHeight: 1.55 }}>{n.d}</div><div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{n.time}</div></div>
        </div>))}</div>
    </div>);
  }

  function DecisionsLog() {
    const rows = HD.allCases().map((q) => ({ q, d: dOf(q.secret) })).filter((x) => x.d.issued).map((x) => ({ secret: x.q.secret, name: x.q.applicant ? x.q.applicant.name : "—", type: x.d.issued.type, when: x.d.issued.when }));
    const TONE = { "قبول": "success", "رفض": "error" };
    return (<div>
      <h2 className="h2">سجل القرارات</h2>
      <p className="lede">القرارات الصادرة عن المجلس وحالة الإشعار — غير قابلة للتعديل ومسجّلة في التدقيق (م24–32).</p>
      {rows.length === 0 ? <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>لا قرارات صادرة بعد.</Card>
      : <Card className="card" style={{ overflow: "hidden" }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>طالب الحماية</th><th>القرار</th><th>الإشعار</th></tr></thead>
        <tbody>{rows.map((d, i) => (
          <tr key={i}><td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{d.secret}</td><td className="muted">{d.name}</td>
            <td><Tag tone={TONE[d.type] || "info"} size="sm">{d.type}</Tag></td>
            <td><Tag tone="success" size="sm" iconLeft={<I name="mark_email_read" size={13} />}>أُرسِل</Tag></td></tr>))}</tbody>
      </table></div></Card>}
    </div>);
  }

  function Messages({ scope }) {
    return (<div>
      <h2 className="h2">المراسلات</h2>
      <p className="lede">قناة مؤمّنة بين المعدّ/الأعضاء والقيادة للاستيضاح بشأن قرارٍ مطروح — معزولة ومسجّلة في التدقيق.</p>
      <Card className="card pad" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
        <I name="forum" size={40} color="var(--text-secondary)" />
        <p style={{ marginTop: 10 }}>لا مراسلات في مقعدك بعد.</p>
      </Card>
    </div>);
  }

  function Profile({ scope, me }) {
    const id = identOf(scope, me);
    const note = scope === "preparer" ? "دورك إعدادٌ محايد: تُنشئ الطلب وتُرفِق مستنداته كاملةً دون توصية بالقبول أو الرفض ودون تصويت؛ ثم يُطرح مباشرةً على المجلس للتصويت." : scope === "leadership" ? "تطّلع على الحصيلة، وتصوّت كعضو، ويُصدر رئيس المركز قرار المركز عند اكتمال التصويت وتُشعَر الطرفان. لك ترجيح الجانب عند التعادل." : "تصويتك مستقلّ (قبول/رفض) على قرار المركز المُعَدّ ولا تطّلع على أصوات بقية الأعضاء ولا الحصيلة؛ تظهر للنائب والرئيس فقط.";
    const auth = scope === "preparer" ? "إنشاء الطلب وإرفاق مستنداته وطرحه للتصويت (بلا تصويت ولا توصية)" : scope === "leadership" ? "الاطّلاع على الحصيلة + التصويت كعضو + إصدار القرار (الرئيس) والإشعار" : "الاطّلاع الكامل + التصويت المستقلّ (قبول/رفض)";
    const fields = [["الاسم", id.name], ["الصفة", id.t], ["الجهة", id.org], ["نطاق العمل", "مرحلة القرار — المسار الجديد"], ["الصلاحية", auth], ["التوثيق", "نفاذ + MFA"]];
    return (<div>
      <h2 className="h2">الملف الشخصي</h2>
      <p className="lede">حسابك وصلاحياتك ونطاق عملك في مرحلة القرار.</p>
      <Card className="card pad">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{fields.map(([l, v], i) => (<div className="ro-field" key={i}><span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{l}</span><span style={{ fontSize: 13, color: "var(--text-body)" }}>{v}</span></div>))}</div>
        <InlineAlert kind="info" title={scope === "preparer" ? "الحياد والفصل" : "استقلال الرأي"} style={{ marginTop: 14 }}>{note}</InlineAlert>
      </Card>
    </div>);
  }

  // ————— القشرة والتنقّل —————
  function Shell({ scope }) {
    useStore();
    const meReal = HD.getMe();
    const seatList = seatsOf(scope);
    const [me] = useState((meReal && meReal.seat) || seatList[0]);
    const [active, setActive] = useState("dashboard");
    const [sel, setSel] = useState(null);
    const nav = NAV[scope];
    const meta = SCOPE_META[scope];
    const id = identOf(scope, me);
    const [open, setOpen] = useState(false);
    const go = (a) => { setActive(a); setSel(null); setOpen(false); };
    const scrollTop = () => { if (typeof window !== "undefined") window.scrollTo(0, 0); };
    const openCase = (q, mode) => { setSel({ q, mode }); scrollTop(); };
    const openCreate = () => { setSel({ q: null, mode: "create" }); scrollTop(); };
    const cur = nav.find((n) => n.id === active) || nav[0];
    const signout = () => { fetch("/auth/signout", { method: "POST" }).then(() => { window.location.href = "http://localhost:3000/"; }); };
    let body, title;
    if (sel && sel.mode === "create") { body = <CreateRequest me={me} onCreated={(s) => { setSel({ q: HD.queueBySecret(s), mode: "prepare" }); scrollTop(); }} back={() => setSel(null)} />; title = "إنشاء طلب حماية"; }
    else if (sel && sel.mode === "prepare") { body = <PrepareDecision q={sel.q} back={() => { setSel(null); setActive("cases"); }} />; title = "إعداد قرار المركز"; }
    else if (sel && sel.mode === "session") { body = <DecisionSession q={sel.q} me={me} scope={scope} back={() => { setSel(null); setActive("cases"); }} />; title = scope === "leadership" ? "حصيلة القرار وإصداره" : "الاطّلاع والتصويت"; }
    else if (active === "cases") { body = <Cases scope={scope} me={me} open={openCase} onCreate={openCreate} />; title = cur.t; }
    else if (active === "messages") { body = <Messages scope={scope} />; title = cur.t; }
    else if (active === "notifications") { body = <Notifs scope={scope} />; title = cur.t; }
    else if (active === "log") { body = <DecisionsLog />; title = cur.t; }
    else if (active === "profile") { body = <Profile scope={scope} me={me} />; title = cur.t; }
    else { body = <Dashboard scope={scope} me={me} go={go} onCreate={openCreate} />; title = cur.t; }
    return (
      <div className="shell">
        <aside className={"side" + (open ? " open" : "")}>
          <div className="brand"><div className="brand-mark"><I name={scope === "preparer" ? "assignment" : scope === "leadership" ? "shield_person" : "how_to_vote"} size={22} fill color="#fff" /></div>
            <div><div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)", lineHeight: 1.2 }}>مرحلة القرار</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{meta.sub}</div></div></div>
          <nav className="nav">{nav.map((n) => (<button key={n.id} className={"nav-item" + (active === n.id && !sel ? " on" : "")} onClick={() => go(n.id)}><I name={n.icon} size={20} /> <span>{n.t}</span></button>))}</nav>
          <div className="side-foot">{meta.foot}</div>
          <button className="nav-item" onClick={signout} style={{ margin: "0 12px 12px" }}><I name="logout" size={20} /> <span>تسجيل الخروج</span></button>
        </aside>
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <div className="main">
          <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
            <span className="topbar-title">{title}</span>
            <span className="row" style={{ marginInlineStart: "auto", gap: 8 }}><Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "4px 10px" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-subtle)", display: "grid", placeItems: "center" }}><I name="person" size={18} color="var(--color-primary)" /></div>
                <span style={{ textAlign: "start" }}><span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.2 }}>{id.name}</span><span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)" }}>{id.t}</span></span>
              </span>
            </span>
          </header>
          <main className="content">{body}</main>
        </div>
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
      createRequest: DecActions.createRequest,
      setAttachment: DecActions.setAttachment,
      removeAttachment: DecActions.removeAttachment,
      submitVoting: DecActions.submitVoting,
      castVote: DecActions.castVote,
      closeDeadline: DecActions.closeDeadline,
      issue: DecActions.issue,
    });
  }, []);
  return <App scope={scope} />;
}
