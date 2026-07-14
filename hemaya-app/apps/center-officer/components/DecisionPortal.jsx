'use client';
/* ============================================================
   تطبيق بوابة القرار والإشعار — منقول من decision-app.jsx
   window/__decisionScreens/HP → @hemaya/ui + وحدات محلّية.
   النطاقات: preparer (معدّ) · members (أعضاء) · leadership (قيادة).
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, RiskLevel } from "@hemaya/ui";
import { HemayaDecision } from "./decision-store";
import { DScreens } from "./decision-screens";
import "./decision.css";

const HD = HemayaDecision;

const { App, DecisionLeadership } = (function () {

  const S = DScreens;
  const { ReviewPackage, DecisionView, VoteBox, CouncilTally, SecurityReport, Timer, I, STATUS, identOf, seatsOf, useStore } = S;
  const SEATS = HD.SEATS, PREPARERS = HD.PREPARERS, VOTING_SEATS = HD.VOTING_SEATS;
  const PROTECTION_TYPES = HD.PROTECTION_TYPES, PROPOSED_TYPES = HD.PROPOSED_TYPES, DEFAULT_DURATION = HD.DEFAULT_DURATION;
  const QUEUE = HD.QUEUE, LIFECYCLE = HD.LIFECYCLE, DECIDED = HD.DECIDED;

  const SCOPE_META = {
    preparer:   { sub: 'معد قرار المركز', foot: 'إعدادٌ محايد من الدراسات والتقييمات — بلا توصية ولا تصويت · القرار خالصٌ للمجلس.' },
    members:    { sub: 'أعضاء المجلس',    foot: 'تصويت مستقلّ (قبول/رفض) على قرار المركز المُعَدّ · لا اطّلاع على أصوات الغير · مسجّل في التدقيق.' },
    leadership: { sub: 'قيادة المجلس',    foot: 'قرار المركز يُطرح للتصويت مباشرةً · تصويت كأعضاء · إصدار القرار وإشعار الطرفين (م10).' },
  };
  const NAV = {
    preparer: [{ id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' }, { id: 'cases', t: 'طلبات للإعداد', icon: 'assignment' }, { id: 'messages', t: 'المراسلات', icon: 'forum' }, { id: 'notifications', t: 'الإشعارات', icon: 'notifications' }, { id: 'log', t: 'سجل القرارات', icon: 'history' }, { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' }],
    members: [{ id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' }, { id: 'cases', t: 'المطروح للتصويت', icon: 'how_to_vote' }, { id: 'messages', t: 'المراسلات', icon: 'forum' }, { id: 'notifications', t: 'الإشعارات', icon: 'notifications' }, { id: 'log', t: 'سجل القرارات', icon: 'history' }, { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' }],
    leadership: [{ id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' }, { id: 'cases', t: 'التصويت والإصدار', icon: 'gavel' }, { id: 'messages', t: 'المراسلات', icon: 'forum' }, { id: 'notifications', t: 'الإشعارات', icon: 'notifications' }, { id: 'log', t: 'سجل القرارات', icon: 'history' }, { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' }],
  };

  const dOf = (s) => HD.getDecision(s) || { status: 'preparing', preparer: (HD.queueBySecret(s) || {}).preparer, types: [], duration: '', reasoning: '', approvals: { deputy: null, chair: null }, rejections: [] };
  const foreignBadge = (q) => q.foreign ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginInlineStart: 7, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--info-10)', color: 'var(--color-info)', fontSize: 11, fontWeight: 700 }}><I name="public" size={12} fill /> أجنبي · م6</span> : null;
  const CaseHead = ({ q, canReveal, timer }) => (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <div className="row"><SecretCode code={q.secret} canReveal={!!canReveal} /><Tag tone="info" size="sm">{q.cat}</Tag><RiskLevel level={q.risk} />{q.foreign && <Tag tone="info" size="sm" iconLeft={<I name="public" size={13} fill />}>أجنبي · م6</Tag>}</div>
      {timer}
    </div>
  );

  // ————————————————— معدّ القرار: إعداد القرار —————————————————
  function PrepareDecision({ q, back }) {
    const d = dOf(q.secret);
    const canEdit = d.status === 'preparing';
    const [types, setTypes] = useState(d.types.length ? d.types : (PROPOSED_TYPES[q.secret] || []));
    const [duration, setDuration] = useState(d.duration || DEFAULT_DURATION[q.secret] || '30 يوماً');
    const [reasoning, setReasoning] = useState(d.reasoning || HD.REASON_SKELETON);
    const toggle = (t) => setTypes((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]);
    const ready = types.length && duration && reasoning.trim();
    const lastRej = d.rejections && d.rejections.length ? d.rejections[d.rejections.length - 1] : null;
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع لقائمة الإعداد</button>
      <CaseHead q={q} canReveal={false} timer={<Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><ReviewPackage q={q} /></Card>
      {canEdit && lastRej && <InlineAlert kind="warning" title={'أُعيد للتعديل من ' + (SEATS[lastRej.by] ? SEATS[lastRej.by].t : lastRej.by)} style={{ marginBottom: 14 }}>{lastRej.note || 'يُرجى تعديل القرار وإعادة رفعه للاعتماد.'}</InlineAlert>}
      {canEdit ? <Card className="card pad">
        <p className="sec-h"><I name="assignment" size={18} color="var(--color-primary)" /> إعداد قرار المركز</p>
        <InlineAlert kind="info" title="دورك: إعدادٌ محايد — لا توصية ولا تصويت" style={{ marginBottom: 14 }}>تُجمّع طلب الحماية وتوصية الجهة والدراسات والتقييمات مع قرارٍ واحد يُرسَل مباشرةً إلى المجلس للتصويت. القرار خالصٌ للمجلس (م4/8).</InlineAlert>
        <div className="fld"><span className="fld-label">أنواع الحماية المقترحة (المادة 14) — من مقترحات الدراسات</span>
          <div className="chips">{PROTECTION_TYPES.map((t) => <button key={t} className={'chip' + (types.includes(t) ? ' on' : '')} onClick={() => toggle(t)}>{t}{(PROPOSED_TYPES[q.secret] || []).includes(t) && <span style={{ marginInlineStart: 5, fontSize: 10.5, color: 'var(--color-info)' }}>· مقترح</span>}</button>)}</div></div>
        <div className="fld"><span className="fld-label">مدّة الحماية</span>
          <div className="chips">{['30 يوماً', 'إلى حين انتهاء القضية', 'مدّة أخرى'].map((o) => <button key={o} className={'chip' + (duration === o ? ' on' : '')} onClick={() => setDuration(o)}>{o}</button>)}</div></div>
        <div className="fld"><span className="fld-label">حيثيات القرار</span><textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} dir="auto" style={{ minHeight: 110 }} /></div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => { HD.saveDecision(q.secret, { types, duration, reasoning }); }}><I name="save" size={17} /> حفظ</button>
          <button className="btn btn-primary" disabled={!ready} onClick={() => { HD.submitForApproval(q.secret, { types, duration, reasoning }); back(); }}><I name="how_to_vote" size={17} /> إرسال إلى المجلس للتصويت</button>
        </div>
      </Card> : <React.Fragment>
        <DecisionView decision={d} foreign={q.foreign} />
        <InlineAlert kind={d.status === 'issued' ? 'success' : 'info'} title={STATUS[d.status].t} style={{ marginTop: 16 }}>
          {(d.status === 'pending_deputy' || d.status === 'pending_chair') && 'رُفع القرار وهو مطروح على المجلس للتصويت.'}
          {d.status === 'voting' && 'أُرسِل القرار إلى المجلس للتصويت مباشرةً — لا تعديل عليه الآن.'}
          {d.status === 'issued' && 'صدر قرار المركز بناءً على التصويت وأُشعِر الطرفان.'}
        </InlineAlert>
      </React.Fragment>}
    </div>);
  }

  // ————————————————— القيادة: مراجعة واعتماد القرار المُعَدّ —————————————————
  function ApprovalReview({ q, me, back }) {
    const d = dOf(q.secret);
    const [rejecting, setRejecting] = useState(false);
    const [note, setNote] = useState('');
    const myTurn = (me === 'deputy' && d.status === 'pending_deputy') || (me === 'chair' && d.status === 'pending_chair');
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للاعتمادات</button>
      <CaseHead q={q} canReveal={true} timer={<Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><ReviewPackage q={q} /></Card>
      <DecisionView decision={d} foreign={q.foreign} />
      <Card className="card pad" style={{ marginTop: 16 }}>
        <p className="sec-h"><I name="approval" size={18} color="var(--color-primary)" /> اعتماد القرار قبل طرحه للتصويت</p>
        {me === 'chair' && <InlineAlert kind="info" title="اعتماد الرئيس" style={{ marginBottom: 12 }}>يظهر القرار للرئيس بعد اعتماد النائب. باعتمادك يُطرح على المجلس للتصويت وتبدأ مهلة يوم العمل.</InlineAlert>}
        {me === 'deputy' && <InlineAlert kind="info" title="اعتماد النائب" style={{ marginBottom: 12 }}>باعتمادك يُعرض القرار على الرئيس لاعتماده، ثم يُطرح للتصويت.</InlineAlert>}
        {!myTurn ? <InlineAlert kind={d.status === 'voting' || d.status === 'issued' ? 'success' : 'warning'} title="ليس دورك الآن">
          {d.status === 'pending_deputy' && 'بانتظار اعتماد النائب أولاً.'}
          {d.status === 'pending_chair' && me === 'deputy' && 'اعتمدتَه — بانتظار اعتماد الرئيس.'}
          {(d.status === 'voting' || d.status === 'issued') && 'اكتمل الاعتماد وطُرح للتصويت.'}
          {d.status === 'preparing' && 'أُعيد للمعدّ للتعديل.'}
        </InlineAlert> : rejecting ? <React.Fragment>
          <div className="fld"><span className="fld-label">سبب الإعادة للمعدّ <span style={{ color: 'var(--color-error)' }}>· إلزامي</span></span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="وضّح ما يلزم تعديله في القرار…" dir="auto" /></div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setRejecting(false)}>تراجع</button>
            <button className="btn btn-primary" disabled={!note.trim()} onClick={() => { HD.rejectApproval(q.secret, me, note.trim()); back(); }}><I name="undo" size={17} /> إعادة للمعدّ</button>
          </div>
        </React.Fragment> : <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setRejecting(true)}><I name="undo" size={17} /> إعادة للمعدّ للتعديل</button>
          <button className="btn btn-primary" onClick={() => { HD.approve(q.secret, me); back(); }}><I name="verified" size={18} /> {me === 'chair' ? 'اعتماد وطرح للتصويت' : 'اعتماد وإحالة للرئيس'}</button>
        </div>}
      </Card>
    </div>);
  }

  // ————————————————— جلسة القرار الابتدائي (تصويت العضو / حصيلة القيادة وإصدار) —————————————————
  function DecisionSession({ q, me, scope, back }) {
    const d = dOf(q.secret);
    const votesFor = HD.getVotes(q.secret);
    const res = HD.resultFor(q.secret, false);
    const [reason, setReason] = useState('');
    const [returning, setReturning] = useState(false);
    const [returnNote, setReturnNote] = useState('');
    const isLead = scope === 'leadership';
    const outcome = res.outcome;
    const rejectNotes = VOTING_SEATS.map((s) => votesFor[s]).filter((v) => v && v.choice === 'رفض' && v.note).map((v) => v.note);
    const defReason = outcome === 'مقبول' ? (d.reasoning || '') : 'أسباب الرفض المستندة إلى مداولة المجلس:\n- ' + (rejectNotes.length ? rejectNotes.join('\n- ') : 'لم تتوافر مسوّغات كافية للحماية وفق عوامل المادة 9.');
    React.useEffect(() => { if (res.closed && isLead && !d.issued) setReason((r) => r || defReason); }, [res.closed, outcome]);
    const votable = d.status === 'voting';
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع</button>
      <CaseHead q={q} canReveal={isLead} timer={votable ? <Timer q={q} /> : <Tag tone={STATUS[d.status].tone} size="md" iconLeft={<I name={STATUS[d.status].icon} size={14} />}>{STATUS[d.status].t}</Tag>} />
      <Card className="card pad" style={{ marginBottom: 16 }}><ReviewPackage q={q} /></Card>
      <DecisionView decision={d} foreign={q.foreign} />
      {d.issued ? <Card className="card pad" style={{ marginTop: 16 }}>
        <InlineAlert kind={d.issued.type === 'قبول' ? 'success' : 'warning'} title={'صدر قرار المركز: ' + d.issued.type}>صدر القرار بناءً على تصويت المجلس وأُشعِر <b>طالب الحماية والجهة المختصة</b> ({d.issued.when}). {d.issued.type === 'رفض' ? 'مع حقّ التظلّم خلال 10 أيام (م21).' : ''}</InlineAlert>
      </Card> : !isLead ? <React.Fragment>
        {votable ? <VoteBox my={votesFor[me]} canVote={!res.closed} onCast={(c, n) => HD.castVote(q.secret, me, c, n)} subject="قرار المركز المُعَدّ" />
          : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="لم يُطرح للتصويت بعد">القرار قيد الإعداد لدى المعدّ؛ يُطرح للتصويت فور إرساله.</InlineAlert></Card>}
        {votable && res.closed && !votesFor[me] && <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title="انتهت مهلة التصويت">أُغلق باب التصويت على هذا القرار؛ لم يُسجَّل لك صوت خلاله.</InlineAlert></Card>}
      </React.Fragment> : votable ? <React.Fragment>
        <CouncilTally result={res} votesFor={votesFor} seat={me} onCast={(c, n) => HD.castVote(q.secret, me, c, n)} onClose={() => HD.closeByDeadline(q.secret)} />
        {!res.closed && <Card className="card pad" style={{ marginTop: 14 }}>
          <p className="sec-h"><I name="undo" size={18} color="var(--color-primary)" /> إعادة القرار للمعدّ</p>
          {returning ? <React.Fragment>
            <InlineAlert kind="warning" title="تُلغى الأصوات المُسجّلة" style={{ marginBottom: 12 }}>إعادة القرار للمعدّ تُلغي أصوات هذا القرار ويُعاد التصويت من جديد بعد إعادة رفعه.</InlineAlert>
            <div className="fld"><span className="fld-label">سبب الإعادة للمعدّ <span style={{ color: 'var(--color-error)' }}>· إلزامي</span></span><textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="وضّح ما يلزم تعديله في القرار قبل إعادة طرحه…" dir="auto" /></div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setReturning(false); setReturnNote(''); }}>تراجع</button>
              <button className="btn btn-primary" disabled={!returnNote.trim()} onClick={() => { HD.rejectApproval(q.secret, me, returnNote.trim()); back(); }}><I name="undo" size={17} /> إعادة للمعدّ</button>
            </div>
          </React.Fragment> : <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>إن كان القرار المُعَدّ ناقصاً، أعِده للمعدّ للتعديل بدل التصويت عليه.</span>
            <button className="btn btn-ghost" onClick={() => setReturning(true)}><I name="undo" size={17} /> إعادة للمعدّ للتعديل</button>
          </div>}
        </Card>}
        {res.closed && <Card className="card pad" style={{ marginTop: 16 }}>
          <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> إصدار قرار المركز</p>
          {q.foreign && outcome === 'مقبول' && <InlineAlert kind="warning" title="مسار أجنبي — تُرفع للنائب العام" style={{ marginBottom: 12 }}>القرار في الطلب الأجنبي توصية تُرفع إلى النائب العام للبتّ النهائي (المادة 6)، ثمّ تُبلَّغ عبر اللجنة الدائمة.</InlineAlert>}
          <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">حصيلة تصويت المجلس</span><b style={{ color: outcome === 'مقبول' ? 'var(--color-success)' : 'var(--color-error)' }}>{outcome} · قبول {res.accept} / رفض {res.reject}</b></div>
          {outcome === 'مقبول' ? <React.Fragment>
            <div className="fld"><span className="fld-label">أنواع الحماية المقرَّرة (من القرار المعتمَد)</span><div className="row" style={{ gap: 6 }}>{d.types.map((t) => <Tag key={t} tone="success" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}</div></div>
            <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">المدّة</span><b style={{ color: 'var(--text-strong)' }}>{d.duration}</b></div>
          </React.Fragment> : <InlineAlert kind="warning" title="قرار رفض مكتوب مسبّب" style={{ marginBottom: 12 }}>يُصدَر قرار رفضٍ مسبَّب يتضمّن حقّ التظلّم خلال 10 أيام (المادة 21).</InlineAlert>}
          <div className="fld"><span className="fld-label">تسبيب قرار المركز {outcome === 'مرفوض' && <span style={{ color: 'var(--color-error)' }}>· إلزامي</span>}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" style={{ minHeight: 100 }} /></div>
          <InlineAlert kind="info" title="اعتماد القرار">يُعتمد بتوقيع الرئيس والنائب على القرار — والإصدار يُشعِر طالب الحماية والجهة (م10).</InlineAlert>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-primary" disabled={!reason.trim()} onClick={() => HD.issue(q.secret, { type: outcome === 'مقبول' ? 'قبول' : 'رفض', types: outcome === 'مقبول' ? d.types : [], duration: outcome === 'مقبول' ? d.duration : '', reason })}><I name="verified" size={18} /> إصدار القرار وإشعار الطرفين</button>
          </div>
        </Card>}
      </React.Fragment> : <Card className="card pad" style={{ marginTop: 16 }}><InlineAlert kind="info" title={STATUS[d.status].t}>القرار قيد الإعداد لدى المعدّ؛ يُطرح للتصويت فور إرساله.</InlineAlert></Card>}
    </div>);
  }

  // ————————————————— دورة الحياة (تصويت مباشر + إصدار، بلا معدّ/اعتماد) —————————————————
  function LifecycleSession({ q, me, scope, back }) {
    const r = q.report;
    const votesFor = HD.getLifecycleVotes(q.secret);
    const res = HD.resultFor(q.secret, true);
    const issued = HD.lifecycleIssued(q.secret);
    const isLead = scope === 'leadership';
    const [dtype, setDtype] = useState('');
    const [types, setTypes] = useState(r.current);
    const [duration, setDuration] = useState('');
    const [reason, setReason] = useState('');
    const isClose = dtype === 'إغلاق', isModify = dtype === 'تعديل';
    const toggleType = (t) => { if (isModify) setTypes((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]); };
    const ready = res.closed && dtype && reason.trim() && (isClose || (duration && (!isModify || types.length)));
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع</button>
      <CaseHead q={q} canReveal={isLead} timer={<DeadlineTimer label="بتّ مراجعة دورة الحياة" totalDays={3} daysElapsed={q.studyDays} articleRef="م12–14" />} />
      <Card className="card pad" style={{ marginBottom: 16 }}><SecurityReport r={r} /></Card>
      {issued ? <Card className="card pad"><InlineAlert kind={issued.type === 'إغلاق' ? 'warning' : 'success'} title={'صدر القرار: ' + issued.type}>بُلِّغ المشمول بقرار دورة الحياة{issued.type !== 'استمرار' ? ' مع حقّ التظلّم (م21)' : ''}.</InlineAlert></Card>
        : !isLead ? <VoteBox my={votesFor[me]} canVote={!res.closed} onCast={(c, n) => HD.castLifecycleVote(q.secret, me, c, n)} subject="توصية الإدارة الأمنية" />
        : <React.Fragment>
          <CouncilTally result={res} votesFor={votesFor} seat={me} onCast={(c, n) => HD.castLifecycleVote(q.secret, me, c, n)} onClose={() => HD.closeLifecycleByDeadline(q.secret)} />
          <Card className="card pad" style={{ marginTop: 16 }}>
            <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> صياغة قرار دورة الحياة</p>
            {!res.closed && <InlineAlert kind="info" title="أكمِل التصويت أولاً">تُفعَّل الصياغة بعد إغلاق التصويت (أغلبية 4/7 أو انتهاء المهلة).</InlineAlert>}
            <div style={{ opacity: res.closed ? 1 : .5, pointerEvents: res.closed ? 'auto' : 'none', marginTop: 12 }}>
              <div className="fld"><span className="fld-label">قرار المجلس</span>
                <div className="chips">{['استمرار', 'تعديل', 'إغلاق'].map((o) => <button key={o} className={'chip' + (dtype === o ? ' on' : '') + (o === 'إغلاق' ? ' danger' : '')} onClick={() => setDtype(o)}>{o}</button>)}</div></div>
              {!isClose && dtype && <div className="fld"><span className="fld-label">{isModify ? 'أنواع الحماية المعدَّلة (م14)' : 'أنواع الحماية المستمرّة'}</span>
                <div className="chips">{PROTECTION_TYPES.map((t) => <button key={t} className={'chip' + (types.includes(t) ? ' on' : '')} onClick={() => toggleType(t)} style={{ pointerEvents: isModify ? 'auto' : 'none', opacity: isModify || types.includes(t) ? 1 : .4 }}>{t}</button>)}</div></div>}
              {!isClose && dtype && <div className="fld"><span className="fld-label">مدّة التجديد</span>
                <div className="chips">{['30 يوماً', 'إلى حين انتهاء القضية', 'مدّة أخرى'].map((o) => <button key={o} className={'chip' + (duration === o ? ' on' : '')} onClick={() => setDuration(o)}>{o}</button>)}</div></div>}
              <div className="fld"><span className="fld-label">تسبيب القرار {isClose && <span style={{ color: 'var(--color-error)' }}>· إلزامي</span>}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" /></div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><button className="btn btn-primary" disabled={!ready} onClick={() => HD.issueLifecycle(q.secret, { type: dtype, types: isClose ? [] : types, duration: isClose ? '' : duration, reason })}><I name="verified" size={18} /> إصدار القرار وإشعار المشمول</button></div>
            </div>
          </Card>
        </React.Fragment>}
    </div>);
  }

  // ————————————————— لوحات القوائم —————————————————
  function Stat({ icon, v, l, bg, fg }) { return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></Card>; }

  function Dashboard({ scope, me, go }) {
    if (scope === 'preparer') {
      const mine = QUEUE.filter((q) => q.preparer === me);
      const toPrep = mine.filter((q) => dOf(q.secret).status === 'preparing');
      const inFlight = mine.filter((q) => ['pending_deputy', 'pending_chair', 'voting'].includes(dOf(q.secret).status));
      return (<div>
        <h2 className="h2">لوحة المعلومات</h2>
        <p className="lede">بصفتك معدّ قرار (مستشار قانوني)، تُعِدّ قرار المركز من الدراسات والتقييمات المُجمَّعة وترفعه لاعتماد القيادة ثم للتصويت — إعدادٌ محايد بلا توصية.</p>
        <div className="stats">
          <Stat icon="assignment" v={toPrep.length} l="بانتظار الإعداد" bg="var(--warning-10)" fg="var(--color-warning)" />
          <Stat icon="send" v={inFlight.length} l="مرفوعة (اعتماد/تصويت)" bg="var(--info-10)" fg="var(--color-info)" />
          <Stat icon="folder_shared" v={mine.length} l="طلباتي المُسنَدة" bg="var(--green-10)" fg="var(--color-primary)" />
        </div>
        <Card className="card pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div><b style={{ color: 'var(--text-strong)' }}>{toPrep.length} طلبات بانتظار إعداد قرارها</b><div className="muted" style={{ marginTop: 3 }}>اكتملت دراستها وتقييمها ومُسنَدة إليك (توزيع آلي بالعبء).</div></div>
          <button className="btn btn-primary" onClick={() => go('cases')}><I name="assignment" size={18} /> طلبات للإعداد</button>
        </Card>
      </div>);
    }
    const voting = QUEUE.filter((q) => dOf(q.secret).status === 'voting').concat(LIFECYCLE);
    if (scope === 'members') {
      const pending = voting.filter((q) => !(q.kind === 'lifecycle' ? HD.getLifecycleVotes(q.secret)[me] : HD.getVotes(q.secret)[me]));
      return (<div>
        <h2 className="h2">لوحة المعلومات</h2>
        <p className="lede">تطّلع على قرارات المركز المطروحة وتدلي بصوتك (قبول/رفض) مستقلّاً. الحصيلة وأصوات الأعضاء تظهر للنائب والرئيس فقط.</p>
        <div className="stats">
          <Stat icon="how_to_vote" v={pending.length} l="بانتظار صوتك" bg="var(--warning-10)" fg="var(--color-warning)" />
          <Stat icon="inbox" v={voting.length} l="مطروح للتصويت" bg="var(--info-10)" fg="var(--color-info)" />
          <Stat icon="gavel" v={DECIDED.length} l="قرارات صدرت" bg="var(--green-10)" fg="var(--color-primary)" />
        </div>
        <Card className="card pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div><b style={{ color: 'var(--text-strong)' }}>{pending.length} بنود تنتظر صوتك</b><div className="muted" style={{ marginTop: 3 }}>المهلة: يوم عمل واحد من فتح التصويت.</div></div>
          <button className="btn btn-primary" onClick={() => go('cases')}><I name="how_to_vote" size={18} /> المطروح للتصويت</button>
        </Card>
      </div>);
    }
    // leadership
    const votingPending = voting.filter((q) => !(q.kind === 'lifecycle' ? HD.getLifecycleVotes(q.secret)[me] : HD.getVotes(q.secret)[me]));
    return (<div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">تُطرح قرارات المركز عليك للتصويت مباشرةً؛ تصوّت كعضو ثم تُصدر قرار المركز وتُشعِر الطرفين — ضمن مظلّة 3 أيام (م10). ولك إعادة قرارٍ ناقص للمعدّ عند الحاجة.</p>
      <div className="stats">
        <Stat icon="how_to_vote" v={votingPending.length} l="بانتظار صوتك" bg="var(--warning-10)" fg="var(--color-warning)" />
        <Stat icon="inbox" v={voting.length} l="مطروح للتصويت" bg="var(--info-10)" fg="var(--color-info)" />
        <Stat icon="gavel" v={DECIDED.length} l="قرارات صدرت" bg="var(--green-10)" fg="var(--color-primary)" />
      </div>
      <Card className="card pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><b style={{ color: 'var(--text-strong)' }}>{voting.length} بنود مطروحة للتصويت والإصدار</b><div className="muted" style={{ marginTop: 3 }}>اطّلع على الحزمة، صوّت كعضو، ثم أصدِر القرار بعد إغلاق التصويت.</div></div>
        <button className="btn btn-primary" onClick={() => go('cases')}><I name="gavel" size={18} /> التصويت والإصدار</button>
      </Card>
    </div>);
  }

  function Cases({ scope, me, open }) {
    if (scope === 'preparer') {
      const mine = QUEUE.filter((q) => q.preparer === me);
      return (<div>
        <h2 className="h2">طلبات بانتظار إعداد القرار</h2>
        <p className="lede">طلبات مُسنَدة إليك (توزيع آلي بالعبء، كلٌّ معزول). اطّلع على الحزمة المُجمَّعة ثم أعِدّ قرار المركز وارفعه للاعتماد.</p>
        <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
          <thead><tr><th>الرمز السري</th><th>الفئة</th><th>تصنيف الخطر</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{mine.map((q) => { const d = dOf(q.secret); const st = STATUS[d.status]; return (
            <tr key={q.secret} className="clk" onClick={() => open(q, 'prepare')}>
              <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{q.secret}{foreignBadge(q)}</td>
              <td><Tag tone="info" size="sm">{q.cat}</Tag></td><td><RiskLevel level={q.risk} /></td>
              <td><Tag tone={st.tone} size="sm" iconLeft={<I name={st.icon} size={12} />}>{st.t}</Tag></td>
              <td><span className="link">{d.status === 'preparing' ? 'إعداد القرار' : 'عرض'} <I name="chevron_left" size={16} /></span></td>
            </tr>); })}</tbody>
        </table></div></Card>
      </div>);
    }
    const list = QUEUE.filter((q) => ['voting', 'issued'].includes(dOf(q.secret).status)).concat(LIFECYCLE);
    const statusCell = (q) => {
      if (q.kind === 'lifecycle') { const issued = HD.lifecycleIssued(q.secret); if (issued) return <Tag tone="success" size="sm">صدر: {issued.type}</Tag>; const r = HD.resultFor(q.secret, true); if (scope === 'leadership') return r.closed ? <Tag tone={r.outcome === 'مقبول' ? 'success' : 'warning'} size="sm">{r.outcome} · {r.accept}/{r.reject}</Tag> : <Tag tone="info" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>تصويت جارٍ · {r.cast}/{VOTING_SEATS.length}</Tag>; const my = HD.getLifecycleVotes(q.secret)[me]; return my ? <Tag tone={my.choice === 'رفض' ? 'warning' : 'success'} size="sm">صوتك: {my.choice}</Tag> : <Tag tone="warning" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>بانتظار صوتك</Tag>; }
      const d = dOf(q.secret); if (d.issued) return <Tag tone={d.issued.type === 'قبول' ? 'success' : 'warning'} size="sm">صدر: {d.issued.type}</Tag>;
      const r = HD.resultFor(q.secret, false);
      if (scope === 'leadership') return r.closed ? <Tag tone={r.outcome === 'مقبول' ? 'success' : 'warning'} size="sm">{r.outcome} · {r.accept}/{r.reject}</Tag> : <Tag tone="info" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>تصويت جارٍ · {r.cast}/{VOTING_SEATS.length}</Tag>;
      const my = HD.getVotes(q.secret)[me]; return my ? <Tag tone={my.choice === 'رفض' ? 'warning' : 'success'} size="sm">صوتك: {my.choice}</Tag> : <Tag tone="warning" size="sm" iconLeft={<I name="how_to_vote" size={12} />}>بانتظار صوتك</Tag>;
    };
    return (<div>
      <h2 className="h2">{scope === 'leadership' ? 'التصويت وإصدار القرار' : 'المطروح للتصويت'}</h2>
      <p className="lede">{scope === 'leadership' ? 'قرارات معتمَدة مطروحة للتصويت (تصوّت كعضو ثم تُصدر بعد الإغلاق) ومراجعات دورة حياة.' : 'قرارات المركز المُعتمَدة ومراجعات دورة الحياة — أدلِ بصوتك مستقلّاً.'}</p>
      <InlineAlert kind="warning" title="مهلة التصويت: يوم عمل واحد كحدّ أقصى" style={{ marginBottom: 16 }}>يُغلق التصويت ببلوغ الأغلبية الحاسمة (4/7) أو انتهاء يوم العمل — أيّهما أسبق. من لم يصوّت يُدوَّن دون تعطيل القرار.</InlineAlert>
      <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>الفئة</th><th>نوع البند</th><th>تصنيف الخطر</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{list.map((q) => (
          <tr key={q.secret} className="clk" onClick={() => open(q, q.kind === 'lifecycle' ? 'lifecycle' : 'session')}>
            <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{q.secret}{foreignBadge(q)}</td>
            <td><Tag tone="info" size="sm">{q.cat}</Tag></td>
            <td>{q.kind === 'lifecycle' ? <Tag tone="warning" size="sm" iconLeft={<I name="cached" size={12} />}>دورة حياة</Tag> : <Tag tone="info" size="sm" iconLeft={<I name="gavel" size={12} />}>قرار ابتدائي</Tag>}</td>
            <td><RiskLevel level={q.risk} /></td><td>{statusCell(q)}</td>
            <td><span className="link">{scope === 'leadership' ? 'الحصيلة والإصدار' : 'الاطّلاع والتصويت'} <I name="chevron_left" size={16} /></span></td>
          </tr>))}</tbody>
      </table></div></Card>
    </div>);
  }

  function Approvals({ me, open }) {
    const pending = QUEUE.filter((q) => dOf(q.secret).status === (me === 'deputy' ? 'pending_deputy' : 'pending_chair'));
    const later = QUEUE.filter((q) => { const s = dOf(q.secret).status; return me === 'deputy' ? ['pending_chair', 'voting', 'issued'].includes(s) : ['voting', 'issued'].includes(s); });
    return (<div>
      <h2 className="h2">اعتماد القرارات المُعَدّة</h2>
      <p className="lede">{me === 'deputy' ? 'تعتمد قرار المركز المُعَدّ أولاً، ثم يُعرض على الرئيس لاعتماده وطرحه للتصويت.' : 'يظهر القرار لك بعد اعتماد النائب. باعتمادك يُطرح على المجلس للتصويت وتبدأ مهلة يوم العمل.'}</p>
      <Card className="card" style={{ overflow: 'hidden', marginBottom: 16 }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>الفئة</th><th>المعدّ</th><th>تصنيف الخطر</th><th></th></tr></thead>
        <tbody>{pending.length ? pending.map((q) => { const d = dOf(q.secret); return (
          <tr key={q.secret} className="clk" onClick={() => open(q, 'approve')}>
            <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{q.secret}{foreignBadge(q)}</td>
            <td><Tag tone="info" size="sm">{q.cat}</Tag></td><td className="muted">{(PREPARERS[d.preparer] || {}).name}</td><td><RiskLevel level={q.risk} /></td>
            <td><span className="link">مراجعة واعتماد <I name="chevron_left" size={16} /></span></td>
          </tr>); }) : <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 22 }}>لا قرارات بانتظار اعتمادك.</td></tr>}</tbody>
      </table></div></Card>
      {later.length > 0 && <React.Fragment>
        <p className="sec-h" style={{ margin: '4px 0 10px' }}><I name="history" size={17} color="var(--text-secondary)" /> قرارات تجاوزت مرحلة اعتمادك</p>
        <div style={{ display: 'grid', gap: 8 }}>{later.map((q) => { const d = dOf(q.secret); return (
          <div key={q.secret} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{q.secret}</span><Tag tone="info" size="sm">{q.cat}</Tag>
            <span style={{ marginInlineStart: 'auto' }}><Tag tone={STATUS[d.status].tone} size="sm" iconLeft={<I name={STATUS[d.status].icon} size={12} />}>{STATUS[d.status].t}</Tag></span>
          </div>); })}</div>
      </React.Fragment>}
    </div>);
  }

  function Notifs({ scope }) {
    const base = ({ preparer: [], members: [], leadership: [] })[scope] || []; // لا إشعارات مُلفّقة
    return (<div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات المهامّ والمواعيد النظامية في مرحلة القرار.</p>
      <div style={{ display: 'grid', gap: 10 }}>{base.map((n, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: i === 0 ? 'var(--green-10)' : 'var(--surface-card)', alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', background: 'var(--info-10)', color: 'var(--color-info)' }}><I name={n.icon} size={20} fill /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{n.t}</div><div style={{ fontSize: 13, color: 'var(--text-body)', marginTop: 2, lineHeight: 1.55 }}>{n.d}</div><div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{n.time}</div></div>
        </div>))}</div>
    </div>);
  }

  function DecisionsLog() {
    const issued = QUEUE.map((q) => ({ q, d: dOf(q.secret) })).filter((x) => x.d.issued).map((x) => ({ secret: x.q.secret, cat: x.q.cat, type: x.d.issued.type, when: x.d.issued.when }));
    const rows = issued.concat(DECIDED.map((d) => ({ secret: d.secret, cat: d.cat, type: d.type, when: d.when })));
    const TONE = { 'قبول': 'success', 'رفض': 'error' };
    return (<div>
      <h2 className="h2">سجل القرارات</h2>
      <p className="lede">القرارات الصادرة عن المجلس وحالة الإشعار — غير قابلة للتعديل ومسجّلة في التدقيق (م24–32).</p>
      <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
        <thead><tr><th>الرمز السري</th><th>الفئة</th><th>القرار</th><th>التاريخ</th><th>الإشعار</th></tr></thead>
        <tbody>{rows.map((d, i) => (
          <tr key={i}><td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{d.secret}</td><td><Tag tone="info" size="sm">{d.cat}</Tag></td>
            <td><Tag tone={TONE[d.type] || 'info'} size="sm">{d.type}</Tag></td><td className="muted">{d.when}</td>
            <td><Tag tone="success" size="sm" iconLeft={<I name="mark_email_read" size={13} />}>أُرسِل</Tag></td></tr>))}</tbody>
      </table></div></Card>
    </div>);
  }

  function Profile({ scope, me }) {
    const id = identOf(scope, me);
    const note = scope === 'preparer' ? 'دورك إعدادٌ محايد: تُعِدّ قرار المركز من الدراسات والتقييمات دون توصية بالقبول أو الرفض ودون تصويت؛ ويُرسَل مباشرةً إلى المجلس للتصويت.' : scope === 'leadership' ? 'يُطرح قرار المركز عليك للتصويت مباشرةً، وتصوّت كعضو، وتُصدر قرار المركز عند اكتمال التصويت وتُشعِر الطرفين. ولك إعادة قرارٍ ناقص للمعدّ، وترجيح الجانب عند التعادل.' : 'تصويتك مستقلّ (قبول/رفض) على قرار المركز المُعَدّ ولا تطّلع على أصوات بقية الأعضاء ولا الحصيلة؛ تظهر للنائب والرئيس فقط.';
    const auth = scope === 'preparer' ? 'إعداد قرار المركز وإرساله للمجلس للتصويت (بلا تصويت ولا توصية)' : scope === 'leadership' ? 'التصويت كعضو + إصدار القرار والإشعار + إعادة للمعدّ عند الحاجة' : 'الاطّلاع الكامل + التصويت المستقلّ (قبول/رفض)';
    const fields = [['الاسم', id.name], ['الصفة', id.t], ['الجهة', id.org], ['نطاق العمل', 'مرحلة القرار — إدارة البرنامج'], ['الصلاحية', auth], ['التوثيق', 'نفاذ + MFA']];
    return (<div>
      <h2 className="h2">الملف الشخصي</h2>
      <p className="lede">حسابك وصلاحياتك ونطاق عملك في مرحلة القرار.</p>
      <Card className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{fields.map(([l, v], i) => (<div className="ro-field" key={i}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{l}</span><span style={{ fontSize: 13, color: 'var(--text-body)' }}>{v}</span></div>))}</div>
        <InlineAlert kind="info" title={scope === 'preparer' ? 'الحياد والفصل' : 'استقلال الرأي'} style={{ marginTop: 14 }}>{note}</InlineAlert>
      </Card>
    </div>);
  }

  // ————————————————— المراسلات (معزولة بالمقعد؛ القيادة تطّلع على الجميع) —————————————————
  function Messages({ scope, me }) {
    const [sel, setSel] = useState(null);
    const [draft, setDraft] = useState('');
    const [composing, setComposing] = useState(false);
    const [cCase, setCCase] = useState('');
    const [cWith, setCWith] = useState('');
    const threads = HD.getThreads(scope, me);
    const canCompose = scope !== 'leadership';
    const nameOf = (s) => (PREPARERS[s] && PREPARERS[s].name) || (SEATS[s] && SEATS[s].name) || s;
    const roleOf = (s) => (PREPARERS[s] && PREPARERS[s].t) || (SEATS[s] && SEATS[s].t) || '';
    const composeCases = scope === 'preparer' ? QUEUE.filter((q) => q.preparer === me) : QUEUE.filter((q) => dOf(q.secret).status === 'voting');
    const cur = sel ? HD.findThread(sel) : null;
    const send = () => { if (!draft.trim() || !cur) return; HD.sendMessage(cur.id, me, draft.trim()); setDraft(''); };
    const startCompose = () => { if (!cCase || !cWith) return; const id = HD.startThread(scope === 'preparer' ? 'preparer' : 'member', me, cCase, cWith); setComposing(false); setCCase(''); setCWith(''); setSel(id); };

    if (cur) {
      const otherName = scope === 'leadership' ? nameOf(cur.partySeat) : nameOf(cur.with);
      const otherRole = scope === 'leadership' ? roleOf(cur.partySeat) : roleOf(cur.with);
      return (<div>
        <button className="link" onClick={() => setSel(null)} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للمراسلات</button>
        <Card className="card" style={{ overflow: 'hidden' }}>
          <div className="row" style={{ gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><I name="shield_person" size={20} color="var(--color-primary)" /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>{otherName} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {otherRole}</span></div>
              <div className="mono muted" style={{ fontSize: 11.5 }}>بشأن الطلب {cur.secret}</div></div>
            <Tag tone="error" size="sm" iconLeft={<I name="lock" size={12} />}>قناة مؤمّنة</Tag>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto', background: 'var(--surface-page)' }}>
            {cur.msgs.length === 0 && <div className="muted" style={{ textAlign: 'center', fontSize: 13, padding: 18 }}>لا رسائل بعد — ابدأ المحادثة.</div>}
            {cur.msgs.map((m, i) => { const mine = m.from === me; return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-start' : 'flex-end' }}>
                <div style={{ maxWidth: '82%', background: mine ? 'var(--color-primary)' : 'var(--surface-card)', color: mine ? '#fff' : 'var(--text-strong)', border: mine ? 'none' : '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 13.5, lineHeight: 1.65 }}>{m.t}</div>
                <span className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>{nameOf(m.from)} · {m.when}</span>
              </div>); })}
          </div>
          <div className="row" style={{ gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="اكتب رسالتك…" dir="auto" style={{ flex: 1 }} />
            <button className="btn btn-primary" style={{ width: 44, padding: 0 }} onClick={send} disabled={!draft.trim()}><I name="send" size={18} /></button>
          </div>
        </Card>
      </div>);
    }

    return (<div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 className="h2" style={{ margin: 0 }}>المراسلات</h2>
        {canCompose && !composing && <button className="btn btn-primary" onClick={() => setComposing(true)}><I name="add_comment" size={18} /> بدء مراسلة</button>}
      </div>
      <p className="lede">{scope === 'leadership' ? 'قنوات مؤمّنة مع أعضاء المجلس ومعدّي القرار — تطّلع على جميع المراسلات وتردّ عليها. كلها مسجّلة في التدقيق.' : 'قناة مؤمّنة مع قيادة المجلس (النائب/الرئيس) للاستيضاح بشأن قرارٍ مطروح — معزولة عن بقية الأعضاء ومسجّلة في التدقيق.'}</p>
      {composing && <Card className="card pad" style={{ marginBottom: 16 }}>
        <p className="sec-h"><I name="add_comment" size={18} color="var(--color-primary)" /> بدء مراسلة مع القيادة</p>
        <div className="fld"><span className="fld-label">{scope === 'preparer' ? 'الطلب المُسنَد إليك' : 'الطلب المطروح للتصويت'}</span>
          <select value={cCase} onChange={(e) => setCCase(e.target.value)} style={{ height: 44, padding: '0 13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--field-border)', background: 'var(--field-bg)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)', fontSize: 14, width: '100%' }}>
            <option value="">— اختر الطلب —</option>{composeCases.map((q) => <option key={q.secret} value={q.secret}>{q.secret} · {q.cat}</option>)}</select></div>
        <div className="fld"><span className="fld-label">إلى</span><div className="chips">{['deputy', 'chair'].map((k) => <button key={k} className={'chip' + (cWith === k ? ' on' : '')} onClick={() => setCWith(k)}>{SEATS[k].name} · {SEATS[k].t}</button>)}</div></div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}><button className="btn btn-ghost" onClick={() => { setComposing(false); setCCase(''); setCWith(''); }}>إلغاء</button><button className="btn btn-primary" disabled={!cCase || !cWith} onClick={startCompose}><I name="forum" size={17} /> بدء المراسلة</button></div>
      </Card>}
      {threads.length === 0 && !composing && <Card className="card pad" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>لا مراسلات في مقعدك بعد.{canCompose ? ' ابدأ مراسلة مع القيادة عند الحاجة.' : ''}</Card>}
      <div style={{ display: 'grid', gap: 10 }}>{threads.map((t) => { const last = t.msgs[t.msgs.length - 1] || { t: 'مراسلة جديدة', when: '' }; const other = scope === 'leadership' ? nameOf(t.partySeat) : nameOf(t.with); return (
        <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, cursor: 'pointer' }} onClick={() => setSel(t.id)}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-subtle)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><I name={scope === 'leadership' ? (t.party === 'preparer' ? 'assignment_ind' : 'account_circle') : 'shield_person'} size={20} color="var(--color-primary)" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div className="row" style={{ justifyContent: 'space-between', gap: 8 }}><span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-strong)' }}>{other} <span className="mono muted" style={{ fontWeight: 400 }}>· {t.secret}</span></span><span className="muted" style={{ fontSize: 11 }}>{last.when}</span></div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scope === 'leadership' && t.party === 'preparer' ? 'معدّ القرار' : ''}{last.t}</div></div>
          <I name="chevron_left" size={18} color="var(--text-secondary)" />
        </div>); })}</div>
    </div>);
  }

  // ————————————————— القشرة والتنقّل —————————————————
  function App({ scope, initialData }) {
    useStore();
    const real = !!(initialData && initialData.me);
    React.useEffect(() => { if (initialData) HD.hydrate(initialData); }, []);
    const seatList = seatsOf(scope);
    // في الوضع الحقيقيّ: النطاقات متعدّدة المقاعد (المعدّ/القيادة) تستخدم معرّف المقعد للعرض/الفرز
    // (إجراءات القاعدة محصورةٌ بالدور وتستعمل auth.uid() خادمياً)؛ أما الأعضاء فيستخدمون هويتهم الحقيقيّة لمطابقة التصويت.
    const [me, setMe] = useState(real ? (scope === 'members' ? initialData.me : seatList[0]) : seatList[0]);
    const [active, setActive] = useState('dashboard');
    const [sel, setSel] = useState(null); // {q, mode}
    const nav = NAV[scope];
    const meta = SCOPE_META[scope];
    const id = identOf(scope, me);
    const [open, setOpen] = useState(false);
    const go = (a) => { setActive(a); setSel(null); setOpen(false); };
    const openCase = (q, mode) => { setSel({ q, mode }); window.scrollTo(0, 0); };
    const cur = nav.find((n) => n.id === active) || nav[0];
    let body, title;
    if (sel && sel.mode === 'prepare') { body = <PrepareDecision q={sel.q} back={() => setSel(null)} />; title = 'إعداد قرار المركز'; }
    else if (sel && sel.mode === 'approve') { body = <ApprovalReview q={sel.q} me={me} back={() => setSel(null)} />; title = 'مراجعة واعتماد القرار'; }
    else if (sel && sel.mode === 'lifecycle') { body = <LifecycleSession q={sel.q} me={me} scope={scope} back={() => setSel(null)} />; title = 'بتّ مراجعة دورة الحياة'; }
    else if (sel && sel.mode === 'session') { body = <DecisionSession q={sel.q} me={me} scope={scope} back={() => setSel(null)} />; title = scope === 'leadership' ? 'حصيلة القرار وإصداره' : 'الاطّلاع والتصويت'; }
    else if (active === 'cases') { body = <Cases scope={scope} me={me} open={openCase} />; title = cur.t; }
    else if (active === 'approvals') { body = <Approvals me={me} open={openCase} />; title = cur.t; }
    else if (active === 'messages') { body = <Messages scope={scope} me={me} />; title = cur.t; }
    else if (active === 'notifications') { body = <Notifs scope={scope} />; title = cur.t; }
    else if (active === 'log') { body = <DecisionsLog />; title = cur.t; }
    else if (active === 'profile') { body = <Profile scope={scope} me={me} />; title = cur.t; }
    else { body = <Dashboard scope={scope} me={me} go={go} />; title = cur.t; }
    return (
      <div className="shell dec">
        <aside className={'side' + (open ? ' open' : '')}>
          <div className="brand"><div className="brand-mark"><I name={scope === 'preparer' ? 'assignment' : scope === 'leadership' ? 'shield_person' : 'how_to_vote'} size={22} fill color="#fff" /></div>
            <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.2 }}>بوابة موظف المركز</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{meta.sub}</div></div></div>
          <nav className="nav">{nav.map((n) => (<button key={n.id} className={'nav-item' + (active === n.id && !sel ? ' on' : '')} onClick={() => go(n.id)}><I name={n.icon} size={20} /> <span>{n.t}</span></button>))}</nav>
          <div className="side-foot">{meta.foot}</div>
        </aside>
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <div className="main">
          <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
            <span className="topbar-title">{title}</span>
            <span className="row" style={{ marginInlineStart: 'auto', gap: 8 }}><Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
              {((!real) || scope === 'leadership') && seatList.length > 1 && <button onClick={() => { const i = seatList.indexOf(me); setMe(seatList[(i + 1) % seatList.length]); setSel(null); setActive('dashboard'); }} title={scope === 'leadership' ? 'تبديل المقعد (نائب/رئيس)' : 'تبديل الهوية (للتجربة)'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '4px 10px', cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-subtle)', display: 'grid', placeItems: 'center' }}><I name="person" size={18} color="var(--color-primary)" /></div>
                <span style={{ textAlign: 'start' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.2 }}>{id.name}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)' }}>{id.t}</span></span>
              </button>}
              <button title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); }} style={{ width: 34, height: 34, flexShrink: 0, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}><I name="logout" size={18} /></button>
            </span>
          </header>
          <main className="content">{body}</main>
        </div>
      </div>
    );
  }

  // تصدير شاشات القيادة لإعادة استخدامها في بوابة «قيادة المركز» (الإشراف)
  const DecisionLeadership = { Approvals, DecisionCases: Cases, ApprovalReview, DecisionSession, LifecycleSession, dOf, foreignBadge };

  return { App, DecisionLeadership };

})();

export { DecisionLeadership };
export function DecisionPortal({ scope = 'preparer', initialData }) {
  // بوابة تأجيل حتى التركيب (منع عدم تطابق hydration)، ثم التغذية من بيانات الخادم.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <App scope={scope} initialData={initialData} />;
}
