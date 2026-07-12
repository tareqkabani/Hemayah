'use client';
/* ============================================================
   بوابة طالب الحماية — تطبيق كامل منقول من «البوابة.html».
   محوّل آلياً: ربط window → استيراد ES، والملف الشخصي/تقديم الطلب
   يُستبدلان بالنسختين التفصيليّتين. لوحة التجارب (Tweaks) مُبطَّلة.
   ============================================================ */
import React, { useState, useContext, useRef, useEffect } from 'react';
import { Card, Tag, InlineAlert } from '@hemaya/ui';
import { SecretCode, DeadlineTimer } from '@hemaya/ui';
import { createClient } from '@hemaya/supabase/src/browser';
import { IdentityContext, RequestsContext, maskId } from './identity-context';
import { Profile as ProfileDetailed, NewRequest as NewRequestDetailed, RealRequests, STATUS_AR, CATEGORY_AR } from './screens-detailed';
import { Messages as MessagesDetailed, Notifications as NotificationsDetailed, RealtimeRefresh } from './realtime-screens';

// لوحة التجارب في البروتوتايب مُبطَّلة (القيم الافتراضية تبقى فاعلة).
const useTweaks = (d) => [d, () => {}];
const TweaksPanel = ({ children }) => null;
const TweakSection = () => null;
const TweakSelect = () => null;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "prosecutorRuling": "pending"
}/*EDITMODE-END*/;

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// ===== بيانات تجريبية (حالة واحدة نشطة) =====
const CASE = { ref: 'REF-2026-4821', secret: 'C-2026-0481', category: 'شاهد' };
const STAGES = [
  { t: 'تمّ استلام الطلب', d: 'سُجِّل الطلب وأُسند الرمز السري.' },
  { t: 'الفرز المبدئي', d: 'يتواصل المركز للتحقّق ويطلب الاستيفاء عند الحاجة.' },
  { t: 'الإحالة إلى الجهة المختصة', d: 'لرفع التوصية خلال 5 أيام عمل.' },
  { t: 'الدراسة والتقييم', d: 'تُدرس عوامل المادة (9) ويُصنَّف الخطر.' },
  { t: 'قرار إدارة البرنامج', d: 'يصدر بالأغلبية ويُشعَر خلال 3 أيام.' },
  { t: 'تفعيل الحماية', d: 'عند صدور قرار المركز بالشمول: توقيع وثيقة الحماية ودخول دورة الحياة.' },
];
// بنود الاستيفاء — ظرفية يبنيها موظف الفرز لهذه الحالة بعينها
const COMPLETION_ITEMS = [
  { id: 'med', label: 'تقرير طبي حديث', type: 'file', note: 'لتأكيد الحالة الصحية الواردة في الطلب.' },
  { id: 'threat', label: 'توضيح مصدر التهديد ووسائله', type: 'text', note: 'يخدم عامل «طبيعة الخطر» في دراسة الطلب (م9).' },
  { id: 'depId', label: 'هوية أحد التابعين', type: 'file', note: 'لإكمال بيانات التابعين المشمولين بالحماية.' },
];
// قرار القبول + أنواع الحماية المقرّرة (المادة 14) — يصدر من إدارة البرنامج
const DECISION = {
  outcome: 'accept',
  ref: 'DEC-2026-0731', date: '8 مايو 2026',
  types: ['الحماية الأمنية', 'إخفاء البيانات الشخصية وما يدل على الهوية', 'وسائل الإبلاغ عن الخطر (تواصل طارئ 24/7)', 'مرافقة أمنية عند التنقّل'],
  duration: '12 شهراً، قابلة للتمديد بعد إعادة التقييم الدوري',
};
// قرار الرفض — يحقّ لطالب الحماية التظلّم عليه أمام النائب العام (م10، م21)
const DECISION_REJECT = {
  outcome: 'reject',
  ref: 'DEC-2026-0732', date: '8 مايو 2026',
  reasons: [
    'عدم ثبوت وجود قضية جزائية قائمة مرتبطة بطلب الحماية.',
    'عدم كفاية القرائن على وجود خطر حقيقي ومحدق يستوجب تدابير الحماية.',
  ],
};
// قرار البتّ في التظلّم — يصدره المكتب الفني (بتفويض من النائب العام) ويعتمده رئيس المكتب الفني، ثم يُبلَّغ المركز
const GRIEVANCE_GRANT = {
  by: 'المكتب الفني — معتمَد من رئيس المكتب الفني',
  ref: 'GRV-DEC-2026-0192', date: '13 مايو 2026',
  // أنواع الحماية التي اختارها المكتب الفني عند قبول التظلّم (المادة 14) — يفعّلها المركز
  types: ['الحماية الأمنية', 'إخفاء البيانات الشخصية وما يدل على الهوية', 'وسائل الإبلاغ عن الخطر (تواصل طارئ 24/7)', 'تغيير محل الإقامة'],
};
// التزامات المشمول بالحماية (المادة 11)
const OBLIGATIONS = [
  'الالتزام بإجراءات أنواع الحماية المقرّرة وتعليمات الإدارة الأمنية.',
  'تقديم المعلومات والأدلة الصحيحة لجهة التحقيق أو المحاكمة عند الطلب.',
  'التعاون التامّ مع الإدارة الأمنية المختصة بتنفيذ الحماية.',
  'الامتناع عن أي نشاط يعرّض الحماية أو سريّتها للخطر.',
  'إبلاغ المركز فوراً بأي تغيّر في الظروف أو محل الإقامة أو وسائل التواصل.',
];
// دورة حياة الحماية بعد التفعيل — يقرّرها المركز بناءً على تقارير الإدارات الأمنية
const LIFECYCLE_NEXT = '8 نوفمبر 2026';
const LIFECYCLE = [
  { t: 'المتابعة', icon: 'monitoring' },
  { t: 'التعديل', icon: 'tune' },
  { t: 'الاستمرار', icon: 'autorenew' },
  { t: 'إنهاء الانضمام', icon: 'lock' },
];

function Screen({ icon, title, lede, children }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <h2 className="h-sec" style={{ fontSize: 21 }}>{title}</h2>
      </div>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </div>
  );
}

// ===== بند استيفاء واحد (إرفاق أو نصّ) =====
function CompletionItem({ item, onFulfill }) {
  const [text, setText] = useState('');
  const fileRef = React.useRef(null);
  if (item.done) {
    return (
      <div className="ci">
        <div className="ci-head">
          <I name="check_circle" size={20} fill color="var(--color-success)" style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div className="ci-label">{item.label}</div>
            <div className="ci-val">{item.type === 'file'
              ? <span className="row" style={{ gap: 6 }}><I name="description" size={15} color="var(--text-secondary)" />{item.value}</span>
              : item.value}</div>
          </div>
          <button className="linkbtn" onClick={() => onFulfill(item.id, null)}>تغيير</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ci">
      <div className="ci-head">
        <span className="ci-box" />
        <div style={{ flex: 1 }}>
          <div className="ci-label">{item.label}<span className="ci-type">{item.type === 'file' ? 'مرفق' : 'نصّ'}</span></div>
          <div className="ci-note">{item.note}</div>
        </div>
      </div>
      {item.type === 'file' ? (
        <div className="ci-action">
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onFulfill(item.id, f.name); }} />
          <button className="btn btn-ghost sm" onClick={() => fileRef.current.click()}><I name="attach_file" size={16} /> إرفاق ملف</button>
        </div>
      ) : (
        <div className="ci-action col">
          <textarea className="ci-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب التوضيح المطلوب…" dir="auto" rows={3} />
          <button className="btn btn-primary sm" disabled={!text.trim()} onClick={() => onFulfill(item.id, text.trim())}><I name="check" size={16} /> حفظ</button>
        </div>
      )}
    </div>
  );
}

// ===== طلباتي — قائمة الطلبات ثم التفاصيل =====
const REQUESTS = [
  { id: 'r1', ref: 'REF-2026-4821', secret: 'C-2026-0481', category: 'شاهد', outcome: 'accept', decision: DECISION },
  { id: 'r2', ref: 'REF-2025-3097', secret: 'C-2025-0212', category: 'مُبلّغ', outcome: 'reject', decision: DECISION_REJECT },
];
const TONE_RGB = { success: 'var(--color-success)', error: 'var(--color-error)', warning: 'var(--color-warning)', info: 'var(--color-info)', neutral: 'var(--text-secondary)' };
function statusOf(req, st, ruling) {
  if (st.signed) return { label: 'الحماية نشطة', tone: 'success', icon: 'verified' };
  if (st.grievance.status === 'filed') {
    if (ruling === 'accept') return { label: 'قُبِل التظلّم', tone: 'success', icon: 'gavel' };
    if (ruling === 'reject') return { label: 'رُفِض التظلّم — نهائي', tone: 'error', icon: 'gavel' };
    return { label: 'تظلّم قيد النظر', tone: 'warning', icon: 'gavel' };
  }
  if (st.closed) return { label: 'مغلق', tone: 'neutral', icon: 'lock' };
  if (req.outcome === 'reject') return { label: 'مرفوض', tone: 'error', icon: 'cancel' };
  return { label: 'بانتظار توقيعك', tone: 'warning', icon: 'draw' };
}

function RequestsList({ requests, states, ruling, open }) {
  return (
    <Screen title="طلباتي" lede="جميع طلباتك ومآلاتها. اختر طلباً لعرض تفاصيله واتّخاذ الإجراء المتاح.">
      <div style={{ display: 'grid', gap: 12 }}>
        {requests.map((req) => {
          const st = states[req.id];
          const s = statusOf(req, st, ruling);
          const needs = !st.signed && !st.closed && !(st.grievance.status === 'filed' && ruling === 'reject');
          return (
            <button key={req.id} className="req-card" onClick={() => open(req.id)}>
              <span className="req-ic" style={{ background: 'color-mix(in srgb, ' + TONE_RGB[s.tone] + ' 12%, transparent)', color: TONE_RGB[s.tone] }}><I name={s.icon} size={22} fill /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <b style={{ fontSize: 15, color: 'var(--text-strong)' }}>طلب حماية</b>
                  <Tag tone={s.tone === 'neutral' ? 'info' : s.tone} size="sm">{s.label}</Tag>
                </span>
                <span className="muted" style={{ display: 'block' }}>مرجع <span className="mono">{req.ref}</span> · {req.category} · قرار {req.decision.date}</span>
              </span>
              {needs && <span className="req-dot" />}
              <I name="chevron_left" size={22} color="var(--text-disabled)" />
            </button>
          );
        })}
      </div>
      <InlineAlert kind="info" title="طلب واحد نشط" style={{ marginTop: 16 }}>يُسمح بطلب واحد نشط في كل مرة؛ والطلبات السابقة تبقى في سجلّك للاطّلاع. الاعتراض على أي قرار يكون بالتظلّم لا بطلب جديد.</InlineAlert>
    </Screen>
  );
}

// مسار التظلّم المصغّر (رُفِع → بتّ النائب العام → النتيجة)
function GrievanceTrack({ ruling }) {
  const ruled = ruling !== 'pending';
  const steps = [
    { t: 'رُفِع التظلّم', d: 'أمام النائب العام، يبتّ فيه المكتب الفني المختصّ (مستقلّ عن المركز).', done: true },
    { t: 'البتّ والاعتماد', d: 'يبتّ المكتب الفني خلال (10) أيام، ويعتمده رئيس المكتب الفني.', done: ruled },
    { t: ruling === 'accept' ? 'قُبِل التظلّم' : ruling === 'reject' ? 'رُفِض التظلّم' : 'صدور القرار', d: ruling === 'accept' ? 'يُبلَّغ المركز ويُفعّل الحماية بالأنواع المقرّرة من المكتب.' : ruling === 'reject' ? 'قرار نهائي معتمَد — يُبلَّغ المركز ويُغلق الطلب آلياً.' : 'قرار نهائي غير قابل للطعن.', done: ruled },
  ];
  return (
    <div className="tl" style={{ marginTop: 4 }}>
      {steps.map((s, i) => {
        const tone = s.done && i === 2 && ruling === 'reject' ? 'var(--color-error)' : 'var(--color-primary)';
        return (
          <div className="tl-step" key={i}>
            <div className="tl-rail">
              <div className="tl-dot" style={{ background: s.done ? 'color-mix(in srgb, ' + tone + ' 12%, transparent)' : 'var(--surface-subtle)', color: s.done ? tone : 'var(--text-disabled)', border: '2px solid ' + (s.done ? tone : 'var(--border-default)') }}>{s.done ? <I name={i === 2 && ruling === 'reject' ? 'close' : 'check'} size={14} /> : i + 1}</div>
              {i < steps.length - 1 && <div className="tl-line" style={{ background: s.done ? tone : 'var(--border-default)' }} />}
            </div>
            <div className="tl-body"><div className="tl-t">{s.t}</div><div className="tl-d">{s.d}</div></div>
          </div>
        );
      })}
    </div>
  );
}

function RequestDetail({ req, st, ruling, go, toAgreement, toGrievance, onClose, back }) {
  const dec = req.decision;
  const g = st.grievance;
  const filed = g.status === 'filed';
  const grantedTypes = GRIEVANCE_GRANT.types; // عند قبول التظلّم: شمول بالأنواع التي اختارها المكتب الفني
  const stage = st.signed ? STAGES.length : (req.outcome === 'reject' && !(filed && ruling === 'accept')) ? 4 : 5;
  return (
    <div>
      <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى طلباتي</button>
      <Screen title="تفاصيل الطلب" lede={'مرجع ' + req.ref + ' · ' + req.category + ' · رمز سري ' + req.secret}>

        {st.signed && (
          <Card className="card pad" style={{ marginBottom: 16, background: 'var(--success-10)', borderColor: 'var(--success-50)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="verified_user" size={22} fill color="var(--color-success)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>حمايتك مفعّلة</b></div>
              <Tag tone="success" size="sm" iconLeft={<I name="lock_clock" size={13} />}>سارية</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 12px' }}>وُقّعت اتفاقية الحماية عبر نفاذ. أنت الآن مشمول ببرنامج الحماية، ودخلت دورة المتابعة وإعادة التقييم الدوري.</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" onClick={toAgreement}><I name="description" size={17} /> عرض الاتفاقية الموقّعة</button>
              <button className="btn btn-ghost" onClick={() => go('messages')}><I name="forum" size={17} /> مراسلة المركز</button>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>دورة حياة الحماية</b>
                <Tag tone="info" size="sm" iconLeft={<I name="event_repeat" size={13} />}>المراجعة القادمة: {LIFECYCLE_NEXT}</Tag>
              </div>
              <div className="lc">
                {LIFECYCLE.map((l, i) => (
                  <span className={'lc-chip' + (i === 0 ? ' on' : '')} key={l.t}><I name={l.icon} size={13} fill={i === 0} color={i === 0 ? 'var(--color-primary)' : 'var(--text-secondary)'} />{l.t}{i === 0 ? ' (الحالية)' : ''}</span>
                ))}
              </div>
            </div>
          </Card>
        )}

        {filed && ruling === 'pending' && !st.signed && (
          <Card className="card pad" style={{ marginBottom: 16, background: 'var(--warning-10)', borderColor: 'var(--warning-50)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="gavel" size={22} fill color="var(--color-warning)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>تظلّمك قيد النظر أمام النائب العام</b></div>
              <Tag tone="warning" size="sm" iconLeft={<I name="schedule" size={13} />}>قيد البتّ</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 12px' }}>قُدّم تظلّمك (رقم <span className="mono">{g.ref}</span>) بتاريخ {g.date}، ويُنظر أمام النائب العام عبر <b>المكتب الفني المختصّ</b>. يُبتّ فيه خلال (10) أيام، ويصدر معتمَداً من رئيس المكتب الفني، ثم يُبلَّغ المركز.</p>
            <div style={{ marginBottom: 12 }}><DeadlineTimer label="مهلة البتّ في التظلّم" totalDays={10} daysElapsed={1} articleRef="م21" /></div>
            <GrievanceTrack ruling={ruling} />
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={toGrievance}><I name="gavel" size={17} /> عرض تفاصيل التظلّم</button>
          </Card>
        )}

        {filed && ruling === 'accept' && !st.signed && (
          <Card className="card pad" style={{ marginBottom: 16, background: 'var(--success-10)', borderColor: 'var(--success-50)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="gavel" size={22} fill color="var(--color-success)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>قُبِل تظلّمك — صدر قرار البتّ</b></div>
              <Tag tone="success" size="sm" iconLeft={<I name="event_available" size={13} />}>قرار نهائي</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 12px' }}>أصدر <b>المكتب الفني</b> قراره بقبول تظلّمك (رقم <span className="mono">{GRIEVANCE_GRANT.ref}</span>)، <b>معتمَداً من رئيس المكتب الفني</b>، وأُبلِغ مركز الحماية ليُفعّل شمولك ببرنامج الحماية مباشرةً دون العودة للدراسة والتقييم (م10). راجِع اتفاقية الحماية ووقّعها عبر نفاذ لتفعيل حمايتك.</p>
            <div className="ci-label" style={{ marginBottom: 8 }}>أنواع الحماية التي قرّرها المكتب الفني</div>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              {grantedTypes.map((tp) => <span className="chip-type" key={tp}><I name="shield" size={13} fill color="var(--color-primary)" />{tp}</span>)}
            </div>
            <div style={{ marginBottom: 14 }}><GrievanceTrack ruling={ruling} /></div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={toAgreement}><I name="draw" size={18} /> مراجعة وتوقيع اتفاقية الحماية</button>
          </Card>
        )}

        {filed && ruling === 'reject' && (
          <Card className="card pad" style={{ marginBottom: 16, background: 'var(--error-10)', borderColor: 'var(--error-50)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="gavel" size={22} fill color="var(--color-error)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>رُفِض تظلّمك — قرار نهائي قاطع</b></div>
              <Tag tone="error" size="sm" iconLeft={<I name="block" size={13} />}>نهائي قطعي</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 12px' }}>أصدر <b>المكتب الفني</b> قراره برفض تظلّمك (رقم <span className="mono">{g.ref}</span>)، <b>معتمَداً من رئيس المكتب الفني</b>، وهو نهائي غير قابل للطعن أمام أي جهة قضائية (م21). أُبلِغ مركز الحماية، و<b>أُغلق هذا الطلب آلياً</b>.</p>
            <div style={{ marginBottom: 8 }}><GrievanceTrack ruling={ruling} /></div>
            <InlineAlert kind="info" title="مستجدّات جديدة">إن استجدّت ظروف أو أدلّة جديدة، يمكنك التقدّم بطلب حماية جديد عبر «تقديم طلب جديد».</InlineAlert>
          </Card>
        )}

        {!filed && !st.closed && !st.signed && req.outcome === 'reject' && (
          <Card className="card pad" style={{ marginBottom: 16, background: 'var(--error-10)', borderColor: 'var(--error-50)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="cancel" size={22} fill color="var(--color-error)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>صدر قرار برفض طلبك</b></div>
              <Tag tone="error" size="sm" iconLeft={<I name="event" size={13} />}>{dec.date}</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 12px' }}>اطّلعت إدارة برنامج الحماية على طلبك وقرّرت عدم قبوله (قرار رقم <span className="mono">{dec.ref}</span>). لك أن تقبل القرار، أو تتظلّم عليه أمام النائب العام خلال (10) أيام من تاريخ العلم به.</p>
            <div style={{ marginBottom: 14 }}>
              <div className="ci-label" style={{ marginBottom: 8 }}>أسباب الرفض</div>
              {dec.reasons.map((r, i) => (
                <div className="rr-item" key={i}><I name="remove" size={16} color="var(--color-error)" style={{ flexShrink: 0, marginTop: 2 }} /><span>{r}</span></div>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}><DeadlineTimer label="مهلة التظلّم على القرار" totalDays={10} daysElapsed={1} articleRef="م21" /></div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={toGrievance}><I name="gavel" size={18} /> التظلّم على القرار أمام النائب العام</button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onClose}><I name="check" size={18} /> قبول القرار وإغلاق الطلب</button>
          </Card>
        )}

        {!filed && !st.closed && !st.signed && req.outcome === 'accept' && (
          <Card className="card pad decision-card" style={{ marginBottom: 16, background: 'var(--success-10)', borderColor: 'var(--success-50)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 9 }}><I name="verified" size={22} fill color="var(--color-success)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>صدر قرار قبول طلبك</b></div>
              <Tag tone="success" size="sm" iconLeft={<I name="event_available" size={13} />}>{dec.date}</Tag>
            </div>
            <p className="muted" style={{ margin: '0 0 12px' }}>وافقت إدارة برنامج الحماية على توفير الحماية لك (قرار رقم <span className="mono">{dec.ref}</span>). راجِع الاتفاقية ووقّعها عبر نفاذ لتفعيل حمايتك — أو اعترِض على الأنواع المقرّرة برفع تظلّم.</p>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              {dec.types.map((tp) => <span className="chip-type" key={tp}><I name="shield" size={13} fill color="var(--color-primary)" />{tp}</span>)}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={toAgreement}><I name="draw" size={18} /> مراجعة وتوقيع اتفاقية الحماية</button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={toGrievance}><I name="gavel" size={18} /> الاعتراض على الأنواع المقرّرة ورفع تظلّم</button>
          </Card>
        )}

        {st.closed && (
          <Card className="card pad" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="lock" size={22} fill color="var(--text-secondary)" /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>أُغلق الطلب</b></div>
            <p className="muted" style={{ margin: 0 }}>قبلتَ قرار الرفض وأُغلق هذا الطلب. يمكنك التقدّم بطلب جديد عند وجود مستجدّات عبر «تقديم طلب جديد».</p>
          </Card>
        )}

        <Card className="card pad" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="row">
              <SecretCode code={req.secret} canReveal={false} />
              <Tag tone="info" size="sm" iconLeft={<I name="badge" size={13} />}>{req.category}</Tag>
            </div>
            {(() => { const s = statusOf(req, st, ruling); return <Tag tone={s.tone === 'neutral' ? 'info' : s.tone} size="md" iconLeft={<I name={s.icon} size={14} fill />}>{s.label}</Tag>; })()}
          </div>
          <div className="tl">
            {STAGES.map((s, i) => {
              const done = i < stage, active = i === stage;
              return (
                <div className="tl-step" key={i}>
                  <div className="tl-rail">
                    <div className="tl-dot" style={{ background: done ? 'var(--green-10)' : active ? 'var(--color-primary)' : 'var(--surface-subtle)', color: active ? '#fff' : done ? 'var(--color-primary)' : 'var(--text-disabled)', border: active ? 'none' : '2px solid ' + (done ? 'var(--color-primary)' : 'var(--border-default)') }}>
                      {done ? <I name="check" size={15} /> : i + 1}
                    </div>
                    {i < STAGES.length - 1 && <div className={'tl-line' + (done ? ' done' : '')} />}
                  </div>
                  <div className="tl-body">
                    <div className="tl-t" style={{ color: active ? 'var(--color-primary)' : done ? 'var(--text-strong)' : 'var(--text-secondary)' }}>{s.t}</div>
                    <div className="tl-d">{s.d}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => go('messages')}><I name="forum" size={18} /> مراسلة المركز</button>
          </div>
        </Card>
      </Screen>
    </div>
  );
}

// ===== تقديم طلب (مُقيَّد بطلب واحد نشط) =====
function NewRequestSimple({ go }) {
  return (
    <Screen title="تقديم طلب جديد">
      <InlineAlert kind="warning" title="لديك طلب قائم" style={{ marginBottom: 16 }}>
        لا يمكن تقديم طلب جديد ما دام لديك طلب قيد المعالجة (منعاً للتكرار). تابِع طلبك القائم، أو تواصل مع المركز عبر المراسلات.
      </InlineAlert>
      <Card className="card pad">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="tl-t">طلبك القائم</div>
            <div className="muted" style={{ marginTop: 4 }}><span className="mono">{CASE.ref}</span> · {CASE.secret}</div>
          </div>
          <button className="btn btn-primary" onClick={() => go('requests')}><I name="visibility" size={18} /> عرض الطلب</button>
        </div>
      </Card>
      <p className="muted" style={{ marginTop: 14 }}>عند إغلاق الطلب أو رفضه نهائياً، تُفتح إمكانية تقديم طلب جديد بعد مهلة محدّدة أو بمستجدات جديدة. والاعتراض على القرار يكون عبر التظلّم لا بطلب جديد.</p>
    </Screen>
  );
}

// ===== المراسلات (خيطان + محضر هاتفي) =====
const THREADS = {
  center: [
    { side: 'in', who: 'منسّق الحماية', t: '09:02', text: 'مرحباً، تسلّمنا طلبك ونراجع بياناته في مرحلة الفرز.' },
    { side: 'note', who: 'محضر هاتفي', t: '09:40', text: 'محضر مكالمة هاتفية: تأكّد من مستوى التهديد (مرتفع) — كتبه الموظف، للتوثيق.' },
    { side: 'in', who: 'منسّق الحماية', t: '09:52', text: 'لاستكمال طلبك نحتاج بعض المستندات. أنشأنا لك بطاقة «استيفاء» في «طلباتي» تبيّن المطلوب — أو أرفِقها هنا مباشرة.' },
  ],
  entity: [
    { side: 'in', who: 'الجهة المختصة', t: 'أمس', text: 'نراجع التوصية المتعلقة بطلبك، وسنرفعها خلال المهلة النظامية.' },
  ],
};
function MessagesSimple() {
  const [tab, setTab] = useState('center');
  const [text, setText] = useState('');
  const [threads, setThreads] = useState(THREADS);
  const [attach, setAttach] = useState(null);
  const fileRef = React.useRef(null);
  const msgs = threads[tab];
  const send = () => {
    if (!text.trim() && !attach) return;
    setThreads((t) => ({ ...t, [tab]: [...t[tab], { side: 'out', who: 'أنت', t: 'الآن', text: text.trim(), file: attach }] }));
    setText(''); setAttach(null);
  };
  return (
    <Screen title="المراسلات" lede="قناة تواصل مؤمّنة بالرمز السري — خيط منفصل مع المركز وآخر مع الجهة المختصة. المحاضر الهاتفية تظهر كتوثيق.">
      <div className="threads">
        <button className={'thread-tab' + (tab === 'center' ? ' on' : '')} onClick={() => setTab('center')}><I name="apartment" size={16} /> المركز</button>
        <button className={'thread-tab' + (tab === 'entity' ? ' on' : '')} onClick={() => setTab('entity')}><I name="gavel" size={16} /> الجهة المختصة</button>
      </div>
      <Card className="card pad">
        <div className="msg-list">
          {msgs.map((m, i) => (
            <div className={'msg ' + m.side} key={i}>
              <div className="msg-meta">
                {m.side === 'note' && <I name="call" size={13} color="var(--warning-50)" />}
                <b style={{ color: m.side === 'note' ? 'var(--warning-70)' : 'var(--text-secondary)' }}>{m.who}</b> · {m.t}
              </div>
              {m.text}
              {m.file && <div className="msg-file"><I name="description" size={16} color="var(--color-primary)" />{m.file}</div>}
            </div>
          ))}
        </div>
        {attach && (
          <div className="row" style={{ padding: '10px 2px 0' }}>
            <span className="attach-chip"><I name="attach_file" size={14} />{attach}<button className="linkbtn" style={{ color: 'var(--text-secondary)' }} onClick={() => setAttach(null)}><I name="close" size={15} /></button></span>
          </div>
        )}
        <div className="composer">
          <input type="file" ref={fileRef} hidden onChange={(e) => { const f = e.target.files[0]; if (f) setAttach(f.name); }} />
          <button className="iconbtn" onClick={() => fileRef.current.click()} title="إرفاق مستند"><I name="attach_file" size={20} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tab === 'entity' ? 'المراسلة مع الجهة عبر المركز…' : 'اكتب رسالة مؤمّنة…'} dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <button className="send" onClick={send}><I name="send" size={20} /></button>
        </div>
      </Card>
    </Screen>
  );
}

// ===== الإشعارات =====
const NOTIFS = [
  { type: 'decision', icon: 'verified', tone: 'success', t: 'صدر قرار قبول طلبك', d: 'وافقت إدارة البرنامج على توفير الحماية. راجِع الاتفاقية ووقّعها عبر نفاذ لتفعيلها.', time: 'الآن', unread: true, action: 'requests', actionLabel: 'مراجعة الاتفاقية' },
  { type: 'completion', icon: 'assignment_late', tone: 'warning', t: 'المركز يطلب استكمال طلبك', d: 'مطلوب: تقرير طبي حديث، توضيح مصدر التهديد، وهوية أحد التابعين. افتح بطاقة الاستيفاء في «طلباتي».', time: 'قبل دقائق', unread: false, action: 'requests', actionLabel: 'فتح بطاقة الاستيفاء' },
  { type: 'message', icon: 'forum', tone: 'primary', t: 'رسالة جديدة من المركز', d: 'منسّق الحماية يطلب تأكيد معلومات.', time: 'اليوم 09:52', unread: true },
  { type: 'deadline', icon: 'timer', tone: 'warning', t: 'تذكير بميعاد نظامي', d: 'يُتوقّع صدور القرار والإشعار خلال 3 أيام بعد اكتمال الفرز.', time: 'أمس', unread: false },
  { type: 'received', icon: 'task_alt', tone: 'success', t: 'تمّ استلام طلبك', d: 'رقم مرجعي REF-2026-4821 ورمز سري C-2026-0481.', time: '3 مايو', unread: false },
];
const NT = { info: ['var(--info-10)', 'var(--color-info)'], primary: ['var(--green-10)', 'var(--color-primary)'], warning: ['var(--warning-10)', 'var(--color-warning)'], success: ['var(--success-10)', 'var(--color-success)'] };
function NotificationsSimple({ go }) {
  const [items, setItems] = useState(NOTIFS);
  const markAll = () => setItems((x) => x.map((n) => ({ ...n, unread: false })));
  return (
    <Screen title="الإشعارات" lede="تنبيهات الإحالات والمواعيد والقرارات والمراسلات. إشعارات الطوارئ (للحالات النشطة) تُميَّز بوضوح.">
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={markAll}><I name="done_all" size={18} /> تعليم الكل كمقروء</button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((n, i) => {
          const [bg, fg] = NT[n.tone];
          return (
            <div className={'ntf' + (n.unread ? ' unread' : '')} key={i}>
              <div className="ntf-ico" style={{ background: bg, color: fg }}><I name={n.icon} size={20} fill /></div>
              <div style={{ flex: 1 }}>
                <div className="ntf-t">{n.t}</div>
                <div className="ntf-d">{n.d}</div>
                <div className="ntf-time">{n.time}</div>
                {n.action && <button className="btn btn-ghost sm" style={{ marginTop: 8 }} onClick={() => go(n.action)}><I name="open_in_new" size={15} /> {n.actionLabel || 'فتح'}</button>}
              </div>
              {n.unread && <div className="dot-unread" />}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

// ===== الملف الشخصي (موجز موثّق — يظهر لمالك الحساب بقيمه الفعلية) =====
function ProfileSimple() {
  const id = useContext(IdentityContext);
  const fields = [
    ['الاسم', id.name, 'نفاذ'], ['رقم الهوية', <span className="mono" dir="ltr">{maskId(id.nationalId)}</span>, 'نفاذ'], ['الجنس', null, 'نفاذ'], ['تاريخ الميلاد', null, 'نفاذ'],
    ['الجنسية', null, 'نفاذ'], ['الحالة الاجتماعية', null, 'نفاذ'], ['العنوان الوطني', null, 'سبل'], ['بيانات العمل', null, 'الموارد البشرية'],
  ];
  return (
    <Screen title="الملف الشخصي" lede="بياناتك موثّقة من المصادر الوطنية، تظهر لك وحدك (مالك الحساب) وغير قابلة للتعديل، وتُستخدم تلقائياً دون إعادة إدخال.">
      <Card className="card pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {fields.map(([l, v, src], i) => (
            <div className="ro-field" key={i}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{l}</span>
              <span className="row" style={{ gap: 6 }}><span style={{ fontSize: 13, color: 'var(--text-body)' }}>{v || '••••'}</span><span className="mono muted" style={{ fontSize: 11 }}>({src})</span><I name="lock" size={15} style={{ color: 'var(--text-disabled)' }} /></span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="card pad">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row"><I name="contact_emergency" size={20} color="var(--color-primary)" /><b style={{ color: 'var(--text-strong)' }}>جهة اتصال للطوارئ</b></div>
          <a className="btn btn-ghost" href="الملف الشخصي وتقديم طلب.html"><I name="open_in_new" size={17} /> الملف التفصيلي</a>
        </div>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>للتواصل عند الخطر الوشيك (م14/6) — تُدخَل من المستخدم وتُحفظ في الملف.</p>
      </Card>
    </Screen>
  );
}

// ===== التوقيع عبر نفاذ =====
function NafathSign({ onDone, onClose }) {
  const [waiting, setWaiting] = useState(false);
  const confirm = () => { setWaiting(true); setTimeout(onDone, 1700); };
  return (
    <div className="nf-scrim" onClick={onClose}>
      <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <I name="verified_user" size={22} color="var(--color-primary)" fill />
          <b style={{ fontSize: 16, color: 'var(--text-strong)' }}>التوقيع عبر نفاذ</b>
        </div>
        {!waiting ? (
          <React.Fragment>
            <p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>افتح تطبيق نفاذ على جهازك واختر الرقم التالي لاعتماد توقيعك على اتفاقية الحماية.</p>
            <div className="nf-num">47</div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={confirm}><I name="check" size={18} /> لقد اخترت الرقم في نفاذ</button>
            <button className="linkbtn" style={{ marginTop: 12 }} onClick={onClose}>إلغاء</button>
          </React.Fragment>
        ) : (
          <div style={{ padding: '26px 0' }}>
            <I name="progress_activity" size={40} color="var(--color-primary)" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />
            <p className="muted" style={{ marginTop: 14 }}>جارٍ التحقّق من توقيعك عبر نفاذ…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== اتفاقية الحماية (مراجعة وتوقيع) =====
function Agreement({ req, decision, signed, onSign, onGrieve, back }) {
  const [obl, setObl] = useState([]);
  const [ackTypes, setAckTypes] = useState(false);
  const [ackConf, setAckConf] = useState(false);
  const [nafath, setNafath] = useState(false);
  const ready = obl.length === OBLIGATIONS.length && ackTypes && ackConf;
  const toggleObl = (i) => setObl((a) => a.includes(i) ? a.filter((x) => x !== i) : [...a, i]);
  const wm = Array.from({ length: 64 });
  return (
    <div>
      <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى طلباتي</button>
      <Screen title="اتفاقية الحماية" lede={signed ? 'نسختك الموقّعة من اتفاقية الحماية — سرية للغاية، مخصّصة لك وحدك.' : 'راجِع أنواع الحماية المقرّرة والتزاماتك، ثم وقّع الاتفاقية عبر نفاذ لتفعيل حمايتك.'}>
        <InlineAlert kind="warning" title="سرية للغاية ومسؤولية نظامية" style={{ marginBottom: 16 }}>
          محتوى هذه الاتفاقية سري (م15، م16) ومخصّص لك وحدك. يُحظر نسخه أو تصويره أو إفشاؤه لأي طرف. وكل من يسيء التصرف بمحتواها يقع تحت طائلة المساءلة النظامية والعقوبات المقرّرة. نسختك موسومة برمزك السري لتتبّع أي تسريب.
        </InlineAlert>
        <div className="agr-doc" style={{ marginBottom: 16 }}>
          <div className="agr-wm" aria-hidden="true">{wm.map((_, i) => <span key={i}>{req.secret} · 1•••••{req.ref.slice(-4)} · سري — لا تُنسخ</span>)}</div>
          <div className="agr-body">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="agr-h">اتفاقية توفير الحماية</div>
                <div className="muted" style={{ marginTop: 2 }}>إدارة برنامج الحماية — النيابة العامة</div>
              </div>
              {signed && <Tag tone="success" size="md" iconLeft={<I name="verified" size={14} fill />}>موقّعة</Tag>}
            </div>
            <div className="row" style={{ gap: 18, marginTop: 12 }}>
              <span className="muted">رقم القرار: <b className="mono" style={{ color: 'var(--text-strong)' }}>{decision.ref}</b></span>
              <span className="muted">التاريخ: <b style={{ color: 'var(--text-strong)' }}>{decision.date}</b></span>
              <span className="muted">الرمز السري: <b className="mono" style={{ color: 'var(--text-strong)' }}>{req.secret}</b></span>
            </div>
            <div className="agr-sec-t"><I name="article" size={18} /> الديباجة</div>
            <p className="agr-p">بناءً على نظام حماية الشهود والخبراء والمبلّغين ولائحته التنفيذية، وبعد دراسة طلبك وتقييم الأخطار وصدور قرار إدارة برنامج الحماية بالقبول، تُبرَم هذه الاتفاقية لتحديد أنواع الحماية المقرّرة لك ومدّتها والتزامات الطرفين.</p>
            <div className="agr-sec-t"><I name="shield" size={18} /> أنواع الحماية المقرّرة (المادة 14)</div>
            <div className="row" style={{ gap: 8 }}>{decision.types.map((t) => <span className="chip-type" key={t}><I name="check_circle" size={14} fill color="var(--color-primary)" />{t}</span>)}</div>
            <div className="agr-sec-t"><I name="schedule" size={18} /> مدة الحماية</div>
            <p className="agr-p">{decision.duration}</p>
            <div className="agr-sec-t"><I name="gavel" size={18} /> التزامات المشمول بالحماية (المادة 11)</div>
            {signed
              ? OBLIGATIONS.map((o, i) => <div className="agr-li" key={i}><I name="check_circle" size={17} fill color="var(--color-success)" style={{ marginTop: 1, flexShrink: 0 }} />{o}</div>)
              : <div style={{ display: 'grid', gap: 8 }}>{OBLIGATIONS.map((o, i) => (
                  <button key={i} className={'ack' + (obl.includes(i) ? ' on' : '')} onClick={() => toggleObl(i)}>
                    <I name={obl.includes(i) ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={obl.includes(i)} color={obl.includes(i) ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />{o}
                  </button>
                ))}</div>}
          </div>
        </div>
        {signed ? (
          <Card className="card pad" style={{ background: 'var(--success-10)', borderColor: 'var(--success-50)' }}>
            <div className="row" style={{ gap: 10 }}>
              <I name="verified" size={24} fill color="var(--color-success)" />
              <div>
                <b style={{ color: 'var(--text-strong)' }}>وُقّعت الاتفاقية وفُعّلت حمايتك</b>
                <div className="muted" style={{ marginTop: 3 }}>وُقّعت رقمياً عبر نفاذ بتاريخ {decision.date}. النسخة للعرض فقط — لا تُتاح للتنزيل حفاظاً على السرية.</div>
              </div>
            </div>
          </Card>
        ) : (
          <React.Fragment>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <button className={'ack' + (ackTypes ? ' on' : '')} onClick={() => setAckTypes(!ackTypes)}>
                <I name={ackTypes ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={ackTypes} color={ackTypes ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />
                أقرّ بأنني اطّلعت على أنواع الحماية المقرّرة لي ومدّتها ووافقت عليها.
              </button>
              <button className={'ack' + (ackConf ? ' on' : '')} onClick={() => setAckConf(!ackConf)}>
                <I name={ackConf ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={ackConf} color={ackConf ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />
                أتعهّد بالحفاظ على سرية هذه الاتفاقية، وأقرّ بمسؤوليتي النظامية عند إساءة التصرف بمحتواها.
              </button>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ready} onClick={() => setNafath(true)}>
              <I name="draw" size={18} /> {ready ? 'التوقيع عبر نفاذ وتفعيل الحماية' : 'أكمِل الإقرارات للتوقيع'}
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onGrieve}><I name="gavel" size={18} /> بدلاً من التوقيع: الاعتراض على الأنواع المقرّرة ورفع تظلّم</button>
          </React.Fragment>
        )}
      </Screen>
      {nafath && <NafathSign onDone={() => { setNafath(false); onSign(); }} onClose={() => setNafath(false)} />}
    </div>
  );
}

// ===== التظلّم أمام النائب العام =====
function Grievance({ decision, grievance, onFile, back }) {
  const filed = grievance.status === 'filed';
  const isReject = decision.outcome === 'reject';
  const SCOPES = isReject
    ? [ { id: 'reject', t: 'الاعتراض على رفض الطلب' }, { id: 'other', t: 'سبب آخر' } ]
    : [ { id: 'types', t: 'أنواع الحماية المقرّرة غير كافية' }, { id: 'duration', t: 'مدة الحماية المقرّرة' }, { id: 'other', t: 'سبب آخر' } ];
  const [scope, setScope] = useState(isReject ? 'reject' : 'types');
  const [reason, setReason] = useState('');
  const scopeLabel = (SCOPES.find((s) => s.id === (grievance.scope || scope)) || SCOPES[0]).t;
  return (
    <div>
      <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى طلباتي</button>
      <Screen title="التظلّم أمام النائب العام" lede={filed ? 'تظلّمك قيد النظر — ستُشعَر بالنتيجة فور البتّ.' : isReject ? 'إن رأيت أنّ رفض طلبك غير مبرّر، يمكنك التظلّم على القرار أمام النائب العام.' : 'إن رأيت أنّ أنواع الحماية المقرّرة أو القرار لا يفي بحاجتك، يمكنك التظلّم أمام النائب العام.'}>
        <InlineAlert kind="info" title="مسار التظلّم النظامي" style={{ marginBottom: 16 }}>
          يُرفع التظلّم أمام النائب العام خلال (10) أيام من تاريخ العلم بالقرار، ويُبتّ فيه خلال (10) أيام، وقراره نهائي غير قابل للطعن. (م10/2، م21)
        </InlineAlert>
        {filed ? (
          <Card className="card pad">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="row" style={{ gap: 9 }}><I name="gavel" size={20} fill color="var(--color-warning)" /><b style={{ color: 'var(--text-strong)' }}>تظلّم مُقدّم</b></div>
              <Tag tone="warning" size="sm" iconLeft={<I name="schedule" size={13} />}>قيد البتّ</Tag>
            </div>
            <div className="ro-field" style={{ marginBottom: 10 }}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>رقم التظلّم</span><span className="mono muted">{grievance.ref}</span></div>
            <div className="ro-field" style={{ marginBottom: 10 }}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>محل الاعتراض</span><span className="muted">{scopeLabel}</span></div>
            {grievance.reason && <div className="ci" style={{ marginBottom: 10 }}><div className="ci-note" style={{ marginTop: 0 }}>سبب التظلّم</div><div className="ci-val">{grievance.reason}</div></div>}
            <div style={{ marginTop: 4 }}><DeadlineTimer label="مهلة البتّ في التظلّم" totalDays={10} daysElapsed={1} articleRef="م21" /></div>
          </Card>
        ) : (
          <Card className="card pad">
            <div style={{ marginBottom: 16 }}><DeadlineTimer label="مهلة رفع التظلّم" totalDays={10} daysElapsed={1} articleRef="م21" /></div>
            <div className="ci-label" style={{ marginBottom: 8 }}>محل الاعتراض</div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {SCOPES.map((s) => (
                <button key={s.id} className={'ack' + (scope === s.id ? ' on' : '')} onClick={() => setScope(s.id)}>
                  <I name={scope === s.id ? 'radio_button_checked' : 'radio_button_unchecked'} size={20} fill={scope === s.id} color={scope === s.id ? 'var(--color-primary)' : 'var(--text-disabled)'} style={{ flexShrink: 0 }} />{s.t}
                </button>
              ))}
            </div>
            <div className="ci-label" style={{ marginBottom: 8 }}>سبب التظلّم</div>
            <textarea className="ci-text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اشرح سبب اعتراضك على القرار أو أنواع الحماية المقرّرة…" dir="auto" rows={4} style={{ marginBottom: 16 }} />
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!reason.trim()} onClick={() => onFile({ scope, reason: reason.trim(), scopeLabel })}>
              <I name="gavel" size={18} /> رفع التظلّم أمام النائب العام
            </button>
          </Card>
        )}
      </Screen>
    </div>
  );
}

// ===== لوحة المعلومات =====
// حقل قراءة موجز: القيمة الفعلية لمالك الحساب + شارة المصدر + قفل (غير قابل للتعديل)
function DashField({ label, value, source }) {
  return (
    <div className="ro-field">
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{label}</span>
      <span className="row" style={{ gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-body)' }}>{value || '••••'}</span>
        <span className="mono muted" style={{ fontSize: 11 }}>({source})</span>
        <I name="lock" size={15} style={{ color: 'var(--text-disabled)' }} />
      </span>
    </div>
  );
}

const DASH_ICON = { success: 'verified', error: 'cancel', warning: 'draw', info: 'assignment', neutral: 'lock' };
const NEEDS_ACTION_STATUSES = ['accepted', 'rejected']; // بانتظار توقيع أو تظلّم

function Dashboard({ go }) {
  const identity = useContext(IdentityContext);
  const requests = useContext(RequestsContext);
  const supabase = useRef(createClient()).current;
  const [counts, setCounts] = useState({ msgs: null, notifs: null });
  useEffect(() => {
    let on = true;
    Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('direction', 'in'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
    ]).then(([m, n]) => { if (on) setCounts({ msgs: m.count ?? 0, notifs: n.count ?? 0 }); });
    return () => { on = false; };
  }, [supabase]);
  const req = requests[0] || null;
  const st = req ? (STATUS_AR[req.status] || { t: req.status, tone: 'info' }) : null;
  const tone = st ? (TONE_RGB[st.tone] || TONE_RGB.info) : null;
  const needsAction = requests.filter((r) => NEEDS_ACTION_STATUSES.includes(r.status)).length;
  return (
    <Screen title="لوحة المعلومات" lede="نظرة سريعة على طلباتك ومراسلاتك وبياناتك — كل ما يتطلّب إجراءً منك يظهر هنا أولاً.">
      <Card className="card pad" style={{ marginBottom: 16 }}>
        {req ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="req-ic" style={{ background: 'color-mix(in srgb, ' + tone + ' 12%, transparent)', color: tone }}><I name={DASH_ICON[st.tone] || 'assignment'} size={22} fill /></span>
              <span>
                <span className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <b style={{ fontSize: 15, color: 'var(--text-strong)' }}>طلبك النشط</b>
                  <Tag tone={st.tone === 'neutral' ? 'info' : st.tone} size="sm">{st.t}</Tag>
                </span>
                <span className="muted" style={{ display: 'block' }}>مرجع <span className="mono">{req.ref_no}</span> · {CATEGORY_AR[req.category] || req.category} · قُدِّم {new Date(req.created_at).toLocaleDateString('ar-SA', { dateStyle: 'medium' })}</span>
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => go('requests')}><I name="visibility" size={18} /> عرض الطلب</button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="req-ic" style={{ background: 'var(--green-10)', color: 'var(--color-primary)' }}><I name="note_add" size={22} /></span>
              <span>
                <b style={{ fontSize: 15, color: 'var(--text-strong)', display: 'block', marginBottom: 4 }}>لا يوجد طلب نشط</b>
                <span className="muted">عند تقديم طلب حماية ستظهر حالته هنا أولاً بأول.</span>
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => go('new')}><I name="note_add" size={18} /> تقديم طلب جديد</button>
          </div>
        )}
      </Card>
      <div className="dash-stats">
        <button className="dash-stat" onClick={() => go('requests')}>
          <span className="ntf-ico" style={{ background: 'var(--green-10)', color: 'var(--color-primary)' }}><I name="assignment" size={20} fill /></span>
          <span><span className="dash-num">{requests.length}</span><span className="dash-lbl" style={{ display: 'block' }}>الطلبات — {needsAction} يتطلّب إجراء</span></span>
        </button>
        <button className="dash-stat" onClick={() => go('messages')}>
          <span className="ntf-ico" style={{ background: 'var(--info-10)', color: 'var(--color-info)' }}><I name="forum" size={20} fill /></span>
          <span><span className="dash-num">{counts.msgs ?? '…'}</span><span className="dash-lbl" style={{ display: 'block' }}>رسائل واردة</span></span>
        </button>
        <button className="dash-stat" onClick={() => go('notifications')}>
          <span className="ntf-ico" style={{ background: 'var(--warning-10)', color: 'var(--color-warning)' }}><I name="notifications" size={20} fill /></span>
          <span><span className="dash-num">{counts.notifs ?? '…'}</span><span className="dash-lbl" style={{ display: 'block' }}>إشعارات جديدة</span></span>
        </button>
      </div>
      <Card className="card pad">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="row"><I name="account_circle" size={20} color="var(--color-primary)" /><b style={{ color: 'var(--text-strong)' }}>ملفّك الشخصي</b></div>
          <Tag tone="info" size="sm" iconLeft={<I name="lock" size={13} />}>للاطلاع فقط — غير قابل للتعديل</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <DashField label="الاسم" value={identity.name} source="نفاذ" />
          <DashField label="رقم الهوية" value={<span className="mono" dir="ltr">{maskId(identity.nationalId)}</span>} source="نفاذ" />
          <DashField label="العنوان الوطني" value={null} source="سبل" />
          <DashField label="بيانات العمل" value={null} source="الموارد البشرية" />
        </div>
        <p className="muted" style={{ margin: '0 0 12px' }}>بياناتك موثّقة من المصادر الوطنية وتظهر لك وحدك (مالك الحساب)، ولا يمكن تعديلها من البوابة.</p>
        <button className="btn btn-ghost" onClick={() => go('profile')}><I name="open_in_new" size={17} /> عرض الملف الشخصي كاملاً</button>
      </Card>
    </Screen>
  );
}

const NAV = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard', C: Dashboard },
  { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle', C: ProfileDetailed },
  { id: 'new', t: 'تقديم طلب جديد', icon: 'note_add', C: NewRequestDetailed },
  { id: 'requests', t: 'طلباتي', icon: 'assignment', C: null },
  { id: 'messages', t: 'المراسلات', icon: 'forum', C: MessagesDetailed },
  { id: 'notifications', t: 'الإشعارات', icon: 'notifications', C: NotificationsDetailed },
];

function PortalApp() {
  const identity = useContext(IdentityContext);
  const realRequests = useContext(RequestsContext);
  const supabase = useRef(createClient()).current;
  const [active, setActive] = useState('dashboard');
  const [open, setOpen] = useState(false);
  // حالة الطيّ محلية وتُحفظ في تفضيلات المتصفح (تُقرأ بعد التركيب تفادياً لاختلاف الترطيب)
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('seeker.side.collapsed') === '1') setCollapsed(true); } catch { /* خصوصية المتصفح */ } }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('seeker.side.collapsed', c ? '0' : '1'); } catch { /* خصوصية المتصفح */ } return !c; });
  const signOut = () => { fetch('/auth/signout', { method: 'POST' }).finally(() => { window.location.href = 'http://localhost:3000/'; }); };
  const [completion, setCompletion] = useState({
    status: 'awaiting',
    submitted: false,
    items: COMPLETION_ITEMS.map((it) => ({ ...it, done: false, value: '' })),
  });
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const ruling = t.prosecutorRuling;
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [states, setStates] = useState({
    r1: { signed: false, grievance: { status: 'none' }, closed: false },
    r2: { signed: false, grievance: { status: 'none' }, closed: false },
  });
  const selReq = REQUESTS.find((r) => r.id === selectedReqId) || null;
  const selState = selReq ? states[selReq.id] : null;
  const decisionForAgreement = selReq ? (selReq.outcome === 'reject' ? DECISION : selReq.decision) : DECISION;
  const signReq = () => setStates((s) => ({ ...s, [selectedReqId]: { ...s[selectedReqId], signed: true } }));
  const closeReq = () => setStates((s) => ({ ...s, [selectedReqId]: { ...s[selectedReqId], closed: true } }));
  // رفع تظلّمٍ حقيقيّ على قضيّة المستفيد: يُنشئ صفّاً في grievances فيُشعِر المكتب الفني عبر المُشغّل القاعديّ.
  const fileGrievance = async (g) => {
    setStates((s) => ({ ...s, [selectedReqId]: { ...s[selectedReqId], grievance: { status: 'filed', date: 'الآن', ...g } } }));
    const caseId = (realRequests[0] || {}).id;
    if (!caseId) return;
    const against = (g.scopeLabel || 'تظلّم') + (g.reason ? ' — ' + g.reason : '');
    const now = new Date();
    const due = new Date(now.getTime() + 10 * 86400000).toISOString();
    try {
      const { data } = await supabase.from('grievances').insert({ case_id: caseId, against, filed_at: now.toISOString(), decision_due: due, status: 'filed' }).select('id').single();
      if (data) setStates((s) => ({ ...s, [selectedReqId]: { ...s[selectedReqId], grievance: { status: 'filed', ref: 'GRV-' + String(data.id).slice(0, 8), date: 'الآن', ...g } } }));
    } catch (e) { /* يبقى السجلّ المحلّي؛ لا بيانات مُلفّقة تُعرَض */ }
  };
  const fulfill = (id, value) => setCompletion((c) => ({
    ...c,
    items: c.items.map((it) => it.id === id ? { ...it, done: value !== null, value: value || '' } : it),
  }));
  const submitCompletion = () => setCompletion((c) => ({ ...c, status: 'processing', submitted: true }));
  const go = (id) => { setActive(id); setOpen(false); };
  const openReq = (id) => { setSelectedReqId(id); setActive('requests'); setOpen(false); };
  const isAgreement = active === 'agreement';
  const isGrievance = active === 'grievance';
  const cur = NAV.find((n) => n.id === active) || NAV[2];
  const Comp = cur.C;
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '') + (collapsed ? ' collapsed' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="shield_person" size={22} fill color="#fff" /></div>
          <div className="brand-txt">
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-strong)', lineHeight: 1.2 }}>بوابة طالب الحماية</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>النيابة العامة</div>
          </div>
          <button className="collapse-btn" onClick={toggleCollapsed} title={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'} aria-label={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}>
            <I name={collapsed ? 'left_panel_open' : 'left_panel_close'} size={20} />
          </button>
        </div>
        <nav className="nav">
          {NAV.map((n) => {
            const needsAction = REQUESTS.some((r) => { const st = states[r.id]; return !st.signed && !st.closed && !(st.grievance.status === 'filed' && ruling === 'reject'); });
            const badge = n.id === 'requests' && (needsAction || completion.status === 'awaiting') ? '!' : n.badge;
            return (
              <button key={n.id} className={'nav-item' + (active === n.id ? ' on' : '')} title={collapsed ? n.t : undefined} onClick={() => { if (n.id === 'requests') setSelectedReqId(null); go(n.id); }}>
                <I name={n.icon} size={20} /> <span className="nav-lbl">{n.t}</span>
                {badge && <span className="nav-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <button className="logout-btn" title="تسجيل الخروج" onClick={signOut}>
            <I name="logout" size={19} /> <span className="nav-lbl">تسجيل الخروج</span>
          </button>
        </div>
        <div className="side-foot">مبنية على نظام Platforms Code — هيئة الحكومة الرقمية. الهوية تُعرض بالرمز السري.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{isAgreement ? 'اتفاقية الحماية' : isGrievance ? 'التظلّم' : cur.t}</span>
          <span className="row" style={{ marginInlineStart: 'auto', gap: 8 }}>
            <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
            <SecretCode code={selReq ? selReq.secret : (identity.secretCode || CASE.secret)} canReveal={false} />
          </span>
        </header>
        <main className="content">
          {isAgreement && selReq
            ? <Agreement req={selReq} decision={decisionForAgreement} signed={selState.signed} onSign={signReq} onGrieve={() => go('grievance')} back={() => go('requests')} />
            : isGrievance && selReq
            ? <Grievance req={selReq} decision={selReq.decision} grievance={selState.grievance} onFile={fileGrievance} back={() => go('requests')} />
            : active === 'requests'
            ? (selReq
                ? <RequestDetail req={selReq} st={selState} ruling={ruling} go={go} toAgreement={() => go('agreement')} toGrievance={() => go('grievance')} onClose={closeReq} back={() => setSelectedReqId(null)} />
                : <RealRequests go={go} />)
            : <Comp go={go} completion={completion} fulfill={fulfill} submitCompletion={submitCompletion} />}
        </main>
      </div>
      <TweaksPanel title="إعدادات العرض">
        <TweakSection label="محاكاة (للعرض التجريبي)" />
        <TweakSelect label="قرار النائب العام على التظلّم" value={t.prosecutorRuling}
          options={[{ value: 'pending', label: 'قيد النظر' }, { value: 'accept', label: 'قبول التظلّم' }, { value: 'reject', label: 'رفض التظلّم' }]}
          onChange={(v) => setTweak('prosecutorRuling', v)} />
      </TweaksPanel>
    </div>
  );
}

function SeekerRoot({ identity, requests }) {
  return (
    <IdentityContext.Provider value={identity}>
      <RequestsContext.Provider value={requests || []}>
        <RealtimeRefresh />
        <PortalApp />
      </RequestsContext.Provider>
    </IdentityContext.Provider>
  );
}

export { PortalApp, SeekerRoot };
