'use client';
/* ============================================================
   بوابة وزارة الداخلية — اللجنة الدائمة لطلبات المساعدة القانونية (المسار الأجنبي · المادة السادسة).
   منقول من «بوابة وزارة الداخلية/البوابة.html». window/DS → @hemaya/ui، window.scrollTo محروس، mount→export.
   ============================================================ */
import React, { useState } from "react";
import { registerForeign, notifyForeign } from "../lib/foreign-actions";
import { StaffNotifications, StaffMessages } from "./staff-feeds";
const MoiMessages = () => <StaffMessages authority="moi" senderLabel="وزارة الداخلية" source="foreign" />;
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import "./interior.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// ===== حالة الطلب الأجنبي من منظور اللجنة الدائمة =====
const ST = {
  inbox:    { t: 'وارد — لم يُسجَّل', tone: ['var(--warning-10)','var(--warning-70)'], icon: 'inbox' },
  draft:    { t: 'مسوّدة تسجيل', tone: ['var(--info-10)','var(--info-70)'], icon: 'edit_note' },
  sent:     { t: 'مرفوع للمركز', tone: ['var(--green-10)','var(--green-80)'], icon: 'send' },
  studying: { t: 'قيد الدراسة بالمركز', tone: ['var(--info-10)','var(--color-info)'], icon: 'hourglass_top' },
  approved: { t: 'صدر قرار النائب — موافقة', tone: ['var(--success-10)','var(--success-70)'], icon: 'verified' },
  declined: { t: 'صدر قرار النائب — اعتذار', tone: ['var(--error-10)','var(--color-error)'], icon: 'block' },
  notified: { t: 'أُبلِغت السلطة الأجنبية', tone: ['var(--surface-subtle)','var(--text-secondary)'], icon: 'mark_email_read' },
};
const CAT = { reporter: 'مبلّغ', witness: 'شاهد', expert: 'خبير', victim: 'ضحية' };

// أعلام مبسّطة (رمز نصّي — لا صور)
const FLAG = {
  'الأردن': ['#000','#fff','الأ'], 'الإمارات': ['#00732f','#fff','إ'], 'مصر': ['#ce1126','#fff','م'],
  'فرنسا': ['#0055a4','#fff','FR'], 'المغرب': ['#c1272d','#fff','م'],
};
function Flag({ country }) {
  const f = FLAG[country] || ['var(--surface-subtle)','var(--text-secondary)','—'];
  return <span className="flag"><span className="flag-em" style={{ background: f[0], color: f[1] }}>{f[2]}</span>{country}</span>;
}

const REQUESTS = []; // الطلبات الأجنبيّة الحقيقيّة فقط (initialData من foreign_requests) — لا بذور مُلفّقة

function Stat({ icon, v, l, bg, fg }) {
  return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></Card>;
}
function Pill({ status }) { const s = ST[status]; return <span className="pill" style={{ background: s.tone[0], color: s.tone[1] }}><I name={s.icon} size={13} fill /> {s.t}</span>; }

// ===== لوحة المعلومات =====
function Dashboard({ openReq }) {
  const inbox = REQUESTS.filter((r) => r.status === 'inbox').length;
  const active = REQUESTS.filter((r) => r.status === 'sent' || r.status === 'studying').length;
  const decided = REQUESTS.filter((r) => r.status === 'approved' || r.status === 'declined').length;
  const queue = REQUESTS.filter((r) => r.status === 'inbox' || r.status === 'draft');
  return (
    <div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">اللجنة الدائمة لطلبات المساعدة القانونية — تتلقّى طلبات الحماية الواردة من السلطات الأجنبية المختصة، وتُحيلها لمركز الحماية، وتُبلِّغ السلطة الأجنبية والشخص بالقرار (المادة السادسة من النظام · وفق مبدأ المعاملة بالمثل).</p>
      <div className="stats">
        <Stat icon="inbox" v={inbox} l="طلبات واردة لم تُسجَّل" bg="var(--warning-10)" fg="var(--color-warning)" />
        <Stat icon="send" v={active} l="مرفوعة وقيد الدراسة" bg="var(--green-10)" fg="var(--color-primary)" />
        <Stat icon="gavel" v={decided} l="صدر فيها قرار النائب" bg="var(--info-10)" fg="var(--color-info)" />
        <Stat icon="public" v={new Set(REQUESTS.map((r)=>r.country)).size} l="سلطات أجنبية متعاملة" bg="var(--success-10)" fg="var(--color-success)" />
      </div>
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="pad" style={{ paddingBottom: 8 }}><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>طلبات تنتظر إجراءك</b></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المرجع</th><th>الدولة الطالبة</th><th>الصفة</th><th>الأساس</th><th>ورد</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id} className="clk" onClick={() => openReq(r)}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                  <td><Flag country={r.country} /></td>
                  <td><Tag tone="info" size="sm">{CAT[r.cat]}</Tag></td>
                  <td className="muted">{r.basis}</td>
                  <td className="muted">{r.arrived}</td>
                  <td><Pill status={r.status} /></td>
                  <td><span className="link">{r.status === 'inbox' ? 'تسجيل وإحالة' : 'متابعة'} <I name="chevron_left" size={16} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===== الطلبات الواردة =====
function Incoming({ openReq }) {
  const [filter, setFilter] = useState('all');
  const rows = REQUESTS.filter((r) =>
    filter === 'all' ? true :
    filter === 'inbox' ? (r.status === 'inbox' || r.status === 'draft') :
    filter === 'active' ? (r.status === 'sent' || r.status === 'studying') :
    (r.status === 'approved' || r.status === 'declined' || r.status === 'notified'));
  return (
    <div>
      <h2 className="h2">الطلبات الأجنبية الواردة</h2>
      <p className="lede">طلبات المساعدة القانونية الواردة من السلطات الأجنبية المختصة عبر القنوات الرسمية. سجّل الطلب وأحِله إلى مركز الحماية ليُدرَس بالمعاملة بالمثل.</p>
      <div className="filters">
        {[['all', 'الكل'], ['inbox', 'بانتظار التسجيل'], ['active', 'قيد الدراسة'], ['done', 'صدر فيها قرار']].map(([k, t]) => (
          <button key={k} className={'fbtn' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t}</button>
        ))}
      </div>
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>المرجع</th><th>الدولة / السلطة</th><th>الصفة</th><th>الأساس</th><th>ورد</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clk" onClick={() => openReq(r)}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                  <td><Flag country={r.country} /><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.authority}</div></td>
                  <td><Tag tone="info" size="sm">{CAT[r.cat]}</Tag></td>
                  <td className="muted">{r.basis}</td>
                  <td className="muted">{r.arrived}</td>
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

// ===== تفاصيل الطلب + تسجيل/إحالة =====
const TRACK = {
  inbox:    0, draft: 0, sent: 1, studying: 2, approved: 3, declined: 3, notified: 4,
};
function Detail({ r, onBack, onRegister }) {
  const isApproved = r.status === 'approved' || r.outcome === 'approved';
  let stage = TRACK[r.status];
  if (r.status === 'notified' && isApproved) stage = 5;
  const steps = [
    { t: 'ورود الطلب من السلطة الأجنبية', d: `${r.authority} · ${r.country}`, when: r.arrived },
    { t: 'التسجيل والإحالة لمركز الحماية', d: 'تحقّق اللجنة من سند الطلب والمعاملة بالمثل ثم ترفعه لإدارة البرنامج', when: stage >= 1 ? 'تمّت' : null },
    { t: 'الدراسة والتصويت بالمركز', d: 'إدارة برنامج الحماية تدرس الطلب وتصوّت بالأغلبية كأي طلب', when: stage >= 2 ? 'جارية' : null },
    { t: 'بتّ النائب العام', d: 'يبتّ النائب وفق توصية المركز ومبدأ المعاملة بالمثل (م6)', when: stage >= 3 ? (r.status === 'declined' || r.outcome === 'declined' ? 'اعتذار مسبّب' : 'موافقة') : null },
    { t: isApproved ? 'إبلاغ السلطة الأجنبية والشخص بالموافقة' : 'إبلاغ السلطة الأجنبية بالقرار', d: 'تتولّى اللجنة تبليغ القرار للسلطة الأجنبية والشخص المطلوب حمايته', when: stage >= 4 ? 'تمّ' : null },
  ];
  if (isApproved) steps.push({ t: 'الإدراج ضمن المشمولين وسريان البرنامج', d: 'يدخل الشخص ضمن المشمولين بالحماية لدى المركز، ويسري عليه ما يسري على باقي المشمولين: تدابير الحماية المقرَّرة والمتابعة الأمنية ومراجعات دورة الحياة (م12–م14)', when: stage >= 5 ? 'سارٍ' : null });
  return (
    <div className="rf">
      <button className="link" onClick={onBack} style={{ marginBottom: 14 }}><I name="arrow_forward" size={16} /> رجوع للقائمة</button>
      <div className="rf-top">
        <div className="rf-kicker">طلب مساعدة قانونية أجنبي · المادة السادسة</div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="rf-h">{r.id}</h2>
          <Pill status={r.status} />
        </div>
      </div>

      <div className="rf-sec">
        <div className="rf-sec-head">
          <div className="rf-sec-n"><I name="public" size={16} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="rf-sec-t">السلطة الأجنبية الطالبة</h3>
            <p className="rf-sec-sub">الجهة القضائية أو التنفيذية المختصة في الدولة الأجنبية.</p>
          </div>
          <span className="rf-fed"><I name="verified_user" size={13} /> قناة رسمية</span>
        </div>
        <div className="rf-sec-body">
          <dl className="kv">
            <dt>الدولة</dt><dd><Flag country={r.country} /></dd>
            <dt>السلطة</dt><dd>{r.authority}</dd>
            <dt>صفة الجهة</dt><dd>{r.authKind}</dd>
            <dt>المرجع الأجنبي</dt><dd className="mono">{r.foreignRef}</dd>
            <dt>أساس المعاملة بالمثل</dt><dd>{r.basis}</dd>
          </dl>
        </div>
      </div>

      <div className="rf-sec">
        <div className="rf-sec-head">
          <div className="rf-sec-n"><I name="person" size={16} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="rf-sec-t">الشخص المطلوب حمايته</h3>
            <p className="rf-sec-sub">الهوية تُعرض بالرمز السري حفاظاً على السرية (م15، م16).</p>
          </div>
        </div>
        <div className="rf-sec-body">
          <dl className="kv">
            <dt>الرمز السري</dt><dd className="mono">{r.secret}</dd>
            <dt>الصفة</dt><dd>{CAT[r.cat]}</dd>
            <dt>الموقع في المملكة</dt><dd>{r.city}</dd>
          </dl>
          <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-body)' }}>
            <b style={{ color: 'var(--text-strong)' }}>موجز الواقعة والطلب:</b> {r.summary}
          </div>
        </div>
      </div>

      <div className="rf-sec">
        <div className="rf-sec-head">
          <div className="rf-sec-n"><I name="timeline" size={16} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="rf-sec-t">مسار الطلب</h3>
            <p className="rf-sec-sub">من ورود الطلب حتى إبلاغ القرار — يُعامَل بالمثل كأي طلب حماية.</p>
          </div>
        </div>
        <div className="rf-sec-body">
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

      {(r.status === 'inbox' || r.status === 'draft') && (
        <RegisterPanel r={r} onRegister={onRegister} />
      )}
      {r.status === 'approved' && (
        <Card className="card pad" style={{ borderColor: 'var(--success-50)' }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}><I name="verified" size={20} color="var(--color-success)" fill /><b style={{ color: 'var(--text-strong)' }}>صدر قرار النائب العام بالموافقة</b></div>
          <InlineAlert kind="success" title="يُدرَج ضمن المشمولين بالحماية" style={{ marginBottom: 14 }}>بموافقة النائب العام يدخل الشخص ضمن المشمولين ببرنامج الحماية لدى المركز، <b>ويسري عليه ما يسري على باقي المشمولين</b> من تدابير الحماية المقرَّرة والمتابعة الأمنية ومراجعات دورة الحياة (م12–م14). ودور اللجنة هنا تبليغ السلطة الأجنبية والشخص بالقرار.</InlineAlert>
          <p className="muted" style={{ margin: '0 0 14px' }}>أبلِغ السلطة الأجنبية والشخص بقرار الموافقة على توفير الحماية وفق المعاملة بالمثل.</p>
          <button className="btn btn-primary sm" onClick={() => onRegister(r.id, 'notified', 'أُبلِغت السلطة الأجنبية والشخص بالموافقة، وأُدرِج الشخص ضمن المشمولين بالحماية بالمركز.', 'approved')}><I name="outgoing_mail" size={17} /> تبليغ السلطة الأجنبية والشخص</button>
        </Card>
      )}
      {r.status === 'declined' && (
        <Card className="card pad" style={{ borderColor: 'var(--error-50)' }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}><I name="block" size={20} color="var(--color-error)" fill /><b style={{ color: 'var(--text-strong)' }}>صدر اعتذار مسبّب من النائب العام</b></div>
          <p className="muted" style={{ margin: '0 0 14px' }}>أبلِغ السلطة الأجنبية بالاعتذار المسبّب عن الطلب.</p>
          <button className="btn btn-ghost sm" onClick={() => onRegister(r.id, 'notified', 'أُبلِغت السلطة الأجنبية بالاعتذار المسبّب.', 'declined')}><I name="outgoing_mail" size={17} /> تبليغ السلطة الأجنبية</button>
        </Card>
      )}
      {r.status === 'notified' && (
        <Card className="card pad" style={{ borderColor: isApproved ? 'var(--success-50)' : 'var(--border-subtle)' }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}><I name="mark_email_read" size={20} color={isApproved ? 'var(--color-success)' : 'var(--text-secondary)'} fill /><b style={{ color: 'var(--text-strong)' }}>اكتمل التبليغ — انتهى دور اللجنة في هذا الطلب</b></div>
          {isApproved
            ? <InlineAlert kind="success" title="مشمول بالحماية">أُبلِغت السلطة الأجنبية والشخص بالموافقة، والشخص الآن ضمن المشمولين لدى المركز، يسري عليه ما يسري على باقي المشمولين.</InlineAlert>
            : <InlineAlert kind="info" title="انتهى الطلب">أُبلِغت السلطة الأجنبية بالاعتذار المسبّب، وأُغلق الطلب.</InlineAlert>}
        </Card>
      )}
    </div>
  );
}

function RegisterPanel({ r, onRegister }) {
  const [basis, setBasis] = useState(r.basis || '');
  const [att, setAtt] = useState({ official: false, recip: false, risk: false });
  const [ack, setAck] = useState(false);
  const ready = basis && att.official && att.recip && ack;
  const BASES = ['اتفاقية ثنائية', 'اتفاقية الرياض العربية', 'اتفاقية الأمم المتحدة لمكافحة الفساد', 'مبدأ المعاملة بالمثل'];
  return (
    <div className="rf-sec" style={{ borderColor: 'var(--green-20)' }}>
      <div className="rf-sec-head" style={{ background: 'var(--green-10)' }}>
        <div className="rf-sec-n"><I name="send" size={16} /></div>
        <div style={{ flex: 1 }}>
          <h3 className="rf-sec-t">التسجيل والإحالة لمركز الحماية</h3>
          <p className="rf-sec-sub">تحقّق من سند الطلب وأساس المعاملة بالمثل، ثم أحِله لإدارة البرنامج ليُدرَس ويُصوَّت عليه.</p>
        </div>
      </div>
      <div className="rf-sec-body rf">
        <div className="rf-fld">
          <label className="rf-label">أساس المعاملة بالمثل <span className="rf-req">*</span></label>
          <div className="rf-chips">
            {BASES.map((b) => <button key={b} className={'rf-chip' + (basis === b ? ' on' : '')} onClick={() => setBasis(b)}>{b}</button>)}
          </div>
        </div>
        <div className="rf-recip">
          <div className="row" style={{ gap: 7 }}><I name="handshake" size={17} color="var(--color-info)" fill /><b style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>تأكيد المعاملة بالمثل</b></div>
          <p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>يُعامَل الطلب الأجنبي كطلب المواطن/المقيم متى توافر مبدأ المعاملة بالمثل؛ ويبتّ فيه النائب العام بناءً على توصية مركز الحماية (المادة السادسة).</p>
        </div>
        <div className="rf-fld" style={{ marginTop: 16 }}>
          <label className="rf-label">سندات الطلب <span className="rf-req">*</span> <span className="rf-hint">(الطلب الرسمي المترجم وسند المعاملة بالمثل إلزاميان)</span></label>
          <div className="rf-attach-grid">
            <label className={'rf-attach' + (!att.official ? ' req' : '')}><input type="checkbox" checked={att.official} onChange={(e) => setAtt({ ...att, official: e.target.checked })} /> الطلب الرسمي المُترجَم ومُصدَّق</label>
            <label className={'rf-attach' + (!att.recip ? ' req' : '')}><input type="checkbox" checked={att.recip} onChange={(e) => setAtt({ ...att, recip: e.target.checked })} /> سند المعاملة بالمثل / الاتفاقية</label>
            <label className="rf-attach"><input type="checkbox" checked={att.risk} onChange={(e) => setAtt({ ...att, risk: e.target.checked })} /> مستندات تقييم الخطر (إن وُجدت)</label>
          </div>
        </div>
        <label className="rf-ack" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>أُقرّ بأن الطلب ورد عبر قناة رسمية مختصة، وأن سند المعاملة بالمثل متحقّق، وأُحيله إلى مركز الحماية لدراسته والبتّ فيه وفق المادة السادسة من النظام.</span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8, gap: 10 }}>
          <button className="btn btn-ghost sm">حفظ كمسوّدة</button>
          <button className="btn btn-primary sm" disabled={!ready} onClick={() => onRegister(r.id, 'sent', 'سُجِّل الطلب وأُحيل إلى مركز الحماية للدراسة.', null, basis)}><I name="send" size={17} /> إحالة لمركز الحماية</button>
        </div>
      </div>
    </div>
  );
}

// ===== الإشعارات =====
const NT = { info: ['var(--info-10)', 'var(--color-info)'], primary: ['var(--green-10)', 'var(--color-primary)'], warning: ['var(--warning-10)', 'var(--color-warning)'], success: ['var(--success-10)', 'var(--color-success)'], error: ['var(--error-10)', 'var(--color-error)'] };
const NOTIFS = [];
function Notifications({ go }) {
  const [items, setItems] = useState(NOTIFS);
  const markAll = () => setItems((x) => x.map((n) => ({ ...n, unread: false })));
  return (
    <div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات الطلبات الواردة، وتقدّم الدراسة بالمركز، وقرارات النائب العام التي تستوجب التبليغ.</p>
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
                {n.action && <button className="btn btn-ghost sm" style={{ marginTop: 8 }} onClick={() => go(n.action)}><I name="open_in_new" size={15} /> فتح الطلبات الواردة</button>}
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
  const send = () => { if (!text.trim()) return; setMsgs((m) => [...m, { side: 'out', who: 'اللجنة الدائمة', t: 'الآن', text: text.trim() }]); setText(''); };
  return (
    <div>
      <h2 className="h2">المراسلات</h2>
      <p className="lede">قناة مؤمّنة مع مركز الحماية لتنسيق الطلبات الأجنبية. الهوية تُعرض بالرمز السري، ويُسجَّل كل تبادل في التدقيق.</p>
      <div className="thread-head"><I name="apartment" size={17} color="var(--color-primary)" fill /><span>أنت: <b>منسّق اللجنة الدائمة</b> · تخاطب مركز الحماية</span></div>
      <div className="conf-note"><I name="shield_lock" size={16} /> تواصل مرتبط بطلبات أجنبية؛ يُكتفى بالرمز السري في الواجهة حفاظاً على السرية (م15، م16).</div>
      <Card className="card pad">
        <div className="msg-list">
          {msgs.map((m, i) => (
            <div className={'msg ' + m.side} key={i}>
              <div className="msg-meta"><b>{m.who}</b> · {m.t}</div>
              {m.text}
            </div>
          ))}
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

// ===== الأرشيف =====
function Archive() {
  return (
    <div>
      <h2 className="h2">الأرشيف</h2>
      <p className="lede">الطلبات الأجنبية المنتهية والقرارات المبلَّغة. الوصول مقيّد بصلاحية اللجنة ويُسجَّل في التدقيق.</p>
      <Card className="card pad" style={{ textAlign: 'center', padding: '48px 20px' }}>
        <I name="inventory_2" size={40} color="var(--text-disabled)" />
        <p className="muted" style={{ marginTop: 12 }}>لا توجد عناصر مؤرشفة في هذا العرض التجريبي.</p>
      </Card>
    </div>
  );
}

const NAV = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard', C: Dashboard },
  { id: 'incoming', t: 'الطلبات الأجنبية الواردة', icon: 'public', C: Incoming, badge: REQUESTS.filter((r)=>r.status==='inbox').length },
  { id: 'messages', t: 'المراسلات', icon: 'forum', C: MoiMessages, badge: 1 },
  { id: 'notifications', t: 'الإشعارات', icon: 'notifications', C: StaffNotifications, badge: 2 },
  { id: 'archive', t: 'الأرشيف', icon: 'inventory_2', C: Archive },
];

function signOut() {
  fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; });
}

function App() {
  const [active, setActive] = useState('dashboard');
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState(null);
  const [toast, setToast] = useState('');
  const [, force] = useState(0);
  const go = (id) => { setActive(id); setReq(null); setOpen(false); };
  const openReq = (r) => { setReq(r); if (typeof window !== 'undefined') window.scrollTo(0, 0); };
  const onRegister = (id, status, msg, outcome, basis) => {
    const target = REQUESTS.find((x) => x.id === id);
    if (target) {
      target.status = status; if (outcome) target.outcome = outcome;
      // التثبيت الخادميّ (م6): تسجيل/إحالة أو تبليغ السلطة الأجنبية.
      if (target._real && target._rid) {
        if (status === 'sent') registerForeign(target._rid, basis || target.basis || null);
        else if (status === 'notified') notifyForeign(target._rid, outcome || target.outcome || '-');
      }
    }
    setReq(null); setActive('incoming'); force((n) => n + 1);
    setToast(msg); setTimeout(() => setToast(''), 4500);
  };
  const cur = NAV.find((n) => n.id === active);
  const Comp = cur.C;
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="public" size={22} fill color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.25 }}>بوابة وزارة الداخلية</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>اللجنة الدائمة لطلبات المساعدة القانونية</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={'nav-item' + (active === n.id && !req ? ' on' : '')} onClick={() => go(n.id)}>
              <I name={n.icon} size={20} /> <span>{n.t}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">المدخل الثالث — المسار الأجنبي (م6). تبادل مؤمّن مع مركز الحماية. مبنية على نظام Platforms Code.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{req ? req.id : cur.t}</span>
          <span className="who">
            <Tag tone="info" size="sm" iconLeft={<I name="account_balance" size={13} />}>اللجنة الدائمة</Tag>
            <div className="avatar"><I name="badge" size={18} /></div>
            <button className="to-signout" title="تسجيل الخروج" onClick={signOut}><I name="logout" size={18} /></button>
          </span>
        </header>
        <main className="content">
          {toast && <InlineAlert kind="success" title="تمّ" style={{ marginBottom: 16 }}>{toast}</InlineAlert>}
          {req
            ? <Detail r={req} onBack={() => setReq(null)} onRegister={onRegister} />
            : <Comp go={go} openReq={openReq} />}
        </main>
      </div>
    </div>
  );
}

export function InteriorPortal({ initialData }) {
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    if (initialData && initialData.length) { REQUESTS.length = 0; initialData.forEach((r) => REQUESTS.push(r)); }
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <App />;
}
