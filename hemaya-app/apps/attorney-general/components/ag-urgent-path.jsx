'use client';
/* المسار العاجل (المادة الثامنة) — حقيقيّ: يقرأ emergency_reports (Realtime) ويبتّ عبر approve_urgent RPC.
   بتّ القبول يُنشئ حمايةً مؤقّتة ويجعل القضيّة active (تتدفّق للتنفيذ) ويُشعِر طالبَ الحماية. لا تلفيق. */
import React, { useState } from "react";
import { Card, InlineAlert, SecretCode } from "@hemaya/ui";
import { useUrgent, approveUrgent } from "./urgent-store";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) =>
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

const PROTECTION_TYPES = [
  'الحماية الأمنية', 'إخفاء البيانات الشخصية', 'النقل من العمل (مؤقّت/دائم)', 'إيجاد عمل بديل',
  'الإرشاد القانوني/النفسي/الاجتماعي', 'توفير وسائل الإبلاغ الفوري', 'تغيير أرقام الاتصال',
  'تغيير محل الإقامة', 'المرافقة الأمنية', 'الإدلاء بوسائط إلكترونية (تغيير الصوت وإخفاء الوجه)',
  'حماية المسكن', 'المساعدة المالية', 'أخرى (ما تراه الإدارة مناسباً)',
];

const catTone = { 'شاهد': ['var(--info-10)', 'var(--color-info)'], 'مبلّغ': ['var(--green-10)', 'var(--green-80)'], 'ضحية': ['var(--warning-10)', 'var(--warning-70)'], 'خبير': ['var(--surface-subtle)', 'var(--text-body)'] };
const fmtElapsed = (m) => m < 60 ? `${m} دقيقة` : `${Math.floor(m / 60)} س ${m % 60} د`;
const fmtWhen = (ts) => { try { return new Date(ts).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return '—'; } };

function Queue({ list, openCase }) {
  return (<div className="uq">
    {list.map((u) => {
      const [bg, fg] = catTone[u.cat] || catTone['خبير'];
      const done = u.status !== 'pending';
      const approved = u.status === 'approved';
      return (
        <div className="ucard" key={u.ref} onClick={() => openCase(u)}>
          <div className={'ucard-edge' + (done ? ' done' : '')} />
          <div className="ucard-body">
            <div className="ucard-top">
              <span className="ucard-ref">{u.ref}</span>
              <span className="pill" style={{ background: bg, color: fg }}>{u.cat}</span>
              {done
                ? <span className="pill" style={{ background: approved ? 'var(--green-10)' : 'var(--error-10)', color: approved ? 'var(--green-80)' : 'var(--error-70)' }}><I name={approved ? 'check_circle' : 'cancel'} size={13} fill /> {approved ? 'مبتوت — موافقة' : 'مبتوت — رفض'}</span>
                : <span className={'timer' + (u.elapsed >= 120 ? '' : ' warn')}><I name="timer" size={13} /> منذ {fmtElapsed(u.elapsed)}</span>}
            </div>
            <h4 className="ucard-h">{u.danger ? u.danger.slice(0, 70) + (u.danger.length > 70 ? '…' : '') : 'طلب حماية عاجل — خطر وشيك على الحياة'}</h4>
            <div className="ucard-meta">رُفع من: {u.raisedBy} · {fmtWhen(u.reportedAt)}</div>
          </div>
          <div className="ucard-arrow"><I name="chevron_left" size={22} /></div>
        </div>
      );
    })}
  </div>);
}

function UrgentDetail({ u, back }) {
  const decided = u.status !== 'pending';
  const r = u.ruling || {};
  const [outcome, setOutcome] = useState(decided ? r.outcome : '');
  const [types, setTypes] = useState(decided && r.types ? r.types : []);
  const [days, setDays] = useState(decided && r.days ? r.days : 30);
  const [reason, setReason] = useState(decided ? (r.reason || '') : '');
  const [issued, setIssued] = useState(decided);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (t) => setTypes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);
  const [bg, fg] = catTone[u.cat] || catTone['خبير'];
  const validDays = days >= 1 && days <= 30;
  const canApprove = outcome === 'approve' && types.length > 0 && reason.trim() && validDays && !busy;
  const canReject = outcome === 'reject' && reason.trim() && !busy;

  const submit = async (approve) => {
    setBusy(true); setErr('');
    const { error } = await approveUrgent(u.id, approve, approve ? types : [], approve ? days : 0, reason.trim());
    setBusy(false);
    if (error) { setErr('تعذّر حفظ القرار: ' + error.message); return; }
    setIssued(true);
  };

  if (issued) {
    const approved = outcome === 'approve';
    return (<div>
      <button className="link" onClick={back} style={{ marginBottom: 14 }}><I name="arrow_forward" size={18} /> رجوع للطلبات العاجلة</button>
      <div className="urgent-banner" style={{ background: approved ? 'var(--green-10)' : 'var(--error-10)', borderColor: approved ? 'color-mix(in srgb, var(--color-primary) 35%, transparent)' : 'color-mix(in srgb, var(--color-error) 35%, transparent)' }}>
        <div className="ub-ico" style={{ background: approved ? 'var(--color-primary)' : 'var(--color-error)' }}><I name={approved ? 'verified' : 'cancel'} size={22} color="#fff" fill /></div>
        <div>
          <div className="ub-t" style={{ color: approved ? 'var(--green-80)' : 'var(--error-70)' }}>{approved ? 'تمّت الموافقة — أُحيل للمركز للتنفيذ الفوري' : 'رُفض الطلب العاجل'}</div>
          <div className="ub-d">{u.ref} · صدر القرار من النائب العام.</div>
        </div>
      </div>

      {approved && (<>
        <Card className="card pad" style={{ marginBottom: 14 }}>
          <h3 className="sec-h"><I name="shield" size={18} color="var(--color-primary)" /> التدابير المؤقّتة المقرّرة</h3>
          <div className="chips">{types.map((t) => <span key={t} className="chip on" style={{ cursor: 'default' }}>{t}</span>)}</div>
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="ro-field"><span className="fac-k">مدّة التدابير المؤقّتة</span><span className="fac-v">{days} يوماً (حدّ أقصى 30 — المادة الثامنة)</span></div>
            <div className="ro-field"><span className="fac-k">تجديد/مراجعة</span><span className="fac-v">تُعرض الحالة على المجلس قبل الانتهاء</span></div>
          </div>
          <div className="opin" style={{ marginTop: 12 }}><b style={{ color: 'var(--text-strong)' }}>التسبيب: </b>{reason}</div>
        </Card>
        <InlineAlert kind="info" title="ما يجري الآن آلياً في مركز الحماية">
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <div>• صارت القضيّة نشطةً وأُحيلت لمركز الحماية للتنفيذ الفوري (تظهر في «الوارِدون للتنفيذ» لحظيّاً).</div>
            <div>• سُجّلت حمايةٌ مؤقّتة مدّتها {days} يوماً (م8).</div>
            <div>• تُعرض الحالة على المجلس قبل انتهاء المدّة لتقرير الاستمرار/التعديل/الإنهاء.</div>
            <div>• أُشعر طالب الحماية بصدور القرار.</div>
          </div>
        </InlineAlert>
      </>)}
      {!approved && (
        <Card className="card pad">
          <div className="opin"><b style={{ color: 'var(--text-strong)' }}>سبب الرفض: </b>{reason}</div>
          <InlineAlert kind="warning" title="إشعار" style={{ marginTop: 12 }}>أُشعر طالب الحماية بالاعتذار عن الطلب العاجل. يبقى المسار العادي متاحاً عبر تقديم طلب وفق الإجراءات المعتادة.</InlineAlert>
        </Card>
      )}
    </div>);
  }

  return (<div>
    <button className="link" onClick={back} style={{ marginBottom: 14 }}><I name="arrow_forward" size={18} /> رجوع للطلبات العاجلة</button>

    <div className="urgent-banner">
      <div className="ub-ico"><I name="emergency" size={22} color="#fff" fill /></div>
      <div>
        <div className="ub-t">طلب حماية عاجل — خطر وشيك على الحياة</div>
        <div className="ub-d">وارد منذ <b>{fmtElapsed(u.elapsed)}</b> · رُفع مباشرةً للنائب العام (المادة الثامنة)، يتجاوز الفرز والدراسة والمجلس. القرار هنا <b>مؤقّت</b> لحين عرض الحالة على المجلس.</div>
      </div>
      <span className="ucard-ref" style={{ marginInlineStart: 'auto', alignSelf: 'center' }}>{u.ref}</span>
    </div>

    <Card className="card pad" style={{ marginBottom: 14 }}>
      <h3 className="sec-h"><I name="account_balance" size={18} color="var(--color-primary)" /> الجهة الرافعة للطلب العاجل</h3>
      <div className="grid2">
        <div className="ro-field"><span className="fac-k">الجهة</span><span className="fac-v">{u.raisedBy}</span></div>
        <div className="ro-field"><span className="fac-k">وقت الرفع</span><span className="fac-v">{fmtWhen(u.reportedAt)}</span></div>
      </div>
    </Card>

    <Card className="card pad" style={{ marginBottom: 14 }}>
      <h3 className="sec-h"><I name="person" size={18} color="var(--color-primary)" /> المعنيّ بالحماية</h3>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="pill" style={{ background: bg, color: fg }}>{u.cat}</span>
        <SecretCode code={u.secret} canReveal={false} />
      </div>
      <InlineAlert kind="info" title="حماية الهوية">بيانات المعنيّ مرمَّزة برمز سرّي (المادتان الثانية والخامسة عشرة)؛ تُكشف التفاصيل الكاملة لفريق التنفيذ في المركز عند الحاجة فقط.</InlineAlert>
    </Card>

    <Card className="card pad" style={{ marginBottom: 14 }}>
      <h3 className="sec-h"><I name="warning" size={18} color="var(--color-error)" /> طبيعة الخطر الوشيك</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><div className="fld-label">طبيعة الخطر</div><div className="opin">{u.danger || '—'}</div></div>
        <div className="grid2">
          <div><div className="fld-label">مصدر التهديد</div><div className="opin">{u.source || '—'}</div></div>
          <div><div className="fld-label">الإجراء المؤقّت المطلوب</div><div className="opin">{u.requested || '—'}</div></div>
        </div>
        <div className="ro-field"><span className="fac-k">امتداد الخطر لوثيقي الصلة</span><span className="fac-v">{u.extends}</span></div>
      </div>
    </Card>

    <Card className="card pad">
      <h3 className="sec-h"><I name="gavel" size={18} color="var(--color-primary)" /> قرار النائب العام (مؤقّت)</h3>
      <div className="fld-label">القرار</div>
      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={outcome === 'approve' ? 'on-accept' : ''} onClick={() => setOutcome('approve')}>موافقة بتدابير مؤقّتة</button>
        <button className={outcome === 'reject' ? 'on-reject' : ''} onClick={() => setOutcome('reject')}>رفض</button>
      </div>

      {outcome === 'approve' && (<>
        <div style={{ marginBottom: 18 }}>
          <div className="fld-label">التدابير المؤقّتة المقرّرة (من الـ13 — المادة الرابعة عشرة)</div>
          <div className="chips">{PROTECTION_TYPES.map((t) => <button key={t} className={'chip' + (types.includes(t) ? ' on' : '')} onClick={() => toggle(t)}>{t}</button>)}</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div className="fld-label">مدّة التدابير المؤقّتة</div>
          <div className="dur">
            <input type="number" min="1" max="30" value={days} onChange={(e) => setDays(Math.max(1, Math.min(30, +e.target.value || 0)))} />
            <span className="muted">يوماً — الحدّ الأقصى 30 يوماً، تُعرض الحالة على المجلس قبل انتهائها (المادة الثامنة).</span>
          </div>
          {!validDays && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>المدّة يجب أن تكون بين 1 و30 يوماً.</div>}
        </div>
      </>)}

      <div style={{ marginBottom: 18 }}>
        <div className="fld-label">{outcome === 'reject' ? 'سبب الرفض' : 'تسبيب القرار'}</div>
        <textarea className="ta" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={outcome === 'reject' ? 'بيّن سبب عدم توفّر عناصر الخطر الوشيك أو كفاية المسار العادي…' : 'بيّن مسوّغات الموافقة وتوفّر عناصر الخطر الوشيك والجسامة…'} />
      </div>

      {err && <InlineAlert kind="error" title="خطأ" style={{ marginBottom: 12 }}>{err}</InlineAlert>}

      {outcome === 'approve'
        ? <button className="btn btn-primary" disabled={!canApprove} onClick={() => submit(true)}><I name="verified" size={18} fill /> {busy ? 'جارٍ الحفظ…' : 'موافقة وإحالة للمركز للتنفيذ الفوري'}</button>
        : outcome === 'reject'
        ? <button className="btn btn-danger" disabled={!canReject} onClick={() => submit(false)}><I name="cancel" size={18} /> {busy ? 'جارٍ الحفظ…' : 'إصدار الرفض وإشعار الجهة'}</button>
        : <button className="btn btn-primary" disabled><I name="gavel" size={18} /> اختر القرار أولاً</button>}
    </Card>
  </div>);
}

function UrgentDashboard({ list, openCase }) {
  const pend = list.filter((u) => u.status === 'pending');
  const approved = list.filter((u) => u.status === 'approved');
  const stats = [
    { ico: 'bolt', c: 'var(--color-error)', bg: 'var(--error-10)', v: pend.length, l: 'بانتظار البتّ' },
    { ico: 'check_circle', c: 'var(--color-primary)', bg: 'var(--green-10)', v: approved.length, l: 'مبتوت (موافقة)' },
    { ico: 'forward_to_inbox', c: 'var(--color-info)', bg: 'var(--info-10)', v: approved.length, l: 'أُحيل للمركز للتنفيذ' },
  ];
  return (<div>
    <h2 className="h2">الطلبات العاجلة — البتّ المباشر</h2>
    <p className="lede">طلبات الحماية العاجلة الواردة مباشرةً للنائب العام (المادة الثامنة) — تتجاوز الفرز والدراسة والمجلس لخطورتها على الأرواح. مسؤولية غير مفوَّضة.</p>
    <div className="stats">
      {stats.map((s, i) => (<Card className="card stat" key={i}><div className="stat-ico" style={{ background: s.bg }}><I name={s.ico} size={22} color={s.c} fill /></div><div><div className="stat-v">{s.v}</div><div className="stat-l">{s.l}</div></div></Card>))}
    </div>
    {pend.length > 0 && (
      <InlineAlert kind="error" title={`${pend.length} طلب عاجل بانتظار بتّك الفوري`} style={{ marginBottom: 16 }}>هذه الطلبات تخصّ خطراً وشيكاً على الحياة. يُتّخذ فيها قرار مؤقّت عاجل لحين عرض الحالة على المجلس.</InlineAlert>
    )}
    <h3 className="sec-h"><I name="priority_high" size={18} color="var(--color-error)" /> الطلبات الواردة</h3>
    {list.length === 0
      ? <Card className="card pad"><p className="lede" style={{ textAlign: 'center', padding: 24 }}>لا طلبات عاجلة واردة بعد.</p></Card>
      : <Queue list={list} openCase={openCase} />}
  </div>);
}

export function AG_UrgentPath() {
  const list = useUrgent();
  const [sel, setSel] = useState(null);
  const selU = list.find((u) => u.ref === sel) || null;
  return (
    <div className="ag-urgent">
      {selU
        ? <UrgentDetail u={selU} back={() => setSel(null)} />
        : <UrgentDashboard list={list} openCase={(u) => setSel(u.ref)} />}
    </div>
  );
}
