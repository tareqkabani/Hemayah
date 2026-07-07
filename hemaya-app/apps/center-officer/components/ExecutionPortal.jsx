'use client';
/* ============================================================
   التنفيذ والتجديد — بوابة موظف المركز (منقول من البوابة.html)
   window→@hemaya/ui. مخزن التسليم HemayaHandoff محروسٌ للـSSR (بيانات SEED مؤقّتاً).
   ============================================================ */
import React, { useState, useRef } from "react";
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import { HemayaBus } from "./referral-bus";
import { HemayaHandoff } from "./execution-handoff";
import { execClient, refetchHandoffs } from "./execution-live";
import "./execution.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// ════════════════════════════════════════════════════════════
//  مصدر القرار يحكم كل تفرّعات الواجهة — إضافة مسار = سطر بيانات
//  SRC: مجلس (دائم/محدّد) · عاجل (مؤقّت ≤30 قابل للتجديد) · تظلّم
// ════════════════════════════════════════════════════════════
const SRC = {
  'مجلس':  { label: 'إدارة البرنامج', icon: 'gavel',          bg: 'var(--green-10)',  fg: 'var(--green-80)',   note: 'قرار المجلس بالأغلبية (م5)' },
  'عاجل':  { label: 'النائب العام',   icon: 'bolt',           bg: 'var(--warning-10)',fg: 'var(--warning-70)', note: 'تدبير مؤقّت عاجل (م8) — قابل للتجديد' },
  'تظلّم': { label: 'المكتب الفني',    icon: 'balance',        bg: 'var(--info-10)',   fg: 'var(--color-info)', note: 'قبول التظلّم — شمول مباشر (م10)' },
};

// قائمة التفعيل النظامية (لائحة م4/9 · م7 · م11 · م12 نظام)
const STEPS = [
  { id: 'doc',   t: 'توقيع وثيقة الحماية', d: 'حقوق والتزامات الطرفين موقّعة عبر نفاذ — تُفعَّل الحماية بعدها.', ref: 'لائحة م7 · م11 نظام',
    who: 'المشمول + المركز', inputs: ['قرار الشمول معتمَداً', 'هوية موثّقة عبر نفاذ', 'نصّ الوثيقة (الحقوق والالتزامات)'], output: 'وثيقة حماية موقّعة بعلامة مائية في ملف الحالة',
    subs: ['إصدار الوثيقة من القرار وأنواع الحماية', 'إرسالها للمشمول عبر بوابته', 'التوقيع الإلكتروني عبر نفاذ', 'حفظ النسخة الموقّعة المؤمّنة'] },
  { id: 'rec',   t: 'إنشاء سجل المشمول', d: 'بيانات المشمول وتفاصيل حمايته في السجل المؤمّن.', ref: 'لائحة م4/9',
    who: 'إدارة البرنامج', inputs: ['الوثيقة موقّعة', 'بيانات الهوية والفئة', 'أنواع الحماية المقرَّرة'], output: 'سجل مؤمّن مرتبط بالرمز السري',
    subs: ['إنشاء السجل وربطه بالرمز السري', 'إدخال تفاصيل الحماية والمدّة', 'تقييد الوصول حسب الصلاحية'] },
  { id: 'oblig', t: 'تحديد الالتزامات وتصنيف الأخطار', d: 'التزامات المشمول ومستوى الخطر المحسوب.', ref: 'لائحة م4/9 · م11',
    who: 'إدارة البرنامج + الإدارة الأمنية', inputs: ['تقييم الخطر', 'قائمة الالتزامات النظامية'], output: 'التزامات موثّقة + تصنيف خطر محسوب',
    subs: ['تحديد التزامات المشمول', 'حساب تصنيف الخطر (منخفض/متوسط/عالٍ/حرج)', 'إقرار المشمول بالالتزامات'] },
  { id: 'coord', t: 'التنسيق مع الجهات ذات العلاقة', d: 'مخاطبة الجهات لتقديم سبل الحماية المقرّرة.', ref: 'لائحة م4/9',
    who: 'إدارة البرنامج', inputs: ['أنواع الحماية المقرَّرة', 'سجل المشمول'], output: 'تأكيد جاهزية الجهات لتقديم سبل الحماية',
    subs: ['تحديد الجهات حسب نوع الحماية', 'إصدار خطابات التنسيق المؤمّنة', 'تأكيد الجاهزية من كل جهة'] },
  { id: 'apply', t: 'تطبيق الحماية الأمنية', d: 'إحالة للإدارة الأمنية (الداخلية/أمن الدولة) للتنفيذ الميداني.', ref: 'م12 نظام · لائحة م8/1',
    who: 'الإدارة الأمنية', inputs: ['اكتمال التنسيق', 'سجل المشمول'], output: 'تفعيل ميداني للحماية + إسناد منسّق',
    subs: ['إسناد منسّق ميداني', 'بدء التنفيذ الميداني', 'تأكيد التفعيل وبدء المتابعة'] },
];

const BENEF = []; // لا مشمولين مُلفّقين — القضايا الحقيقيّة فقط من التسليم

const RISK_TONE = { 'حرج': 'error', 'عالٍ': 'warning', 'متوسط': 'info', 'منخفض': 'neutral' };
const ST_TONE = { 'نشط': 'success', 'قارب الانتهاء': 'warning', 'قيد التفعيل': 'info', 'مُنتهٍ': 'neutral' };

const SRC_FALLBACK = { icon: 'shield_person', bg: 'var(--surface-subtle)', fg: 'var(--text-secondary)' };
const SrcPill = ({ s }) => { const c = SRC[s] || SRC_FALLBACK; return <span className="src-pill" style={{ background: c.bg, color: c.fg }}><I name={c.icon} size={13} /> {s}</span>; };

// ═══════════════ لوحة المعلومات ═══════════════
function Dashboard({ openB, go }) {
  const [, hb] = useState(0);
  React.useEffect(() => { const h = () => hb((n) => n + 1); window.addEventListener('hemaya-handoff', h); window.addEventListener('storage', h); return () => { window.removeEventListener('hemaya-handoff', h); window.removeEventListener('storage', h); }; }, []);
  const HHx = HemayaHandoff ? HemayaHandoff.list().filter((h) => !BENEF.some((b) => b.secret === h.secret)) : [];
  const active = BENEF.filter((b) => b.status === 'نشط').length + HHx.filter((h) => h.status === 'active').length;
  const onboarding = BENEF.filter((b) => b.status === 'قيد التفعيل').length + HHx.filter((h) => h.status === 'await-agreement').length;
  const ending = BENEF.filter((b) => b.temp && b.dayLeft <= 7);
  return (<div>
    <h2 className="h2">دورة حياة المشمولين</h2>
    <p className="lede">تنفيذ قرارات الشمول ومتابعتها — أيّاً كان مصدرها (المجلس · النائب العام · المكتب الفني) — في مسار تنفيذ واحد. التجديد يظهر للتدابير العاجلة المؤقّتة وحدها.</p>
    <div className="stats">
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--green-10)' }}><I name="verified_user" size={22} color="var(--color-primary)" fill /></div><div><div className="stat-v">{active}</div><div className="stat-l">حماية نشطة</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--info-10)' }}><I name="pending_actions" size={22} color="var(--color-info)" /></div><div><div className="stat-v">{onboarding}</div><div className="stat-l">قيد التفعيل</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--warning-10)' }}><I name="timer" size={22} color="var(--warning-70)" /></div><div><div className="stat-v">{ending.length}</div><div className="stat-l">تقارب نهاية المدّة</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--surface-subtle)' }}><I name="assessment" size={22} color="var(--text-secondary)" /></div><div><div className="stat-v">{BENEF.length}</div><div className="stat-l">إجمالي تحت المتابعة</div></div></Card>
    </div>

    {ending.length > 0 && (
      <Card className="card pad" style={{ marginBottom: 20, borderColor: 'var(--warning-50)' }}>
        <p className="sec-h"><I name="notification_important" size={18} color="var(--warning-70)" /> تنبيه التجديد — تدابير عاجلة تقارب الانتهاء</p>
        {ending.map((b) => (
          <div key={b.secret} className="ro-field" style={{ marginBottom: 8 }}>
            <span className="row" style={{ gap: 8 }}><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{b.secret}</span><SrcPill s={b.src} /><Tag tone={RISK_TONE[b.risk]} size="sm">{b.risk}</Tag></span>
            <span className="row" style={{ gap: 10 }}><span className="muted">يتبقّى <b style={{ color: 'var(--warning-70)' }}>{b.dayLeft} أيام</b></span><button className="btn btn-primary btn-sm" onClick={() => openB(b)}><I name="event_repeat" size={16} /> معالجة التجديد</button></span>
          </div>
        ))}
        <p className="note warn" style={{ marginTop: 6, marginBottom: 0 }}><I name="gavel" size={15} /> التمديد قرارٌ للنائب العام (م8) — يرفع المركز طلب التمديد مُسنَداً بتقرير الإدارة الأمنية قبل انتهاء المدّة.</p>
      </Card>
    )}

    <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
      <thead><tr><th>الرمز السري</th><th>الفئة</th><th>المصدر</th><th>الحالة</th><th>الخطر</th><th>المدّة المتبقّية</th><th></th></tr></thead>
      <tbody>{BENEF.map((b) => (
        <tr key={b.secret} className="clk" onClick={() => openB(b)}>
          <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{b.secret}</td>
          <td><Tag tone="info" size="sm">{b.cat}</Tag></td>
          <td><SrcPill s={b.src} /></td>
          <td><Tag tone={ST_TONE[b.status]} size="sm">{b.status}</Tag></td>
          <td><Tag tone={RISK_TONE[b.risk]} size="sm">{b.risk}</Tag></td>
          <td className="muted">{b.temp ? <span style={{ color: b.dayLeft <= 7 ? 'var(--warning-70)' : 'inherit', fontWeight: b.dayLeft <= 7 ? 700 : 400 }}>{b.dayLeft} يوماً</span> : b.duration}</td>
          <td><I name="chevron_left" size={20} color="var(--text-secondary)" /></td>
        </tr>))}</tbody>
    </table></div></Card>
  </div>);
}

// خطوة تفعيل قابلة للفتح على تفاصيلها
function StepRow({ s, i, isDone, locked, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="step">
      <div className={'step-box' + (isDone ? ' done' : locked ? ' lock' : '')} onClick={() => !locked && onToggle()}>
        {isDone ? <I name="check" size={16} color="#fff" /> : locked ? <I name="lock" size={13} color="var(--text-secondary)" /> : <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{i + 1}</span>}
      </div>
      <div style={{ flex: 1 }}>
        <div className="step-head" onClick={() => !locked && setOpen(!open)} style={{ cursor: locked ? 'default' : 'pointer' }}>
          <div style={{ flex: 1 }}>
            <div className="step-t">{s.t}</div>
            <div className="step-d">{s.d}</div>
            {locked && <div className="step-ref" style={{ color: 'var(--text-secondary)' }}>يُفتح بعد إتمام الخطوة السابقة</div>}
          </div>
          {!locked && <I name="expand_more" size={20} color="var(--text-secondary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />}
        </div>
        {open && !locked && (
          <div className="step-detail">
            <div className="sd-meta">
              <div className="sd-cell"><span className="sd-k"><I name="badge" size={13} /> المسؤول</span><span className="sd-v">{s.who}</span></div>
              <div className="sd-cell"><span className="sd-k"><I name="output" size={13} /> المخرَج</span><span className="sd-v">{s.output}</span></div>
            </div>
            <div className="sd-block">
              <div className="sd-bt"><I name="rule" size={14} color="var(--color-primary)" /> المتطلبات</div>
              <ul className="sd-list">{s.inputs.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="sd-block">
              <div className="sd-bt"><I name="format_list_numbered" size={14} color="var(--color-primary)" /> الإجراءات الفرعية</div>
              <ul className="sd-list num">{s.subs.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="sd-foot">
              <span className="step-ref" style={{ margin: 0 }}>{s.ref}</span>
              <button className={'btn btn-sm ' + (isDone ? 'btn-ghost' : 'btn-primary')} onClick={onToggle}>
                {isDone ? <span className="row" style={{ gap: 6 }}><I name="undo" size={15} /> تراجع عن الإتمام</span> : <span className="row" style={{ gap: 6 }}><I name="check" size={15} /> تأكيد إتمام الخطوة</span>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ تفاصيل المشمول — التنفيذ والمتابعة ═══════════════
function Detail({ b, back }) {
  const [done, setDone] = useState(b.done);
  const [outcome, setOutcome] = useState('');
  const toggle = (id, i) => {
    if (done.includes(id)) { setDone(done.filter((x) => x !== id)); return; }
    // ترتيب: لا يُفعَّل إلا بعد سابقه
    if (i === 0 || done.includes(STEPS[i - 1].id)) setDone([...done, id]);
  };
  const allDone = STEPS.every((s) => done.includes(s.id));
  const pct = Math.round(done.length / STEPS.length * 100);
  const c = SRC[b.src];
  const timeColor = b.temp ? (b.dayLeft <= 7 ? 'var(--color-error)' : 'var(--warning-70)') : 'var(--color-primary)';
  const ringP = Math.round((b.dayTotal - b.dayLeft) / b.dayTotal * 100);

  return (<div>
    <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={17} /> رجوع</button>

    {/* ترويسة الحالة */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{b.secret}</span>
          <Tag tone="info" size="sm">{b.cat}</Tag><SrcPill s={b.src} /><Tag tone={ST_TONE[b.status]} size="sm">{b.status}</Tag>
        </div>
        <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
      </div>
      <p className="note info" style={{ marginTop: 14, marginBottom: 0 }}><I name={c.icon} size={15} /> مصدر القرار: <b>{c.label}</b> — {c.note}.</p>
    </Card>

    {/* أنواع الحماية المقرَّرة + عدّاد المدّة */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <p className="sec-h"><I name="shield" size={18} color="var(--color-primary)" /> أنواع الحماية المقرَّرة (م14)</p>
      <div className="types-grid">{b.types.map((t) => <span key={t} className="type-tag"><I name="check_circle" size={14} fill /> {t}</span>)}</div>
      <div className="timer" style={{ color: timeColor, marginTop: 16, background: 'var(--surface-subtle)', borderColor: 'var(--border-subtle)' }}>
        <div className="timer-ring" style={{ '--p': ringP }}><span>{b.temp ? b.dayLeft : '∞'}</span></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{b.temp ? `تدبير مؤقّت — يتبقّى ${b.dayLeft} يوماً من ${b.dayTotal}` : `مدّة الحماية: ${b.duration}`}</div>
          <div className="muted" style={{ marginTop: 2 }}>{b.start !== '—' ? `من ${b.start} إلى ${b.end}` : 'تُحدَّد بعد إتمام التفعيل'}</div>
        </div>
        {b.temp && b.dayLeft <= 7 && <Tag tone="warning" size="sm" iconLeft={<I name="event_repeat" size={13} />}>يستدعي تجديداً</Tag>}
      </div>
    </Card>

    {/* تدابير م1٣ — الإحالة للجهات */}
    <MeasureDispatch b={b} />

    {/* أ) التفعيل — قائمة المهام */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <p className="sec-h" style={{ margin: 0 }}><I name="checklist" size={18} color="var(--color-primary)" /> التفعيل (Onboarding)</p>
        <Tag tone={allDone ? 'success' : 'info'} size="sm">{pct}%</Tag>
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 6 }}>خطوات نظامية متسلسلة — تُفعَّل الحماية بعد توقيع الوثيقة (لا يُفتح إجراء قبل إتمام سابقه).</p>
      {STEPS.map((s, i) => {
        const isDone = done.includes(s.id);
        const locked = !isDone && i > 0 && !done.includes(STEPS[i - 1].id);
        return <StepRow key={s.id} s={s} i={i} isDone={isDone} locked={locked} onToggle={() => toggle(s.id, i)} />;
      })}
      {allDone && <p className="note info" style={{ marginTop: 12, marginBottom: 0 }}><I name="task_alt" size={15} /> اكتمل التفعيل — المشمول في حماية نشطة وتحت المتابعة الدورية.</p>}
    </Card>

    {/* الإدارة الأمنية */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <p className="sec-h"><I name="security" size={18} color="var(--color-primary)" /> الإدارة الأمنية المنفّذة (م12)</p>
      <div className="ro-field" style={{ marginBottom: 8 }}><span className="muted">الجهة</span><b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>{b.sec.unit}</b></div>
      <div className="ro-field" style={{ marginBottom: 8 }}><span className="muted">منسّق التنفيذ</span><span style={{ fontSize: 13.5 }}>{b.sec.officer}</span></div>
      <div className="ro-field"><span className="muted">قناة التواصل</span><span className="row" style={{ gap: 6 }}><I name="lock" size={14} color="var(--color-primary)" /><span style={{ fontSize: 13.5 }}>{b.sec.contact}</span></span></div>
    </Card>

    {/* ب) المتابعة الدورية */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <p className="sec-h"><I name="monitoring" size={18} color="var(--color-primary)" /> المتابعة الدورية (لائحة م8)</p>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="muted">إعادة تقييم الأخطار: <b style={{ color: 'var(--text-strong)' }}>{b.assess.when}</b> · التالي: {b.assess.next}</span>
        <Tag tone={RISK_TONE[b.assess.level]} size="sm" iconLeft={<I name="speed" size={13} />}>الخطر: {b.assess.level}</Tag>
      </div>
      {b.reports.length ? b.reports.map((r, idx) => (
        <div className="rpt" key={idx}>
          <div className="rpt-ico"><I name={r.ok ? 'fact_check' : 'report' } size={18} color={r.ok ? 'var(--color-info)' : 'var(--warning-70)'} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6 }}>{r.t}</div><div className="muted" style={{ marginTop: 4 }}>{r.by} · {r.when}</div></div>
        </div>
      )) : <p className="muted" style={{ margin: 0 }}>لا تقارير بعد — تبدأ المتابعة بعد إتمام التفعيل.</p>}
    </Card>

    {/* التجديد — للمؤقّت العاجل فقط */}
    {b.temp && (
      <Card className="card pad" style={{ marginBottom: 16, borderColor: b.dayLeft <= 7 ? 'var(--warning-50)' : 'var(--border-subtle)' }}>
        <p className="sec-h"><I name="event_repeat" size={18} color="var(--warning-70)" /> تجديد التدبير العاجل (م8)</p>
        <p className="note warn" style={{ marginBottom: 14 }}><I name="info" size={15} /> التدبير العاجل مؤقّت (≤30 يوماً). تمديده قرارٌ للنائب العام — يرفع المركز الطلب مُسنَداً بأحدث تقرير للإدارة الأمنية قبل انتهاء المدّة.</p>
        <div className="ro-field" style={{ marginBottom: 14 }}>
          <span className="muted">سند التمديد</span>
          <span className="row" style={{ gap: 6 }}><I name="description" size={15} color="var(--color-info)" /><span style={{ fontSize: 13 }}>تقرير {b.assess.when} — يوصي بالتمديد</span></span>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost btn-sm"><I name="visibility" size={16} /> مراجعة الملف</button>
          <button className="btn btn-primary"><I name="send" size={17} /> رفع طلب التمديد للنائب العام</button>
        </div>
      </Card>
    )}

    {/* ج) نتائج المتابعة — استمرار/تعديل/إنهاء */}
    <Card className="card pad">
      <p className="sec-h"><I name="rule_settings" size={18} color="var(--color-primary)" /> نتيجة المتابعة — قرار إدارة البرنامج (م18)</p>
      <p className="muted" style={{ marginTop: 0 }}>بناءً على التقييم: الاستمرار، أو تعديل نوع الحماية، أو إنهاء الانضمام — مع إشعار المشمول والجهة قبل (30) يوماً وحقّ التظلّم.</p>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={outcome === 'cont' ? 'on' : ''} onClick={() => setOutcome('cont')}>استمرار</button>
        <button className={outcome === 'mod' ? 'on warn' : ''} onClick={() => setOutcome('mod')}>تعديل النوع</button>
        <button className={outcome === 'end' ? 'on danger' : ''} onClick={() => setOutcome('end')}>إنهاء الانضمام</button>
      </div>
      {outcome === 'cont' && <p className="note info" style={{ marginBottom: 14 }}><I name="check_circle" size={15} /> تستمرّ الحماية بأنواعها الحالية ما دامت مسوّغاتها قائمة (م19).</p>}
      {outcome === 'mod' && <p className="note warn" style={{ marginBottom: 14 }}><I name="tune" size={15} /> تعديل أنواع الحماية وفق تغيّر الخطر — يُشعَر المشمول والجهة قبل (30) يوماً، وله التظلّم أمام النائب العام (م18/م10).</p>}
      {outcome === 'end' && <p className="note warn" style={{ marginBottom: 14 }}><I name="cancel" size={15} /> إنهاء الانضمام (القسم 9) — بانتفاء المسوّغات أو الإخلال بالالتزامات. إشعار مسبَّب قبل (30) يوماً وحقّ التظلّم.</p>}
      <div className="fld">
        <label className="fld-label">مسوّغات القرار</label>
        <textarea placeholder="تُوثَّق المسوّغات وتُرفق بقرار الاستمرار/التعديل/الإنهاء…"></textarea>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-primary" disabled={!outcome}><I name="verified" size={17} /> اعتماد القرار وإشعار الأطراف</button>
      </div>
    </Card>
  </div>);
}

// ═══════════════ المشمولون ═══════════════
function Beneficiaries({ openB }) {
  const [, hb] = useState(0);
  React.useEffect(() => { const h = () => hb((n) => n + 1); window.addEventListener('hemaya-handoff', h); window.addEventListener('storage', h); return () => { window.removeEventListener('hemaya-handoff', h); window.removeEventListener('storage', h); }; }, []);
  const HH = HemayaHandoff;
  const TRACK_SRC = { council: 'مجلس', urgent: 'عاجل', grievance: 'تظلّم' };
  const extra = HH ? HH.list().filter((h) => h.status === 'active' && !BENEF.some((b) => b.secret === h.secret)).map((h) => ({ secret: h.secret, cat: h.cat, name: '—', src: TRACK_SRC[h.track] || (HH.TRACKS[h.track] || {}).label || 'تسليم', status: 'نشط', temp: !!h.temp, types: h.types || [], duration: h.temp ? '30 يوماً' : 'سنة', start: h.decidedAt, end: '—', dayLeft: h.temp ? 30 : 365, dayTotal: h.temp ? 30 : 365, risk: 'عالٍ', done: ['doc', 'rec'],
    sec: { unit: 'الإدارة الأمنية المختصّة مكانياً', officer: '—', contact: 'قناة مؤمّنة مع المشمول' },
    assess: { when: '—', next: 'بعد التفعيل', level: 'عالٍ' },
    reports: [] })) : [];
  const list = [...extra, ...BENEF];
  return (<div>
    <h2 className="h2">المشمولون تحت الحماية</h2>
    <p className="lede">جميع المشمولين في البرنامج وتفاصيل تنفيذ حمايتهم ومتابعتها.</p>
    <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
      <thead><tr><th>الرمز السري</th><th>الفئة</th><th>المصدر</th><th>أنواع الحماية</th><th>الحالة</th><th>المدّة</th><th></th></tr></thead>
      <tbody>{list.map((b) => (
        <tr key={b.secret} className="clk" onClick={() => openB(b)}>
          <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{b.secret}</td>
          <td><Tag tone="info" size="sm">{b.cat}</Tag></td>
          <td><SrcPill s={b.src} /></td>
          <td className="muted">{b.types.length} أنواع</td>
          <td><Tag tone={ST_TONE[b.status]} size="sm">{b.status}</Tag></td>
          <td className="muted">{b.temp ? `${b.dayLeft} يوماً` : b.duration}</td>
          <td><I name="chevron_left" size={20} color="var(--text-secondary)" /></td>
        </tr>))}</tbody>
    </table></div></Card>
  </div>);
}

// ═══════════════ الإشعارات ═══════════════
// إشعارات التنفيذ تُشتقّ حيّاً من HemayaHandoff (لا مصفوفة تجريبيّة مُلفّقة).
function Notifs() {
  const HH = HemayaHandoff;
  const hNotifs = HH ? HH.list().slice(0, 8).map((h) => ({ ico: 'move_to_inbox', tone: 'var(--color-primary)', bg: 'var(--green-10)', t: 'وارد للتنفيذ: ' + ((HH.TRACKS[h.track] || {}).label || '') + ' · ' + h.secret + ' — ' + (h.status === 'active' ? 'مُفعّل تحت الحماية.' : 'بانتظار توقيع اتفاقية الحماية.'), when: h.decidedAt })) : [];
  const all = hNotifs;
  return (<div>
    <h2 className="h2">الإشعارات</h2>
    <p className="lede">مستجدّات التنفيذ والتجديد والمتابعة.</p>
    <Card className="card pad">{all.map((n, i) => (
      <div className="rpt" key={i} style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="rpt-ico" style={{ background: n.bg }}><I name={n.ico} size={18} color={n.tone} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6 }}>{n.t}</div><div className="muted" style={{ marginTop: 4 }}>{n.when}</div></div>
      </div>
    ))}</Card>
  </div>);
}

// ═══════════════ الملف الشخصي ═══════════════
function Profile() {
  const rows = [
    ['الاسم', 'أخصائي تنفيذ الحماية'],
    ['الإدارة', 'إدارة برنامج الحماية — مركز الحماية'],
    ['الصلاحية', 'تنفيذ القرارات · التنسيق الأمني · المتابعة الدورية · رفع طلبات التجديد'],
    ['الدخول', 'عبر نفاذ الوطني الموحّد'],
  ];
  return (<div>
    <h2 className="h2">الملف الشخصي</h2>
    <p className="lede">حسابك وصلاحياتك في مسار التنفيذ والتجديد.</p>
    <Card className="card pad" style={{ maxWidth: 560 }}>
      <div className="row" style={{ gap: 14, marginBottom: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)', background: 'var(--green-10)', display: 'grid', placeItems: 'center' }}><I name="engineering" size={28} color="var(--color-primary)" fill /></div>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>أخصائي تنفيذ الحماية</div><div className="muted">إدارة برنامج الحماية</div></div>
      </div>
      {rows.map(([k, v]) => <div className="ro-field" key={k} style={{ marginBottom: 8 }}><span className="muted">{k}</span><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)', textAlign: 'end', maxWidth: 360 }}>{v}</span></div>)}
    </Card>
  </div>);
}

// ═══════════════ ناقل الإحالات: تدابير م14 → الجهات المنفّذة ═══════════════
const { M13, AUTH, STATUS } = HemayaBus;
// بذر إحالة قانونية تجريبية (القسم الداخلي) — مرّة واحدة
HemayaBus.seed([]); // لا إحالة قانونية مُلفّقة
const AUTH_GROUPS = [
  { key: 'health', items: ['psych', 'social', 'medical'] },
  { key: 'hr', items: ['transfer', 'alt', 'dismissal', 'housing', 'finance'] },
  { key: 'security', items: ['guard', 'secure', 'testify'] },
  { key: 'legal', items: ['legal'] },
];
const ST_TONES = { warning: ['var(--warning-10)', 'var(--warning-70)'], info: ['var(--info-10)', 'var(--color-info)'], success: ['var(--success-10)', 'var(--success-70)'] };
function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.new; const [bg, fg] = ST_TONES[s.tone] || ST_TONES.info;
  return <span className="pill" style={{ background: bg, color: fg }}>{s.ar}</span>;
}
function useBus() { const [, bump] = useState(0); React.useEffect(() => HemayaBus.subscribe(() => bump((n) => n + 1)), []); }

function MeasureDispatch({ b }) {
  useBus();
  const refs = HemayaBus.list({ caseRef: b.secret });
  const have = new Set(refs.map((r) => r.service));
  const [sel, setSel] = useState([]);
  const [note, setNote] = useState('');
  const toggle = (k) => setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  const dispatch = () => {
    sel.forEach((k) => HemayaBus.create({ caseRef: b.secret, name: b.secret, cat: b.cat, risk: b.risk, service: k, summary: note.trim() || (M13[k].ar + ' — ' + b.secret) }));
    setSel([]); setNote('');
  };
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <p className="sec-h"><I name="hub" size={18} color="var(--color-primary)" /> تدابير الحماية (م14) — الإحالة للجهات المنفّذة</p>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>اختر التدابير المقرّرة؛ تُصدَر إحالة لكل تدبير وتظهر حيّةً لدى الجهة المنفّذة، وتعود نتيجتها إلى «سجل الإحالات» أدناه.</p>
      {AUTH_GROUPS.map((g) => {
        const a = AUTH[g.key];
        return (
          <div key={g.key} style={{ marginBottom: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, color: a.color, marginBottom: 7 }}><I name={a.icon} size={15} /> {a.ar}</div>
            <div className="types-grid">
              {g.items.map((k) => {
                const dispatched = have.has(k); const on = sel.includes(k);
                return <button key={k} disabled={dispatched} onClick={() => toggle(k)} className="type-tag"
                  style={{ cursor: dispatched ? 'default' : 'pointer', opacity: dispatched ? 0.55 : 1, background: on ? 'var(--color-primary)' : 'var(--green-10)', color: on ? '#fff' : 'var(--green-80)', border: '1px solid ' + (on ? 'var(--color-primary)' : 'transparent') }}>
                  <I name={dispatched ? 'check_circle' : M13[k].icon} size={14} fill={dispatched} /> {M13[k].ar}{dispatched ? ' · مُحالة' : ''}
                </button>;
              })}
            </div>
          </div>
        );
      })}
      {sel.length > 0 && (
        <div className="fld" style={{ marginTop: 4 }}>
          <label className="fld-label">سبب/سياق الإحالة (يُرفق لكل إحالة)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="موجز يوضّح حاجة المشمول للتدبير…"></textarea>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={!sel.length} onClick={dispatch}><I name="send" size={17} /> إصدار {sel.length || ''} إحالة</button>
      </div>

      {refs.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px dashed var(--border-subtle)', paddingTop: 14 }}>
          <div className="sd-bt" style={{ marginBottom: 10 }}><I name="receipt_long" size={15} color="var(--color-primary)" /> سجل الإحالات ({refs.length})</div>
          {refs.map((r) => {
            const a = AUTH[r.authority] || {}; const m = M13[r.service] || {};
            return (
              <div key={r.id} className="rpt" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="rpt-ico" style={{ background: 'var(--surface-subtle)' }}><I name={m.icon || 'assignment'} size={18} color={a.color} /></div>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{m.ar} <span className="muted" style={{ fontWeight: 400 }}>· {a.short}</span></span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>{r.ref} · أُحيلت {r.referredAt}</div>
                  {r.result && <div className="note info" style={{ marginTop: 6 }}><I name="task_alt" size={14} /> {r.result}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ═══════════════ القسم القانوني الداخلي ═══════════════
function LegalCard({ r, persona }) {
  const [out, setOut] = useState(r.result || '');
  const [adv, setAdv] = useState((r.sched && r.sched.who) || '');
  const act = (status, patch, by) => HemayaBus.update(r.id, Object.assign({ status, _by: by }, patch), STATUS[status] ? STATUS[status].ar : '');
  return (
    <Card className="card pad" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 8 }}><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.caseRef}</span><Tag tone="info" size="sm">{r.cat}</Tag><Tag tone={(r.risk === 'عالٍ' || r.risk === 'حرج') ? 'warning' : 'neutral'} size="sm">{r.risk}</Tag></span>
        <StatusPill status={r.status} />
      </div>
      <p className="muted" style={{ marginTop: 10, marginBottom: 12 }}>{r.summary}</p>
      {r.status === 'new' && (persona === 'staff'
        ? <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary btn-sm" onClick={() => act('assigned', { assignee: 'مستشار قانوني' }, 'مستشار قانوني')}><I name="how_to_reg" size={16} /> استلام الإحالة</button></div>
        : <p className="note warn" style={{ margin: 0 }}><I name="hourglass_top" size={14} /> بانتظار استلام المستشار.</p>)}
      {r.status === 'assigned' && (persona === 'staff' ? (
        <div>
          <div className="fld"><label className="fld-label">جهة/مرجع الاستشارة</label><input value={adv} onChange={(e) => setAdv(e.target.value)} placeholder="المستشار أو المرجع القانوني" /></div>
          <div className="fld"><label className="fld-label">مخرَج الاستشارة القانونية</label><textarea value={out} onChange={(e) => setOut(e.target.value)} placeholder="ملخّص الرأي/المساعدة القانونية المقدّمة للمشمول…"></textarea></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary btn-sm" disabled={!out.trim()} onClick={() => act('review', { sched: { who: adv }, result: out }, 'مستشار قانوني')}><I name="send" size={16} /> رفع للاعتماد</button></div>
        </div>
      ) : <p className="note info" style={{ margin: 0 }}><I name="engineering" size={14} /> قيد المعالجة لدى المستشار.</p>)}
      {r.status === 'review' && (
        <div>
          {r.result && <p className="note info" style={{ marginBottom: 10 }}><I name="description" size={14} /> {r.result}</p>}
          {persona === 'manager'
            ? <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}><button className="btn btn-ghost btn-sm" onClick={() => act('assigned', {}, 'مدير القسم القانوني')}><I name="undo" size={15} /> إعادة للمستشار</button><button className="btn btn-primary btn-sm" onClick={() => act('done', {}, 'مدير القسم القانوني')}><I name="verified" size={16} /> اعتماد وإشعار المشمول</button></div>
            : <p className="note warn" style={{ margin: 0 }}><I name="hourglass_top" size={14} /> بانتظار اعتماد المدير.</p>}
        </div>
      )}
      {r.status === 'done' && <p className="note info" style={{ margin: 0 }}><I name="task_alt" size={14} /> اعتُمدت الاستشارة وأُشعِر المشمول.{r.result ? ' ' + r.result : ''}</p>}
    </Card>
  );
}
function LegalDesk() {
  useBus();
  const [persona, setPersona] = useState('staff');
  const refs = HemayaBus.list({ authority: 'legal' });
  const nNew = refs.filter((r) => r.status === 'new').length;
  const nRev = refs.filter((r) => r.status === 'review').length;
  const nDone = refs.filter((r) => r.status === 'done').length;
  return (<div>
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h2 className="h2">الاستشارات القانونية</h2>
        <p className="lede">قسم داخلي بالمركز يعالج طلبات الاستشارة والمساعدة القانونية المُحالة ضمن تدابير م14 — المستشار يعالج، والمدير يعتمد قبل إشعار المشمول.</p>
      </div>
      <div className="seg"><button className={persona === 'staff' ? 'on' : ''} onClick={() => setPersona('staff')}>المستشار</button><button className={persona === 'manager' ? 'on' : ''} onClick={() => setPersona('manager')}>المدير</button></div>
    </div>
    <div className="stats">
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--warning-10)' }}><I name="inbox" size={22} color="var(--warning-70)" /></div><div><div className="stat-v">{nNew}</div><div className="stat-l">واردة بانتظار الاستلام</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--info-10)' }}><I name="rate_review" size={22} color="var(--color-info)" /></div><div><div className="stat-v">{nRev}</div><div className="stat-l">بانتظار اعتماد المدير</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--green-10)' }}><I name="task_alt" size={22} color="var(--color-primary)" /></div><div><div className="stat-v">{nDone}</div><div className="stat-l">مكتملة ومُبلَّغة</div></div></Card>
    </div>
    {refs.length ? refs.map((r) => <LegalCard key={r.id} r={r} persona={persona} />)
      : <Card className="card pad"><p className="muted" style={{ margin: 0 }}>لا إحالات قانونية بعد — تظهر هنا فور إصدارها من ملف المشمول (تدابير م14).</p></Card>}
  </div>);
}

function Incoming() {
  const HH = HemayaHandoff;
  const [, bump] = useState(0);
  React.useEffect(() => { const h = () => bump((n) => n + 1); window.addEventListener('hemaya-handoff', h); window.addEventListener('storage', h); return () => { window.removeEventListener('hemaya-handoff', h); window.removeEventListener('storage', h); }; }, []);
  if (!HH) return <div><h2 className="h2">الوارِدون للتنفيذ</h2><p className="lede">ناقل التسليم غير محمّل.</p></div>;
  const items = HH.list();
  const TR = HH.TRACKS;
  const trackTone = { urgent: ['var(--error-10)', 'var(--color-error)'], foreign: ['var(--warning-10)', 'var(--warning-70)'], grievance: ['var(--info-10)', 'var(--color-info)'] };
  const pend = items.filter((i) => i.status === 'await-agreement').length;
  return (<div>
    <h2 className="h2">الوارِدون للتنفيذ</h2>
    <p className="lede">مشمولون صدرت قرارات قبولهم في المسارات الثلاثة (العاجل م8 · الأجنبي م6 · التظلّم م21) وأُحيلوا للتفعيل. يبدأ فريق التنفيذ بتوقيع اتفاقية الحماية (م11) ثم التفعيل والمتابعة — <b>{pend}</b> بانتظار التوقيع.</p>
    {items.length === 0 ? <Card className="card pad" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>لا وارد حالياً.</Card>
    : items.map((it) => { const t = TR[it.track] || {}; const tone = trackTone[it.track] || trackTone.grievance; const isActive = it.status === 'active'; return (
      <Card className="card pad" key={it.id} style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill" style={{ background: tone[0], color: tone[1] }}><I name={t.icon} size={13} fill /> {t.label} · {t.article}</span>
          <span className="mono" style={{ fontWeight: 700, letterSpacing: '.05em' }}>{it.secret}</span>
          <span className="pill" style={isActive ? { background: 'var(--green-10)', color: 'var(--green-80)', marginInlineStart: 'auto' } : { background: 'var(--warning-10)', color: 'var(--warning-70)', marginInlineStart: 'auto' }}><I name={isActive ? 'verified_user' : 'draw'} size={13} fill /> {isActive ? 'مُفعّل تحت الحماية' : 'بانتظار توقيع الاتفاقية'}</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7, margin: '10px 0 8px' }}>{it.note}</p>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>القرار: {it.decidedBy} · {it.decidedAt}{it.boardReviewDue != null ? ' · عرضٌ على المجلس خلال ' + it.boardReviewDue + ' يوماً (م8)' : ''}</div>
        {it.types && it.types.length ? <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{it.types.map((x) => <span className="pill" key={x} style={{ background: 'var(--green-10)', color: 'var(--green-80)' }}>{x}</span>)}</div> : null}
        {!isActive && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => HH.update(it.id, { status: 'active' })}><I name="draw" size={17} /> بدء التفعيل — توقيع اتفاقية الحماية</button>}
      </Card>); })}
  </div>);
}

const NAV = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' },
  { id: 'benef', t: 'المشمولون', icon: 'groups' },
  { id: 'incoming', t: 'الوارِدون للتنفيذ', icon: 'move_to_inbox', badge: (HemayaHandoff ? (HemayaHandoff.pending().length || null) : null) },
  { id: 'legal', t: 'الاستشارات القانونية', icon: 'balance' },
  { id: 'notifs', t: 'الإشعارات', icon: 'notifications' },
  { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' },
];

function App({ initialData }) {
  const supabase = useRef(execClient()).current;
  React.useEffect(() => {
    if (initialData && initialData.handoffs) HemayaHandoff.hydrate(initialData.handoffs);
    // مزامنة حيّة: أي قضيّةٍ يصدر قبولها تظهر في التنفيذ لحظيّاً (بلا إعادة تحميل).
    const apply = () => refetchHandoffs(supabase).then((h) => { if (Array.isArray(h)) HemayaHandoff.hydrate(h); }).catch(() => {});
    const ch = supabase.channel('exec-cases').on('postgres_changes', { event: '*', schema: 'public', table: 'protection_cases' }, apply).subscribe();
    return () => { try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  const [active, setActive] = useState('dashboard');
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(false);
  const go = (id) => { setActive(id); setSel(null); setOpen(false); };
  const openB = (b) => { setSel(b); window.scrollTo(0, 0); };
  const cur = NAV.find((n) => n.id === active);
  let body, title;
  if (sel) { body = <Detail b={sel} back={() => setSel(null)} />; title = 'تنفيذ ومتابعة المشمول'; }
  else if (active === 'benef') { body = <Beneficiaries openB={openB} />; title = cur.t; }
  else if (active === 'incoming') { body = <Incoming />; title = cur.t; }
  else if (active === 'legal') { body = <LegalDesk />; title = cur.t; }
  else if (active === 'notifs') { body = <Notifs />; title = cur.t; }
  else if (active === 'profile') { body = <Profile />; title = cur.t; }
  else { body = <Dashboard openB={openB} go={go} />; title = cur.t; }
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand"><div className="brand-mark"><I name="shield_person" size={22} fill color="#fff" /></div>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.2 }}>بوابة موظف المركز</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>التنفيذ والتجديد</div></div></div>
        <nav className="nav">{NAV.map((n) => (<button key={n.id} className={'nav-item' + (active === n.id && !sel ? ' on' : '')} onClick={() => go(n.id)}><I name={n.icon} size={20} /> <span>{n.t}</span>{n.badge && <span className="nav-badge">{n.badge}</span>}</button>))}</nav>
        <div className="side-foot">تنفيذ قرارات الشمول ومتابعتها — أيّاً كان مصدرها. التجديد للتدابير العاجلة (م8). مسجّل في التدقيق.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{title}</span>
          <span className="row" style={{ marginInlineStart: 'auto', gap: 8 }}><Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
            <button title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = 'http://localhost:3000/'; }).catch(() => { window.location.href = 'http://localhost:3000/'; }); }} style={{ width: 34, height: 34, flexShrink: 0, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}><I name="logout" size={18} /></button>
          </span>
        </header>
        <main className="content">{body}</main>
      </div>
    </div>
  );
}

export function ExecutionPortal({ initialData }) {
  // بوابة تأجيل حتى التركيب (المخازن تقرأ localStorage على العميل).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <App initialData={initialData} />;
}
