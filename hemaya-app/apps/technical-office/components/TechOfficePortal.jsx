'use client';
/* ============================================================
   بوابة المكتب الفني — مرحلة التظلّمات (م10، م21) فوق القشرة الموحّدة:
   PortalShell (القشرة الغبية) + PortalConfig من @hemaya/domain
   (tech-advisor للمستشار · tech-head للمدير).
   المنطق النظامي: المستشار يقرّر مستقلّاً في المُسنَد إليه حصراً (عزل متبادل)،
   والمدير يعتمد البتّ أو يعيده — عبر RPCs الآمنة، وكل إجراءٍ بصفّ تدقيق.
   لا بيانات مُلفّقة: كل ما يُعرض من الصفوف الفعلية تحت RLS.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, PortalShell, NotificationsScreen, NotifItem, MessagesScreen } from "@hemaya/ui";
import { PORTAL_CONFIGS, GRIEVANCE_STAGES, GRIEVANCE_SLA_DAYS, PROTECTION_TYPES_14, grievanceStageIndex } from "@hemaya/domain";
import { createClient } from "@hemaya/supabase/src/browser";
import { advisorDecide, officeAdopt, officeReturn, sendOfficeMessage } from "@/lib/actions";
import { fetchGrievances } from "@/lib/grievances";
import "./tech-screens.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// حالة التظلّم في مسار المكتب — مشتقة من القرارين لا من أرقامٍ ثابتة
function statusTag(g) {
  if (g.officeDecision) {
    return g.officeDecision.outcome === 'accept'
      ? <Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} />}>اعتمده المكتب — قبول</Tag>
      : <Tag tone="error" size="sm" iconLeft={<I name="block" size={13} />}>اعتمده المكتب — رفض</Tag>;
  }
  if (g.advisorDecision) return <Tag tone="info" size="sm" iconLeft={<I name="how_to_reg" size={13} />}>بانتظار اعتماد المكتب</Tag>;
  return <Tag tone="warning" size="sm" iconLeft={<I name="edit_note" size={13} />}>قيد دراسة المستشار</Tag>;
}
function decisionOutcomeTag(o) {
  return o === 'reject'
    ? <Tag tone="error" size="sm">رفض الطلب</Tag>
    : <Tag tone="success" size="sm">قبول</Tag>;
}

function Bar({ k, v, max, tone }) {
  const pct = max ? Math.round((v / max) * 100) : 0;
  return <div className="bar-row"><span className="bar-k">{k}</span><span className="bar-track"><span className="bar-fill" style={{ width: pct + '%', background: tone || 'var(--color-primary)' }} /></span><span className="bar-v">{v}</span></div>;
}

// ===== لوحة المعلومات =====
function FocusCard({ g, act, isHead, openCase }) {
  if (!g || !act) {
    return (
      <Card className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10 }}>
          <I name="task_alt" size={22} fill color="var(--color-primary)" />
          <div>
            <b style={{ color: 'var(--text-strong)' }}>لا إجراءات معلّقة عليك الآن</b>
            <div className="muted" style={{ marginTop: 3 }}>{isHead ? 'لا قرارات مستشارين بانتظار اعتمادك — تابع سير العمل من التظلّمات.' : 'قرّرت في كل التظلّمات المُسنَدة إليك — تابع المهل من الإشعارات.'}</div>
          </div>
        </div>
      </Card>
    );
  }
  const sIdx = grievanceStageIndex(g);
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="ntf-ico" style={{ background: 'var(--warning-10)', color: 'var(--color-warning)', width: 46, height: 46 }}><I name="gavel" size={22} fill /></span>
          <span>
            <span className="row" style={{ gap: 8, marginBottom: 4 }}>
              <b style={{ fontSize: 15, color: 'var(--text-strong)' }}>تظلّم <span className="mono">{g.ref}</span></b>
              <Tag tone="info" size="sm">{g.cat}</Tag>
              <Tag tone="warning" size="sm" iconLeft={<I name="touch_app" size={12} />}>يتطلّب إجراء</Tag>
            </span>
            <span className="muted" style={{ display: 'block' }}>{g.scopeLabel} · رُفِع في {g.filedOn} · متبقٍّ {g.daysLeft} أيام من مهلة ({GRIEVANCE_SLA_DAYS})</span>
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => openCase(g)}><I name="touch_app" size={18} /> اتّخذ الإجراء</button>
      </div>
      <div className="row" style={{ gap: 7, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--warning-70)' }}><I name="arrow_left_alt" size={15} /> الإجراء المطلوب منك: {act.t}</div>
      <div className="stp" aria-hidden="true">{GRIEVANCE_STAGES.map((_, i) => <span key={i} className={i < sIdx ? 'on' : ''} />)}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>المرحلة {sIdx + 1} من {GRIEVANCE_STAGES.length} — {GRIEVANCE_STAGES[sIdx]}</div>
    </Card>
  );
}

function Dashboard({ cfg, isHead, rows, advisors, go, openCase, unreadMsgs, unreadNotifs, notifs, onOpenNotif }) {
  const actionable = rows.map((r) => ({ r, act: cfg.nextAction(r) })).filter((x) => x.act);
  // الأبرز: الأقدم مهلةً أولاً
  const focus = actionable.slice().sort((a, b) => b.r.daysElapsed - a.r.daysElapsed)[0] || null;
  const running = rows.filter((g) => !g.officeDecision).slice().sort((a, b) => b.daysElapsed - a.daysElapsed)[0] || null;
  const updates = notifs.slice(0, 3);
  const stats = isHead
    ? [
        { icon: 'gavel', v: rows.length, l: 'إجمالي التظلّمات', bg: 'var(--info-10)', fg: 'var(--color-info)', to: 'queue' },
        { icon: 'how_to_reg', v: actionable.length, l: 'يتطلّب إجراءك — اعتماد البتّ', bg: 'var(--warning-10)', fg: 'var(--color-warning)', to: 'queue' },
        { icon: 'forum', v: unreadMsgs, l: 'رسائل غير مقروءة', bg: 'var(--green-10)', fg: 'var(--color-primary)', to: 'messages' },
        { icon: 'notifications', v: unreadNotifs, l: 'إشعارات غير مقروءة', bg: 'var(--error-10)', fg: 'var(--color-error)', to: 'notifications' },
      ]
    : [
        { icon: 'assignment_ind', v: rows.length, l: 'تظلّمات مُسنَدة إليّ', bg: 'var(--info-10)', fg: 'var(--color-info)', to: 'queue' },
        { icon: 'edit_note', v: actionable.length, l: 'يتطلّب إجراءك — قرار مستقلّ', bg: 'var(--warning-10)', fg: 'var(--color-warning)', to: 'queue' },
        { icon: 'forum', v: unreadMsgs, l: 'رسائل غير مقروءة', bg: 'var(--green-10)', fg: 'var(--color-primary)', to: 'messages' },
        { icon: 'notifications', v: unreadNotifs, l: 'إشعارات غير مقروءة', bg: 'var(--error-10)', fg: 'var(--color-error)', to: 'notifications' },
      ];
  const adviMax = Math.max(1, ...advisors.map((a) => rows.filter((g) => g.assignedTo === a.user_id).length));
  const studying = rows.filter((g) => !g.advisorDecision && !g.officeDecision).length;
  const awaitingAdopt = rows.filter((g) => g.advisorDecision && !g.officeDecision).length;
  const adopted = rows.filter((g) => g.officeDecision).length;
  return (<div>
    <h2 className="h2">لوحة المعلومات</h2>
    <p className="lede">{isHead
      ? 'إشراف مدير المكتب الفني على كامل أعمال التظلّمات: قرارات المستشارين واعتماد البتّ والالتزام بالمواعيد (م10، م21) — كل ما يتطلّب إجراءً منك يظهر هنا أولاً.'
      : 'تَرِد إليك التظلّمات المُسنَدة آلياً حسب العبء. تعمل مستقلّاً ولا ترى عمل بقية المستشارين — وكل ما يتطلّب إجراءً منك يظهر هنا أولاً.'}</p>
    <FocusCard g={focus && focus.r} act={focus && focus.act} isHead={isHead} openCase={openCase} />
    <div className="stats">
      {stats.map((s, i) => (
        <button key={i} className="card stat" onClick={() => go(s.to)}>
          <span className="stat-ico" style={{ background: s.bg, color: s.fg }}><I name={s.icon} size={20} fill /></span>
          <span><span className="stat-v">{s.v}</span><span className="stat-l" style={{ display: 'block' }}>{s.l}</span></span>
        </button>
      ))}
    </div>
    <div className="dash-cols">
      <Card className="card pad">
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <I name="timer" size={18} color="var(--color-primary)" />
          <b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>المهلة النظامية الجارية</b>
        </div>
        {running
          ? <React.Fragment>
              <DeadlineTimer label={'مهلة البتّ — ' + running.ref} totalDays={GRIEVANCE_SLA_DAYS} daysElapsed={running.daysElapsed} articleRef="م21" />
              <p className="muted" style={{ margin: '12px 0 0', fontSize: 12 }}>يُبتّ في التظلّم خلال (10) أيام، وقرار المكتب نهائي غير قابل للطعن (م21).</p>
            </React.Fragment>
          : <p className="muted" style={{ margin: 0 }}>لا مهل جارية — كل التظلّمات المرئية لك بُتّ فيها.</p>}
      </Card>
      <Card className="card" style={{ padding: '16px 10px 10px' }}>
        <div className="row" style={{ justifyContent: 'space-between', margin: '0 8px 8px' }}>
          <b style={{ color: 'var(--text-strong)' }}><I name="update" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />آخر التحديثات</b>
          <button className="link" onClick={() => go('notifications')}>كل الإشعارات</button>
        </div>
        {updates.length === 0 && <p className="muted" style={{ margin: '4px 8px 10px' }}>لا تحديثات بعد.</p>}
        {updates.map((u) => <NotifItem key={u.id} config={cfg} n={u} dense onOpen={onOpenNotif} />)}
      </Card>
    </div>
    {isHead && (
      <div className="dash-cols" style={{ marginTop: 14 }}>
        <Card className="card pad">
          <div className="sec-h"><I name="hub" size={19} color="var(--color-primary)" /> توزّع العبء على المستشارين</div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>توزيع آلي حسب الأقل عبئاً — لضمان الحياد واستقلال العمل.</p>
          {advisors.map((a) => <Bar key={a.user_id} k={a.name + ' · ' + a.spec} v={rows.filter((g) => g.assignedTo === a.user_id).length} max={adviMax} />)}
          {advisors.length === 0 && <p className="muted" style={{ margin: 0 }}>لا مستشارين مسجّلين بعد.</p>}
        </Card>
        <Card className="card pad">
          <div className="sec-h"><I name="donut_small" size={19} color="var(--color-primary)" /> حالات التظلّمات</div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>أين تقف التظلّمات الآن في مسار المكتب.</p>
          <Bar k="قيد دراسة المستشار" v={studying} max={Math.max(1, rows.length)} tone="var(--color-warning)" />
          <Bar k="بانتظار اعتماد المكتب" v={awaitingAdopt} max={Math.max(1, rows.length)} tone="var(--color-info)" />
          <Bar k="اعتمدها المكتب" v={adopted} max={Math.max(1, rows.length)} tone="var(--color-primary)" />
        </Card>
      </div>
    )}
  </div>);
}

// ===== التظلّمات =====
function Grievances({ cfg, isHead, rows, advisorName, openCase }) {
  const title = isHead ? 'التظلّمات الواردة' : 'التظلّمات المُسنَدة';
  const lede = isHead
    ? 'كل التظلّمات الواردة للمكتب مع المستشار المُسنَد إليه وقراره؛ اعتمد قرار المكتب من تفاصيل التظلّم.'
    : 'تظلّمات أُسنِدت إليك آلياً حسب العبء. تعمل عليها مستقلّاً — لا تظهر لك تظلّمات بقية المستشارين.';
  return (<div>
    <h2 className="h2">{title}</h2>
    <p className="lede">{lede}</p>
    <Card className="card" style={{ overflow: 'hidden' }}>
      <div className="tbl-wrap"><table>
        <thead><tr><th>رقم التظلّم</th><th>الرمز السري</th><th>الفئة</th><th>محل الاعتراض</th>{isHead && <th>المستشار المُسنَد</th>}<th>الميعاد</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{rows.map((g) => {
          const act = cfg.nextAction(g);
          return (
          <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => openCase(g)}>
            <td>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{g.ref}</span>
              {act && <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--warning-70)' }}><I name="arrow_left_alt" size={12} style={{ verticalAlign: '-2px' }} /> الإجراء المطلوب منك: {act.t}</span>}
            </td>
            <td className="mono">{g.secret}</td>
            <td><Tag tone="info" size="sm">{g.cat}</Tag></td>
            <td className="muted">{g.scopeLabel}</td>
            {isHead && <td className="muted">{advisorName(g.assignedTo)}</td>}
            <td>{g.officeDecision
              ? <span className="muted" style={{ fontSize: 12.5 }}>بُتّ فيه</span>
              : <span style={{ fontSize: 12.5, color: g.daysElapsed >= 4 ? 'var(--color-error)' : 'var(--color-primary)', fontWeight: 600 }}>متبقٍّ {g.daysLeft} يوم</span>}</td>
            <td><div style={{ display: 'grid', gap: 4, justifyItems: 'start' }}>{statusTag(g)}{act && <Tag tone="warning" size="sm" iconLeft={<I name="touch_app" size={12} />}>يتطلّب إجراء</Tag>}</div></td>
            <td><span className="link">عرض <I name="chevron_left" size={16} /></span></td>
          </tr>);
        })}
          {rows.length === 0 && <tr><td colSpan={isHead ? 8 : 7} className="muted" style={{ textAlign: 'center', padding: '28px 0', cursor: 'default' }}>{isHead ? 'لا تظلّمات واردة بعد.' : 'لا تظلّمات مُسنَدة إليك حالياً.'}</td></tr>}
        </tbody>
      </table></div>
    </Card>
  </div>);
}

// ===== تفاصيل التظلّم =====
function TypeChips({ value, onToggle, disabled }) {
  return (
    <div className="chips">
      {PROTECTION_TYPES_14.map((t) => disabled
        ? (value.includes(t) ? <span className="chip on" key={t} style={{ cursor: 'default' }}>{t}</span> : null)
        : <button key={t} className={'chip' + (value.includes(t) ? ' on' : '')} onClick={() => onToggle(t)}>{t}</button>)}
    </div>
  );
}

function GrievanceDetail({ g, isHead, advisorName, back, onAdvisorDecide, onAdopt, onReturn, busy }) {
  const [decision, setDecision] = useState('');
  const [decTypes, setDecTypes] = useState([]);
  const [decReason, setDecReason] = useState('');
  const [outcome, setOutcome] = useState('');
  const [adoptTypes, setAdoptTypes] = useState(() => (g.advisorDecision && Array.isArray(g.advisorDecision.types)) ? g.advisorDecision.types : []);
  const [adoptReason, setAdoptReason] = useState('');
  const [returning, setReturning] = useState(false);
  const [returnNote, setReturnNote] = useState('');

  const myDec = g.advisorDecision;
  // تحديث دالّي — نقرات متتالية في دفعةٍ واحدة لا تُسقط بعضها
  const toggle = (set) => (t) => set((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const canDecide = decision && decReason.trim() && (decision !== 'support' || decTypes.length > 0);
  const canAdopt = outcome && adoptReason.trim() && (outcome !== 'accept' || adoptTypes.length > 0);

  return (<div>
    <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى التظلّمات</button>

    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <I name="gavel" size={26} fill color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>تظلّم <span className="mono">{g.ref}</span></div>
            <div className="muted">{g.scopeLabel} · رُفِع في {g.filedOn} · <Tag tone="info" size="sm">{g.cat}</Tag></div>
          </div>
        </div>
        {statusTag(g)}
      </div>
      <div style={{ marginTop: 14 }}><SecretCode code={g.secret} canReveal={false} /></div>
      {!g.officeDecision && <div style={{ marginTop: 12 }}><DeadlineTimer label="مهلة البتّ في التظلّم" totalDays={GRIEVANCE_SLA_DAYS} daysElapsed={g.daysElapsed} articleRef="م21" /></div>}
    </Card>

    <div className="pkg-bar"><I name="auto_awesome" size={18} /><span>تُجمَّع كامل بيانات الطلب وقراره ودراساته آلياً للاطّلاع — هوية المعني بالحماية مرمَّزة (المادة الثانية والخامسة عشرة والسادسة عشرة)، ولا توصية مرفقة.</span></div>

    <Card className="card pad" style={{ marginBottom: 14 }}>
      <div className="sec-h"><I name="timeline" size={19} color="var(--color-primary)" /> مسار الطلب — من التقديم إلى القرار</div>
      <div className="tl">{g.timeline.map((s, i) => (
        <div className="tl-item" key={i}>
          <div className={'tl-dot' + (s.kind === 'rej' ? ' rej' : s.kind === 'grv' ? ' grv' : '')}>
            <I name={s.kind === 'rej' ? 'close' : s.kind === 'grv' ? 'gavel' : 'check'} size={10} color={s.kind === 'rej' ? 'var(--color-error)' : s.kind === 'grv' ? 'var(--color-warning)' : 'var(--color-primary)'} />
          </div>
          <div className="tl-t">{s.t}</div>
          <div className="tl-m mono">{new Date(s.ts).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <div className="tl-m" style={{ marginTop: 2 }}>{s.m}</div>
        </div>))}
      </div>
    </Card>

    {g.decision && (
      <Card className="card pad" style={{ marginBottom: 14 }}>
        <div className="sec-h"><I name="description" size={19} color="var(--color-primary)" /> القرار محل التظلّم</div>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className="ro-field" style={{ flex: 1 }}><span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 13 }}>التاريخ</span><span className="muted">{g.decision.date}</span></span>
          <span className="ro-field"><span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 13 }}>المآل</span>{decisionOutcomeTag(g.decision.outcome)}</span>
        </div>
        {g.decision.types.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="fld-label" style={{ marginBottom: 6 }}>أنواع الحماية المقرّرة</div>
            <div className="chips">{g.decision.types.map((t) => <span className="chip on" key={t} style={{ cursor: 'default' }}>{t}</span>)}</div>
          </div>
        )}
        <div className="fld-label" style={{ marginBottom: 6 }}>{g.decision.outcome === 'reject' ? 'أسباب الرفض' : 'مسوّغات القرار'}</div>
        <ul style={{ margin: 0, paddingInlineStart: 20, color: 'var(--text-body)', fontSize: 13.5, lineHeight: 1.9 }}>
          {(g.decision.reasons.length ? g.decision.reasons : ['—']).map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </Card>
    )}

    <Card className="card pad" style={{ marginBottom: 14 }}>
      <div className="sec-h"><I name="folder_shared" size={19} color="var(--color-primary)" /> ملف القضية والدراسات</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="ro-field"><span className="fac-k">رقم الطلب</span><span className="fac-v mono">{g.caseRef}</span></div>
        <div className="ro-field"><span className="fac-k">الجهة المختصة</span><span className="fac-v">{g.caseFile.entity}</span></div>
        <div className="ro-field"><span className="fac-k">توصية الجهة</span><span className="fac-v">{g.caseFile.recDecision}</span></div>
        <div className="ro-field"><span className="fac-k">درجة الخطر المصنّفة</span><span className="fac-v">{g.caseFile.threat}</span></div>
        <div className="ro-field"><span className="fac-k">المسار</span><span className="fac-v">{g.caseFile.source}</span></div>
        <div className="ro-field"><span className="fac-k">الفئة</span><span className="fac-v">{g.cat}</span></div>
      </div>
      {g.studies.map((s, i) => (
        <details className="acc" key={i}>
          <summary><I name={s.icon} size={18} color="var(--text-secondary)" /> {s.who} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {s.when}</span><I name="expand_more" size={20} className="chev2" /></summary>
          <div className="acc-body">
            {s.factors.map(([k, v], j) => <div className="fac" key={j}><span className="fac-k">{k}</span><span className="fac-v">{v}</span></div>)}
            <div className="opin">{s.opinion}</div>
          </div>
        </details>
      ))}
      {g.studies.length === 0 && <p className="muted" style={{ margin: 0 }}>لا دراسات مُقدَّمة على هذه القضية (قد يكون القرار صدر بمسارٍ مختصر).</p>}
    </Card>

    <Card className="card pad" style={{ marginBottom: 14, background: 'var(--warning-10)', borderColor: 'var(--warning-50)' }}>
      <div className="sec-h"><I name="record_voice_over" size={19} color="var(--color-warning)" /> أسباب التظلّم — كما قدّمها المتقدّم</div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: 'var(--text-body)' }}>{g.applicantReason}</p>
    </Card>

    {g.returnLog.length > 0 && (
      <Card className="card pad" style={{ marginBottom: 14 }}>
        <div className="sec-h"><I name="undo" size={19} color="var(--color-warning)" /> إعادات المدير</div>
        {g.returnLog.map((r, i) => (
          <div className="ro-field" key={i} style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>{r.note}</span>
            <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{r.by} · {new Date(r.at).toLocaleDateString('ar-SA-u-nu-latn')}</span>
          </div>
        ))}
      </Card>
    )}

    {/* قرار المستشار — إجراء للمستشار المُسنَد؛ اطّلاع للمدير */}
    <Card className="card pad" style={{ marginBottom: 14 }}>
      <div className="sec-h"><I name="how_to_reg" size={19} color="var(--color-primary)" /> قرار المستشار {isHead && <span className="muted" style={{ fontWeight: 400, marginInlineStart: 4 }}>· {advisorName(g.assignedTo)}</span>}</div>
      {myDec ? (
        <React.Fragment>
          <div className="row" style={{ marginBottom: 10 }}>
            <Tag tone={myDec.decision === 'support' ? 'success' : 'error'} size="sm">{myDec.decision === 'support' ? 'تأييد التظلّم' : 'تأييد قرار المركز'}</Tag>
            <span className="muted">بواسطة {myDec.by} · {fmtOn(myDec.on)}</span>
          </div>
          {Array.isArray(myDec.types) && myDec.types.length > 0 && (
            <div className="chips" style={{ marginBottom: 10 }}>{myDec.types.map((t) => <span className="chip on" key={t} style={{ cursor: 'default' }}>{t}</span>)}</div>
          )}
          <div className="opin" style={{ marginTop: 0 }}>{myDec.reason}</div>
        </React.Fragment>
      ) : !isHead ? (
        <React.Fragment>
          <InlineAlert kind="info" title="عملك مستقلّ" style={{ marginBottom: 14 }}>قرارك فردي ولا يطّلع عليه بقية المستشارين. يعتمد المكتب الفني القرار النهائي بعد قرارك المستقلّ.</InlineAlert>
          <div className="fld">
            <label className="fld-label">قرارك في التظلّم</label>
            <div className="chips">
              <button className={'chip' + (decision === 'support' ? ' on' : '')} onClick={() => setDecision('support')}>تأييد التظلّم</button>
              <button className={'chip danger' + (decision === 'reject_grievance' ? ' on' : '')} onClick={() => setDecision('reject_grievance')}>تأييد قرار المركز — رفض التظلّم</button>
            </div>
          </div>
          {decision === 'support' && (
            <div className="fld">
              <label className="fld-label">أنواع الحماية المقترحة عند تأييد التظلّم (من الـ13 — المادة الرابعة عشرة)</label>
              <TypeChips value={decTypes} onToggle={toggle(setDecTypes)} />
            </div>
          )}
          <div className="fld">
            <label className="fld-label">حيثيات القرار <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <textarea value={decReason} onChange={(e) => setDecReason(e.target.value)} placeholder="حلّل مدى توافر عوامل المادة (التاسعة)، وسلامة قرار المركز، وأثر مستجدّات التظلّم…" dir="auto" />
          </div>
          <button className="btn btn-primary" disabled={!canDecide || busy} onClick={() => onAdvisorDecide(g, decision, decTypes, decReason.trim())}>
            <I name="send" size={18} /> اعتماد قراري وإرساله للمكتب
          </button>
        </React.Fragment>
      ) : (
        <InlineAlert kind="warning" title="لم يقرّر المستشار بعد">التظلّم قيد دراسة المستشار المُسنَد ({advisorName(g.assignedTo)}) — يُعتمد البتّ بعد وصول قراره المستقلّ.</InlineAlert>
      )}
    </Card>

    {/* اعتماد المكتب الفني — البتّ (للمدير فقط) */}
    {isHead && (
      <Card className="card pad" style={{ borderColor: 'var(--color-primary)' }}>
        <div className="sec-h"><I name="verified" size={19} color="var(--color-primary)" /> اعتماد المكتب الفني — البتّ</div>
        {g.officeDecision ? (
          <React.Fragment>
            <InlineAlert kind={g.officeDecision.outcome === 'accept' ? 'success' : 'error'} title={g.officeDecision.outcome === 'accept' ? 'اعتمد المكتب الفني قبول التظلّم' : 'اعتمد المكتب الفني رفض التظلّم — نهائي'}>
              {g.officeDecision.outcome === 'accept'
                ? 'يُشمل المتقدّم ببرنامج الحماية مباشرةً دون العودة للدراسة، وأُشعِر هو والمركز. القرار نهائي.'
                : 'قرار المكتب الفني في التظلّم نهائي. أُشعِر المتقدّم والمركز.'}
            </InlineAlert>
            {Array.isArray(g.officeDecision.types) && g.officeDecision.types.length > 0 && (
              <div className="chips" style={{ marginTop: 12 }}>{g.officeDecision.types.map((t) => <span className="chip on" key={t} style={{ cursor: 'default' }}>{t}</span>)}</div>
            )}
            <div className="opin" style={{ marginTop: 12 }}>{g.officeDecision.reason}<div className="muted" style={{ marginTop: 6, fontSize: 11.5 }}>بواسطة {g.officeDecision.by} · {fmtOn(g.officeDecision.on)}</div></div>
          </React.Fragment>
        ) : !myDec ? (
          <InlineAlert kind="warning" title="لا يمكن الاعتماد بعد">لم يقرّر المستشار المُسنَد بعد. يُعتمد القرار بعد ورود قرار المستشار المستقلّ.</InlineAlert>
        ) : (
          <React.Fragment>
            <InlineAlert kind="info" title="قرار نهائي" style={{ marginBottom: 14 }}>المكتب الفني يبتّ في التظلّم بتوجيه النائب العام؛ القرار نهائي ويُوثَّق بالتوقيع عبر نفاذ (المادة العاشرة). تعتمد قرار المستشار أو تعيده مسبَّباً — لا تعديل عليه.</InlineAlert>
            <div className="fld">
              <label className="fld-label">قرار المكتب</label>
              <div className="chips">
                <button className={'chip' + (outcome === 'accept' ? ' on' : '')} onClick={() => setOutcome('accept')}>قبول التظلّم</button>
                <button className={'chip danger' + (outcome === 'reject' ? ' on' : '')} onClick={() => setOutcome('reject')}>رفض التظلّم</button>
              </div>
            </div>
            {outcome === 'accept' && (
              <div className="fld">
                <label className="fld-label">أنواع الحماية المقرّرة (من الـ13 — المادة الرابعة عشرة)</label>
                <TypeChips value={adoptTypes} onToggle={toggle(setAdoptTypes)} />
              </div>
            )}
            <div className="fld">
              <label className="fld-label">حيثيات الاعتماد <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <textarea value={adoptReason} onChange={(e) => setAdoptReason(e.target.value)} placeholder="اذكر الأساس النظامي والحيثيات التي بُني عليها قرار المكتب…" dir="auto" />
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button className={'btn ' + (outcome === 'reject' ? 'btn-danger' : 'btn-primary')} disabled={!canAdopt || busy} onClick={() => onAdopt(g, outcome, adoptTypes, adoptReason.trim())}>
                <I name="draw" size={18} /> اعتماد قرار المكتب والتوقيع عبر نفاذ
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setReturning((v) => !v)}><I name="undo" size={18} /> إعادة للمستشار</button>
            </div>
            {returning && (
              <div className="fld" style={{ marginTop: 14, marginBottom: 0 }}>
                <label className="fld-label">سبب الإعادة <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="ما الذي يلزم المستشار استكماله قبل الاعتماد؟" dir="auto" style={{ minHeight: 64 }} />
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                  <button className="btn btn-ghost" disabled={!returnNote.trim() || busy} onClick={() => onReturn(g, returnNote.trim())}><I name="undo" size={18} /> تأكيد الإعادة</button>
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </Card>
    )}
  </div>);
}

function fmtOn(iso) {
  try { return new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(iso || '—'); }
}

// ===== المستشارون (للمدير) =====
function Advisors({ advisors, rows }) {
  const max = Math.max(1, ...advisors.map((a) => Number(a.open_load)));
  return (<div>
    <h2 className="h2">المستشارون</h2>
    <p className="lede">مستشارو المكتب الفني وأعباؤهم الجارية. التوزيع آليّ حسب الأقل عبئاً، وكلٌّ يعمل مستقلّاً ولا يطّلع على عمل زملائه — والمدير يشرف ويعتمد.</p>
    <Card className="card" style={{ overflow: 'hidden', marginBottom: 14 }}>
      <div className="tbl-wrap"><table>
        <thead><tr><th>المستشار</th><th>التخصّص</th><th>تظلّمات جارية</th><th>قرارات مُدلًى بها</th><th>العبء</th></tr></thead>
        <tbody>{advisors.map((a) => (
          <tr key={a.user_id} style={{ cursor: 'default' }}>
            <td style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{a.name}</td>
            <td className="muted">{a.spec}</td>
            <td>{rows.filter((g) => g.assignedTo === a.user_id && !g.officeDecision).length}</td>
            <td>{a.decided}</td>
            <td style={{ minWidth: 160 }}><span className="bar-track" style={{ display: 'block' }}><span className="bar-fill" style={{ width: Math.round((Number(a.open_load) / max) * 100) + '%' }} /></span></td>
          </tr>
        ))}
        {advisors.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>لا مستشارين مسجّلين بعد.</td></tr>}
        </tbody>
      </table></div>
    </Card>
    <InlineAlert kind="info" title="العزل المتبادل">كل مستشارٍ يرى المُسنَد إليه فقط (RLS) ولا يطّلع على قرارات زملائه؛ الأسماء هنا أسماء موظفين — هوية المتظلّمين تبقى بالرمز السري حصراً.</InlineAlert>
  </div>);
}

// ===== الملف الشخصي =====
function Profile({ me, isHead, mySpec }) {
  const fields = [
    ['الاسم', me.name],
    ['الصفة', isHead ? 'مدير المكتب الفني' : 'مستشار المكتب الفني' + (mySpec ? ' · ' + mySpec : '')],
    ['الجهة', 'النيابة العامة — مكتب النائب العام'],
    ['نطاق العمل', 'مرحلة التظلّمات (المادة العاشرة والحادية والعشرون)'],
    ['الصلاحية', isHead ? 'اطّلاع كامل + اعتماد قرار المكتب (البتّ) + الإشراف' : 'اطّلاع كامل + قرار مستقلّ في المُسنَد إليك'],
    ['التوثيق', 'نفاذ + MFA'],
  ];
  return (<div>
    <h2 className="h2">الملف الشخصي</h2>
    <p className="lede">حسابك وصلاحياتك ونطاق عملك في مرحلة التظلّمات.</p>
    <Card className="card pad">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {fields.map(([l, v], i) => (<div className="ro-field" key={i}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{l}</span><span style={{ fontSize: 13, color: 'var(--text-body)' }}>{v}</span></div>))}
      </div>
      <InlineAlert kind="info" title="استقلال العمل والفصل بين الأدوار" style={{ marginTop: 14 }}>{isHead
        ? 'يعتمد المكتب الفني القرار النهائي بعد قرارات المستشارين المستقلّة — بتوجيه النائب العام، ويشرف المدير على سير العمل والمواعيد.'
        : 'تعمل مستقلّاً عن بقية المستشارين؛ التظلّمات تُوزَّع آلياً حسب العبء، ولا ترى قرارات غيرك.'}</InlineAlert>
    </Card>
  </div>);
}

// الإشعارات الحقيقية (recipient_id) → صيغة القشرة الموحّدة
const NOTIF_CAT = { assign: 'assign', deadline: 'deadline', msg: 'msg', return: 'status', status: 'status', decision: 'decision', incoming: 'incoming' };
function mapNotifs(rows, grievances) {
  const byRef = {}; grievances.forEach((g) => { byRef[g.ref] = g; });
  const refIn = (s) => { const m = /GRV-\d{4}-\d{4}/.exec(s || ''); return m ? m[0] : null; };
  return (rows || []).map((n) => {
    const ref = refIn(n.title) || refIn(n.body);
    const g = ref ? byRef[ref] : null;
    const open = g && !g.officeDecision;
    return {
      id: n.id,
      cat: NOTIF_CAT[n.type] || 'status',
      crit: !!n.crit && (!g || open),
      title: n.title,
      body: n.body,
      created_at: n.sent_at || n.created_at,
      read: !!n.read,
      dest: n.target_tab === 'messages' ? 'messages' : 'queue',
      ref,
      deadline: n.type === 'deadline' && open
        ? { label: 'مهلة البتّ في التظلّم — ' + g.ref, total: GRIEVANCE_SLA_DAYS, elapsed: g.daysElapsed, ref: 'م21' }
        : undefined,
    };
  });
}

// ===== التطبيق — تركيب القشرة الموحّدة =====
function App({ roleKey, me, mySpec, initialRows, prefs, basePath, initialNotifs, initialReadKeys, initialOfficeMsgs, initialCaseMsgs, advisors }) {
  const cfg = PORTAL_CONFIGS[roleKey] || PORTAL_CONFIGS['tech-advisor'];
  const isHead = roleKey === 'tech-head';
  const supabase = useRef(createClient()).current;
  const [active, setActive] = useState(cfg.defaultScreen);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(!!(prefs || {})['sidebar-technical']);
  const [rows, setRows] = useState(initialRows || []);
  const [notifRows, setNotifRows] = useState(initialNotifs || []);
  const [officeMsgs, setOfficeMsgs] = useState(initialOfficeMsgs || []);
  const [caseMsgs, setCaseMsgs] = useState(initialCaseMsgs || []);
  const [readKeys, setReadKeys] = useState(initialReadKeys || []);
  const [localThreads, setLocalThreads] = useState([]);
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3600); };

  const advisorName = (uid) => {
    const a = advisors.find((x) => x.user_id === uid);
    return a ? a.name : '—';
  };

  const notifs = mapNotifs(notifRows, rows);
  const unreadNotifs = notifs.filter((n) => !n.read).length;
  const markRead = async (id) => {
    setNotifRows((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };
  const markAllRead = async () => {
    const ids = notifRows.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setNotifRows((xs) => xs.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  // خيوط المراسلات: office_messages (قنوات المكتب) + messages (خيط المتظلّم بالرمز)
  const rowById = {}; rows.forEach((g) => { rowById[g.id] = g; });
  const rowByCase = {}; rows.forEach((g) => { rowByCase[g.caseId] = g; });
  const partyOfChannel = (ch) => (isHead && ch === 'head' ? 'advisor' : ch);
  const channelOfParty = (p) => (p === 'advisor' ? 'head' : p);
  const threads = (() => {
    const map = new Map();
    const push = (key, gid, party, msg, unreadKey, fromMe) => {
      if (!map.has(key)) {
        const g = rowById[gid];
        map.set(key, { id: key, caseId: gid, secret: g ? g.ref + ' · ' + g.secret : '—', party, unread: 0, msgs: [] });
      }
      const t = map.get(key);
      t.msgs.push(msg);
      if (!fromMe && unreadKey && !readKeys.includes(unreadKey)) t.unread += 1;
    };
    for (const m of officeMsgs) {
      const party = partyOfChannel(m.channel);
      if (!cfg.messaging.parties.some((p) => p.id === party)) continue;
      const fromMe = m.author_id === me.id;
      push(m.grievance_id + ':' + party, m.grievance_id, party,
        { id: 'om:' + m.id, from: fromMe ? 'me' : 'party', body: m.body, at: m.created_at, _key: 'om:' + m.id },
        'om:' + m.id, fromMe);
    }
    if (!isHead) {
      for (const m of caseMsgs) {
        const g = rowByCase[m.case_id];
        if (!g) continue;
        const fromMe = m.direction === 'in';
        push(g.id + ':seeker', g.id, 'seeker',
          { id: 'cm:' + m.id, from: fromMe ? 'me' : 'party', body: m.body, at: m.created_at, _key: 'cm:' + m.id },
          'cm:' + m.id, fromMe);
      }
    }
    const db = Array.from(map.values());
    const extras = localThreads.filter((lt) => !map.has(lt.id));
    return [...extras, ...db].sort((a, b) => (((a.msgs[a.msgs.length - 1] || {}).at || '9999') < ((b.msgs[b.msgs.length - 1] || {}).at || '9999') ? 1 : -1));
  })();
  const unreadMsgs = threads.reduce((a, t) => a + (t.unread || 0), 0);

  const persistReadKeys = async (keys) => {
    if (!keys.length) return;
    setReadKeys((xs) => Array.from(new Set([...xs, ...keys])));
    await supabase.from('notification_reads').upsert(
      keys.map((k) => ({ user_id: me.id, notif_key: k })), { onConflict: 'user_id,notif_key' });
  };
  const openThread = (t) => {
    const keys = t.msgs.filter((m) => m.from === 'party' && m._key && !readKeys.includes(m._key)).map((m) => m._key);
    persistReadKeys(keys);
  };
  const startThread = (gid, partyId) => {
    const key = gid + ':' + partyId;
    const g = rowById[gid];
    setLocalThreads((xs) => (xs.some((x) => x.id === key) ? xs : [{ id: key, caseId: gid, secret: g ? g.ref + ' · ' + g.secret : '—', party: partyId, unread: 0, msgs: [] }, ...xs]));
    return key;
  };
  const sendMessage = async (t, body) => {
    const g = rowById[t.caseId];
    if (!g) { say('تعذّر تحديد التظلّم.'); return; }
    if (t.party === 'seeker') {
      const { data, error } = await supabase
        .from('messages')
        .insert({ case_id: g.caseId, thread: 'center', direction: 'in', body, sender_label: cfg.label })
        .select()
        .single();
      if (error) { say('تعذّر الإرسال: ' + error.message); return; }
      setLocalThreads((xs) => xs.filter((x) => x.id !== t.id));
      if (data) setCaseMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
      return;
    }
    const res = await sendOfficeMessage(g.id, channelOfParty(t.party), body);
    if (!res.ok) { say('تعذّر الإرسال: ' + res.error); return; }
    setLocalThreads((xs) => xs.filter((x) => x.id !== t.id));
    setOfficeMsgs((m) => (m.some((x) => x.id === res.id) ? m : [...m, { id: res.id, grievance_id: g.id, channel: channelOfParty(t.party), author_id: me.id, author_label: cfg.label, body, created_at: new Date().toISOString() }]));
  };

  // ريل-تايم: التظلّمات تعيد الجلب تحت RLS؛ الإشعارات والرسائل تُلحق مباشرة
  useEffect(() => {
    const reload = async () => setRows(await fetchGrievances(supabase));
    const ch = supabase
      .channel('tech-office-shell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grievances' }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (p) => { if (p.new && p.new.recipient_id === me.id) setNotifRows((xs) => (xs.some((x) => x.id === p.new.id) ? xs : [p.new, ...xs])); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'office_messages' },
        (p) => setOfficeMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (p) => { if (p.new && p.new.thread === 'center') setCaseMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNav = (id) => { setActive(id); setSel(null); };
  const selG = sel ? rows.find((g) => g.id === sel) || null : null;
  const openCase = (g) => { setActive('queue'); setSel(g.id); };
  const openNotif = (n) => {
    markRead(n.id);
    // وجهة إشعار الرسالة هي المراسلات وإن ذُكر مرجع التظلّم في نصّه
    if (n.dest !== 'messages' && n.ref) { const g = rows.find((x) => x.ref === n.ref); if (g) { openCase(g); return; } }
    goNav(n.dest);
  };

  // كشف الرمز السري = حدث تدقيق (م15/16)
  const revealAudit = async () => { if (selG) await supabase.rpc('record_secret_reveal', { _case_id: selG.caseId }); };

  // طيّ الجانبية تفضيل مستخدم في القاعدة (user_prefs)
  const toggleCollapsed = async () => {
    const v = !collapsed;
    setCollapsed(v);
    const { data: cur } = await supabase.from('user_prefs').select('prefs').eq('user_id', me.id).maybeSingle();
    await supabase.from('user_prefs').upsert(
      { user_id: me.id, prefs: { ...(cur?.prefs || prefs || {}), 'sidebar-technical': v }, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  };

  const refresh = async () => setRows(await fetchGrievances(supabase));
  const onAdvisorDecide = async (g, decision, types, reason) => {
    setBusy(true);
    const r = await advisorDecide(g.id, decision, types, reason);
    setBusy(false);
    if (!r.ok) { say('تعذّر اعتماد القرار: ' + r.error); return; }
    say('أُرسل قرارك المستقلّ للمكتب — مسجّل في التدقيق.');
    await refresh();
  };
  const onAdopt = async (g, outcome, types, reason) => {
    setBusy(true);
    const r = await officeAdopt(g.id, outcome, types, reason);
    setBusy(false);
    if (!r.ok) { say('تعذّر الاعتماد: ' + r.error); return; }
    say(outcome === 'accept' ? 'اعتُمد قبول التظلّم — أُشعِر المتقدّم والمركز وأُنشئ سجلّ المشمول.' : 'اعتُمد رفض التظلّم — القرار نهائي وأُشعِر أطرافه.');
    await refresh();
  };
  const onReturn = async (g, note) => {
    setBusy(true);
    const r = await officeReturn(g.id, note);
    setBusy(false);
    if (!r.ok) { say('تعذّرت الإعادة: ' + r.error); return; }
    say('أُعيد التظلّم للمستشار مسبَّباً — مسجّل في التدقيق.');
    setSel(null);
    await refresh();
  };

  const needCount = rows.filter((g) => cfg.nextAction(g)).length;

  let body;
  if (active === 'queue') body = selG
    ? <GrievanceDetail g={selG} isHead={isHead} advisorName={advisorName} back={() => setSel(null)} onAdvisorDecide={onAdvisorDecide} onAdopt={onAdopt} onReturn={onReturn} busy={busy} />
    : <Grievances cfg={cfg} isHead={isHead} rows={rows} advisorName={advisorName} openCase={openCase} />;
  else if (active === 'dashboard') body = <Dashboard cfg={cfg} isHead={isHead} rows={rows} advisors={advisors} go={goNav} openCase={openCase} unreadMsgs={unreadMsgs} unreadNotifs={unreadNotifs} notifs={notifs} onOpenNotif={openNotif} />;
  else if (active === 'tasks') body = <Advisors advisors={advisors} rows={rows} />;
  else if (active === 'profile') body = <Profile me={me} isHead={isHead} mySpec={mySpec} />;
  else if (active === 'notifications') body = <NotificationsScreen config={cfg} items={notifs} onOpen={openNotif} onMarkAllRead={markAllRead} />;
  else body = (
    <MessagesScreen
      config={cfg}
      lede={isHead
        ? 'قنوات تنسيق مؤمّنة حول التظلّمات: المستشارون ومنسّق المركز وإحاطة مكتب النائب العام — كل رسالة تُسلَّم فعلياً وتُسجَّل في التدقيق.'
        : 'قنوات تنسيق مؤمّنة حول تظلّماتك المُسنَدة: المدير ومنسّق المركز والمتظلّم (بالرمز السري حصراً) — كل رسالة تُسلَّم فعلياً وتُسجَّل في التدقيق.'}
      threads={threads}
      activeCases={rows.filter((g) => !g.officeDecision).map((g) => ({ caseId: g.id, secret: g.ref, label: g.cat + ' · ' + g.secret }))}
      onOpenThread={openThread}
      onSend={sendMessage}
      onStart={startThread}
      senderLabel={cfg.label}
    />
  );

  const logout = async () => { try { await fetch(basePath + '/auth/signout', { method: 'POST' }); } finally { window.location.href = '/'; } };

  return (
    <PortalShell
      config={cfg}
      brand={{ logoSrc: basePath + '/brand/logo-center.png', portalTitle: cfg.strings.brandSub, markIcon: 'balance' }}
      user={{ name: me.name }}
      active={active}
      onNavigate={goNav}
      counters={{ queue: needCount, messages: unreadMsgs, notifications: unreadNotifs }}
      secret={selG ? selG.secret : null}
      onRevealSecret={revealAudit}
      roleTag="سري للغاية"
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      onLogout={logout}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}

export function TechOfficePortal({ roleKey = 'tech-advisor', me, mySpec = '', initialRows, prefs, basePath = '/technical', initialNotifs = [], initialReadKeys = [], initialOfficeMsgs = [], initialCaseMsgs = [], advisors = [] }) {
  return <App roleKey={roleKey} me={me} mySpec={mySpec} initialRows={initialRows} prefs={prefs} basePath={basePath} initialNotifs={initialNotifs} initialReadKeys={initialReadKeys} initialOfficeMsgs={initialOfficeMsgs} initialCaseMsgs={initialCaseMsgs} advisors={advisors} />;
}
