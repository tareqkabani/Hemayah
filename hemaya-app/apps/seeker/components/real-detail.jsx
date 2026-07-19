'use client';
/* ============================================================
   تفصيل طلبٍ حقيقيّ — موصولٌ بـ Supabase (RPC seeker_case_view + sign_agreement
   + إدراج grievances). يحلّ محلّ شاشات القرار/التوقيع/التظلّم الـmock للطلبات الحيّة.
   ============================================================ */
import React, { useEffect, useState, useRef } from 'react';
import { Card, Tag, InlineAlert, SecretCode } from '@hemaya/ui';
import { createClient } from '@hemaya/supabase/src/browser';

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

const CAT = { witness: 'شاهد', reporter: 'مبلّغ', expert: 'خبير', victim: 'ضحية', related: 'ذو صلة' };
const STAGES = [
  { t: 'تمّ استلام الطلب', d: 'سُجِّل الطلب وأُسند الرمز السري.' },
  { t: 'الفرز المبدئي', d: 'يتواصل المركز للتحقّق ويطلب الاستيفاء عند الحاجة.' },
  { t: 'الإحالة إلى الجهة المختصة', d: 'لرفع التوصية خلال 5 أيام عمل.' },
  { t: 'الدراسة والتقييم', d: 'تُدرس عوامل المادة (9) ويُصنَّف الخطر.' },
  { t: 'قرار إدارة البرنامج', d: 'يصدر بالأغلبية ويُشعَر خلال 3 أيام.' },
  { t: 'تفعيل الحماية', d: 'توقيع وثيقة الحماية والدخول في دورة المتابعة.' },
];
// عدد المراحل المكتملة حسب الحالة الحقيقيّة
const DONE = {
  submitted: 1, triage: 1, referred: 2, under_study: 3, classified: 4,
  in_decision: 4, accepted: 5, rejected: 5, signed: 6, active: 6,
  under_review: 6, terminating: 6, closed: 5,
};

const OBLIGATIONS = [
  'الالتزام بإجراءات أنواع الحماية المقرّرة وتعليمات الإدارة الأمنية.',
  'تقديم المعلومات والأدلة الصحيحة لجهة التحقيق أو المحاكمة عند الطلب.',
  'التعاون التامّ مع الإدارة الأمنية المختصة بتنفيذ الحماية.',
  'الامتناع عن أي نشاط يعرّض الحماية أو سريّتها للخطر.',
  'إبلاغ المركز فوراً بأي تغيّر في الظروف أو محل الإقامة أو وسائل التواصل.',
];
const GRV_STATUS = {
  filed: { t: 'تظلّم قيد النظر', tone: 'warning', icon: 'schedule' },
  tech_review: { t: 'قيد دراسة المكتب الفني', tone: 'warning', icon: 'gavel' },
  pg_decision: { t: 'قيد اعتماد النائب العام', tone: 'warning', icon: 'gavel' },
  upheld: { t: 'قُبِل التظلّم', tone: 'success', icon: 'check_circle' },
  dismissed: { t: 'رُفِض التظلّم — نهائي', tone: 'error', icon: 'block' },
};

function Timeline({ status }) {
  const done = DONE[status] ?? 1;
  return (
    <div className="tl">
      {STAGES.map((s, i) => {
        const isDone = i < done, active = i === done && status !== 'active' && status !== 'signed';
        return (
          <div className="tl-step" key={i}>
            <div className="tl-rail">
              <div className="tl-dot" style={{ background: isDone ? 'var(--green-10)' : active ? 'var(--color-primary)' : 'var(--surface-subtle)', color: active ? '#fff' : isDone ? 'var(--color-primary)' : 'var(--text-disabled)', border: active ? 'none' : '2px solid ' + (isDone ? 'var(--color-primary)' : 'var(--border-default)') }}>
                {isDone ? <I name="check" size={15} /> : i + 1}
              </div>
              {i < STAGES.length - 1 && <div className={'tl-line' + (isDone ? ' done' : '')} />}
            </div>
            <div className="tl-body">
              <div className="tl-t" style={{ color: active ? 'var(--color-primary)' : isDone ? 'var(--text-strong)' : 'var(--text-secondary)' }}>{s.t}</div>
              <div className="tl-d">{s.d}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// نافذة توقيع نفاذ (المطابقة محاكاة؛ الترسيخ الحقيقيّ عبر sign_agreement عند التأكيد)
function NafathSign({ onConfirm, onClose, busy }) {
  return (
    <div className="nf-scrim" onClick={onClose}>
      <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <I name="verified_user" size={22} color="var(--color-primary)" fill />
          <b style={{ fontSize: 16, color: 'var(--text-strong)' }}>التوقيع عبر نفاذ</b>
        </div>
        <p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>افتح تطبيق نفاذ واعتمد توقيعك على اتفاقية الحماية.</p>
        <div className="nf-num">47</div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={onConfirm}>
          <I name="check" size={18} /> {busy ? 'جارٍ الاعتماد…' : 'لقد اعتمدتُ التوقيع في نفاذ'}
        </button>
        <button className="linkbtn" style={{ marginTop: 12 }} onClick={onClose} disabled={busy}>إلغاء</button>
      </div>
    </div>
  );
}

export function RealRequestDetail({ request, back, go }) {
  const supabase = useRef(createClient()).current;
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('detail');   // detail | agreement | grievance
  const [nafath, setNafath] = useState(false);
  const [obl, setObl] = useState([]);
  const [ackTypes, setAckTypes] = useState(false);
  const [ackConf, setAckConf] = useState(false);
  const [gScope, setGScope] = useState('');
  const [gReason, setGReason] = useState('');

  const load = () => {
    setErr('');
    return supabase.rpc('seeker_case_view', { _ref: request.ref_no }).then(({ data, error }) => {
      if (error) setErr('تعذّر جلب تفاصيل الطلب: ' + error.message);
      else setView(data);
      setLoading(false);
    });
  };
  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ }, [request.ref_no]);

  if (loading) return <div className="card pad"><p className="muted" style={{ textAlign: 'center', padding: 20 }}><I name="progress_activity" size={22} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ التحميل…</p></div>;
  if (err) return <InlineAlert kind="error" title="خطأ">{err}</InlineAlert>;

  const c = (view && view.case) || {};
  const dec = view && view.decision;               // null قبل الإصدار
  const grv = view && view.grievance;              // null إن لا تظلّم
  const status = c.status || request.status;
  const isAccept = dec && dec.issued_type === 'accept';
  const isReject = dec && dec.issued_type === 'reject';
  const signed = status === 'signed' || status === 'active';
  const types = (dec && Array.isArray(dec.types)) ? dec.types : [];

  const back2detail = () => { setMode('detail'); load(); };

  const doSign = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('seeker_sign_agreement', { _case_id: request.id });
    setBusy(false); setNafath(false);
    if (error) { setErr('تعذّر التوقيع: ' + error.message); return; }
    setMode('detail'); await load();
  };
  const doFileGrievance = async () => {
    setBusy(true); setErr('');
    const against = [gScope, gReason].filter((s) => s && s.trim()).join(' — ');
    const due = new Date(Date.now() + 10 * 86400000).toISOString();
    // scope/applicant_reason حقلان بنيويّان لدورة المكتب الفني (م21) — لا استنتاج نصّي
    const scope = isReject ? 'reject' : 'types';
    const { error } = await supabase.from('grievances').insert({ case_id: request.id, against, scope, applicant_reason: gReason.trim() || null, status: 'filed', filed_at: new Date().toISOString(), decision_due: due });
    setBusy(false);
    if (error) { setErr('تعذّر رفع التظلّم: ' + error.message); return; }
    setMode('detail'); await load();
  };

  // ===== شاشة الاتفاقية (توقيع حقيقيّ) =====
  if (mode === 'agreement' && isAccept) {
    const ready = obl.length === OBLIGATIONS.length && ackTypes && ackConf;
    return (
      <div>
        <button className="linkbtn" onClick={back2detail} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة للطلب</button>
        <h2 className="h-sec" style={{ fontSize: 21, marginBottom: 6 }}>اتفاقية الحماية</h2>
        <InlineAlert kind="warning" title="سرية للغاية" style={{ marginBottom: 16 }}>محتوى الاتفاقية سرّي (م15، م16) ومخصّص لك وحدك. يُحظر نسخه أو إفشاؤه، ونسختك موسومة برمزك السري.</InlineAlert>
        <Card className="card pad" style={{ marginBottom: 16 }}>
          <div className="agr-h">اتفاقية توفير الحماية — إدارة برنامج الحماية</div>
          <div className="row" style={{ gap: 18, marginTop: 10, marginBottom: 12 }}>
            <span className="muted">الرمز السري: <b className="mono" style={{ color: 'var(--text-strong)' }}>{c.secret_code}</b></span>
            {dec.duration && <span className="muted">المدّة: <b style={{ color: 'var(--text-strong)' }}>{dec.duration}</b></span>}
          </div>
          <div className="ci-label" style={{ marginBottom: 8 }}>أنواع الحماية المقرّرة (م14)</div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>{types.map((t) => <span className="chip-type" key={t}><I name="shield" size={13} fill color="var(--color-primary)" />{t}</span>)}</div>
        </Card>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div className="ci-label">إقرار الالتزامات (م11)</div>
          {OBLIGATIONS.map((o, i) => (
            <button key={i} className={'ack' + (obl.includes(i) ? ' on' : '')} onClick={() => setObl((a) => a.includes(i) ? a.filter((x) => x !== i) : [...a, i])}>
              <I name={obl.includes(i) ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={obl.includes(i)} color={obl.includes(i) ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />{o}
            </button>
          ))}
          <button className={'ack' + (ackTypes ? ' on' : '')} onClick={() => setAckTypes(!ackTypes)}>
            <I name={ackTypes ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={ackTypes} color={ackTypes ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />أقرّ باطّلاعي على أنواع الحماية المقرّرة وموافقتي عليها.
          </button>
          <button className={'ack' + (ackConf ? ' on' : '')} onClick={() => setAckConf(!ackConf)}>
            <I name={ackConf ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={ackConf} color={ackConf ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />أتعهّد بالحفاظ على سرية الاتفاقية وأقرّ بمسؤوليتي النظامية.
          </button>
        </div>
        {err && <InlineAlert kind="error" title="خطأ" style={{ marginBottom: 12 }}>{err}</InlineAlert>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ready} onClick={() => setNafath(true)}>
          <I name="draw" size={18} /> {ready ? 'التوقيع عبر نفاذ وتفعيل الحماية' : 'أكمِل الإقرارات للتوقيع'}
        </button>
        {nafath && <NafathSign onConfirm={doSign} onClose={() => setNafath(false)} busy={busy} />}
      </div>
    );
  }

  // ===== شاشة رفع التظلّم (إدراج حقيقيّ) =====
  if (mode === 'grievance') {
    const scopes = isReject
      ? ['الاعتراض على رفض الطلب', 'سبب آخر']
      : ['أنواع الحماية غير كافية', 'مدة الحماية المقرّرة', 'سبب آخر'];
    return (
      <div>
        <button className="linkbtn" onClick={back2detail} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة للطلب</button>
        <h2 className="h-sec" style={{ fontSize: 21, marginBottom: 6 }}>التظلّم أمام النائب العام</h2>
        <InlineAlert kind="info" title="مسار التظلّم النظامي" style={{ marginBottom: 16 }}>يُرفع خلال (10) أيام من العلم بالقرار، ويُبتّ فيه خلال (10) أيام عبر المكتب الفني، وقراره نهائي. (م10/2، م21)</InlineAlert>
        <Card className="card pad">
          <div className="ci-label" style={{ marginBottom: 8 }}>محل الاعتراض</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {scopes.map((s) => (
              <button key={s} className={'ack' + (gScope === s ? ' on' : '')} onClick={() => setGScope(s)}>
                <I name={gScope === s ? 'radio_button_checked' : 'radio_button_unchecked'} size={20} fill={gScope === s} color={gScope === s ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />{s}
              </button>
            ))}
          </div>
          <div className="ci-label" style={{ marginBottom: 8 }}>سبب التظلّم</div>
          <textarea className="ci-text" value={gReason} onChange={(e) => setGReason(e.target.value)} placeholder="اشرح سبب اعتراضك…" dir="auto" rows={4} style={{ marginBottom: 16 }} />
          {err && <InlineAlert kind="error" title="خطأ" style={{ marginBottom: 12 }}>{err}</InlineAlert>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={!gReason.trim() || busy} onClick={doFileGrievance}>
            <I name="gavel" size={18} /> {busy ? 'جارٍ الرفع…' : 'رفع التظلّم أمام النائب العام'}
          </button>
        </Card>
      </div>
    );
  }

  // ===== شاشة التفصيل الرئيسية =====
  return (
    <div>
      <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى طلباتي</button>
      <h2 className="h-sec" style={{ fontSize: 21, marginBottom: 4 }}>تفاصيل الطلب</h2>
      <p className="lede">مرجع {c.ref_no} · {CAT[c.category] || c.category} · رمز سري {c.secret_code}</p>

      {/* حالة الحماية النشطة */}
      {signed && (
        <Card className="card pad" style={{ marginBottom: 16, background: 'var(--success-10)', borderColor: 'var(--success-50)' }}>
          <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="verified_user" size={22} fill color="var(--color-success)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>حمايتك مفعّلة</b></div>
          <p className="muted" style={{ margin: 0 }}>وُقّعت اتفاقية الحماية عبر نفاذ. أنت الآن مشمول ببرنامج الحماية ودخلت دورة المتابعة الدورية.</p>
        </Card>
      )}

      {/* قرار القبول → توقيع */}
      {isAccept && !signed && !grv && (
        <Card className="card pad" style={{ marginBottom: 16, background: 'var(--success-10)', borderColor: 'var(--success-50)' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="row" style={{ gap: 9 }}><I name="verified" size={22} fill color="var(--color-success)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>صدر قرار قبول طلبك</b></div>
            <Tag tone="success" size="sm">قرار صادر</Tag>
          </div>
          <p className="muted" style={{ margin: '0 0 12px' }}>وافقت إدارة البرنامج على توفير الحماية لك. راجِع الاتفاقية ووقّعها عبر نفاذ لتفعيلها — أو اعترِض على الأنواع برفع تظلّم.</p>
          <div className="row" style={{ gap: 8, marginBottom: 14 }}>{types.map((t) => <span className="chip-type" key={t}><I name="shield" size={13} fill color="var(--color-primary)" />{t}</span>)}</div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMode('agreement')}><I name="draw" size={18} /> مراجعة وتوقيع اتفاقية الحماية</button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setMode('grievance')}><I name="gavel" size={18} /> الاعتراض على الأنواع ورفع تظلّم</button>
        </Card>
      )}

      {/* قرار الرفض → تظلّم */}
      {isReject && !grv && (
        <Card className="card pad" style={{ marginBottom: 16, background: 'var(--error-10)', borderColor: 'var(--error-50)' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="row" style={{ gap: 9 }}><I name="cancel" size={22} fill color="var(--color-error)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>صدر قرار برفض طلبك</b></div>
            <Tag tone="error" size="sm">قرار صادر</Tag>
          </div>
          <p className="muted" style={{ margin: '0 0 12px' }}>قرّرت إدارة البرنامج عدم قبول طلبك. لك التظلّم أمام النائب العام خلال (10) أيام من تاريخ العلم.</p>
          {dec.issued_reason && <div className="rr-item" style={{ marginBottom: 12 }}><I name="remove" size={16} color="var(--color-error)" style={{ flexShrink: 0, marginTop: 2 }} /><span>{dec.issued_reason}</span></div>}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMode('grievance')}><I name="gavel" size={18} /> التظلّم على القرار أمام النائب العام</button>
        </Card>
      )}

      {/* حالة التظلّم (إن وُجد) */}
      {grv && (() => {
        const gs = GRV_STATUS[grv.status] || { t: grv.status, tone: 'neutral', icon: 'gavel' };
        const bg = gs.tone === 'success' ? 'var(--success-10)' : gs.tone === 'error' ? 'var(--error-10)' : 'var(--warning-10)';
        const bd = gs.tone === 'success' ? 'var(--success-50)' : gs.tone === 'error' ? 'var(--error-50)' : 'var(--warning-50)';
        const col = 'var(--color-' + (gs.tone === 'neutral' ? 'warning' : gs.tone) + ')';
        return (
          <Card className="card pad" style={{ marginBottom: 16, background: bg, borderColor: bd }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="gavel" size={22} fill color={col} /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>{gs.t}</b></div>
              <Tag tone={gs.tone === 'neutral' ? 'warning' : gs.tone} size="sm" iconLeft={<I name={gs.icon} size={13} />}>{grv.status === 'upheld' || grv.status === 'dismissed' ? 'قرار نهائي' : 'قيد البتّ'}</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 6px' }}>محل الاعتراض: {grv.against}</p>
            {grv.tech_opinion && <p className="muted" style={{ margin: '6px 0 0' }}>رأي المكتب الفني: {grv.tech_opinion}</p>}
            {grv.status === 'upheld' && <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => setMode('agreement')}><I name="draw" size={18} /> مراجعة وتوقيع اتفاقية الحماية</button>}
          </Card>
        );
      })()}

      {/* بلا قرار بعد */}
      {!dec && !grv && !signed && (
        <InlineAlert kind="info" title="طلبك قيد المعالجة" style={{ marginBottom: 16 }}>يتابع المركز طلبك في مرحلته الحاليّة. ستصلك إشعارات بأي مستجدّ، ويظهر القرار هنا فور صدوره.</InlineAlert>
      )}

      {/* الخط الزمنيّ الحقيقيّ */}
      <Card className="card pad">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="row"><SecretCode code={c.secret_code} canReveal={false} /><Tag tone="info" size="sm" iconLeft={<I name="badge" size={13} />}>{CAT[c.category] || c.category}</Tag></div>
        </div>
        <Timeline status={status} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={() => go && go('messages')}><I name="forum" size={18} /> مراسلة المركز</button>
        </div>
      </Card>
    </div>
  );
}
