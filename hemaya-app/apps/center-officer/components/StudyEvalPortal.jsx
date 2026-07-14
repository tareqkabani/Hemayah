"use client";
/* ============================================================
   مكتبة الدراسة والتقييم — منقولة حرفياً من study-eval-portal.jsx
   دوران معزولان (studier/evaluator). window→@hemaya/ui. البيانات لاحقاً من Supabase.
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";
import { submitStudy, submitAssessment } from "@/lib/study-actions";
import "./study-eval.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// ===== إعداد الدور =====
const ROLE = {
  studier: {
    label: 'الدارس', short: 'دارس', kind: 'دراسة', brandSub: 'الدراسة',
    formTitle: 'الدراسة والرأي', formIcon: 'rate_review', recLabel: 'توصية الدارس',
    signer: 'مُعِدّ الدراسة', peers: 'الدارسين', peerOne: 'دارس', output: 'الدراسة',
    person: { name: 'أ. خالد العنزي', emp: 'EMP-4210' },
    brandIcon: 'analytics',
  },
  evaluator: {
    label: 'المقيّم', short: 'مقيّم', kind: 'تقييم', brandSub: 'التقييم',
    formTitle: 'التقييم والرأي', formIcon: 'psychology', recLabel: 'توصية المقيّم',
    signer: 'مُعِدّ التقييم', peers: 'المقيّمين', peerOne: 'مقيّم', output: 'التقييم',
    person: { name: 'أ. منى الزهراني', emp: 'EMP-4233' },
    brandIcon: 'psychology',
  },
};

const TRACK = {
  'عادي':  ['var(--neutral-100)', 'var(--text-secondary)', 'schedule'],
  'عاجل':  ['var(--warning-10)', 'var(--warning-70)', 'bolt'],
  'طارئ':  ['var(--error-10)', 'var(--color-error)', 'e911_emergency'],
  'أجنبي': ['var(--info-10)', 'var(--info-70)', 'public'],
};

const SEED = {}; // (لم يعد مستعملاً — القائمة حقيقيّة)

function TrackPill({ track }) {
  const t = TRACK[track] || TRACK['عادي'];
  return <span className="pill" style={{ background: t[0], color: t[1] }}><I name={t[2]} size={12} fill /> {track}</span>;
}

function Tasks({ cfg, rows, open }) {
  return (<div>
    <h2 className="h2">المهام المُسندة إليّ</h2>
    <p className="lede">مهامّ {cfg.output} المُسندة إليك — <b>توزيع آليّ بالعبء</b>. يُستقبَل المخرَج ضمن يوم عمل في مظلّة 3 أيام (م10).</p>
    <Card className="card"><div className="tbl-wrap"><table>
      <thead><tr><th>الرمز السري</th><th>الفئة</th><th>المسار</th><th>الميعاد</th><th></th></tr></thead>
      <tbody>{rows.map((t, i) => (
        <tr key={i} onClick={() => t.status === 'new' && open(t)}>
          <td>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{t.secret}</span>
            {t.foreign && <span className="pill" style={{ background: 'var(--info-10)', color: 'var(--info-70)', marginInlineStart: 7 }}><I name="public" size={12} fill /> أجنبي · م6</span>}
          </td>
          <td>{t.cat}</td>
          <td><TrackPill track={t.track} /></td>
          <td><span style={{ fontSize: 12.5, color: t.status === 'done' ? 'var(--text-secondary)' : 'var(--color-primary)', fontWeight: 600 }}>{t.due}</span></td>
          <td>{t.status === 'new' ? <span className="link">فتح النموذج <I name="chevron_left" size={16} /></span> : <Tag tone="success" size="sm" iconLeft={<I name="check" size={13} />}>مكتملة</Tag>}</td>
        </tr>))}</tbody>
    </table></div></Card>
    <InlineAlert kind="info" title="عزل تامّ بين الأقران" style={{ marginTop: 16 }}>
      قد يُسنَد الطلب الواحد إلى عدّة {cfg.peers} في آنٍ واحد، يعمل كلٌّ منهم بمعزل عن الآخرين — لا اطّلاع أفقيّ على أعمالهم. تُجمَّع كل المخرجات <b>آلياً</b> وتُعرض على المجلس دون تدخّل بشريّ، ضماناً للحياد.
    </InlineAlert>
  </div>);
}

const PTYPES = [
  { t: 'الحماية الأمنية' },
  { t: 'الإرشاد القانوني والنفسي والاجتماعي' },
  { t: 'تغيير أرقام هواتفه' },
  { t: 'منحه وسيلة للإبلاغ الفوري' },
  { t: 'إخفاء بياناته الشخصية وكل ما يدل على هويته' },
  { t: 'سلامة تنقّله كتوفير مرافق أمني' },
  { t: 'نقله من مكان عمله', dur: true },
  { t: 'مساعدته في الحصول على عمل بديل' },
  { t: 'مساعدته مالياً' },
  { t: 'تغيير محل إقامته', dur: true },
  { t: 'التنسيق مع الجهات ذات العلاقة' },
  { t: 'حماية مسكنه' },
  { t: 'استخدام وسائط إلكترونية لتغيير الصوت وإخفاء الوجه' },
];
const REJ = [
  { k: 'r1', t: 'الجريمة ليست من الجرائم الكبيرة الموجبة للتوقيف' },
  { k: 'r2', t: 'مقدّم الطلب ليس من الفئات المشمولة بأحكام النظام' },
  { k: 'r3', t: 'عدم وجود خطر أو تهديد', note: true },
  { k: 'r4', t: 'توفير حلول بديلة دون قبوله بالبرنامج', note: true },
  { k: 'r5', t: 'أخرى', note: true },
];

function Chk({ on, label, onClick, children }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', border: '1px solid ' + (on ? 'var(--color-primary)' : 'var(--border-subtle)'), borderRadius: 'var(--radius-md)', cursor: 'pointer', background: on ? 'var(--green-10)' : 'var(--surface-card)', fontSize: 13.5, color: 'var(--text-body)', userSelect: 'none' }}>
      <I name={on ? 'check_box' : 'check_box_outline_blank'} size={20} color={on ? 'var(--color-primary)' : 'var(--text-secondary)'} fill={on} />
      <span style={{ flex: 1 }}>{label}</span>{children}
    </div>
  );
}

function AuthRec({ secret, detail }) {
  const [open, setOpen] = useState(true);
  const a = (detail && detail.assess) || {};
  const rc = (detail && detail.rec) || {};
  const provide = (detail && detail.recommendation) || rc.provide || null;
  const dash = (v) => (v !== undefined && v !== null && String(v).trim() !== '') ? v : '—';
  const R = (l, v, tone) => (
    <div className="ro-field" style={{ marginBottom: 6 }}><span className="muted" style={{ fontSize: 12.5 }}>{l}</span>{tone ? <Tag tone={tone} size="sm">{v}</Tag> : <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-strong)' }}>{v}</span>}</div>
  );
  const Block = (l, v) => (
    <div className="fld" style={{ marginBottom: 8 }}><span className="fld-label">{l}</span><div className="ro-field" style={{ display: 'block', lineHeight: 1.7 }}>{v}</div></div>
  );
  const Grp = ({ n, title, children }) => (
    <div style={{ marginTop: 16 }}>
      <div className="row" style={{ gap: 8, marginBottom: 9 }}><span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--green-10)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</span><b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>{title}</b></div>
      {children}
    </div>
  );
  return (
    <Card className="card pad" style={{ marginBottom: 16, borderColor: 'var(--green-20)' }}>
      <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <b style={{ color: 'var(--text-strong)' }}><I name="assignment_turned_in" size={18} color="var(--color-primary)" fill style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />التوصية الكاملة من الجهة المختصة</b>
        <span className="row" style={{ gap: 8 }}><Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} fill />}>معتمدة ومرفوعة</Tag><I name={open ? 'expand_less' : 'expand_more'} size={20} color="var(--text-secondary)" /></span>
      </div>
      {open && (<div>
        <InlineAlert kind="warning" title="الهوية محجوبة" style={{ marginTop: 12 }}>هوية الشخص وبياناته الشخصية <b>محجوبة</b> ويُشار إليه بالرمز السري <span className="mono" style={{ fontWeight: 700 }}>{secret}</span> — تطّلع على مضمون التوصية دون التعرّف على الهوية (عزل وسرية).</InlineAlert>
        <Grp n="١" title="بيانات مقدّم الطلب (محجوبة الهوية)">
          {R('صفة مقدّم الطلب', dash(a.applicantRoleDesc || (detail && detail.applicantRole)))}
          {R('الحالة الصحية', a.health ? (a.health + (a.healthNote ? ` — ${a.healthNote}` : '')) : '—')}
          {R('التاريخ الجنائي', a.criminal === 'يوجد' ? dash(a.criminalNote || 'يوجد') : (a.criminal ? 'لا يوجد' : '—'))}
          {R('التاريخ النفسي', dash(a.psychHistory))}
          {R('رغبة الكشف عن الهوية', dash(a.reveal), a.reveal === 'لا يرغب' ? 'warning' : null)}
        </Grp>
        <Grp n="٢" title="ملخّص القضية ودور مقدّم الطلب">
          {R('المرحلة الحالية للقضية', dash(a.caseStage))}
          {Block('ملخّص القضية', dash(a.caseSummary))}
        </Grp>
        <Grp n="٣" title="مسوّغات توفير الحماية">
          {R('نوع الجريمة', dash(a.crimeType), (a.crimeType && a.crimeType.includes('كبيرة')) ? 'error' : null)}
          {R('الواقعة', Array.isArray(a.waqia) && a.waqia.length ? a.waqia.join(' · ') : '—')}
          {Block('الوصف الإجرامي', dash(a.crimeDesc))}
          {R('إخفاء البيانات (م2 من النظام)', dash(a.hidden2))}
          {R('وجود خطر يهدّد طالب الحماية', dash(a.threatExists), a.threatExists === 'يوجد' ? 'error' : null)}
          {a.threatType && R('نوع الخطر', a.threatType)}
          {a.riskLevel && R('مستوى الخطر', a.riskLevel, 'error')}
          {R('وجود ضرر نتيجة دوره', dash(a.harmExists), a.harmExists === 'يوجد' ? 'error' : null)}
          {a.harmType && R('نوع الضرر', a.harmType)}
          {R('امتداد الخطر إلى الغير (م5/4)', dash(a.extends), a.extends === 'نعم' ? 'error' : null)}
          {a.extendsWho && R('إلى من يمتدّ', a.extendsWho)}
          {R('القدرة على التكيّف مع البرنامج', dash(a.adapt), a.adapt === 'نعم' ? 'success' : null)}
          {provide && R('توصية الجهة', provide, provide === 'توفير' ? 'success' : 'error')}
          {Array.isArray(rc.reasons) && rc.reasons.length > 0 && Block('أسباب التوصية', rc.reasons.join(' · '))}
        </Grp>
        <Grp n="٤" title="أنواع الحماية والمدة المقترحة من الجهة">
          {Block('الأنواع المقترحة', Array.isArray(rc.types) && rc.types.length ? rc.types.join(' · ') : '—')}
          {R('الحلول البديلة', dash(rc.alternatives))}
          {R('مدة الحماية المقترحة', rc.duration === 'مدة أخرى' ? dash(rc.durationNote) : dash(rc.duration))}
        </Grp>
        <div className="ro-field" style={{ marginTop: 16 }}><span className="row" style={{ gap: 8 }}><I name="account_balance" size={17} color="var(--color-primary)" /><span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-strong)' }}>{dash(detail && detail.entity)}</span></span><Tag tone="neutral" size="sm" iconLeft={<I name="lock_clock" size={13} />}>وردت ورقياً</Tag></div>
      </div>)}
    </Card>
  );
}

function UnifiedForm({ cfg, task, back, onSubmit }) {
  const [f, setF] = useState({ kama: '', rec: '', partial: '', rej: {}, rejNote: {}, dur: '', durText: '', types: {}, subdur: {}, otherText: '' });
  const [revealed, setRevealed] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (grp, k) => setF((s) => ({ ...s, [grp]: { ...s[grp], [k]: !s[grp][k] } }));
  const Seg = (label, key, opts) => (
    <div className="fld"><span className="fld-label">{label}</span>
      <div className="chips">{opts.map((o) => <button key={o} className={'chip sm' + (f[key] === o ? ' on' : '')} onClick={() => set(key, o)}>{o}</button>)}</div></div>
  );
  const accept = f.rec === 'قبول كلي' || f.rec === 'قبول جزئي';
  // بيانات الحالة الحقيقيّة الموروثة من الطلب (لا قيمٌ ثابتة) — تُعرض للقراءة فقط.
  const d = task.detail || {};
  const fmtDate = (iso) => { if (!iso) return '—'; const dt = new Date(iso); return `${dt.getDate()} / ${dt.getMonth() + 1} / ${dt.getFullYear()}م`; };
  const CASE = [
    ['رقم الطلب', task.secret, 'tag'], ['تاريخ الوارد', fmtDate(d.createdAt)],
    ['الجهة مقدّمة الطلب', d.entity || '—'], ['رقم القضية', d.caseNo || '—'],
    ['نوع الجريمة / الواقعة', d.crime || '—'], ['صفة مقدّم الطلب', d.applicantRole || task.cat],
    ['الفئة', task.cat], ['سبق التقديم للجهة المختصة', d.priorSubmit ? 'نعم' : 'لا'],
  ];
  // حقول التقييم المهيكلة — تُعرَض فقط إن كانت مخزّنة فعلاً (مسار توصية الجهة).
  const a = d.assess || {};
  if (a.threatExists) CASE.push(['وجود خطر يهدّد طالب الحماية', a.threatExists, a.threatExists === 'يوجد' ? 'risk' : null]);
  if (a.riskLevel) CASE.push(['مستوى الخطر', a.riskLevel, 'risk']);
  if (a.harmExists) CASE.push(['وجود ضرر نتيجة دوره', a.harmExists, a.harmExists === 'يوجد' ? 'risk' : null]);
  if (a.extends) CASE.push(['امتداد الخطر إلى الغير (م5/4)', a.extends, a.extends === 'نعم' ? 'risk' : null]);
  if (a.health) CASE.push(['الحالة الصحية', a.health]);
  if (a.criminal) CASE.push(['التاريخ الجنائي', a.criminal === 'يوجد' ? (a.criminalNote || 'يوجد') : 'لا يوجد']);
  return (<div>
    <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للمهام</button>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
      <div className="row"><SecretCode code={task.secret} canReveal={true} onReveal={() => setRevealed(true)} /><Tag tone="info" size="sm">{task.cat}</Tag>
        <Tag tone={cfg.short === 'دارس' ? 'info' : 'warning'} size="sm">{cfg.kind}</Tag>
        <TrackPill track={task.track} />
        {task.foreign && <Tag tone="info" size="sm" iconLeft={<I name="public" size={13} fill />}>أجنبي · م6</Tag>}</div>
      <DeadlineTimer label="استقبال المخرَج" totalDays={1} daysElapsed={0} articleRef="يوم عمل · م10" />
    </div>
    {revealed &&
      <InlineAlert kind="info" title="كشف الهوية مُسجَّل في التدقيق" style={{ marginBottom: 12 }}>
        كُشِفت هوية طالب الحماية بواسطة {cfg.person.name} — سُجِّل حدث الكشف (المستخدم، الطلب، الوقت) في سجلّ التدقيق وفق مبدأ الحاجة إلى المعرفة.
      </InlineAlert>}
    <InlineAlert kind="warning" title="عمل مستقلّ ومعزول">أنت أحد <b>{task.peers} {cfg.peers}</b> على هذا الطلب. تملأ {cfg.output} باستقلال تامّ — لا تُكشف مدخلاتك لأقرانك ولا مدخلاتهم لك، ولا ترى {cfg.short === 'دارس' ? 'أيّ تقييم' : 'أيّ دراسة'}. يُجمَّع الكل آلياً للمجلس.</InlineAlert>
    {task.foreign && (
      <Card className="card pad" style={{ marginTop: 16, borderColor: 'var(--color-info)', background: 'var(--info-10)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <b style={{ color: 'var(--text-strong)' }}><I name="public" size={18} color="var(--color-info)" fill style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />المسار الأجنبي — طلب مساعدة قانونية (المادة السادسة)</b>
          <Tag tone="neutral" size="sm" iconLeft={<I name="handshake" size={13} />}>معاملة بالمثل</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
          {[['الدولة الطالبة', task.foreign.country], ['السلطة الأجنبية', task.foreign.authority], ['المرجع الأجنبي', task.foreign.foreignRef], ['أساس المعاملة بالمثل', task.foreign.basis], ['الموقع في المملكة', task.foreign.city], ['أُحيل عبر', task.foreign.committee]].map(([l, v], i) => (
            <div key={i} className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>{l}</span><span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-strong)' }}>{v}</span></div>))}
        </div>
        <p className="muted" style={{ margin: '12px 0 0', lineHeight: 1.65 }}><I name="info" size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />يُدرَس ويُقيَّم ويُصوّت عليه كأيّ طلب (الأغلبية وترجيح الرئيس)، ثمّ يبتّ فيه النائب العام بناءً على توصية المركز ومبدأ المعاملة بالمثل.</p>
      </Card>
    )}
    <Card className="card pad" style={{ marginTop: 16, marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <b style={{ color: 'var(--text-strong)' }}><I name="folder_shared" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />معلومات الحالة</b>
        <Tag tone="neutral" size="sm" iconLeft={<I name="sync" size={13} />}>مجلوبة آلياً · للقراءة</Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
        {CASE.map(([l, v, kind], i) => (
          <div key={i} className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>{l}</span>
            {kind === 'tag' ? <span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 13 }}>{v}</span>
              : kind === 'risk' ? <Tag tone="error" size="sm">{v}</Tag>
              : <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-strong)' }}>{v}</span>}
          </div>))}
      </div>
      <div className="fld" style={{ marginTop: 12, marginBottom: 0 }}><span className="fld-label">المسوّغات وسبب الطلب <span className="muted" style={{ fontWeight: 400 }}>· مجلوب</span></span>
        <div className="ro-field" style={{ display: 'block', lineHeight: 1.7 }}>{d.reason || '—'}</div></div>
    </Card>
    {d.recommendation && <AuthRec secret={task.secret} detail={d} />}
    <Card className="card pad">
      <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 14 }}><I name={cfg.formIcon} size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />{cfg.formTitle}</b>
      <InlineAlert kind="info" title="مجلوب آلياً" style={{ marginBottom: 12 }}>توصية الجهة المختصة والطلب المسبّب من طالب الحماية <b>مرفقان ومعروضان أعلاه آلياً</b> — لا حاجة لتأكيدهما يدوياً (العمل كلّه إلكتروني).</InlineAlert>
      <div className="fld"><span className="fld-label">بالاطّلاع على الطلب والتوصية المرافقة تبيّن الآتي</span><textarea value={f.kama} onChange={(e) => set('kama', e.target.value)} placeholder={'ملاحظات ' + cfg.label + ' بعد الاطّلاع…'} dir="auto" /></div>
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0 16px' }} />
      {Seg(cfg.recLabel, 'rec', ['قبول كلي', 'قبول جزئي', 'رفض الحماية'])}
      {f.rec === 'قبول جزئي' && (
        <div className="fld"><span className="fld-label">أسباب القبول الجزئي</span><textarea value={f.partial} onChange={(e) => set('partial', e.target.value)} placeholder="حدّد ما يُقبل وما يُستثنى ومسوّغاته…" dir="auto" /></div>
      )}
      {f.rec === 'رفض الحماية' && (
        <div className="fld"><span className="fld-label">أسباب رفض الحماية</span>
          <div style={{ display: 'grid', gap: 8 }}>{REJ.map((r) => (
            <div key={r.k}>
              <Chk on={!!f.rej[r.k]} label={r.t} onClick={() => toggle('rej', r.k)} />
              {r.note && f.rej[r.k] && <input value={f.rejNote[r.k] || ''} onChange={(e) => setF((s) => ({ ...s, rejNote: { ...s.rejNote, [r.k]: e.target.value } }))} placeholder="تفصيل…" dir="auto" style={{ marginTop: 6 }} />}
            </div>))}</div>
        </div>
      )}
      {accept && (<>
        {Seg('مدة الحماية المقترحة', 'dur', ['ثلاثون يوماً أو حتى انتهاء القضية', 'مدة محدّدة'])}
        {f.dur === 'مدة محدّدة' && <div className="fld" style={{ marginTop: -8 }}><input value={f.durText} onChange={(e) => set('durText', e.target.value)} placeholder="حدّد المدة…" dir="auto" /></div>}
        <div className="fld"><span className="fld-label">نوع الحماية المقترحة <span className="muted" style={{ fontWeight: 400 }}>· المادة 14 (اختيار متعدّد · مقترح للمجلس)</span></span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
            {PTYPES.map((p, i) => (
              <Chk key={i} on={!!f.types['t' + i]} label={p.t} onClick={() => toggle('types', 't' + i)}>
                {p.dur && f.types['t' + i] && (
                  <span className="chips" onClick={(e) => e.stopPropagation()}>
                    {['مؤقت', 'دائم'].map((d) => <button key={d} className={'chip sm' + (f.subdur['t' + i] === d ? ' on' : '')} onClick={() => set('subdur', { ...f.subdur, ['t' + i]: d })}>{d}</button>)}
                  </span>)}
              </Chk>))}
            <Chk on={!!f.types.other} label="أخرى" onClick={() => toggle('types', 'other')} />
          </div>
          {f.types.other && <input value={f.otherText} onChange={(e) => set('otherText', e.target.value)} placeholder="نوع حماية آخر…" dir="auto" style={{ marginTop: 8 }} />}
          <p className="muted" style={{ margin: '8px 2px 0' }}><I name="info" size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 3 }} />هذه أنواع <b>مقترحة</b> فقط؛ القرار النهائي بأنواع الحماية للمجلس.</p>
        </div>
      </>)}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0 14px' }} />
      <div className="ro-field"><span className="row" style={{ gap: 8 }}><I name="verified_user" size={18} color="var(--color-success)" fill /><span><span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-strong)' }}>{cfg.signer}: {cfg.person.name} — يُوثّق آلياً عبر نفاذ</span><span className="muted" style={{ display: 'block', fontSize: 12 }}>توقيع إلكتروني + ختم زمني في سجل التدقيق</span></span></span>
        <Tag tone="success" size="sm" iconLeft={<I name="lock_clock" size={13} />}>موقّع رقمياً</Tag></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
        <button className="btn btn-ghost" onClick={back}>حفظ مسودة</button>
        <button className="btn btn-primary" disabled={!f.rec} onClick={() => onSubmit(task, {
          recommendation: f.rec,
          rejectReasons: REJ.filter((r) => f.rej[r.k]).map((r) => r.t + (f.rejNote[r.k] ? ' — ' + f.rejNote[r.k] : '')),
          proposedType: accept ? [
            ...PTYPES.map((p, i) => f.types['t' + i] ? p.t + (f.subdur['t' + i] ? ' (' + f.subdur['t' + i] + ')' : '') : null).filter(Boolean),
            ...(f.types.other && f.otherText ? [f.otherText] : []),
          ] : [],
          durationDays: accept && f.dur && f.dur !== 'مدة محدّدة' ? 30 : null,
          notes: [f.kama, f.partial && ('قبول جزئي: ' + f.partial), f.dur === 'مدة محدّدة' && f.durText && ('المدة: ' + f.durText)].filter(Boolean).join(' — '),
        })}>اعتماد وإرسال <I name="send" size={17} /></button>
      </div>
    </Card>
  </div>);
}

function Dashboard({ cfg, rows }) {
  const n = (fn) => rows.filter(fn).length;
  const stats = [
    { v: n((r) => r.status === 'new'), l: 'بانتظار ' + cfg.output, icon: 'pending_actions', tone: ['var(--warning-10)', 'var(--color-warning)'] },
    { v: n((r) => r.status === 'done'), l: 'مكتملة', icon: 'task_alt', tone: ['var(--green-10)', 'var(--color-primary)'] },
    { v: n((r) => r.foreign), l: 'أجنبي · م6', icon: 'public', tone: ['var(--info-10)', 'var(--color-info)'] },
    { v: rows.length, l: 'إجمالي المُسند إليّ', icon: 'folder_shared', tone: ['var(--info-10)', 'var(--color-info)'] },
  ];
  return (<div>
    <h2 className="h2">لوحة المتابعة</h2>
    <p className="lede">مهامّك أنت فقط. مبدأ الحاجة إلى المعرفة — لا اطّلاع على أعمال أقرانك، والتوزيع آليّ بالعبء.</p>
    <div className="stats">{stats.map((s, i) => (
      <Card key={i} className="card stat">
        <div className="stat-ico" style={{ background: s.tone[0], color: s.tone[1] }}><I name={s.icon} size={22} /></div>
        <div><div className="stat-v">{s.v}</div><div className="stat-l">{s.l}</div></div>
      </Card>))}</div>
    <Card className="card pad">
      <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 6 }}><I name="schedule" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />الالتزام بالميعاد النظامي</b>
      <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>يُستقبَل مخرَج {cfg.output} خلال <b>يوم عمل</b> من الإسناد، ضمن المظلّة النظامية <b>3 أيام</b> لاكتمال الدراسة والتقييم (المادة العاشرة). المتأخّر يُنبَّه عليه في الإشعارات.</p>
    </Card>
  </div>);
}

function Profile({ cfg }) {
  const rows = [['الاسم', cfg.person.name], ['الرقم الوظيفي', cfg.person.emp], ['الدور', cfg.label], ['الإدارة', 'إدارة البرنامج — الدراسة والتقييم'], ['نطاق العمل', cfg.output + ' الطلبات المُسندة إليّ'], ['المصادقة الثنائية (MFA)', 'مُفعّلة']];
  const perms = ['استقبال الطلبات المُسندة إليّ آلياً بالعبء', 'الاطّلاع على معلومات الحالة وتوصية الجهة (هوية محجوبة)', 'إعداد ' + cfg.output + ' وإبداء الرأي (قبول/رفض) واقتراح الأنواع', 'اعتماد المخرَج وإرساله موقّعاً عبر نفاذ', 'عرض الرمز السري وكشفه عند الحاجة (مُسجّل)'];
  const denied = [cfg.short === 'دارس' ? 'الاطّلاع على دراسات الدارسين الآخرين' : 'الاطّلاع على تقييمات المقيّمين الآخرين', cfg.short === 'دارس' ? 'الاطّلاع على أيّ تقييم' : 'الاطّلاع على أيّ دراسة', 'كشف هوية طالب الحماية', 'تعديل مخرَج بعد اعتماده'];
  return (<div>
    <h2 className="h2">الملف الشخصي</h2>
    <p className="lede">البيانات والصلاحيات ونطاق العمل. الوصول مقيّد بالدور ومُسجّل في التدقيق.</p>
    <Card className="card pad" style={{ marginBottom: 16 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{rows.map(([l, v], i) => <div className="ro-field" key={i}><span className="muted" style={{ fontSize: 12.5 }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}</div></Card>
    <Card className="card pad" style={{ marginBottom: 16 }}><b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 10 }}><I name="key" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />الصلاحيات</b><div style={{ display: 'grid', gap: 8 }}>{perms.map((p, i) => <div className="row" key={i} style={{ gap: 8 }}><I name="check_circle" size={18} color="var(--color-success)" fill /><span style={{ fontSize: 13.5 }}>{p}</span></div>)}</div></Card>
    <Card className="card pad"><b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 10 }}><I name="block" size={18} color="var(--color-error)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />خارج الصلاحية (عزل تامّ)</b><div style={{ display: 'grid', gap: 8 }}>{denied.map((p, i) => <div className="row" key={i} style={{ gap: 8 }}><I name="do_not_disturb_on" size={18} color="var(--color-error)" fill /><span style={{ fontSize: 13.5 }}>{p}</span></div>)}</div></Card>
  </div>);
}

const NT = { primary: ['var(--green-10)', 'var(--color-primary)'], warning: ['var(--warning-10)', 'var(--color-warning)'], info: ['var(--info-10)', 'var(--color-info)'], error: ['var(--error-10)', 'var(--color-error)'] };
function Notifs({ cfg, go }) {
  const base = []; // لا إشعارات مُلفّقة
  const [items, setItems] = useState(base);
  return (<div>
    <h2 className="h2">الإشعارات</h2>
    <p className="lede">تنبيهات الإسناد واقتراب المواعيد واعتماد مخرجاتك. تحفظ السرية بالرمز السري.</p>
    <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn btn-ghost" onClick={() => setItems((x) => x.map((n) => ({ ...n, unread: false })))}><I name="done_all" size={18} /> تعليم الكل كمقروء</button></div>
    <div style={{ display: 'grid', gap: 10 }}>{items.map((n, i) => { const [bg, fg] = NT[n.tone]; return (
      <div key={i} onClick={() => { setItems((x) => x.map((it, j) => j === i ? { ...it, unread: false } : it)); go && go(i === 1 ? 'messages' : 'tasks'); }} style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: n.unread ? 'var(--green-10)' : 'var(--surface-card)', alignItems: 'flex-start', cursor: 'pointer' }}>
        <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', background: bg, color: fg }}><I name={n.icon} size={20} fill /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{n.t}</div><div style={{ fontSize: 13, color: 'var(--text-body)', marginTop: 2 }}>{n.d}</div><div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{n.time}</div></div>
        {n.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />}
      </div>); })}</div>
  </div>);
}

const LEAD_MSG = { deputy: { t: 'نائب رئيس المركز' }, chair: { t: 'رئيس المركز' } };
const SEL_STYLE = { height: 44, padding: '0 13px', border: '1px solid var(--field-border)', borderRadius: 'var(--radius-md)', background: 'var(--field-bg)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)', fontSize: 14, width: '100%' };
function MessagesScreen({ cfg, rows }) {
  const firstNew = rows.find((r) => r.status === 'new') || rows[0] || { secret: '—' };
  const [threads, setThreads] = useState([
    { id: 'dl', secret: firstNew.secret, with: 'deputy', unread: 1, msgs: [
      { from: 'lead', t: 'يقترب ميعاد تسليم ' + cfg.output + ' للطلب ' + firstNew.secret + ' — يوم عمل ضمن مظلّة 3 أيام (المادة 10). يُرجى إتمام الاعتماد في الوقت.', when: 'اليوم 08:30' },
    ] },
  ]);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [cReq, setCReq] = useState('');
  const [cWith, setCWith] = useState('');
  const cur = threads.find((t) => t.id === sel);
  const send = () => {
    if (!draft.trim() || !cur) return;
    setThreads((ts) => ts.map((t) => t.id === sel ? { ...t, msgs: [...t.msgs, { from: 'me', t: draft.trim(), when: 'الآن' }] } : t));
    setDraft('');
  };
  const start = () => {
    if (!cReq || !cWith) return;
    const ex = threads.find((t) => t.secret === cReq && t.with === cWith);
    if (ex) { setSel(ex.id); setComposing(false); setCReq(''); setCWith(''); return; }
    const id = 'n' + cReq + cWith;
    setThreads((ts) => [{ id, secret: cReq, with: cWith, unread: 0, msgs: [] }, ...ts]);
    setSel(id); setComposing(false); setCReq(''); setCWith('');
  };
  const bub = (me) => ({ maxWidth: '80%', background: me ? 'var(--color-primary)' : 'var(--surface-card)', color: me ? '#fff' : 'var(--text-strong)', border: me ? 'none' : '1px solid var(--border-subtle)', padding: '10px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.7 });
  if (cur) {
    const L = LEAD_MSG[cur.with];
    return (<div>
      <button className="link" onClick={() => setSel(null)} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للمراسلات</button>
      <Card className="card">
        <div className="row" style={{ justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="row" style={{ gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-subtle)', display: 'grid', placeItems: 'center' }}><I name="shield_person" size={20} color="var(--color-primary)" /></div>
            <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>{L.t}</div><div className="muted" style={{ fontSize: 11.5 }}>بشأن الطلب <span className="mono">{cur.secret}</span> · قناة مؤمّنة</div></div></div>
          <Tag tone="info" size="sm" iconLeft={<I name="lock" size={13} />}>مؤمّنة</Tag>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--surface-page)', minHeight: 180 }}>
          {cur.msgs.length === 0 && <p className="muted" style={{ textAlign: 'center', margin: 'auto', fontSize: 12.5 }}>لا رسائل بعد — اكتب أول رسالة.</p>}
          {cur.msgs.map((m, i) => (<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'me' ? 'flex-start' : 'flex-end' }}>
            <div style={bub(m.from === 'me')}>{m.t}</div>
            <span className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>{m.from === 'me' ? cfg.label : L.t} · {m.when}</span>
          </div>))}
        </div>
        <div className="row" style={{ gap: 9, padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالة…" dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} style={{ flex: 1 }} />
          <button className="btn btn-primary" disabled={!draft.trim()} onClick={send}><I name="send" size={17} /></button>
        </div>
      </Card>
    </div>);
  }
  return (<div>
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div><h2 className="h2">المراسلات</h2><p className="lede">تواصل مؤمّن مع قيادة المركز (نائب/رئيس المركز) بشأن مهامّك — تصلك تذكيرات اقتراب الميعاد ولك الرد وبدء مراسلة. كل رسالة مسجّلة في التدقيق بالرمز السري.</p></div>
      {!composing && <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setComposing(true)}><I name="add_comment" size={18} /> بدء مراسلة</button>}
    </div>
    {composing && <Card className="card pad" style={{ marginBottom: 16 }}>
      <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 10 }}>بدء مراسلة مع القيادة</b>
      <div className="fld"><span className="fld-label">بشأن الطلب</span><select value={cReq} onChange={(e) => setCReq(e.target.value)} style={SEL_STYLE}><option value="">اختر الطلب النشط…</option>{rows.filter((r) => r.status === 'new').map((r) => <option key={r.secret} value={r.secret}>{r.secret} — {r.cat}</option>)}</select></div>
      <p className="muted" style={{ margin: '-8px 2px 14px', fontSize: 11.5 }}><I name="lock" size={13} style={{ verticalAlign: 'middle' }} /> الطلبات قيد الدراسة/التقييم فقط؛ المكتملة لا تُفتح لها مراسلة. كل مراسلة معزولة بطلبها ولا تتداخل مع غيرها.</p>
      <div className="fld" style={{ marginBottom: 0 }}><span className="fld-label">إلى</span><div className="chips">{Object.entries(LEAD_MSG).map(([k, v]) => <button key={k} className={'chip' + (cWith === k ? ' on' : '')} onClick={() => setCWith(k)}>{v.t}</button>)}</div></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 14 }}><button className="btn btn-ghost" onClick={() => { setComposing(false); setCReq(''); setCWith(''); }}>إلغاء</button><button className="btn btn-primary" disabled={!cReq || !cWith} onClick={start}><I name="arrow_back" size={17} /> بدء المراسلة</button></div>
    </Card>}
    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>{threads.map((t) => { const L = LEAD_MSG[t.with]; const last = t.msgs[t.msgs.length - 1] || { t: 'مراسلة جديدة', when: '' }; return (
      <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, cursor: 'pointer' }} onClick={() => setSel(t.id)}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-subtle)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><I name="shield_person" size={20} color="var(--color-primary)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div className="row" style={{ justifyContent: 'space-between', gap: 8 }}><span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-strong)' }}>{L.t} <span className="mono muted" style={{ fontWeight: 400 }}>· {t.secret}</span></span><span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{last.when}</span></div><div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.t}</div></div>
        {t.unread > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: 'var(--color-error)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{t.unread}</span>}
      </div>); })}</div>
  </div>);
}

function App({ role, onSignOut = null, initialRows }) {
  const cfg = ROLE[role] || ROLE.studier;
  // القضايا الحقيقيّة فقط (under_study من Supabase) — لا حالات SEED مُلفّقة.
  const [rows, setRows] = useState(() => Array.isArray(initialRows) ? initialRows : []);
  const [active, setActive] = useState('tasks');
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const go = (id) => { setActive(id); setSel(null); setOpen(false); };
  const onSubmit = async (task, payload) => {
    // الحالات الفعليّة: اكتب مخرَج المؤلّف عبر الـRPC (عزل صفّيّ + ختم زمنيّ + تدقيق).
    if (task.real && task.caseId && payload) {
      const fn = role === 'evaluator' ? submitAssessment : submitStudy;
      const res = await fn(task.caseId, payload);
      if (!res.ok) { setToast('تعذّر الإرسال: ' + res.error); setTimeout(() => setToast(''), 4200); return; }
    }
    setRows((rs) => rs.map((r) => r.secret === task.secret ? { ...r, status: 'done' } : r));
    setToast('اعتُمد ' + cfg.output + ' وأُرسل للتجميع الآلي — ' + task.secret); setSel(null);
    setTimeout(() => setToast(''), 3400);
  };
  const NAV = [
    { id: 'dashboard', t: 'لوحة المتابعة', icon: 'dashboard' },
    { id: 'tasks', t: 'المهام المُسندة', icon: 'assignment_ind', badge: rows.filter((r) => r.status === 'new').length || null },
    { id: 'messages', t: 'المراسلات', icon: 'forum' },
    { id: 'notifications', t: 'الإشعارات', icon: 'notifications', badge: 2 },
    { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' },
  ];
  const cur = NAV.find((n) => n.id === active) || NAV[0];
  let body;
  if (active === 'tasks') body = sel ? <UnifiedForm cfg={cfg} task={sel} back={() => setSel(null)} onSubmit={onSubmit} /> : <Tasks cfg={cfg} rows={rows} open={setSel} />;
  else if (active === 'dashboard') body = <Dashboard cfg={cfg} rows={rows} />;
  else if (active === 'messages') body = <MessagesScreen cfg={cfg} rows={rows} />;
  else if (active === 'notifications') body = <Notifs cfg={cfg} go={go} />;
  else body = <Profile cfg={cfg} />;
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand"><div className="brand-mark"><I name={cfg.brandIcon} size={22} fill color="#fff" /></div>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.2 }}>بوابة {cfg.label}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>الدراسة والتقييم · {cfg.brandSub}</div></div></div>
        <nav className="nav">{NAV.map((n) => (<button key={n.id} className={'nav-item' + (active === n.id ? ' on' : '')} onClick={() => go(n.id)}><I name={n.icon} size={20} /> <span>{n.t}</span>{n.badge && <span className="nav-badge">{n.badge}</span>}</button>))}</nav>
        <div className="acct">
          <p className="acct-lbl">الحساب المسجَّل دخوله</p>
          <div className="acct-card">
            <div className="avatar" style={{ width: 34, height: 34 }}><I name="person" size={19} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.person.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cfg.label} · {cfg.person.emp}</div>
            </div>
            <button className="link" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); }} title="خروج"><I name="logout" size={18} /></button>
          </div>
        </div>
        <div className="side-foot">عزل تامّ بين الأقران — كل {cfg.peerOne} يعمل مستقلاً؛ التجميع للمجلس آليّ منعاً للميل.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{sel ? cfg.formTitle : cur.t}</span>
          <span className="who"><Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag><div className="avatar"><I name="person" size={20} /></div><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{cfg.label}</span></span>
        </header>
        <main className="content">{body}</main>
      </div>
      {toast && <div style={{ position: 'fixed', insetInlineStart: 24, bottom: 24, zIndex: 60, background: 'var(--text-strong)', color: '#fff', padding: '12px 18px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}><I name="check_circle" size={18} color="var(--green-40)" fill /> {toast}</div>}
    </div>
  );
}

export function StudyEvalPortal({ role, onSignOut = null, initialRows }) {
  return <App role={role} onSignOut={onSignOut} initialRows={initialRows} />;
}
