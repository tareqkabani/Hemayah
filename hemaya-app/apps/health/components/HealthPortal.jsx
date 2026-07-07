'use client';
/* ============================================================
   بوابة وزارة الصحة — خدمات الإرشاد النفسي/الاجتماعي والرعاية الطبية (م14/5 · التقييم م9/1)
   منقول من «بوابة وزارة الصحة/البوابة.html». window/HP → @hemaya/ui، HemayaBus → referral-bus.
   دوران: مختص · مدير الخدمات. ربط حيّ بناقل الإحالات.
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, RiskLevel } from "@hemaya/ui";
import { HemayaBus } from "./referral-bus";
import { referralUpdate, refetchReferrals } from "../lib/referral-actions";
import { createClient } from "@hemaya/supabase/src/browser";
import { StaffNotifications, StaffMessages } from "./staff-feeds";
import "./health.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// ===== الخدمات (تدابير م14/5 · م9/1) =====
const SERVICE = {
  psych:   { t: 'استشارة/جلسة نفسية', short: 'نفسية', icon: 'psychology', ref: 'م14/5', bg: 'var(--info-10)', fg: 'var(--color-info)',
             desc: 'الإرشاد والعلاج النفسي للمشمول بعد التهديد أو الصدمة.' },
  assess:  { t: 'تقييم نفسي ضمن دراسة الحالة', short: 'تقييم', icon: 'clinical_notes', ref: 'م9/1', bg: 'var(--green-10)', fg: 'var(--color-primary)',
             desc: 'يُلتقَط ضمن «عامل المناسبة النفسية» ويُرفع لمركز الحماية لدراسة الطلب.' },
  social:  { t: 'إرشاد اجتماعي', short: 'اجتماعي', icon: 'diversity_3', ref: 'م14/5', bg: 'var(--warning-10)', fg: 'var(--warning-70)',
             desc: 'دعم اجتماعي وأسري ومعيشي للمشمول وذويه.' },
  medical: { t: 'رعاية طبية للمصابين', short: 'طبية', icon: 'medical_services', ref: 'م14/5', bg: 'var(--error-10)', fg: 'var(--color-error)',
             desc: 'علاج الإصابات الجسدية الناتجة عن الاعتداء المرتبط بالشهادة/الإبلاغ.' },
};
const CAT = { 'شاهد': 'شاهد', 'مبلّغ': 'مبلّغ', 'خبير': 'خبير', 'ضحية': 'ضحية' };
// المناطق/الوحدات الإقليمية — تُقدّم الخدمة في منطقة المشمول؛ المدير يشرف على كل المناطق
const REGIONS = { RUH: 'الرياض', MAK: 'مكة المكرمة', MED: 'المدينة المنورة', QAS: 'القصيم', EAS: 'المنطقة الشرقية', ASR: 'عسير', TAB: 'تبوك', HAI: 'حائل', NOR: 'الحدود الشمالية', JAZ: 'جازان', NAJ: 'نجران', BAH: 'الباحة', JOF: 'الجوف' };
const regionDisp = (code) => { const n = REGIONS[code] || code; return (n.charAt(0) === 'ا' && n.charAt(1) === 'ل') ? n : 'منطقة ' + n; };

// ===== الحالة (من منظور الجهة الصحية) =====
const ST = {
  new:      { t: 'وارد — غير مُسنَد', tone: ['var(--warning-10)','var(--warning-70)'], icon: 'inbox' },
  assigned: { t: 'مُسنَد لمختص', tone: ['var(--info-10)','var(--color-info)'], icon: 'assignment_ind' },
  progress: { t: 'قيد المعالجة', tone: ['var(--info-10)','var(--color-info)'], icon: 'pending' },
  review:   { t: 'بانتظار اعتماد المدير', tone: ['var(--warning-10)','var(--warning-70)'], icon: 'rate_review' },
  done:     { t: 'مُعتمَد ومُبلَّغ للمركز', tone: ['var(--success-10)','var(--success-70)'], icon: 'task_alt' },
};

const STAFF = [];
const ME = 's1'; // المختص الحالي عند تسجيل الدخول كموظف

let REQUESTS = []; // القضايا الحقيقيّة فقط من الناقل (RLS) — لا بذور مُلفّقة

function Pill({ status }) { const s = ST[status]; return <span className="pill" style={{ background: s.tone[0], color: s.tone[1] }}><I name={s.icon} size={13} fill /> {s.t}</span>; }
function SvcTag({ service }) { const s = SERVICE[service]; return <span className="pill" style={{ background: s.bg, color: s.fg }}><I name={s.icon} size={13} fill /> {s.short}</span>; }
// ===== ربط حيّ بناقل الإحالات — تزامن مع المركز =====
const AUTHORITY = 'health';
// خريطة المنطقة الثابتة بالمرجع — تستردّ المنطقة حتى لو كانت إدخالات الناقل قديمة (قبل إضافة region)
const SEED_REGION = {}; REQUESTS.forEach((r) => { SEED_REGION[r.id] = r.region; });
HemayaBus.seed(REQUESTS.map((r) => Object.assign({ caseRef: r.secret, referredAt: r.referred }, r, { authority: AUTHORITY })));
function pullRequests() {
  return HemayaBus.list({ authority: AUTHORITY }).map((ref) => Object.assign({
    days: 0, deadline: 0,
    centerRef: ref.centerRef || ((ref.caseRef || '') + ' · التنفيذ والتجديد'),
  }, ref, {
    secret: ref.caseRef || ref.secret,
    referred: ref.referred || ref.referredAt || '—',
    region: ref.region || SEED_REGION[ref.id] || 'RUH',
  }));
}
REQUESTS = pullRequests();
function Stat({ icon, v, l, bg, fg }) {
  return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></Card>;
}
function staffOf(id) { return STAFF.find((s) => s.id === id) || { id, name: 'مختص الخدمات', init: 'م' }; }

// ===== لوحة المعلومات =====
function Dashboard({ persona, openReq, go, region }) {
  const scoped = region ? REQUESTS.filter((r) => (r.region || 'RUH') === region) : REQUESTS;
  const mine = scoped.filter((r) => r.assignee === ME);
  const pool = persona === 'staff'
    ? scoped.filter((r) => r.assignee === ME || r.status === 'new')
    : scoped;
  const nNew = scoped.filter((r) => r.status === 'new').length;
  const nProg = scoped.filter((r) => r.status === 'assigned' || r.status === 'progress').length;
  const nRev = scoped.filter((r) => r.status === 'review').length;
  const nDone = scoped.filter((r) => r.status === 'done').length;
  const queue = pool.filter((r) => r.status !== 'done').slice(0, 6);
  const allRegions = [...new Set(REQUESTS.map((r) => r.region || 'RUH'))];
  return (
    <div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">{persona === 'staff'
        ? 'خدمات الإرشاد النفسي والاجتماعي والرعاية الطبية المُسنَدة إليك. تُحال الطلبات من مركز الحماية، وتُعالَج ثم تُعتمَد من المدير قبل الرد على المركز (تدابير م14/5 · التقييم م9/1).'
        : 'إشراف على فريق الخدمات العلاجية: توزيع الطلبات الواردة من المركز، ومتابعة المعالجة، واعتماد النتائج قبل ردّها للمركز.'}</p>
      <div className="stats">
        <Stat icon="inbox" v={nNew} l="طلبات واردة غير مُسنَدة" bg="var(--warning-10)" fg="var(--color-warning)" />
        <Stat icon="pending" v={nProg} l="قيد المعالجة" bg="var(--info-10)" fg="var(--color-info)" />
        {persona === 'manager'
          ? <Stat icon="rate_review" v={nRev} l="بانتظار اعتمادك" bg="var(--warning-10)" fg="var(--warning-70)" />
          : <Stat icon="assignment_ind" v={mine.length} l="مُسنَد إليك" bg="var(--green-10)" fg="var(--color-primary)" />}
        <Stat icon="task_alt" v={nDone} l="مكتملة ومُبلَّغة" bg="var(--success-10)" fg="var(--color-success)" />
      </div>
      {persona === 'manager' && (
        <Card className="card pad" style={{ marginBottom: 22 }}>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}><I name="map" size={18} color="var(--color-primary)" /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>التوزيع الجغرافي — الوحدات الإقليمية</b></div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>تُقدّم الخدمة في منطقة المشمول عبر الوحدة الصحية المختصّة مكانياً. الإدارة تشرف على كل المناطق وتوزّع حسب الاختصاص والعبء.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {allRegions.map((code) => {
              const rq = REQUESTS.filter((r) => (r.region || 'RUH') === code);
              const st = STAFF.filter((s) => (s.region || 'RUH') === code).map((s) => s.name.split(' ').slice(-1)[0]).join(' · ') || '—';
              return (<div key={code} className="row" style={{ justifyContent: 'space-between', padding: '11px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span className="row" style={{ gap: 8 }}><I name="location_on" size={16} color="var(--color-primary)" /><b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>{regionDisp(code)}</b><span className="muted">{st}</span></span>
                <Tag tone="info" size="sm">{rq.length} طلبات</Tag>
              </div>);
            })}
          </div>
        </Card>
      )}
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="pad" style={{ paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 15, color: 'var(--text-strong)' }}>{persona === 'staff' ? 'طلبات تنتظر إجراءك' : 'الطلبات النشطة'}</b>
          <button className="link" onClick={() => go('requests')}>عرض الكل <I name="chevron_left" size={16} /></button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المرجع</th><th>المشمول</th><th>الخدمة</th><th>الخطر</th>{persona === 'manager' && <th>المنطقة</th>}<th>المختص</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id} className="clk" onClick={() => openReq(r)}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                  <td className="mono">{r.secret}</td>
                  <td><SvcTag service={r.service} /></td>
                  <td><RiskLevel level={r.risk} /></td>
                  {persona === 'manager' && <td className="muted" style={{ whiteSpace: 'nowrap' }}>{regionDisp(r.region || 'RUH')}</td>}
                  <td>{r.assignee ? <span className="assignee"><span className="ava-sm">{staffOf(r.assignee).init}</span>{staffOf(r.assignee).name.split(' ')[0]} {staffOf(r.assignee).name.split(' ')[1]}</span> : <span className="muted">—</span>}</td>
                  <td><Pill status={r.status} /></td>
                  <td><span className="link">فتح <I name="chevron_left" size={16} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===== قائمة الطلبات =====
function Requests({ persona, openReq, initFilter, region }) {
  const [filter, setFilter] = useState(initFilter || 'all');
  const scoped = region ? REQUESTS.filter((r) => (r.region || 'RUH') === region) : REQUESTS;
  const base = persona === 'staff' ? scoped.filter((r) => r.assignee === ME || r.status === 'new') : scoped;
  const rows = base.filter((r) =>
    filter === 'all' ? true :
    filter === 'new' ? r.status === 'new' :
    filter === 'active' ? (r.status === 'assigned' || r.status === 'progress') :
    filter === 'review' ? r.status === 'review' :
    r.status === 'done');
  const tabs = [['all', 'الكل'], ['new', 'وارد'], ['active', 'قيد المعالجة'], ['review', 'بانتظار الاعتماد'], ['done', 'مكتملة']];
  return (
    <div>
      <h2 className="h2">{persona === 'staff' ? 'طلباتي' : 'طلبات الخدمات الصحية'}</h2>
      <p className="lede">{persona === 'staff'
        ? 'الطلبات المُسنَدة إليك والطلبات الواردة المتاحة للاستلام. افتح الطلب لجدولة الخدمة وتسجيل نتيجتها.'
        : 'كل طلبات الإرشاد النفسي والاجتماعي والرعاية الطبية المُحالة من مركز الحماية، مع المختص المسؤول وحالتها.'}</p>
      <div className="filters">
        {tabs.map(([k, t]) => <button key={k} className={'fbtn' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t}</button>)}
      </div>
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المرجع</th><th>المشمول</th><th>الصفة</th><th>الخدمة</th><th>الخطر</th>{persona === 'manager' && <th>المنطقة</th>}<th>المختص</th><th>ورد</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clk" onClick={() => openReq(r)}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                  <td className="mono">{r.secret}</td>
                  <td><Tag tone="neutral" size="sm">{CAT[r.cat]}</Tag></td>
                  <td><SvcTag service={r.service} /></td>
                  <td><RiskLevel level={r.risk} /></td>
                  {persona === 'manager' && <td className="muted" style={{ whiteSpace: 'nowrap' }}>{regionDisp(r.region || 'RUH')}</td>}
                  <td>{r.assignee ? <span className="assignee"><span className="ava-sm">{staffOf(r.assignee).init}</span>{staffOf(r.assignee).name.split(' ')[1]}</span> : <span className="muted">—</span>}</td>
                  <td className="muted">{r.referred}</td>
                  <td><Pill status={r.status} /></td>
                  <td><span className="link">فتح <I name="chevron_left" size={16} /></span></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 32 }}>لا توجد طلبات في هذا التصنيف.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===== تفاصيل الطلب =====
const TRACK = { new: 0, assigned: 1, progress: 2, review: 3, done: 4 };
function Detail({ r, persona, onBack, act }) {
  const svc = SERVICE[r.service];
  const stage = TRACK[r.status];
  const steps = [
    { t: 'ورود الطلب من مركز الحماية', d: r.centerRef, when: r.referred },
    { t: 'الإسناد لمختص', d: 'يستلم المختص المعني الطلب لبدء الخدمة', when: stage >= 1 ? (r.assignee ? staffOf(r.assignee).name : 'تمّ') : null },
    { t: r.service === 'assess' ? 'إجراء التقييم النفسي' : 'جدولة الخدمة ومعالجتها', d: r.service === 'assess' ? 'يُلتقَط ضمن دراسة الحالة (عامل المناسبة)' : 'تحديد الموعد والوسيط ثم تنفيذ الجلسة/الرعاية', when: stage >= 2 ? 'جارية' : null },
    { t: 'اعتماد المدير', d: 'يراجع مدير الخدمات النتيجة قبل ردّها للمركز', when: stage >= 3 ? (stage >= 4 ? 'مُعتمَد' : 'بانتظار') : null },
    { t: 'الرد للمركز وتحديث حالة المشمول', d: r.service === 'assess' ? 'يُرفَق التقييم بدراسة الحالة' : 'تُسجَّل الخدمة في ملف المشمول لدى المركز', when: stage >= 4 ? 'تمّ' : null },
  ];
  return (
    <div style={{ maxWidth: 920 }}>
      <button className="link" onClick={onBack} style={{ marginBottom: 14 }}><I name="arrow_forward" size={16} /> رجوع للقائمة</button>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', color: svc.fg, textTransform: 'uppercase', marginBottom: 4 }}>{svc.t} · {svc.ref}</div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)', margin: 0 }}>{r.id}</h2>
          <Pill status={r.status} />
        </div>
      </div>

      <div className="sec">
        <div className="sec-head">
          <div className="sec-n"><I name="person" size={16} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="sec-t">المشمول المستفيد</h3>
            <p className="sec-sub">الهوية تُعرض بالرمز السري؛ يُكشف الاسم عند الحاجة العلاجية الفعلية ويُسجَّل بالتدقيق (م15، م16).</p>
          </div>
        </div>
        <div className="sec-body">
          <div style={{ marginBottom: 14 }}><SecretCode code={r.secret} name={r.name} /></div>
          <dl className="kv">
            <dt>الصفة</dt><dd>{CAT[r.cat]}</dd>
            <dt>مستوى الخطر</dt><dd><RiskLevel level={r.risk} /></dd>
            <dt>مصدر الإحالة</dt><dd>{r.centerRef}</dd>
            <dt>منطقة الخدمة</dt><dd>{regionDisp(r.region || 'RUH')}</dd>
            <dt>الخدمة المطلوبة</dt><dd>{svc.t}</dd>
          </dl>
          <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-body)' }}>
            <b style={{ color: 'var(--text-strong)' }}>طلب المركز:</b> {r.summary}
          </div>
        </div>
      </div>

      <div className="sec">
        <div className="sec-head">
          <div className="sec-n"><I name="timeline" size={16} /></div>
          <div style={{ flex: 1 }}><h3 className="sec-t">مسار الخدمة</h3><p className="sec-sub">من ورود الطلب حتى الرد على المركز وتحديث ملف المشمول.</p></div>
        </div>
        <div className="sec-body">
          <div className="trk">
            {steps.map((s, i) => {
              const cls = i < stage ? 'done' : i === stage ? 'active' : 'pending';
              return (
                <div className={'trk-step ' + cls} key={i}>
                  <div className="trk-dot">{i < stage && <I name="check" size={12} />}</div>
                  <div className="trk-t">{s.t}</div>
                  <div className="trk-d">{s.d}</div>
                  {s.when && <div className="trk-when">{s.when}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {r.sched && (
        <div className="sec">
          <div className="sec-head">
            <div className="sec-n"><I name="event" size={16} /></div>
            <div style={{ flex: 1 }}><h3 className="sec-t">{r.service === 'assess' ? 'التقييم' : 'الجدولة'}</h3></div>
          </div>
          <div className="sec-body">
            <dl className="kv">
              <dt>الموعد</dt><dd>{r.sched.when}</dd>
              <dt>الوسيط</dt><dd>{r.sched.via}</dd>
              {r.service !== 'assess' && <><dt>عدد الجلسات</dt><dd>{r.sched.sessions}</dd></>}
              <dt>ملاحظة المختص</dt><dd style={{ fontWeight: 400 }}>{r.sched.note}</dd>
            </dl>
            {r.result && <InlineAlert kind="success" title="نتيجة الخدمة" style={{ marginTop: 14 }}>{r.result}</InlineAlert>}
          </div>
        </div>
      )}

      {/* ===== لوحة الإجراء ===== */}
      <ActionPanel r={r} persona={persona} act={act} />
    </div>
  );
}

function ActionPanel({ r, persona, act }) {
  // staff: استلام / معالجة / رفع للاعتماد ؛ manager: اعتماد / إعادة
  if (persona === 'staff') {
    if (r.status === 'new') {
      return (
        <Card className="card pad" style={{ borderColor: 'var(--green-20)' }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}><I name="assignment_ind" size={20} color="var(--color-primary)" fill /><b style={{ color: 'var(--text-strong)' }}>استلام الطلب</b></div>
          <p className="muted" style={{ margin: '0 0 14px' }}>استلم الطلب ليُسنَد إليك وتبدأ جدولة الخدمة.</p>
          <button className="btn btn-primary sm" onClick={() => act(r.id, 'assigned', { assignee: ME }, 'استلمتَ الطلب وأصبح مُسنَداً إليك.')}><I name="how_to_reg" size={17} /> استلام وإسناد لي</button>
        </Card>
      );
    }
    if (r.status === 'assigned' || r.status === 'progress') {
      return <ProcessForm r={r} act={act} />;
    }
    if (r.status === 'review') {
      return (
        <Card className="card pad" style={{ borderColor: 'var(--warning-50)' }}>
          <div className="row" style={{ gap: 8 }}><I name="hourglass_top" size={20} color="var(--warning-70)" fill /><b style={{ color: 'var(--text-strong)' }}>بانتظار اعتماد المدير</b></div>
          <p className="muted" style={{ margin: '8px 0 0' }}>رُفعت النتيجة لمدير الخدمات للاعتماد قبل الرد على المركز.</p>
        </Card>
      );
    }
    return (
      <Card className="card pad" style={{ borderColor: 'var(--success-50)' }}>
        <div className="row" style={{ gap: 8 }}><I name="task_alt" size={20} color="var(--color-success)" fill /><b style={{ color: 'var(--text-strong)' }}>اكتملت الخدمة وأُبلِغ المركز</b></div>
      </Card>
    );
  }
  // manager
  if (r.status === 'review') {
    return (
      <Card className="card pad" style={{ borderColor: 'var(--warning-50)' }}>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}><I name="rate_review" size={20} color="var(--warning-70)" fill /><b style={{ color: 'var(--text-strong)' }}>اعتماد نتيجة الخدمة</b></div>
        <p className="muted" style={{ margin: '0 0 14px' }}>راجع جدولة الخدمة ونتيجتها. عند الاعتماد تُبلَّغ النتيجة لمركز الحماية وتُسجَّل في ملف المشمول.</p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary sm" onClick={() => act(r.id, 'done', {}, 'اعتُمدت النتيجة وأُبلِغ مركز الحماية، وحُدِّث ملف المشمول.')}><I name="verified" size={17} /> اعتماد والرد للمركز</button>
          <button className="btn btn-ghost sm" onClick={() => act(r.id, 'progress', {}, 'أُعيد الطلب للمختص لاستكمال الخدمة.')}><I name="undo" size={17} /> إعادة للمختص</button>
        </div>
      </Card>
    );
  }
  if (r.status === 'done') {
    return (
      <Card className="card pad" style={{ borderColor: 'var(--success-50)' }}>
        <div className="row" style={{ gap: 8 }}><I name="task_alt" size={20} color="var(--color-success)" fill /><b style={{ color: 'var(--text-strong)' }}>مُعتمَد ومُبلَّغ للمركز</b></div>
      </Card>
    );
  }
  return (
    <Card className="card pad">
      <div className="row" style={{ gap: 8 }}><I name="info" size={20} color="var(--color-info)" /><b style={{ color: 'var(--text-strong)' }}>{r.status === 'new' ? 'بانتظار استلام مختص' : 'قيد المعالجة لدى المختص'}</b></div>
      <p className="muted" style={{ margin: '8px 0 0' }}>{r.assignee ? `المسؤول: ${staffOf(r.assignee).name}` : 'لم يُسنَد بعد. يمكنك توزيعه من قائمة الطلبات.'}</p>
    </Card>
  );
}

function ProcessForm({ r, act }) {
  const isAssess = r.service === 'assess';
  const [when, setWhen] = useState(r.sched?.when || '');
  const [via, setVia] = useState(r.sched?.via || (isAssess ? 'عن بُعد مشفّر' : 'حضوري آمن'));
  const [sessions, setSessions] = useState(r.sched?.sessions || 1);
  const [note, setNote] = useState(r.sched?.note || '');
  const [result, setResult] = useState(r.result || '');
  const [fit, setFit] = useState('');
  const VIA = isAssess ? ['عن بُعد مشفّر', 'حضوري آمن'] : ['حضوري آمن', 'عن بُعد مشفّر', 'منشأة صحية مخصّصة'];
  const FIT = ['مناسب', 'مناسب بتحفّظ', 'غير مناسب حالياً'];
  const canSchedule = when.trim();
  const canFinish = isAssess ? (result.trim() && fit) : (when.trim() && result.trim());
  return (
    <Card className="card pad" style={{ borderColor: 'var(--green-20)' }}>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}><I name={isAssess ? 'clinical_notes' : 'event'} size={20} color="var(--color-primary)" fill /><b style={{ color: 'var(--text-strong)' }}>{isAssess ? 'إجراء التقييم النفسي (م9/1)' : 'جدولة الخدمة ومعالجتها'}</b></div>
      <div className="grid2">
        <div className="fld">
          <label className="label">{isAssess ? 'موعد جلسة التقييم' : 'موعد الجلسة/الرعاية'} <span className="req">*</span></label>
          <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="مثال: 5 يوليو 2026 · 11:00" dir="auto" />
        </div>
        <div className="fld">
          <label className="label">الوسيط</label>
          <div className="seg">{VIA.map((v) => <button key={v} className={via === v ? 'on' : ''} onClick={() => setVia(v)}>{v}</button>)}</div>
        </div>
      </div>
      {!isAssess && (
        <div className="fld">
          <label className="label">عدد الجلسات المبدئي</label>
          <div className="chips">{[1, 2, 3, 4, 6].map((n) => <button key={n} className={'chip' + (sessions === n ? ' on' : '')} onClick={() => setSessions(n)}>{n}</button>)}</div>
        </div>
      )}
      <div className="fld">
        <label className="label">ملاحظة المختص</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="سياق علاجي موجز، تفضيلات الموعد، احتياجات خاصة…" dir="auto" />
      </div>
      <div className="row" style={{ gap: 10, marginBottom: 18 }}>
        <button className="btn btn-ghost sm" disabled={!canSchedule} onClick={() => act(r.id, 'progress', { sched: { when, via, sessions, note } }, 'حُفِظت الجدولة وانتقل الطلب إلى قيد المعالجة.')}><I name="save" size={16} /> حفظ الجدولة</button>
        <span className="muted">احفظ الجدولة أولاً، ثم سجّل النتيجة لرفعها للاعتماد.</span>
      </div>

      <div style={{ borderTop: '1px dashed var(--border-default)', paddingTop: 16 }}>
        {isAssess && (
          <div className="fld">
            <label className="label">خلاصة عامل المناسبة النفسية <span className="req">*</span> <span className="hint">(يُرفع للمركز ضمن دراسة الحالة)</span></label>
            <div className="chips">{FIT.map((f) => <button key={f} className={'chip' + (fit === f ? ' on' : '')} onClick={() => setFit(f)}>{f}</button>)}</div>
          </div>
        )}
        <div className="fld">
          <label className="label">{isAssess ? 'خلاصة التقييم النفسي' : 'نتيجة الخدمة'} <span className="req">*</span></label>
          <textarea value={result} onChange={(e) => setResult(e.target.value)} placeholder={isAssess ? 'ملخص الحالة النفسية وأثرها على المناسبة للشمول…' : 'ما تمّ في الجلسة/الرعاية، حالة المشمول، والتوصية بالمتابعة…'} dir="auto" />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary sm" disabled={!canFinish} onClick={() => act(r.id, 'review', { sched: { when, via, sessions, note }, result: (isAssess ? `[${fit}] ` : '') + result }, 'رُفعت النتيجة لمدير الخدمات للاعتماد.')}><I name="send" size={17} /> إنجاز ورفع للاعتماد</button>
        </div>
      </div>
    </Card>
  );
}

// ===== الإشعارات =====
const NT = { info: ['var(--info-10)', 'var(--color-info)'], primary: ['var(--green-10)', 'var(--color-primary)'], warning: ['var(--warning-10)', 'var(--color-warning)'], success: ['var(--success-10)', 'var(--color-success)'], error: ['var(--error-10)', 'var(--color-error)'] };
const NOTIFS = [];
function Notifications({ persona, go }) {
  const [items, setItems] = useState(NOTIFS.filter((n) => persona === 'manager' || !n.mgr));
  const markAll = () => setItems((x) => x.map((n) => ({ ...n, unread: false })));
  return (
    <div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات الطلبات الواردة من المركز، وما يتطلب اعتماداً، واكتمال الخدمات المبلَّغة.</p>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-ghost sm" onClick={markAll}><I name="done_all" size={17} /> تعليم الكل كمقروء</button>
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
                {n.action && <button className="btn btn-ghost sm" style={{ marginTop: 8 }} onClick={() => go(n.action)}><I name="open_in_new" size={15} /> فتح</button>}
              </div>
              {n.unread && <div className="dot-unread" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== المراسلات مع المركز =====
const SEED_MSGS = [];
function Messages() {
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState(SEED_MSGS);
  const send = () => { if (!text.trim()) return; setMsgs((m) => [...m, { side: 'out', who: 'مختص الصحة', t: 'الآن', text: text.trim() }]); setText(''); };
  return (
    <div>
      <h2 className="h2">المراسلات</h2>
      <p className="lede">قناة مؤمّنة مع مركز الحماية لتنسيق الخدمات العلاجية. الهوية تُعرض بالرمز السري، ويُسجَّل كل تبادل في التدقيق (م15، م16).</p>
      <div className="thread-head"><I name="health_and_safety" size={17} color="var(--color-primary)" fill /><span>أنت: <b>مختص الخدمات الصحية</b> · تخاطب مركز الحماية</span></div>
      <div className="conf-note"><I name="shield_lock" size={16} /> يُكتفى بالرمز السري في الواجهة؛ التفاصيل العلاجية محصورة بالمختص المعالِج.</div>
      <Card className="card pad">
        <div className="msg-list">
          {msgs.map((m, i) => (<div className={'msg ' + m.side} key={i}><div className="msg-meta"><b>{m.who}</b> · {m.t}</div>{m.text}</div>))}
        </div>
        <div className="composer">
          <button className="iconbtn" title="إرفاق مستند"><I name="attach_file" size={20} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="رسالة إلى المركز…" dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <button className="send" onClick={send}><I name="send" size={20} /></button>
        </div>
      </Card>
    </div>
  );
}

const NAV_STAFF = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' },
  { id: 'requests', t: 'طلباتي', icon: 'medical_information', badge: () => REQUESTS.filter((r) => r.status === 'new').length },
  { id: 'messages', t: 'المراسلات', icon: 'forum', badge: () => 1 },
  { id: 'notifications', t: 'الإشعارات', icon: 'notifications', badge: () => 2 },
];
const NAV_MGR = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' },
  { id: 'requests', t: 'كل الطلبات', icon: 'medical_information' },
  { id: 'approvals', t: 'بانتظار الاعتماد', icon: 'rate_review', badge: () => REQUESTS.filter((r) => r.status === 'review').length },
  { id: 'messages', t: 'المراسلات', icon: 'forum', badge: () => 1 },
  { id: 'notifications', t: 'الإشعارات', icon: 'notifications', badge: () => 1 },
];

function signOut() {
  fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = 'http://localhost:3000/'; }).catch(() => { window.location.href = 'http://localhost:3000/'; });
}

function App() {
  const [persona, setPersona] = useState('staff');
  const [active, setActive] = useState('dashboard');
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState(null);
  const [region, setRegion] = useState('');
  const [toast, setToast] = useState('');
  const [, force] = useState(0);
  React.useEffect(() => {
    REQUESTS = pullRequests(); force((n) => n + 1);
    const un = HemayaBus.subscribe(() => { REQUESTS = pullRequests(); force((n) => n + 1); });
    // مزامنة حيّة بين البوّابات: أيّ تغيير في referrals (سلطة الصحة) → أعِد الجلب من الخادم وأعِد hydrate.
    // مزامنة حيّة بين البوّابات: أيّ تغيير في referrals → أعِد الجلب (مؤمَّنٌ بـRLS) وأعِد hydrate.
    // (بلا مُرشِّح على القناة — إعادة الجلب تُرجع صفوف السلطة فقط؛ المُرشِّح على postgres_changes يمنع الأحداث في هذه النسخة.)
    const sb = createClient();
    const ch = sb.channel('rt-referrals-health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals' },
        () => { refetchReferrals('health').then((rows) => { if (Array.isArray(rows)) HemayaBus.hydrate(rows); }).catch(() => {}); })
      .subscribe();
    return () => { un(); try { sb.removeChannel(ch); } catch (e) {} };
  }, []);
  const NAV = persona === 'staff' ? NAV_STAFF : NAV_MGR;
  const allRegions = [...new Set(REQUESTS.map((r) => r.region || 'RUH'))];
  const go = (id) => { setActive(id); setReq(null); setOpen(false); };
  const openReq = (r) => { setReq(r); if (typeof window !== 'undefined') window.scrollTo(0, 0); };
  const switchPersona = (p) => { setPersona(p); setActive('dashboard'); setReq(null); setRegion(''); };
  const act = (id, status, patch, msg) => {
    HemayaBus.update(id, Object.assign({ status, _by: persona === 'manager' ? 'مدير الخدمات' : staffOf(ME).name }, patch),
      status === 'done' ? 'اعتماد النتيجة والرد على المركز' : status === 'review' ? 'رفع النتيجة لاعتماد المدير' : status === 'progress' ? 'حفظ الجدولة وبدء المعالجة' : 'استلام الإحالة وإسنادها');
    REQUESTS = pullRequests();
    setReq(null); force((n) => n + 1);
    setActive(persona === 'manager' && status === 'done' ? 'approvals' : 'requests');
    setToast(msg); setTimeout(() => setToast(''), 4500);
  };
  let view;
  if (req) view = <Detail r={req} persona={persona} onBack={() => setReq(null)} act={act} />;
  else if (active === 'dashboard') view = <Dashboard persona={persona} openReq={openReq} go={go} region={region} />;
  else if (active === 'requests') view = <Requests persona={persona} openReq={openReq} region={region} />;
  else if (active === 'approvals') view = <Requests persona={persona} openReq={openReq} initFilter="review" region={region} />;
  else if (active === 'messages') view = <StaffMessages authority="health" senderLabel="مختص الخدمات الصحية" />;
  else view = <StaffNotifications go={go} />;
  const curT = req ? req.id : (NAV.find((n) => n.id === active) || {}).t;
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="health_and_safety" size={22} fill color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.25 }}>بوابة وزارة الصحة</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>الخدمات العلاجية لمشمولي الحماية</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-group">القائمة</div>
          {NAV.map((n) => {
            const b = n.badge ? n.badge() : 0;
            return (
              <button key={n.id} className={'nav-item' + (active === n.id && !req ? ' on' : '')} onClick={() => go(n.id)}>
                <I name={n.icon} size={20} /> <span>{n.t}</span>
                {b ? <span className="nav-badge">{b}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="side-foot">خدمات م14/5 (الإرشاد النفسي والاجتماعي والرعاية الطبية) والتقييم م9/1. تبادل مؤمّن مع مركز الحماية. مبنية على نظام Platforms Code.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{curT}</span>
          <span className="who">
            {persona === 'manager' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', background: 'var(--surface-card)' }} title="تصفية المنطقة — إشراف الإدارة على الوحدات الإقليمية">
                <I name="location_on" size={15} color="var(--color-primary)" />
                <select value={region} onChange={(e) => { setRegion(e.target.value); setReq(null); }} style={{ border: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)', cursor: 'pointer' }}>
                  <option value="">كل المناطق</option>
                  {allRegions.map((code) => <option key={code} value={code}>{regionDisp(code)}</option>)}
                </select>
              </span>
            )}
            <div className="persona">
              <button className={persona === 'staff' ? 'on' : ''} onClick={() => switchPersona('staff')}><I name="medical_information" size={15} /> مختص</button>
              <button className={persona === 'manager' ? 'on' : ''} onClick={() => switchPersona('manager')}><I name="shield_person" size={15} /> مدير</button>
            </div>
            <Tag tone={persona === 'manager' ? 'primary' : 'info'} size="sm" iconLeft={<I name={persona === 'manager' ? 'shield_person' : 'badge'} size={13} />}>{persona === 'manager' ? 'مدير الخدمات' : staffOf(ME).name}</Tag>
            <div className="avatar"><I name="badge" size={18} /></div>
            <button className="to-signout" title="تسجيل الخروج" onClick={signOut}><I name="logout" size={18} /></button>
          </span>
        </header>
        <main className="content">
          {toast && <InlineAlert kind="success" title="تمّ" style={{ marginBottom: 16 }}>{toast}</InlineAlert>}
          {view}
        </main>
      </div>
    </div>
  );
}

// مُغلِّف — بوابة تأجيل للتركيب (يتفادى عدم تطابق hydration بسبب localStorage للناقل)
export function HealthPortal({ initialData }) {
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    if (initialData && initialData.length) HemayaBus.hydrate(initialData);
    HemayaBus.setPersister((row, patch, note) => {
      const result = { sched: row.sched || null, result: row.result || null };
      referralUpdate(row._rid, row.status, row.assignee || null, result, note || "");
    });
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <App />;
}
