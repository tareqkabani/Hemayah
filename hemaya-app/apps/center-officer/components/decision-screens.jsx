'use client';
/* ============================================================
   شاشات مرحلة القرار المشتركة — منقولة من decision-portal.jsx
   window/HP → @hemaya/ui + وحدة المخزن. تُصدَّر عبر DScreens.
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, RiskLevel } from "@hemaya/ui";
import { HemayaDecision } from "./decision-store";

const HD = HemayaDecision;
const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

const SEATS = HD.SEATS, PREPARERS = HD.PREPARERS, VOTING_SEATS = HD.VOTING_SEATS, MAJORITY = HD.MAJORITY;
const PROTECTION_TYPES = HD.PROTECTION_TYPES, PROPOSED_TYPES = HD.PROPOSED_TYPES, DEFAULT_DURATION = HD.DEFAULT_DURATION;
const QUEUE = HD.QUEUE, LIFECYCLE = HD.LIFECYCLE, DECIDED = HD.DECIDED;

const STATUS = {
  preparing:      { t: 'قيد الإعداد',              tone: 'neutral', icon: 'edit_note' },
  pending_deputy: { t: 'بانتظار اعتماد النائب',    tone: 'warning', icon: 'pending' },
  pending_chair:  { t: 'بانتظار اعتماد الرئيس',    tone: 'warning', icon: 'pending' },
  voting:         { t: 'مطروح للتصويت',            tone: 'info',    icon: 'how_to_vote' },
  issued:         { t: 'صدر القرار',               tone: 'success', icon: 'verified' },
};
const identOf = (scope, id) => (scope === 'preparer' ? PREPARERS[id] : SEATS[id])
  || { name: 'المستخدم (نفاذ)', t: scope === 'preparer' ? 'معدّ القرار' : scope === 'leadership' ? 'قيادة المجلس' : 'عضو المجلس', org: 'النيابة العامة' };
const seatsOf = (scope) => scope === 'preparer' ? Object.keys(PREPARERS) : scope === 'leadership' ? ['deputy', 'chair'] : HD.MEMBER_SEATS;

function useStore() { const [, f] = useState(0); useEffect(() => HD.subscribe(() => f((n) => n + 1)), []); }

// ============================ مكوّنات عرض مشتركة ============================
function StudyCard({ r }) {
  const tc = r.tone === 'success' ? 'var(--color-success)' : r.tone === 'warning' ? 'var(--color-warning)' : 'var(--color-error)';
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderInlineStart: '4px solid ' + tc, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
        <I name={r.spec === 'قانوني' ? 'balance' : r.spec === 'أمني' ? 'security' : 'psychology'} size={20} color="var(--color-primary)" />
        <b style={{ color: 'var(--text-strong)', fontSize: 14 }}>{r.who}</b>
        <Tag tone={r.tone} size="sm">{r.rec}</Tag>
        <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="muted" style={{ fontSize: 11.5 }}>تصنيف الخطر</span><RiskLevel level={r.level} /></span>
      </div>
      <div style={{ padding: 16 }}>
        {r.factors && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
          {r.factors.map((f, j) => (<div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 11px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f[0]}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>{f[1]}</span></div>))}
        </div>}
        <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-body)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', borderInlineStart: '3px solid ' + tc }}>{r.opinion}</div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>{(r.attachments || []).map((a, j) => (<span key={j} className="att" style={{ marginTop: 0 }}><I name="description" size={15} /> {a}</span>))}</div>
      </div>
    </div>
  );
}
function EntityRecCard({ er }) {
  const provide = (er.decision || '').indexOf('عدم') === -1;
  const tc = provide ? 'var(--color-success)' : 'var(--color-error)';
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderInlineStart: '4px solid ' + tc, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
        <I name="account_balance" size={20} color="var(--color-primary)" />
        <b style={{ color: 'var(--text-strong)', fontSize: 14 }}>{er.source}</b>
        <Tag tone={provide ? 'success' : 'error'} size="sm">{er.decision}</Tag>
        <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="muted" style={{ fontSize: 11.5 }}>قناة الاستلام</span><Tag tone="neutral" size="sm">{er.channel}</Tag></span>
      </div>
      <div style={{ padding: 16 }}>
        {er.factors && er.factors.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
          {er.factors.map((f, j) => (<div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 11px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f[0]}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>{f[1]}</span></div>))}
        </div>}
        <div style={{ display: 'grid', gap: 8, marginBottom: er.notes ? 12 : 0 }}>
          <div className="fac"><span className="fac-k">التدبير المقترح</span><span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{(er.proposedType && er.proposedType.length) ? er.proposedType.map((t, j) => <Tag key={j} tone="info" size="sm">{t}</Tag>) : <span className="fac-v">—</span>}</span></div>
          <div className="fac"><span className="fac-k">المدّة المقترحة</span><span className="fac-v">{er.proposedDuration}</span></div>
        </div>
        {er.notes && <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-body)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', borderInlineStart: '3px solid ' + tc }}>{er.notes}</div>}
      </div>
    </div>
  );
}
function ReviewPackage({ q }) {
  const groups = [['دراسات قانونية', 'balance', q.recs.filter((r) => r.spec === 'قانوني')], ['تقييمات نفسية/اجتماعية', 'psychology', q.recs.filter((r) => r.spec === 'نفسي/اجتماعي')], ['تقييمات أمنية', 'security', q.recs.filter((r) => r.spec === 'أمني')]];
  const cf = q.caseFile || {};
  return (<div>
    <p className="sec-h" style={{ marginBottom: 10 }}><I name="folder_open" size={18} color="var(--color-primary)" /> حزمة الاطّلاع — مُجمَّعة آلياً</p>
    <div className="pkg-bar"><I name="smart_toy" size={16} /><span>يجمع النظام مخرجات الدراسة والتقييم كما وردت بلا اختصار أو توصية. يطّلع المعدّ والمجلس على المحتوى الكامل، وكل فتح يُسجَّل في التدقيق (م15/16).</span></div>
    {q.reqChannel === 'body' && <InlineAlert kind="info" title="طلبٌ مُقدَّم من الجهة المختصّة" style={{ margin: '12px 0' }}>وَرَدَ طلب الحماية من جهةٍ مختصّة (لا من المستفيد مباشرةً)، مرفقاً بتوصيتها أدناه.</InlineAlert>}
    {q.foreign && <InlineAlert kind="warning" title={'مسار أجنبي (المادة 6) — ' + q.foreign.country} style={{ margin: '12px 0' }}>الطلب وارد عبر {q.foreign.committee}. عند قبول المجلس تُرفع النتيجة توصيةً إلى النائب العام للبتّ النهائي (المعاملة بالمثل)؛ سند: {q.foreign.basis} · {q.foreign.foreignRef}.</InlineAlert>}
    <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
      {[['الجهة', cf.entity], ['رقم القضية', cf.caseNo], ['نوع الجريمة', cf.crime], ['الواقعة', cf.waqia], ['مستوى التهديد', cf.threat], ['امتداد الخطر', cf.extends]].map(([k, v], i) => (
        <div className="fac" key={i}><span className="fac-k">{k}</span><span className="fac-v">{v}</span></div>))}
    </div>
    {q.entityRec && <div>
      <p className="sec-h" style={{ margin: '18px 0 12px' }}><I name="account_balance" size={18} color="var(--color-primary)" /> توصية الجهة المختصّة</p>
      <EntityRecCard er={q.entityRec} />
    </div>}
    {groups.map(([label, ic, arr]) => arr.length ? (
      <div key={label}>
        <p className="sec-h" style={{ margin: '18px 0 12px' }}><I name={ic} size={18} color="var(--color-primary)" /> {label} <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({arr.length} — كلّ مُعدّ مستقلّ ومعزول)</span></p>
        <div style={{ display: 'grid', gap: 12 }}>{arr.map((r, i) => <StudyCard key={i} r={r} />)}</div>
      </div>) : null)}
  </div>);
}

// قرار المركز المُعَدّ — عرض
function DecisionView({ decision, foreign }) {
  return (
    <Card className="card pad" style={{ marginTop: 16 }}>
      <p className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> قرار المركز المُعَدّ</p>
      <div className="pkg-bar"><I name="verified_user" size={16} /><span>أعدّه <b>{(PREPARERS[decision.preparer] || {}).name || 'معدّ القرار'}</b> (مستشار قانوني) إعداداً محايداً من الدراسات والتقييمات — بلا توصية بالقبول أو الرفض.</span></div>
      <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">أنواع الحماية المقترحة (المادة 14)</span>
        <div className="row" style={{ gap: 6 }}>{(decision.types || []).map((t) => <Tag key={t} tone="success" size="sm" iconLeft={<I name="shield" size={12} />}>{t}</Tag>)}</div></div>
      <div className="ro-field" style={{ marginBottom: 12 }}><span className="muted">مدّة الحماية</span><b style={{ color: 'var(--text-strong)' }}>{decision.duration}</b></div>
      <div className="fld" style={{ marginBottom: 12 }}><span className="fld-label">حيثيات القرار</span><div className="opin" style={{ marginTop: 0 }}>{decision.reasoning}</div></div>
      <div className="row" style={{ gap: 8 }}>
        <Tag tone="info" size="sm" iconLeft={<I name="how_to_vote" size={13} />}>يُرسَل مباشرةً إلى المجلس للتصويت</Tag>
      </div>
      {foreign && <InlineAlert kind="warning" title="مسار أجنبي — المادة 6" style={{ marginTop: 12 }}>عند قبول المجلس تُرفع النتيجة توصيةً إلى النائب العام للبتّ النهائي (المعاملة بالمثل).</InlineAlert>}
    </Card>
  );
}

// صندوق تصويت العضو (قبول/رفض — نقرة واحدة، الرفض بتسبيب)
function VoteBox({ my, onCast, canVote, subject }) {
  const [vote, setVote] = useState('');
  const [note, setNote] = useState('');
  if (my) return (<Card className="card pad" style={{ marginTop: 16 }}>
    <InlineAlert kind={my.choice === 'رفض' ? 'warning' : 'success'} title={'صوتك المسجّل: ' + my.choice}>سُجّل صوتك مستقلّاً بختم زمني في التدقيق ({my.when}).{my.note ? ' — السبب: ' + my.note : ''} لا تطّلع على أصوات بقية الأعضاء ولا على الحصيلة؛ تظهر للنائب والرئيس فقط.</InlineAlert>
  </Card>);
  if (!canVote) return null;
  const isReject = vote === 'رفض';
  const ready = vote && (!isReject || note.trim());
  return (<Card className="card pad" style={{ marginTop: 16 }}>
    <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> صوتك على {subject}</p>
    <InlineAlert kind="info" title="تصويت مستقلّ — نقرة واحدة" style={{ marginBottom: 14 }}>تدلي بصوتك بعد الاطّلاع الكامل، دون رؤية أصوات بقية الأعضاء. المهلة: يوم عمل واحد كحدٍّ أقصى من فتح التصويت.</InlineAlert>
    <div className="fld"><span className="fld-label">قرارك</span>
      <div className="chips">{['قبول', 'رفض'].map((o) => <button key={o} className={'chip' + (vote === o ? ' on' : '') + (o === 'رفض' ? ' danger' : '')} onClick={() => setVote(o)}>{o}</button>)}</div></div>
    {vote === 'قبول' && <p className="muted" style={{ margin: '0 0 8px' }}>القبول = تبنّي القرار المُعَدّ كما عُرض. للتحفّظ على بندٍ اختر «رفض» واذكر السبب فيُعاد للمعدّ.</p>}
    {isReject && <div className="fld"><span className="fld-label">سبب الرفض <span style={{ color: 'var(--color-error)' }}>· إلزامي</span></span>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="اذكر سبب الرفض أو التحفّظ — يُدوَّن للمعدّ والقيادة…" dir="auto" /></div>}
    <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" disabled={!ready} onClick={() => onCast(vote, note.trim())}><I name="how_to_vote" size={18} /> اعتماد صوتي</button></div>
  </Card>);
}

// حصيلة تصويت المجلس (اطّلاع القيادة) + تصويت القيادة كأعضاء
function CouncilTally({ result, votesFor, seat, onCast, onClose }) {
  const t = result;
  const my = votesFor && votesFor[seat];
  const [vote, setVote] = useState('');
  const [note, setNote] = useState('');
  const isReject = vote === 'رفض';
  const VT = { 'قبول': ['var(--success-10)', 'var(--success-70)', 'check_circle'], 'رفض': ['var(--error-10)', 'var(--error-70)', 'cancel'] };
  return (<React.Fragment>
    <Card className="card pad" style={{ marginTop: 16 }}>
      <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> حصيلة تصويت المجلس <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>(اطّلاع القيادة)</span></p>
      <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: 'var(--success-10)', color: 'var(--success-70)' }}><I name="thumb_up" size={14} /> قبول {t.accept}</span>
        <span className="pill" style={{ background: 'var(--error-10)', color: 'var(--error-70)' }}><I name="thumb_down" size={14} /> رفض {t.reject}</span>
        <span className="pill" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}><I name="hourglass_top" size={14} /> لم يصوّت {t.pending}</span>
        <span className="muted" style={{ fontSize: 12 }}>الأغلبية الحاسمة: {MAJORITY}/{VOTING_SEATS.length}</span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: 'var(--surface-subtle)', overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
        <div style={{ width: (t.accept / VOTING_SEATS.length * 100) + '%', background: 'var(--color-success)' }} />
        <div style={{ width: (t.reject / VOTING_SEATS.length * 100) + '%', background: 'var(--color-error)' }} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {Object.keys(votesFor || {}).map((s) => { const v = votesFor[s]; const vt = VT[v.choice] || VT['قبول']; const nm = SEATS[s] ? SEATS[s].name : (v.mine ? 'صوتك' : 'عضو مصوّت'); return (
          <div key={s} className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span className="row" style={{ gap: 8 }}><I name="account_circle" size={18} color="var(--text-secondary)" /><b style={{ fontSize: 13, color: 'var(--text-strong)' }}>{nm}</b>{SEATS[s] && SEATS[s].kind === 'lead' && <Tag tone="neutral" size="sm">{SEATS[s].t}</Tag>}</span>
            <span className="pill" style={{ background: vt[0], color: vt[1] }}><I name={vt[2]} size={13} /> {v.choice}{v.note ? ' · متحفّظ' : ''}</span>
          </div>); })}
        {t.pending > 0 && <div className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}><I name="hourglass_top" size={16} style={{ verticalAlign: 'middle' }} /> أعضاء لم يصوّتوا بعد</span>
          <span className="muted" style={{ fontSize: 12.5 }}>{t.pending} من {VOTING_SEATS.length}</span>
        </div>}
      </div>
      {t.closed ? <InlineAlert kind={t.outcome === 'مقبول' ? 'success' : 'warning'} title={'أُغلق التصويت: ' + t.outcome} style={{ marginTop: 14 }}>حُسم بأغلبية {t.outcome === 'مقبول' ? t.accept : t.reject} من {VOTING_SEATS.length}{t.deadlineClosed ? ' عند انتهاء يوم العمل (النصاب بالمصوّتين)' : ''}. أصدِر قرار المركز أدناه.</InlineAlert>
        : <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>لم تُبلَغ الأغلبية بعد ({Math.max(t.accept, t.reject)}/{MAJORITY}).</span>
            <button className="btn btn-ghost" onClick={onClose} disabled={t.cast === 0}><I name="timer_off" size={17} /> إغلاق بانتهاء يوم العمل</button>
          </div>}
    </Card>
    {!my && !t.closed && <Card className="card pad" style={{ marginTop: 14 }}>
      <p className="sec-h"><I name="how_to_vote" size={18} color="var(--color-primary)" /> صوتك كعضو مصوّت</p>
      <p className="muted" style={{ marginTop: 0 }}>أنت عضوٌ مصوّت في المجلس (وللرئيس ترجيح الجانب عند التعادل). أدلِ بصوتك المستقلّ:</p>
      <div className="chips">{['قبول', 'رفض'].map((o) => <button key={o} className={'chip' + (vote === o ? ' on' : '') + (o === 'رفض' ? ' danger' : '')} onClick={() => setVote(o)}>{o}</button>)}</div>
      {isReject && <div className="fld" style={{ marginTop: 12 }}><span className="fld-label">سبب الرفض · إلزامي</span><textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" /></div>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn btn-primary" disabled={!vote || (isReject && !note.trim())} onClick={() => onCast(vote, note.trim())}>اعتماد صوتي</button></div>
    </Card>}
    {my && <InlineAlert kind="info" title={'صوتك المسجّل كعضو: ' + my.choice} style={{ marginTop: 14 }}>أدليت بصوتك ({my.when}).</InlineAlert>}
  </React.Fragment>);
}

function SecurityReport({ r }) {
  const TONE = { 'استمرار': 'success', 'تعديل': 'warning', 'إغلاق': 'error' };
  return (<div>
    <p className="sec-h" style={{ marginBottom: 10 }}><I name="security" size={18} color="var(--color-primary)" /> تقرير الإدارة الأمنية — مرفوع للمجلس</p>
    <div className="pkg-bar"><I name="smart_toy" size={16} /><span>يَرِد التقرير من الإدارة الأمنية بعد المتابعة الميدانية. يطّلع المجلس على محتواه كاملاً قبل التصويت — القرار خالصٌ للمجلس.</span></div>
    <div style={{ display: 'grid', gap: 8, marginTop: 12, marginBottom: 12 }}>
      {[['مصدر التقرير', r.source], ['نوع التقرير', r.kind], ['المُعِدّ', r.officer], ['نطاق المراجعة', r.period]].map(([k, v], i) => (<div className="fac" key={i}><span className="fac-k">{k}</span><span className="fac-v">{v}</span></div>))}
      <div className="fac"><span className="fac-k">توصية الإدارة الأمنية</span><span><Tag tone={TONE[r.recommendation]} size="sm">{r.recommendation}</Tag></span></div>
      <div className="fac"><span className="fac-k">الأنواع الحالية</span><span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{r.current.map((t) => <Tag key={t} tone="info" size="sm">{t}</Tag>)}</span></div>
    </div>
    <div className="opin">{r.summary}</div>
    <div>{r.attachments.map((a, j) => (<span className="att" key={j}><I name="description" size={15} /> {a}</span>))}</div>
  </div>);
}

const Timer = ({ q }) => <DeadlineTimer label="مهلة التصويت — يوم عمل واحد" totalDays={1} daysElapsed={0} articleRef="المادة 10" />;

export const DScreens = { StudyCard, ReviewPackage, DecisionView, VoteBox, CouncilTally, SecurityReport, Timer, I, STATUS, identOf, seatsOf, useStore };
