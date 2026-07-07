'use client';
/* ============================================================
   بوابة الإدارة الأمنية — التنفيذ الميداني والمتابعة (م12) + رفع توصيات دورة الحياة للمجلس (م18).
   منقول من «بوابة الإدارة الأمنية/البوابة.html». window/DS→@hemaya/ui، window.HemayaBus→referral-bus، scrollTo محروس.
   دوران: ضابط ميداني · مدير الإدارة. ربط حيّ بناقل الإحالات.
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import { HemayaBus } from "./referral-bus";
import { referralUpdate, raiseLifecycleReview, refetchReferrals } from "../lib/referral-actions";
import { createClient } from "@hemaya/supabase/src/browser";
import { StaffNotifications } from "./staff-feeds";
import "./security.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// ════════════════════════════════════════════════════════════
//  بوابة الإدارة الأمنية (وزارة الداخلية / أمن الدولة) — م12 نظام
//  المنفّذ الميداني: ينفّذ الحماية · يعدّ التقارير · يقيّم الخطر
//  · يوصي (استمرار/تعديل/إغلاق) → تُرفع للمجلس ليصوّت ويصدر القرار
//  دوران: ضابط ميداني (ينفّذ ويوصي) · مدير الإدارة (يعتمد ويرفع)
// ════════════════════════════════════════════════════════════
const ROLES = {
  officer: { t: 'ضابط ميداني', sub: 'تنفيذ ومتابعة ميدانية', icon: 'shield_person', scope: 'own',
             perm: 'تنفيذ التدبير · كتابة التقارير الدورية · صياغة التوصية' },
  manager: { t: 'مدير الإدارة الأمنية', sub: 'إسناد · اعتماد · رفع للمجلس', icon: 'shield_lock', scope: 'all',
             perm: 'إسناد الضباط · اعتماد التوصية ورفعها لمجلس المركز' },
};

const REGIONS = { RUH: 'الرياض', MAK: 'مكة المكرمة', MED: 'المدينة المنورة', QAS: 'القصيم', EAS: 'المنطقة الشرقية', ASR: 'عسير', TAB: 'تبوك', HAI: 'حائل', NOR: 'الحدود الشمالية', JAZ: 'جازان', NAJ: 'نجران', BAH: 'الباحة', JOF: 'الجوف' };
const regionDisp = (code) => { const n = REGIONS[code] || code; return (n.charAt(0) === 'ا' && n.charAt(1) === 'ل') ? n : 'منطقة ' + n; };
const OFFICERS = {
  o1: { name: 'العقيد عبدالعزيز الحربي', unit: 'وزارة الداخلية', short: 'ع. الحربي', region: 'RUH' },
  o2: { name: 'المقدّم سعد القحطاني', unit: 'أمن الدولة', short: 'س. القحطاني', region: 'EAS' },
};
const ME = 'o1'; // الضابط الحالي عند اختيار دور «ضابط ميداني»

const SRC = {
  'مجلس':  { label: 'إدارة البرنامج', icon: 'gavel',  bg: 'var(--green-10)',   fg: 'var(--green-80)',   note: 'قرار المجلس بالأغلبية (م5)' },
  'عاجل':  { label: 'النائب العام',   icon: 'bolt',   bg: 'var(--warning-10)', fg: 'var(--warning-70)', note: 'تدبير مؤقّت عاجل (م8)' },
  'تظلّم': { label: 'المكتب الفني',    icon: 'balance',bg: 'var(--info-10)',    fg: 'var(--color-info)', note: 'قبول التظلّم — شمول مباشر (م10)' },
};

// التدبير الأمني الميداني (م12 · لائحة م8/1)
const MEASURES = [
  { id: 'recv',  t: 'استلام أمر التنفيذ', d: 'استلام إحالة المركز وأنواع الحماية المقرَّرة وربطها بالرمز السري.', ref: 'لائحة م8/1',
    who: 'الإدارة الأمنية', output: 'أمر تنفيذ مستلَم ومُسنَد لمنسّق ميداني',
    inputs: ['إحالة المركز معتمَدة', 'أنواع الحماية المقرَّرة', 'تصنيف الخطر الأوّلي'],
    subs: ['التحقّق من اكتمال الإحالة وأنواع الحماية', 'إسناد منسّق ميداني حسب العبء والاختصاص', 'فتح ملف تنفيذ مؤمّن'] },
  { id: 'plan',  t: 'إعداد خطة التدبير الأمني', d: 'تحديد الإجراءات الميدانية المقابلة لكل نوع حماية مقرَّر.', ref: 'م12 · لائحة م8/1',
    who: 'المنسّق الميداني', output: 'خطة تدبير ميدانية معتمَدة',
    inputs: ['أمر التنفيذ المُسنَد', 'تقييم ميداني للموقع والخطر'],
    subs: ['معاينة الموقع وتقدير المخاطر', 'تحديد وسائل التأمين لكل نوع حماية', 'اعتماد الخطة من مدير الإدارة'] },
  { id: 'apply', t: 'تطبيق الحماية الأمنية ميدانياً', d: 'تنفيذ التدابير: تأمين · مرافقة · تأمين مسكن … حسب الخطة.', ref: 'م12 · لائحة م8/1',
    who: 'المنسّق الميداني', output: 'تدابير حماية مفعّلة على الأرض',
    inputs: ['الخطة معتمَدة', 'جاهزية الفرق والوسائل'],
    subs: ['تفعيل وسائل التأمين الميدانية', 'إبلاغ المشمول بآلية التواصل المؤمّن', 'توثيق بدء التنفيذ بالطابع الزمني'] },
  { id: 'activate', t: 'تأكيد التفعيل وبدء المتابعة', d: 'تأكيد الجاهزية الميدانية وإشعار المركز ببدء الحماية الفعلية.', ref: 'لائحة م8/2',
    who: 'الإدارة الأمنية', output: 'تأكيد تفعيل ميداني + بدء دورة التقارير',
    inputs: ['اكتمال تطبيق التدابير'],
    subs: ['تأكيد التفعيل الميداني', 'إشعار المركز بإغلاق خطوة «تطبيق الحماية»', 'جدولة أول تقرير دوري وإعادة تقييم'] },
];

const RKIND = {
  cont: { t: 'استمرار', tone: 'success', icon: 'check_circle', seg: '',       note: 'استمرار الحماية بأنواعها الحالية — الخطر قائم ولا مستجدّ يستدعي التغيير.' },
  mod:  { t: 'تعديل النوع', tone: 'warning', icon: 'tune',     seg: 'warn',   note: 'تعديل أنواع الحماية وفق تغيّر الخطر (رفع/خفض مستوى التدبير).' },
  end:  { t: 'إغلاق الحماية', tone: 'error', icon: 'cancel',   seg: 'danger', note: 'إنهاء الانضمام — انتفاء المسوّغات أو إخلال المشمول بالتزاماته.' },
};

const CASES = []; // لا بيانات مُلفّقة

const RISK_TONE = { 'حرج': 'error', 'عالٍ': 'warning', 'متوسط': 'info', 'منخفض': 'neutral' };
const ST_TONE = { 'متابعة': 'success', 'قيد التنفيذ': 'info', 'وارد': 'warning', 'مرفوع للمجلس': 'neutral' };
const REC_ST = { none: null, draft: { t: 'مسودّة توصية', tone: 'info' }, raised: { t: 'مرفوعة للمجلس', tone: 'warning' }, decided: { t: 'بُتّ فيها', tone: 'success' } };

const SrcPill = ({ s }) => { const c = SRC[s]; return <span className="src-pill" style={{ background: c.bg, color: c.fg }}><I name={c.icon} size={13} /> {s}</span>; };
// ─── مواءمة إحالة الناقل (م14 الأمني) → نموذج أمر التنفيذ (CASE) ───
function busToCase(r) {
  const m = HemayaBus.M13[r.service] || {};
  const cd = r.caseData || {};
  const dn = cd.done || [];
  const full = MEASURES.every((s) => dn.includes(s.id));
  return {
    secret: r.caseRef || r.id,
    cat: r.cat || '—',
    src: 'مجلس',
    risk: r.risk || 'متوسط',
    assignedTo: r.assignedTo || 'o1',
    region: (OFFICERS[r.assignedTo || 'o1'] || {}).region || 'RUH',
    status: full ? 'متابعة' : 'قيد التنفيذ',
    order: { from: 'مركز الحماية — تدبير ' + (m.ref || 'م14') + ' (' + (m.ar || '') + ')', date: cd.orderDate || r.referredAt || '—', ref: cd.orderRef || ('EXE-' + String(r.id || '').slice(-4)) },
    types: [m.ar || 'تدبير أمني'],
    done: dn,
    reports: cd.reports || [],
    assess: cd.assess || { level: r.risk || 'متوسط', when: '—', next: 'بعد التفعيل' },
    rec: cd.rec || { kind: null, status: 'none', note: '', by: null },
    busId: r.id, _rid: r._rid, _caseId: r._caseId, summary: r.summary, fromBus: true,
  };
}
function busCases() {
  return HemayaBus.list({ authority: 'security' }).filter((r) => r.status !== 'new').map(busToCase);
}
const visible = (role, region) => {
  const all = allCases();
  let list = ROLES[role].scope === 'all' ? all : all.filter((c) => c.assignedTo === ME);
  if (region) list = list.filter((c) => (c.region || 'RUH') === region);
  return list;
};
// دمج الملفّات الثابتة مع إحالات الناقل المستلَمة، مع إزالة أي تكرار بالرمز السري (الثابت أولوية)
function allCases() {
  const seen = new Set(); const out = [];
  CASES.concat(busCases()).forEach((c) => { if (!seen.has(c.secret)) { seen.add(c.secret); out.push(c); } });
  return out;
}

// ═══════════════ لوحة المعلومات ═══════════════
function Dashboard({ role, openC, go, region }) {
  const list = visible(role, region);
  const oversight = allCases();
  const allRegions = [...new Set(oversight.map((c) => c.region || 'RUH'))];
  const active = list.filter((c) => c.status === 'متابعة').length;
  const incoming = list.filter((c) => c.status === 'وارد' || c.status === 'قيد التنفيذ').length;
  const raised = list.filter((c) => c.rec.status === 'raised').length;
  const critical = list.filter((c) => c.risk === 'حرج');
  return (<div>
    <h2 className="h2">التنفيذ الميداني والمتابعة</h2>
    <p className="lede">{ROLES[role].scope === 'all'
      ? 'الإدارة الأمنية تنفّذ قرارات الحماية ميدانياً (م12)، تتابع المشمولين وتعدّ تقاريرها الدورية، وترفع توصياتها لمجلس المركز ليبتّ فيها.'
      : 'أوامر التنفيذ المُسنَدة إليك — تنفيذ التدابير، كتابة التقارير الدورية، وصياغة التوصية لرفعها عبر مدير الإدارة.'}</p>
    <div className="stats">
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--green-10)' }}><I name="verified_user" size={22} color="var(--color-primary)" fill /></div><div><div className="stat-v">{active}</div><div className="stat-l">حماية نشطة (متابعة)</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--warning-10)' }}><I name="assignment_late" size={22} color="var(--warning-70)" /></div><div><div className="stat-v">{incoming}</div><div className="stat-l">أوامر قيد التنفيذ</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--info-10)' }}><I name="upload_file" size={22} color="var(--color-info)" /></div><div><div className="stat-v">{raised}</div><div className="stat-l">توصيات مرفوعة للمجلس</div></div></Card>
      <Card className="card stat"><div className="stat-ico" style={{ background: 'var(--surface-subtle)' }}><I name="groups" size={22} color="var(--text-secondary)" /></div><div><div className="stat-v">{list.length}</div><div className="stat-l">إجمالي المُسنَد</div></div></Card>
    </div>

    {critical.length > 0 && (
      <Card className="card pad" style={{ marginBottom: 20, borderColor: 'var(--error-50)' }}>
        <p className="sec-h"><I name="gpp_maybe" size={18} color="var(--color-error)" /> خطر حرج — يستدعي متابعة مشدّدة</p>
        {critical.map((c) => (
          <div key={c.secret} className="ro-field" style={{ marginBottom: 8 }}>
            <span className="row" style={{ gap: 8 }}><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{c.secret}</span><SrcPill s={c.src} /><Tag tone="error" size="sm">{c.risk}</Tag></span>
            <button className="btn btn-primary btn-sm" onClick={() => openC(c)}><I name="open_in_new" size={16} /> فتح الملف</button>
          </div>
        ))}
      </Card>
    )}

    {ROLES[role].scope === 'all' && (
      <Card className="card pad" style={{ marginBottom: 20 }}>
        <p className="sec-h"><I name="balance" size={18} color="var(--color-primary)" /> توزيع العبء على الضباط</p>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>تُوزَّع أوامر التنفيذ آلياً حسب أقلّ عبء واختصاص الجهة — لكل ضابط ملفّاته دون اطّلاع على ملفّات غيره.</p>
        {Object.keys(OFFICERS).map((id) => {
          const n = CASES.filter((c) => c.assignedTo === id).length;
          return (<div className="ld" key={id}>
            <I name="shield_person" size={20} color="var(--color-primary)" />
            <div style={{ minWidth: 150 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{OFFICERS[id].name}</div><div className="muted">{OFFICERS[id].unit} · {regionDisp(OFFICERS[id].region)}</div></div>
            <div className="ld-bar"><i style={{ width: (n / 3 * 100) + '%' }} /></div>
            <Tag tone="info" size="sm">{n} ملفّات</Tag>
          </div>);
        })}
      </Card>
    )}

    {ROLES[role].scope === 'all' && (
      <Card className="card pad" style={{ marginBottom: 20 }}>
        <p className="sec-h"><I name="map" size={18} color="var(--color-primary)" /> التوزيع الجغرافي — الوحدات الميدانية</p>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>تُنفَّذ التدابير في منطقة المشمول عبر الوحدة الميدانية المختصّة مكانياً. المدير يشرف على كل المناطق ويعيد الإسناد عند الحاجة؛ العزل يمتدّ لـ(الوحدة، المنطقة).</p>
        {allRegions.map((code) => {
          const n = oversight.filter((c) => (c.region || 'RUH') === code).length;
          const offs = Object.keys(OFFICERS).filter((id) => OFFICERS[id].region === code).map((id) => OFFICERS[id].short).join(' · ') || '—';
          return (<div className="ld" key={code}>
            <I name="location_on" size={20} color="var(--color-primary)" />
            <div style={{ minWidth: 160 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{regionDisp(code)}</div><div className="muted">{offs}</div></div>
            <div className="ld-bar"><i style={{ width: Math.min(100, n / 3 * 100) + '%' }} /></div>
            <Tag tone="info" size="sm">{n} ملفّات</Tag>
          </div>);
        })}
      </Card>
    )}

    <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
      <thead><tr><th>الرمز السري</th><th>الفئة</th><th>المصدر</th><th>الحالة</th><th>الخطر</th>{ROLES[role].scope === 'all' && <th>المنطقة</th>}{ROLES[role].scope === 'all' && <th>الضابط</th>}<th>التوصية</th><th></th></tr></thead>
      <tbody>{list.map((c) => { const rs = REC_ST[c.rec.status]; return (
        <tr key={c.secret} className="clk" onClick={() => openC(c)}>
          <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{c.secret}</td>
          <td><Tag tone="info" size="sm">{c.cat}</Tag></td>
          <td><SrcPill s={c.src} /></td>
          <td><Tag tone={ST_TONE[c.status]} size="sm">{c.status}</Tag></td>
          <td><Tag tone={RISK_TONE[c.risk]} size="sm">{c.risk}</Tag></td>
          {ROLES[role].scope === 'all' && <td className="muted" style={{ whiteSpace: 'nowrap' }}>{regionDisp(c.region || 'RUH')}</td>}
          {ROLES[role].scope === 'all' && <td className="muted">{OFFICERS[c.assignedTo].short}</td>}
          <td>{rs ? <Tag tone={rs.tone} size="sm">{rs.t}</Tag> : <span className="muted">—</span>}</td>
          <td><I name="chevron_left" size={20} color="var(--text-secondary)" /></td>
        </tr>); })}</tbody>
    </table></div></Card>
  </div>);
}

// خطوة تدبير قابلة للفتح
function StepRow({ s, i, isDone, locked, onToggle, canEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="step">
      <div className={'step-box' + (isDone ? ' done' : locked ? ' lock' : '')} onClick={() => canEdit && !locked && onToggle()}>
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
              {canEdit && <button className={'btn btn-sm ' + (isDone ? 'btn-ghost' : 'btn-primary')} onClick={onToggle}>
                {isDone ? <span className="row" style={{ gap: 6 }}><I name="undo" size={15} /> تراجع</span> : <span className="row" style={{ gap: 6 }}><I name="check" size={15} /> تأكيد إتمام الخطوة</span>}
              </button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ تفاصيل الملف — تنفيذ · متابعة · توصية ═══════════════
function Detail({ c, role, back }) {
  const canExec = role === 'officer' && c.assignedTo === ME;
  const isManager = role === 'manager';
  const [done, setDone] = useState(c.done);
  const [recKind, setRecKind] = useState(c.rec.kind || '');
  const [recNote, setRecNote] = useState(c.rec.note || '');
  const [recStatus, setRecStatus] = useState(c.rec.status);
  const [reports, setReports] = useState(c.reports);
  const [newRep, setNewRep] = useState('');
  // رفع بلاغ حماية عاجل (م8) للنائب العام — عبر RPC raise_urgent الحقيقيّ.
  const [supabase] = useState(() => createClient());
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [uDanger, setUDanger] = useState('');
  const [uSource, setUSource] = useState('');
  const [uReq, setUReq] = useState('');
  const [uBusy, setUBusy] = useState(false);
  const [uDone, setUDone] = useState(false);
  const [uErr, setUErr] = useState('');
  const raiseUrgent = async () => {
    if (!c._caseId || !uDanger.trim()) return;
    setUBusy(true); setUErr('');
    const esc = { danger: uDanger.trim(), source: uSource.trim() || '—', requested: uReq.trim() || '—', raisedBy: 'الإدارة الأمنية', extends: '—' };
    const { error } = await supabase.rpc('raise_urgent', { _case_id: c._caseId, _escalation: esc });
    setUBusy(false);
    if (error) { setUErr('تعذّر رفع البلاغ: ' + error.message); return; }
    setUDone(true); setUrgentOpen(false);
  };
  const cfg = SRC[c.src];
  const councilReview = HemayaBus.listReviews().find((rv) => rv.id === ('REV-' + c.secret));
  const councilDecided = councilReview && councilReview.status === 'decided' ? councilReview.decision : null;

  // حفظ تقدّم أمر التنفيذ في الناقل (لأوامر مصدرها إحالة المركز) → يعكس الحالة للمركز
  const persist = (over, statusOverride, note) => {
    if (!c.busId) return;
    const data = Object.assign({ done, reports, rec: { kind: recKind, note: recNote, status: recStatus }, assess: c.assess, orderRef: c.order.ref, orderDate: c.order.date }, over);
    const patch = { caseData: data, _by: ROLES[role] ? ROLES[role].t : 'الإدارة الأمنية' };
    if (statusOverride) patch.status = statusOverride;
    if (statusOverride === 'done') patch.result = 'التدبير الأمني مُفعَّل بالكامل وتحت المتابعة الدورية — أُبلِغ المركز.';
    HemayaBus.update(c.busId, patch, note);
  };

  const toggle = (id, i) => {
    let next;
    if (done.includes(id)) next = done.filter((x) => x !== id);
    else if (i === 0 || done.includes(MEASURES[i - 1].id)) next = [...done, id];
    else return;
    setDone(next);
    const full = MEASURES.every((s) => next.includes(s.id));
    const st = full ? 'done' : (next.includes('activate') || next.includes('apply') ? 'progress' : 'assigned');
    persist({ done: next }, st, full ? 'اكتمل التنفيذ الميداني — تفعيل الحماية وإبلاغ المركز' : 'تحديث خطوات التدبير الميداني');
  };
  const allDone = MEASURES.every((s) => done.includes(s.id));
  const pct = Math.round(done.length / MEASURES.length * 100);

  const addReport = () => { if (!newRep.trim()) return; const next = [...reports, { id: 'n' + reports.length, when: 'الآن', by: ME, t: newRep.trim(), ok: true }]; setReports(next); setNewRep(''); persist({ reports: next }, null, 'إضافة تقرير دوري'); };
  const draftRec = () => { setRecStatus('draft'); persist({ rec: { kind: recKind, note: recNote, status: 'draft', by: ME } }, null, 'حفظ مسودّة التوصية للمدير'); };
  const raiseRec = () => {
    setRecStatus('raised');
    persist({ rec: { kind: recKind, note: recNote, status: 'raised', by: ME } }, null, 'اعتماد ورفع التوصية لمجلس المركز');
    const recMap = { cont: 'استمرار', mod: 'تعديل', close: 'إغلاق' };
    HemayaBus.raiseReview({
      id: 'REV-' + c.secret, secret: c.secret, cat: c.cat, risk: (c.assess && c.assess.level) || c.risk,
      _rid: c._caseId, _recKind: recKind,
      recommendation: recMap[recKind] || 'استمرار', current: c.types || [], summary: recNote,
      officer: OFFICERS[c.assignedTo] ? OFFICERS[c.assignedTo].name : 'الإدارة الأمنية',
      source: 'الإدارة الأمنية', kind: recKind === 'cont' ? 'تقرير دوري (تجديد 30 يوماً)' : 'تقرير متابعة — مراجعة',
      period: c.assess ? ('آخر تقييم: ' + c.assess.when) : 'مراجعة دورية', attachments: ['تقرير المتابعة الدوري', 'سجل الزيارات الميدانية'],
    });
  };

  return (<div>
    <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={17} /> رجوع</button>

    {/* ترويسة */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{c.secret}</span>
          <Tag tone="info" size="sm">{c.cat}</Tag><SrcPill s={c.src} /><Tag tone={ST_TONE[c.status]} size="sm">{c.status}</Tag>
        </div>
        <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
            <button className="to-signout" title="تسجيل الخروج" onClick={signOut}><I name="logout" size={17} /></button>
      </div>
      <p className="note info" style={{ marginTop: 14, marginBottom: 0 }}><I name="badge" size={15} /> مُسنَد إلى: <b>{OFFICERS[c.assignedTo].name}</b> — {OFFICERS[c.assignedTo].unit} · الوحدة الميدانية: {regionDisp(c.region || 'RUH')}.</p>
    </Card>

    {/* بلاغ حماية عاجل (م8) — يُرفع مباشرةً للنائب العام */}
    {c._caseId && (
      <Card className="card pad" style={{ marginBottom: 16, borderColor: 'var(--color-error)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span className="row" style={{ gap: 8 }}><I name="emergency" size={19} color="var(--color-error)" fill /><b style={{ color: 'var(--text-strong)' }}>بلاغ حماية عاجل (المادة الثامنة)</b></span>
          {!uDone && !urgentOpen && <button className="btn btn-danger btn-sm" onClick={() => setUrgentOpen(true)}><I name="bolt" size={16} /> رفع بلاغ عاجل للنائب العام</button>}
        </div>
        <p className="muted" style={{ marginTop: 8, marginBottom: (urgentOpen || uDone) ? 12 : 0 }}>لخطرٍ وشيكٍ على الحياة يستوجب تدابير فوريّة تتجاوز المسار المعتاد — يُرفع مباشرةً للنائب العام للبتّ العاجل.</p>
        {uDone ? (
          <InlineAlert kind="success" title="رُفع البلاغ العاجل">أُشعر النائب العام فوراً؛ وستظهر نتيجة بتّه على هذه القضيّة.</InlineAlert>
        ) : urgentOpen ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <textarea className="ta" placeholder="طبيعة الخطر الوشيك…" value={uDanger} onChange={(e) => setUDanger(e.target.value)} dir="auto" />
            <input placeholder="مصدر التهديد" value={uSource} onChange={(e) => setUSource(e.target.value)} dir="auto" style={{ height: 40, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-strong)' }} />
            <input placeholder="الإجراء المؤقّت المطلوب" value={uReq} onChange={(e) => setUReq(e.target.value)} dir="auto" style={{ height: 40, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-strong)' }} />
            {uErr && <InlineAlert kind="error" title="خطأ">{uErr}</InlineAlert>}
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => { setUrgentOpen(false); setUErr(''); }}>إلغاء</button>
              <button className="btn btn-danger btn-sm" disabled={!uDanger.trim() || uBusy} onClick={raiseUrgent}><I name="send" size={16} /> {uBusy ? 'جارٍ الرفع…' : 'رفع البلاغ العاجل'}</button>
            </div>
          </div>
        ) : null}
      </Card>
    )}

    {/* أمر التنفيذ */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <p className="sec-h"><I name="assignment_turned_in" size={18} color="var(--color-primary)" /> أمر التنفيذ الوارد</p>
      <div className="ro-field" style={{ marginBottom: 8 }}><span className="muted">المصدر</span><b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>{c.order.from}</b></div>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div className="ro-field" style={{ flex: 1 }}><span className="muted">رقم الأمر</span><span className="mono" style={{ fontWeight: 700 }}>{c.order.ref}</span></div>
        <div className="ro-field" style={{ flex: 1 }}><span className="muted">تاريخ الورود</span><span style={{ fontSize: 13.5 }}>{c.order.date}</span></div>
      </div>
      <p className="sec-h" style={{ fontSize: 13.5, marginBottom: 8 }}><I name="shield" size={16} color="var(--color-primary)" /> أنواع الحماية المطلوب تنفيذها (م14)</p>
      <div className="types-grid">{c.types.map((t) => <span key={t} className="type-tag"><I name="check_circle" size={14} fill /> {t}</span>)}</div>
    </Card>

    {/* التدبير الميداني */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <p className="sec-h" style={{ margin: 0 }}><I name="checklist" size={18} color="var(--color-primary)" /> التدبير الأمني الميداني (م12)</p>
        <Tag tone={allDone ? 'success' : 'info'} size="sm">{pct}%</Tag>
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 6 }}>{canExec ? 'خطوات متسلسلة — لا يُفتح إجراء قبل إتمام سابقه.' : 'عرضٌ فقط — التنفيذ من صلاحية الضابط الميداني المُسنَد.'}</p>
      {MEASURES.map((s, i) => {
        const isDone = done.includes(s.id);
        const locked = !isDone && i > 0 && !done.includes(MEASURES[i - 1].id);
        return <StepRow key={s.id} s={s} i={i} isDone={isDone} locked={locked} canEdit={canExec} onToggle={() => toggle(s.id, i)} />;
      })}
      {allDone && <p className="note ok" style={{ marginTop: 12, marginBottom: 0 }}><I name="task_alt" size={15} /> اكتمل التفعيل الميداني — المشمول تحت حماية نشطة ومتابعة دورية.</p>}
    </Card>

    {/* المتابعة الدورية + التقارير */}
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <p className="sec-h"><I name="monitoring" size={18} color="var(--color-primary)" /> المتابعة الدورية والتقارير (لائحة م8/2–3)</p>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="muted">إعادة تقييم الأخطار: <b style={{ color: 'var(--text-strong)' }}>{c.assess.when}</b> · التالي: {c.assess.next}</span>
        <Tag tone={RISK_TONE[c.assess.level]} size="sm" iconLeft={<I name="speed" size={13} />}>الخطر: {c.assess.level}</Tag>
      </div>
      {reports.length ? reports.map((r) => (
        <div className="rpt" key={r.id}>
          <div className="rpt-ico" style={{ background: r.ok ? 'var(--info-10)' : 'var(--warning-10)' }}><I name={r.ok ? 'fact_check' : 'report'} size={18} color={r.ok ? 'var(--color-info)' : 'var(--warning-70)'} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6 }}>{r.t}</div><div className="muted" style={{ marginTop: 4 }}>{OFFICERS[r.by] ? OFFICERS[r.by].short : 'الإدارة الأمنية'} · {r.when}</div></div>
        </div>
      )) : <p className="muted" style={{ margin: '0 0 6px' }}>لا تقارير بعد — تبدأ بعد التفعيل الميداني.</p>}
      {canExec && allDone && (
        <div style={{ marginTop: 10 }}>
          <div className="fld" style={{ marginBottom: 8 }}>
            <label className="fld-label">كتابة تقرير دوري جديد</label>
            <textarea value={newRep} onChange={(e) => setNewRep(e.target.value)} placeholder="حالة التدبير · مدى التزام المشمول · مستجدّات الخطر…"></textarea>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary btn-sm" disabled={!newRep.trim()} onClick={addReport}><I name="add" size={16} /> إضافة التقرير</button></div>
        </div>
      )}
    </Card>

    {/* التوصية للمجلس */}
    <Card className="card pad" style={{ borderColor: recStatus === 'raised' ? 'var(--warning-50)' : 'var(--border-subtle)' }}>
      <p className="sec-h"><I name="recommend" size={18} color="var(--color-primary)" /> التوصية لمجلس المركز (م18)</p>
      <p className="muted" style={{ marginTop: 0 }}>بناءً على التقييم الميداني: يوصي الضابط بالاستمرار أو التعديل أو الإغلاق، ويعتمدها المدير ويرفعها للمجلس — <b>القرار النهائي بالتصويت للمجلس</b>، لا للإدارة الأمنية.</p>

      {recStatus === 'raised' || recStatus === 'decided' ? (
        <div>
          {councilDecided
            ? <div className="note ok" style={{ marginBottom: 12 }}><I name="gavel" size={15} /> بتّ المجلس: <b>{councilDecided.type}</b>{councilDecided.duration ? ' · المدّة: ' + councilDecided.duration : ''}{councilDecided.reason ? ' — ' + councilDecided.reason : ''}</div>
            : <div className="note warn" style={{ marginBottom: 12 }}><I name="how_to_vote" size={15} /> رُفعت التوصية لمجلس المركز — بانتظار التصويت وإصدار القرار (استمرار · تعديل · إغلاق).</div>}
          <div className="ro-field" style={{ marginBottom: 8 }}><span className="muted">التوصية</span><Tag tone={RKIND[recKind].tone} size="sm" iconLeft={<I name={RKIND[recKind].icon} size={13} />}>{RKIND[recKind].t}</Tag></div>
          <div className="sd-block" style={{ marginBottom: 0 }}>
            <div className="sd-bt"><I name="notes" size={14} color="var(--color-primary)" /> مسوّغات التوصية</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.7, padding: '10px 13px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>{recNote}</p>
          </div>
        </div>
      ) : (<div>
        <div className="seg" style={{ marginBottom: 14 }}>
          {Object.keys(RKIND).map((k) => (
            <button key={k} className={recKind === k ? ('on ' + RKIND[k].seg) : ''} disabled={!canExec && !isManager} onClick={() => canExec && setRecKind(k)}>{RKIND[k].t}</button>
          ))}
        </div>
        {recKind && <p className={'note ' + (recKind === 'cont' ? 'ok' : 'warn')} style={{ marginBottom: 14 }}><I name={RKIND[recKind].icon} size={15} /> {RKIND[recKind].note}</p>}
        <div className="fld">
          <label className="fld-label">مسوّغات التوصية</label>
          <textarea value={recNote} onChange={(e) => setRecNote(e.target.value)} disabled={!canExec} placeholder="استند إلى أحدث تقييم وتقارير المتابعة…"></textarea>
        </div>
        {canExec && (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-primary" disabled={!recKind || !recNote.trim()} onClick={draftRec}><I name="save" size={17} /> حفظ التوصية وإرسالها للمدير</button>
          </div>
        )}
        {isManager && (
          <div>
            {recStatus === 'draft'
              ? <div className="note info" style={{ marginBottom: 12 }}><I name="inbox" size={15} /> توصية الضابط جاهزة للاعتماد والرفع لمجلس المركز.</div>
              : <div className="note info" style={{ marginBottom: 12 }}><I name="hourglass_empty" size={15} /> بانتظار صياغة الضابط الميداني للتوصية.</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-primary" disabled={recStatus !== 'draft' || !recKind} onClick={raiseRec}><I name="upload_file" size={17} /> اعتماد ورفع التوصية للمجلس</button>
            </div>
          </div>
        )}
        {!canExec && !isManager && <p className="muted" style={{ margin: 0 }}>الاطّلاع فقط.</p>}
      </div>)}
    </Card>
  </div>);
}

// ═══════════════ أوامر التنفيذ ═══════════════
function Orders({ role, openC, region }) {
  const list = visible(role, region);
  return (<div>
    <h2 className="h2">أوامر التنفيذ</h2>
    <p className="lede">{ROLES[role].scope === 'all' ? 'جميع أوامر التنفيذ الواردة من المركز وحالة تنفيذها ميدانياً.' : 'أوامر التنفيذ المُسنَدة إليك.'}</p>
    <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
      <thead><tr><th>رقم الأمر</th><th>الرمز السري</th><th>المصدر</th><th>أنواع الحماية</th><th>الحالة</th>{ROLES[role].scope === 'all' && <th>المنطقة</th>}{ROLES[role].scope === 'all' && <th>الضابط</th>}<th></th></tr></thead>
      <tbody>{list.map((c) => (
        <tr key={c.secret} className="clk" onClick={() => openC(c)}>
          <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{c.order.ref}</td>
          <td className="mono">{c.secret}</td>
          <td><SrcPill s={c.src} /></td>
          <td className="muted">{c.types.length} أنواع</td>
          <td><Tag tone={ST_TONE[c.status]} size="sm">{c.status}</Tag></td>
          {ROLES[role].scope === 'all' && <td className="muted" style={{ whiteSpace: 'nowrap' }}>{regionDisp(c.region || 'RUH')}</td>}
          {ROLES[role].scope === 'all' && <td className="muted">{OFFICERS[c.assignedTo].short}</td>}
          <td><I name="chevron_left" size={20} color="var(--text-secondary)" /></td>
        </tr>))}</tbody>
    </table></div></Card>
  </div>);
}

// ═══════════════ التقارير الدورية ═══════════════
function Reports({ role, openC, region }) {
  const list = visible(role, region);
  const rows = [];
  list.forEach((c) => c.reports.forEach((r) => rows.push({ ...r, c })));
  rows.sort((a, b) => (a.when < b.when ? 1 : -1));
  return (<div>
    <h2 className="h2">التقارير الدورية</h2>
    <p className="lede">تقارير الإدارة الأمنية عن المشمولين والتزامهم ومستجدّات الخطر (لائحة م8/2–3).</p>
    {rows.length ? <Card className="card pad">{rows.map((r) => (
      <div className="rpt clk" key={r.c.secret + r.id} onClick={() => openC(r.c)} style={{ cursor: 'pointer' }}>
        <div className="rpt-ico" style={{ background: r.ok ? 'var(--info-10)' : 'var(--warning-10)' }}><I name={r.ok ? 'fact_check' : 'report'} size={18} color={r.ok ? 'var(--color-info)' : 'var(--warning-70)'} /></div>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 8, marginBottom: 3 }}><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.c.secret}</span><SrcPill s={r.c.src} /></div>
          <div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6 }}>{r.t}</div>
          <div className="muted" style={{ marginTop: 4 }}>{OFFICERS[r.by] ? OFFICERS[r.by].short : 'الإدارة الأمنية'} · {r.when}</div>
        </div>
        <I name="chevron_left" size={20} color="var(--text-secondary)" />
      </div>
    ))}</Card> : <Card className="card pad"><p className="muted" style={{ margin: 0 }}>لا تقارير بعد.</p></Card>}
  </div>);
}

// ═══════════════ التوصيات ═══════════════
function Recs({ role, openC, region }) {
  const list = visible(role, region).filter((c) => c.rec.status !== 'none');
  return (<div>
    <h2 className="h2">التوصيات</h2>
    <p className="lede">توصيات الإدارة الأمنية (استمرار · تعديل · إغلاق) ومآلها — تُرفع لمجلس المركز ليصوّت ويصدر القرار النهائي (م18).</p>
    {list.length ? <Card className="card" style={{ overflow: 'hidden' }}><div className="tbl-wrap"><table>
      <thead><tr><th>الرمز السري</th><th>المصدر</th><th>التوصية</th><th>الحالة</th>{ROLES[role].scope === 'all' && <th>الضابط</th>}<th></th></tr></thead>
      <tbody>{list.map((c) => { const rs = REC_ST[c.rec.status]; return (
        <tr key={c.secret} className="clk" onClick={() => openC(c)}>
          <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{c.secret}</td>
          <td><SrcPill s={c.src} /></td>
          <td><Tag tone={RKIND[c.rec.kind].tone} size="sm" iconLeft={<I name={RKIND[c.rec.kind].icon} size={13} />}>{RKIND[c.rec.kind].t}</Tag></td>
          <td>{rs && <Tag tone={rs.tone} size="sm">{rs.t}</Tag>}</td>
          {ROLES[role].scope === 'all' && <td className="muted">{OFFICERS[c.assignedTo].short}</td>}
          <td><I name="chevron_left" size={20} color="var(--text-secondary)" /></td>
        </tr>); })}</tbody>
    </table></div></Card> : <Card className="card pad"><p className="muted" style={{ margin: 0 }}>لا توصيات بعد.</p></Card>}
  </div>);
}

// ═══════════════ الإشعارات ═══════════════
const NOTIF = []; // لا إشعارات مُلفّقة (StaffNotifications الحقيقيّ مُستعمَل)
function Notifs() {
  return (<div>
    <h2 className="h2">الإشعارات</h2>
    <p className="lede">مستجدّات أوامر التنفيذ والتقارير والتوصيات.</p>
    <Card className="card pad">{NOTIFS.map((n, i) => (
      <div className="rpt" key={i} style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="rpt-ico" style={{ background: n.bg }}><I name={n.ico} size={18} color={n.tone} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6 }}>{n.t}</div><div className="muted" style={{ marginTop: 4 }}>{n.when}</div></div>
      </div>
    ))}</Card>
  </div>);
}

// ═══════════════ الملف الشخصي ═══════════════
function Profile({ role }) {
  const r = ROLES[role];
  const who = role === 'officer' ? OFFICERS[ME] : { name: 'مدير الإدارة الأمنية', unit: 'وزارة الداخلية' };
  const rows = [
    ['الاسم', who.name],
    ['الجهة', who.unit + ' — الإدارة الأمنية (م12)'],
    ['الدور', r.t],
    ['الصلاحية', r.perm],
    ['الدخول', 'عبر نفاذ الوطني الموحّد'],
  ];
  return (<div>
    <h2 className="h2">الملف الشخصي</h2>
    <p className="lede">حسابك وصلاحياتك في الإدارة الأمنية المنفّذة.</p>
    <Card className="card pad" style={{ maxWidth: 580 }}>
      <div className="row" style={{ gap: 14, marginBottom: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)', background: 'var(--green-10)', display: 'grid', placeItems: 'center' }}><I name={r.icon} size={28} color="var(--color-primary)" fill /></div>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>{who.name}</div><div className="muted">{r.t} · {r.sub}</div></div>
      </div>
      {rows.map(([k, v]) => <div className="ro-field" key={k} style={{ marginBottom: 8 }}><span className="muted">{k}</span><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)', textAlign: 'end', maxWidth: 380 }}>{v}</span></div>)}
    </Card>
  </div>);
}

// ── إحالات المركز (ناقل م14 الأمني) — تصل حيّةً من بوابة المركز ──
const SEC_ST = HemayaBus.STATUS;
function secTone(s) {
  const t = (SEC_ST[s] || {}).tone || 'info';
  const m = { warning: ['var(--warning-10)', 'var(--warning-70)'], info: ['var(--info-10)', 'var(--color-info)'], success: ['var(--success-10)', 'var(--success-70)'] };
  return m[t] || m.info;
}
function SecPill({ s }) {
  const [bg, fg] = secTone(s);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 'var(--radius-full)', background: bg, color: fg, fontSize: 12, fontWeight: 700 }}>{(SEC_ST[s] || {}).ar || s}</span>;
}
function SecBtn({ onClick, children, ghost }) {
  return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 'var(--radius-md)', border: '1px solid ' + (ghost ? 'var(--border, #e5e7eb)' : 'transparent'), background: ghost ? '#fff' : 'var(--color-primary)', color: ghost ? 'var(--text-strong)' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{children}</button>;
}
function SecReferrals({ role, go }) {
  const [, force] = useState(0);
  useEffect(() => {
    // الإحالات الحقيقيّة تُحقَن من الخادم (hydrate)؛ لا بذور محلّية.
    const off = HemayaBus.subscribe(() => force((n) => n + 1));
    return off;
  }, []);
  // الوارد = الإحالات الجديدة فقط (لم تُستلَم بعد) — المستلَمة تنتقل إلى «أوامر التنفيذ» (بلا تكرار)
  const all = HemayaBus.list({ authority: 'security' });
  const list = all.filter((r) => r.status === 'new');
  const openedCount = all.length - list.length;
  const M = HemayaBus.M13;
  const receive = (r) => {
    HemayaBus.update(r.id, {
      status: 'assigned', assignee: OFFICERS[ME].name, assignedTo: ME, _by: 'الإدارة الأمنية',
      caseData: {
        done: ['recv'], reports: [], rec: { kind: null, status: 'none', note: '', by: null },
        assess: { level: r.risk || 'متوسط', when: '—', next: 'بعد التفعيل' },
        orderRef: 'EXE-' + String(Date.now()).slice(-4), orderDate: r.referredAt || '—',
      },
    }, 'استلام الإحالة وفتحها كأمر تنفيذ في «أوامر التنفيذ»');
  };
  return (<div>
    <h2 className="h2">الوارد — إحالات أمنية جديدة من المركز (م14)</h2>
    <p className="lede">صندوق الورود: تدابير الحماية الأمنية تصل حيّةً من «مركز الحماية» لحظة إصدارها. عند الاستلام يُفتَح للإحالة <b>ملف تنفيذ كامل</b> في «أوامر التنفيذ» (تدبير ميداني · متابعة دورية · توصية للمجلس)، وتغادر هذا الصندوق.</p>
    {openedCount > 0 && <div className="note ok" style={{ marginBottom: 14 }}><I name="task_alt" size={15} /> {openedCount} إحالة مُستلَمة فُتح لها ملف تنفيذ. <button className="link" style={{ display: 'inline' }} onClick={() => go && go('orders')}>عرض «أوامر التنفيذ» ←</button></div>}
    {list.length === 0 && <Card className="card pad"><div className="row" style={{ gap: 10, color: 'var(--text-secondary)' }}><I name="inbox" size={20} /> لا إحالات جديدة بانتظار الاستلام.</div></Card>}
    <div style={{ display: 'grid', gap: 14 }}>
      {list.map((r) => {
        const m = M[r.service] || {};
        return (<Card key={r.id} className="card pad">
          <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--green-10)', display: 'grid', placeItems: 'center' }}><I name={m.icon || 'security'} size={22} color="var(--color-primary)" fill /></div>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{m.ar || r.service}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{r.name} · {r.cat} · خطر {r.risk} · {r.ref}</div></div>
            </div>
            <SecPill s={r.status} />
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{r.summary}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>الرمز السري: {r.caseRef} · وردت: {r.referredAt}</span>
            <span style={{ flex: 1 }} />
            {role === 'officer'
              ? <SecBtn onClick={() => receive(r)}><I name="how_to_reg" size={16} color="#fff" /> استلام وفتح ملف التنفيذ</SecBtn>
              : <span className="muted" style={{ fontSize: 12.5 }}><I name="schedule" size={15} /> بانتظار استلام الضابط الميداني</span>}
          </div>
        </Card>);
      })}
    </div>
  </div>);
}

const NAV = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' },
  { id: 'inbox', t: 'الوارد — إحالات جديدة', icon: 'move_to_inbox' },
  { id: 'orders', t: 'أوامر التنفيذ', icon: 'assignment', badge: 1 },
  { id: 'reports', t: 'التقارير الدورية', icon: 'description' },
  { id: 'recs', t: 'التوصيات', icon: 'recommend' },
  { id: 'notifs', t: 'الإشعارات', icon: 'notifications', badge: 3 },
  { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' },
];

function signOut() {
  fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = 'http://localhost:3000/'; }).catch(() => { window.location.href = 'http://localhost:3000/'; });
}

function App() {
  const [role, setRole] = useState('officer');
  const [region, setRegion] = useState('');
  const [active, setActive] = useState('dashboard');
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(false);
  const [, forceApp] = useState(0);
  useEffect(() => {
    forceApp((n) => n + 1);
    const un = HemayaBus.subscribe(() => forceApp((n) => n + 1));
    // مزامنة حيّة بين البوّابات عبر Supabase Realtime.
    const sb = createClient();
    const ch = sb.channel('rt-referrals-security')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals' },
        () => { refetchReferrals().then((rows) => { if (Array.isArray(rows)) HemayaBus.hydrate(rows); }).catch(() => {}); })
      .subscribe();
    return () => { un(); try { sb.removeChannel(ch); } catch (e) {} };
  }, []);
  const go = (id) => { setActive(id); setSel(null); setOpen(false); };
  const openC = (c) => { setSel(c); typeof window !== 'undefined' && window.scrollTo(0, 0); };
  const switchRole = (r) => { setRole(r); setSel(null); setActive('dashboard'); setRegion(''); };
  const allRegions = [...new Set(allCases().map((c) => c.region || 'RUH'))];
  const cur = NAV.find((n) => n.id === active);
  let body, title;
  if (sel) { body = <Detail c={sel} role={role} back={() => setSel(null)} />; title = 'ملف التنفيذ والمتابعة'; }
  else if (active === 'inbox') { body = <SecReferrals role={role} go={go} />; title = cur.t; }
  else if (active === 'orders') { body = <Orders role={role} openC={openC} region={region} />; title = cur.t; }
  else if (active === 'reports') { body = <Reports role={role} openC={openC} region={region} />; title = cur.t; }
  else if (active === 'recs') { body = <Recs role={role} openC={openC} region={region} />; title = cur.t; }
  else if (active === 'notifs') { body = <StaffNotifications />; title = cur.t; }
  else if (active === 'profile') { body = <Profile role={role} />; title = cur.t; }
  else { body = <Dashboard role={role} openC={openC} go={go} region={region} />; title = cur.t; }
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand"><div className="brand-mark"><I name="security" size={22} fill color="#fff" /></div>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.2 }}>الإدارة الأمنية</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>التنفيذ الميداني والمتابعة</div></div></div>
        <nav className="nav">{NAV.map((n) => (<button key={n.id} className={'nav-item' + (active === n.id && !sel ? ' on' : '')} onClick={() => go(n.id)}><I name={n.icon} size={20} /> <span>{n.t}</span>{n.badge && <span className="nav-badge">{n.badge}</span>}</button>))}</nav>
        <div className="side-foot">المنفّذ الميداني (م12). كل ضابط يرى ملفّاته فقط؛ التوصيات تُرفع لمجلس المركز. مسجّل في التدقيق.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{title}</span>
          <span className="row" style={{ marginInlineStart: 'auto', gap: 10 }}>
            {role === 'manager' && (
              <span className="role-sel" title="تصفية المنطقة — إشراف المدير على الوحدات الميدانية">
                <I name="location_on" size={16} color="var(--color-primary)" />
                <select value={region} onChange={(e) => { setRegion(e.target.value); setSel(null); }}>
                  <option value="">كل المناطق</option>
                  {allRegions.map((code) => <option key={code} value={code}>{regionDisp(code)}</option>)}
                </select>
              </span>
            )}
            <span className="role-sel"><I name={ROLES[role].icon} size={16} color="var(--color-primary)" />
              <select value={role} onChange={(e) => switchRole(e.target.value)}>
                <option value="officer">ضابط ميداني</option>
                <option value="manager">مدير الإدارة الأمنية</option>
              </select>
            </span>
            <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
            <button className="to-signout" title="تسجيل الخروج" onClick={signOut}><I name="logout" size={17} /></button>
          </span>
        </header>
        <main className="content">{body}</main>
      </div>
    </div>
  );
}
// مُغلِّف — بوابة تأجيل للتركيب (يتفادى عدم تطابق hydration بسبب localStorage للناقل)
export function SecurityPortal({ initialData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (initialData && initialData.length) HemayaBus.hydrate(initialData);
    HemayaBus.setPersister((row, patch, note) => {
      const result = row.caseData ? { caseData: row.caseData, assignedTo: row.assignedTo } : {};
      referralUpdate(row._rid, row.status, row.assignee || null, result, note || "");
    });
    HemayaBus.setReviewPersister((rec) => {
      if (rec._rid) raiseLifecycleReview(rec._rid, rec._recKind || "cont", rec.summary || "");
    });
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <App />;
}
