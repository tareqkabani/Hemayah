'use client';
/* ============================================================
   بوابة الجهات المختصة — منقولة من «بوابة الجهات المختصة/البوابة.html»
   window/HP → @hemaya/ui. النموذج والعاجل من ./RecommendationForm.
   ============================================================ */
import React, { useState } from "react";
import { StaffNotifications } from "./staff-feeds";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, RiskLevel } from "@hemaya/ui";
import { RecommendationForm, UrgentForm } from "./RecommendationForm";
import { HemayaBranch } from "./branch-roles";
import { useRecommendations } from "./recommendation-store";
import { submitRecommendation } from "@/lib/entity-actions";
import "./entities.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// حالة الطلب من منظور الجهة المختصة
const ST = {
  awaiting: { t: 'بانتظار توصيتنا', tone: ['var(--warning-10)','var(--warning-70)'], icon: 'assignment_late' },
  draft:    { t: 'مسوّدة', tone: ['var(--info-10)','var(--info-70)'], icon: 'edit_note' },
  pending:  { t: 'بانتظار اعتماد الرئيس', tone: ['var(--green-10)','var(--green-80)'], icon: 'hourglass_top' },
  sent:     { t: 'مرفوعة للمركز', tone: ['var(--success-10)','var(--success-70)'], icon: 'task_alt' },
};
// ===== مصادر البيانات موسومة بالجهة (entity) — تُرشَّح بالجهة الحالية في كل شاشة (عزل بمبدأ الحاجة إلى المعرفة) =====
const byEnt = (rows, ent) => rows.filter((r) => r.entity === ent);
const byScope = (rows, ent, br) => rows.filter((r) => r.entity === ent && (!br || (r.region || 'RUH') === br));
const stamp = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

const INCOMING = []; // لا بيانات مُلفّقة — تُربَط بجدول recommendations الحقيقيّ لاحقاً
const SENT = []; // لا بيانات مُلفّقة — تُربَط بجدول recommendations الحقيقيّ لاحقاً

function Stat({ icon, v, l, bg, fg }) {
  return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></Card>;
}
function Pill({ status }) { const s = ST[status]; return <span className="pill" style={{ background: s.tone[0], color: s.tone[1] }}><I name={s.icon} size={13} fill /> {s.t}</span>; }

// ===== لوحة المعلومات =====
function Dashboard({ go, openRec, ent, br, recIn = [], recSent = [] }) {
  const incoming = byScope(recIn, ent, br);
  const sent = byScope(recSent, ent, br);
  const awaiting = incoming.filter((r) => r.status === 'awaiting').length;
  const overdue = incoming.filter((r) => r.days >= 4).length;
  return (
    <div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">متابعة الطلبات المحالة من المركز ورفع التوصيات خلال المهلة النظامية (5 أيام عمل، م7 لائحة).</p>
      <div className="conf-note" style={{ marginBottom: 18 }}><I name="shield_lock" size={16} /><span>تعرض هذه البوابة بيانات <b>{ENT_NAMES[ent]}</b> فقط — الطلبات والردود والمراسلات والإشعارات معزولة لكل جهة، والوصول مقيّد بمبدأ الحاجة إلى المعرفة ومُسجَّل في التدقيق.</span></div>
      <div className="stats">
        <Stat icon="assignment_late" v={awaiting} l="بانتظار توصيتنا" bg="var(--warning-10)" fg="var(--color-warning)" />
        <Stat icon="running_with_errors" v={overdue} l="يقترب ميعادها" bg="var(--error-10)" fg="var(--color-error)" />
        <Stat icon="hourglass_top" v={incoming.filter((r)=>r.status==='pending').length} l="بانتظار اعتماد الرئيس" bg="var(--green-10)" fg="var(--color-primary)" />
        <Stat icon="task_alt" v={sent.length} l="توصيات مرفوعة" bg="var(--success-10)" fg="var(--color-success)" />
      </div>
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="pad" style={{ paddingBottom: 8 }}><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>طلبات تنتظر إجراءك</b></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>الرمز السري</th><th>الصفة</th><th>رقم القضية</th><th>أُحيل</th><th>الميعاد</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {incoming.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>لا طلبات واردة لهذه الجهة حالياً.</td></tr>}
              {incoming.map((r) => (
                <tr key={r.secret} className="clk" onClick={() => openRec(r)}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.secret}</td>
                  <td><Tag tone="info" size="sm">{r.cat}</Tag></td>
                  <td className="mono">{r.caseNo}</td>
                  <td className="muted">{r.referred}</td>
                  <td>{r.days >= 4 ? <span className="src" style={{ color: 'var(--color-error)' }}><I name="schedule" size={14} /> متبقٍّ {5 - r.days}</span> : <span className="muted">متبقٍّ {5 - r.days} أيام</span>}</td>
                  <td><Pill status={r.status} /></td>
                  <td><span className="link">{r.status === 'awaiting' ? 'إنشاء التوصية' : 'متابعة'} <I name="chevron_left" size={16} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===== الطلبات المحالة إلينا =====
function Incoming({ openRec, ent, br, recIn = [] }) {
  const [filter, setFilter] = useState('all');
  const all = byScope(recIn, ent, br);
  const rows = all.filter((r) => filter === 'all' || (filter === 'awaiting' && r.status === 'awaiting') || (filter === 'progress' && (r.status === 'draft' || r.status === 'pending')));
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 className="h2">الطلبات الواردة</h2>
        <button className="btn btn-primary sm" onClick={() => openRec({ secret: '— يُسنَد لاحقاً', cat: '', caseNo: '', referred: 'الآن', days: 1, status: 'new', linked: false, entity: ent })}><I name="person_add" size={17} /> طلب نيابةً عن الشخص</button>
      </div>
      <p className="lede">طلبات حماية أحالها المركز لجهتنا لإبداء التوصية. اختر طلباً لفتح نموذج التوصية، أو ابدأ طلباً نيابةً عن الشخص دون طلب سابق.</p>
      <div className="filters">
        {[['all', 'الكل'], ['awaiting', 'بانتظار توصيتنا'], ['progress', 'قيد العمل']].map(([k, t]) => (
          <button key={k} className={'fbtn' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t}</button>
        ))}
      </div>
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>الرمز السري</th><th>الصفة</th><th>رقم القضية</th><th>أُحيل</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>لا طلبات مطابقة لهذه الجهة.</td></tr>}
              {rows.map((r) => (
                <tr key={r.secret} className="clk" onClick={() => openRec(r)}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.secret}</td>
                  <td><Tag tone="info" size="sm">{r.cat}</Tag></td>
                  <td className="mono">{r.caseNo}</td>
                  <td className="muted">{r.referred}</td>
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

// ===== ردودنا =====
function Responses({ ent, br, recSent = [] }) {
  const rows = byScope(recSent, ent, br);
  return (
    <div>
      <h2 className="h2">ردودنا</h2>
      <p className="lede">التوصيات التي رفعناها للمركز. القرار النهائي لإدارة برنامج الحماية بعد الدراسة والتقييم.</p>
      <Card className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>الرمز السري</th><th>الصفة</th><th>رقم القضية</th><th>تاريخ الرفع</th><th>توصيتنا</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>لم ترفع هذه الجهة توصيات بعد.</td></tr>}
              {rows.map((r) => (
                <tr key={r.secret}>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.secret}</td>
                  <td><Tag tone="info" size="sm">{r.cat}</Tag></td>
                  <td className="mono">{r.caseNo}</td>
                  <td className="muted">{r.sentAt}</td>
                  <td><Tag tone={r.outcome === 'توفير' ? 'success' : 'neutral'} size="sm" iconLeft={<I name={r.outcome === 'توفير' ? 'shield' : 'remove_moderator'} size={13} />}>{r.outcome}</Tag></td>
                  <td><Pill status="sent" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===== المراسلات — خيوط موسومة بالجهة (كل جهة ترى خيوطها فقط) =====
const ENT_MSG_AUTHOR = { prosecution: 'النيابة المتخصصة', state_security: 'أمن الدولة', moi: 'الداخلية', nazaha: 'نزاهة', moj: 'العدل' };
const THREADS = []; // لا بيانات مُلفّقة — تُربَط بجدول recommendations الحقيقيّ لاحقاً
const threadsFor = (ent, br) => {
  const B = br || 'RUH';
  const c = THREADS.find((t) => t.entity === ent && t.kind === 'center' && (t.region || 'RUH') === B);
  const a = THREADS.find((t) => t.entity === ent && t.kind === 'applicant' && (t.region || 'RUH') === B);
  return { center: c ? c.msgs.slice() : [], applicant: a ? a.msgs.slice() : [] };
};
function Messages({ ent, br }) {
  const [tab, setTab] = useState('center');
  const [text, setText] = useState('');
  const [threads, setThreads] = useState(() => threadsFor(ent, br));
  const msgs = threads[tab] || [];
  const send = () => { if (!text.trim()) return; setThreads((t) => ({ ...t, [tab]: [...t[tab], { side: 'out', who: tab === 'center' ? ENT_MSG_AUTHOR[ent] : 'محقق القضية', t: 'الآن', text: text.trim() }] })); setText(''); };
  return (
    <div>
      <h2 className="h2">المراسلات</h2>
      <p className="lede">قناة مؤمّنة لتنسيق الإحالات والتوصيات. الهوية تُعرض بالرمز السري، والمحاضر الهاتفية تُوثّق في الملف. خيوط كل جهة معزولة عن غيرها.</p>
      <div className="threads">
        <button className={'thread-tab' + (tab === 'center' ? ' on' : '')} onClick={() => setTab('center')}><I name="apartment" size={16} /> مركز الحماية</button>
        <button className={'thread-tab' + (tab === 'applicant' ? ' on' : '')} onClick={() => setTab('applicant')}><I name="person" size={16} /> طالب الحماية</button>
      </div>
      <div className="thread-head"><I name="support_agent" size={17} color="var(--color-primary)" fill /><span>أنت: <b>ضابط الاتصال — {ENT_MSG_AUTHOR[ent]}</b>{tab === 'center' ? ' · تخاطب مركز الحماية' : ' · تخاطب طالب الحماية'}</span></div>
      {tab === 'applicant' && <div className="conf-note"><I name="shield_lock" size={16} /> تواصل مرتبط بقضيتكم؛ يُكتفى بالرمز السري في الواجهة، ويُسجَّل كل تبادل في التدقيق حفاظاً على السرية (م15، م16).</div>}
      <Card className="card pad">
        <div className="msg-list">
          {msgs.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: '24px 8px' }}>لا مراسلات في هذا الخيط لهذه الجهة بعد — ابدأ بكتابة رسالة.</div>}
          {msgs.map((m, i) => (
            <div className={'msg ' + m.side} key={i}>
              <div className="msg-meta">
                {m.side === 'note' && <I name="call" size={13} color="var(--warning-50)" />}
                <b style={{ color: m.side === 'note' ? 'var(--warning-70)' : 'var(--text-secondary)' }}>{m.who}</b> · {m.t}
              </div>
              {m.text}
            </div>
          ))}
        </div>
        <div className="composer">
          <button className="iconbtn" title="إرفاق مستند"><I name="attach_file" size={20} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tab === 'center' ? 'رسالة إلى المركز…' : 'رسالة إلى طالب الحماية…'} dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <button className="send" onClick={send}><I name="send" size={20} /></button>
        </div>
      </Card>
    </div>
  );
}

// ===== الإشعارات =====
const NT = { info: ['var(--info-10)', 'var(--color-info)'], primary: ['var(--green-10)', 'var(--color-primary)'], warning: ['var(--warning-10)', 'var(--color-warning)'], success: ['var(--success-10)', 'var(--color-success)'] };
const NOTIFS = []; // لا بيانات مُلفّقة — تُربَط بجدول recommendations الحقيقيّ لاحقاً
function Notifications({ go, ent, br }) {
  const [items, setItems] = useState(() => byScope(NOTIFS, ent, br));
  const markAll = () => setItems((x) => x.map((n) => ({ ...n, unread: false })));
  return (
    <div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات الإحالات والمواعيد النظامية والمراسلات وقرارات المركز — خاصّة بجهتكم فقط.</p>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-ghost sm" onClick={markAll}><I name="done_all" size={17} /> تعليم الكل كمقروء</button>
      </div>
      {items.length === 0
        ? <Card className="card pad" style={{ textAlign: 'center', padding: '40px 20px' }}><I name="notifications_off" size={38} color="var(--text-disabled)" /><p className="muted" style={{ marginTop: 12 }}>لا إشعارات لهذه الجهة.</p></Card>
        : <div style={{ display: 'grid', gap: 10 }}>
        {items.map((n, i) => {
          const [bg, fg] = NT[n.tone];
          return (
            <div className={'ntf' + (n.unread ? ' unread' : '')} key={i}>
              <div className="ntf-ico" style={{ background: bg, color: fg }}><I name={n.icon} size={20} fill /></div>
              <div style={{ flex: 1 }}>
                <div className="ntf-t">{n.t}</div>
                <div className="ntf-d">{n.d}</div>
                <div className="ntf-time">{n.time}</div>
                {n.action && <button className="btn btn-ghost sm" style={{ marginTop: 8 }} onClick={() => go(n.action)}><I name="open_in_new" size={15} /> فتح الطلبات المحالة</button>}
              </div>
              {n.unread && <div className="dot-unread" />}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// ===== الأرشيف =====
function Archive() {
  return (
    <div>
      <h2 className="h2">الأرشيف</h2>
      <p className="lede">الطلبات المنتهية والتوصيات المؤرشفة. الوصول مقيّد بصلاحية الجهة ويُسجَّل في التدقيق.</p>
      <Card className="card pad" style={{ textAlign: 'center', padding: '48px 20px' }}>
        <I name="inventory_2" size={40} color="var(--text-disabled)" />
        <p className="muted" style={{ marginTop: 12 }}>لا توجد عناصر مؤرشفة في هذا العرض التجريبي.</p>
      </Card>
    </div>
  );
}

// ===== الحارس الآلي (فحص الطلب الابتدائي نيابةً) — ثلاثي المخرَج =====
function runGuard(scenario) {
  if (scenario === 'block') return {
    verdict: 'block',
    dup: { secret: '—', caseNo: '—', stage: 'بانتظار اعتماد الرئيس' },
    checks: [
      { s: 'block', t: 'تطابق قطعي بالهوية', d: 'يوجد طلب قائم بنفس رقم الهوية وقضية سارية — يُمنَع الإنشاء لمنع التكرار.' },
      { s: 'ok', t: 'اكتمال الحقول الإلزامية', d: 'النموذج مكتمل.' },
      { s: 'skip', t: 'الإسناد التلقائي', d: 'لم يُسنَد — الطلب موقوف لوجود طلب أصلي.' },
    ],
  };
  if (scenario === 'review') return {
    verdict: 'review',
    checks: [
      { s: 'warn', t: 'تطابق محتمل (بلا هوية قطعية)', d: 'الشخص بلا رقم هوية؛ مطابقة احتمالية بالاسم وتاريخ الميلاد والجهة أظهرت تشابهاً — تلزم مراجعة بشرية سريعة قبل الإسناد.' },
      { s: 'warn', t: 'نقص حقل إلزامي', d: 'حقل «امتداد الخطر للغير» غير معبّأ.' },
      { s: 'hold', t: 'الإسناد التلقائي', d: 'مُعلّق لحين اعتماد المراجعة البشرية.' },
    ],
  };
  return {
    verdict: 'clean',
    assigned: { to: 'وحدة الدراسة والتقييم', ref: 'STD-' + String(Date.now()).slice(-4) },
    checks: [
      { s: 'ok', t: 'لا تكرار', d: 'لا يوجد طلب أو قضية قائمة بنفس الهوية في المنظومة.' },
      { s: 'ok', t: 'اكتمال الحقول الإلزامية', d: 'كل الحقول الإلزامية معبّأة.' },
      { s: 'ok', t: 'الإسناد التلقائي', d: 'أُسنِد آلياً لمرحلة الدراسة والتقييم حسب العبء.' },
    ],
  };
}
const GST = {
  ok:    { ico: 'check_circle', bg: 'var(--green-10)',   fg: 'var(--color-primary)' },
  warn:  { ico: 'warning',      bg: 'var(--warning-10)', fg: 'var(--warning-70)' },
  block: { ico: 'block',        bg: 'var(--error-10)',   fg: 'var(--color-error)' },
  skip:  { ico: 'do_not_disturb_on', bg: 'var(--surface-subtle)', fg: 'var(--text-secondary)' },
  hold:  { ico: 'schedule',     bg: 'var(--surface-subtle)', fg: 'var(--text-secondary)' },
};
function GuardReview({ onBack, onDone }) {
  const [scenario, setScenario] = useState('clean');
  const g = runGuard(scenario);
  return (
    <div style={{ maxWidth: 880 }}>
      <button className="link" onClick={onBack} style={{ marginBottom: 14 }}><I name="arrow_forward" size={17} /> رجوع للنموذج</button>
      <div className="row" style={{ gap: 10, marginBottom: 6, flexWrap: 'nowrap' }}>
        <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-md)', background: 'var(--green-10)', display: 'grid', placeItems: 'center' }}><I name="verified_user" size={22} color="var(--color-primary)" fill /></div>
        <div><h2 className="h2" style={{ margin: 0 }}>الحارس الآلي — فحص الطلب الابتدائي</h2>
        <div className="muted">خطوة نظامية آلية بين إرسال الجهة ووصول الطلب للدراسة والتقييم · توثيق بالتدقيق</div></div>
      </div>
      <div className="conf-note" style={{ marginTop: 12 }}><I name="science" size={16} /> للعرض التجريبي: استعرض المخرجات الثلاثة للحارس.</div>
      <div className="filters" style={{ marginBottom: 18 }}>
        {[['clean', '✅ مرّ نظيفاً'], ['review', '⚠️ مراجعة بشرية'], ['block', '⛔ منع قطعي']].map(([k, t]) => (
          <button key={k} className={'fbtn' + (scenario === k ? ' on' : '')} onClick={() => setScenario(k)}>{t}</button>
        ))}
      </div>
      <Card className="card pad" style={{ marginBottom: 16 }}>
        <b style={{ fontSize: 15, color: 'var(--text-strong)' }}>فحوصات الحارس</b>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {g.checks.map((c, i) => { const st = GST[c.s]; return (
            <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 11, flexWrap: 'nowrap' }}>
              <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--radius-md)', background: st.bg, display: 'grid', placeItems: 'center' }}><I name={st.ico} size={19} color={st.fg} fill /></div>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{c.t}</div><div className="muted" style={{ marginTop: 2, lineHeight: 1.55 }}>{c.d}</div></div>
            </div>
          ); })}
        </div>
      </Card>
      {g.verdict === 'clean' && <div>
        <InlineAlert kind="success" title="مرّ الطلب نظيفاً — أُسنِد للدراسة والتقييم">دخل الطلب مباشرةً مرحلة الدراسة والتقييم (مؤ09 دراسة) — رقم الإسناد {g.assigned.ref}.</InlineAlert>
        <div className="conf-note" style={{ marginTop: 12, background: 'var(--warning-10)', color: 'var(--warning-70)' }}><I name="link_off" size={16} /> الطلب غير مرتبط بالشخص بعد (linked=false): تستمر الدراسة والتقييم والتصويت، لكن التفعيل وتوقيع الاتفاقية موقوفان على إشعار الشخص والتحقّق عبر نفاذ.</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-primary" onClick={onDone}><I name="check" size={18} /> تمّ — عودة للطلبات</button></div>
      </div>}
      {g.verdict === 'review' && <div>
        <InlineAlert kind="warning" title="رُفِع لمراجعة بشرية سريعة">لم يُرفَض الطلب؛ بل توقّف الإسناد الآلي لحين بتّ موظّف مختص في التطابق المحتمل واستكمال الناقص — حمايةً للحالات بلا هوية من الرفض الآلي.</InlineAlert>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-primary" onClick={onDone}><I name="how_to_reg" size={18} /> إرسال للمراجعة والعودة</button></div>
      </div>}
      {g.verdict === 'block' && <div>
        <InlineAlert kind="error" title="مُنِع — يوجد طلب قائم بنفس الهوية">لمنع التكرار تمّ إيقاف إنشاء الطلب. الطلب الأصلي قائم وقيد المعالجة.</InlineAlert>
        <Card className="card pad" style={{ marginTop: 12, borderColor: 'var(--error-50)' }}>
          <b style={{ fontSize: 14, color: 'var(--text-strong)' }}>الطلب الأصلي</b>
          <div className="row" style={{ gap: 10, marginTop: 10 }}><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{g.dup.secret}</span><Tag tone="info" size="sm">{g.dup.caseNo}</Tag><Tag tone="warning" size="sm">{g.dup.stage}</Tag></div>
        </Card>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-ghost" onClick={onBack}><I name="arrow_forward" size={18} /> عودة</button></div>
      </div>}
    </div>
  );
}

const CLERK_NAV = [
  { id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard', C: Dashboard },
  { id: 'incoming', t: 'الطلبات الواردة', icon: 'move_to_inbox', C: Incoming },
  { id: 'new-rec', t: 'تقديم طلب حماية', icon: 'person_add', action: true },
  { id: 'urgent-report', t: 'بلاغ طارئ', icon: 'emergency', urgent: true },
  { id: 'responses', t: 'ردودنا', icon: 'reply', C: Responses },
  { id: 'messages', t: 'المراسلات', icon: 'forum', C: Messages },
  { id: 'notifications', t: 'الإشعارات', icon: 'notifications', C: StaffNotifications },
  { id: 'archive', t: 'الأرشيف', icon: 'inventory_2', C: Archive },
];
const HEAD_NAV = [
  { id: 'head-home', t: 'لوحة الفرع', icon: 'space_dashboard' },
  { id: 'head-approvals', t: 'بانتظار اعتمادي', icon: 'approval' },
  { id: 'head-raised', t: 'المرفوعة للمركز', icon: 'send' },
];
const HQ_NAV = [
  { id: 'hq-home', t: 'لوحة المقر — الفروع', icon: 'hub' },
  { id: 'hq-esc', t: 'التصعيدات وإعادة الإسناد', icon: 'move_up' },
];
const HB = HemayaBranch;
const { ENT_BRANCHES, branchLabel } = HB;

const ENT_NAMES = { prosecution: 'النيابة العامة', state_security: 'أمن الدولة', moi: 'وزارة الداخلية', nazaha: 'نزاهة', moj: 'وزارة العدل' };
const ENT_ORDER = ['prosecution', 'state_security', 'moi', 'nazaha', 'moj'];
const ENT_OFFICERS = { prosecution: 'المحقق/ سعد المطيري', state_security: 'العميد/ فهد القحطاني', moi: 'المقدّم/ ناصر الشهري', nazaha: 'المستشار/ خالد العنزي', moj: 'المستشار/ عبدالله الدوسري' };
const ENT_ROLE = { prosecution: 'عضو النيابة — ضابط الاتصال', state_security: 'ضابط الاتصال المعتمد', moi: 'ضابط الاتصال المعتمد', nazaha: 'المستشار المختص — ضابط الاتصال', moj: 'المستشار المختص — ضابط الاتصال' };

function App() {
  const { incoming: recIn, sent: recSent } = useRecommendations();
  const [role, setRole] = useState('clerk');
  const [active, setActive] = useState('dashboard');
  const [currentEnt, setCurrentEnt] = useState('prosecution');
  const [currentBranch, setCurrentBranch] = useState('RUH');
  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState(null);
  const [guard, setGuard] = useState(null);
  const [urgent, setUrgent] = useState(null);
  const [headItem, setHeadItem] = useState(null);
  const [toast, setToast] = useState('');
  const [pendingExtra, setPendingExtra] = useState([]);
  const [decided, setDecided] = useState({});
  const [raised, setRaised] = useState([]);
  const [audit, setAudit] = useState(() => [{ ent: 'prosecution', region: 'RUH', role: 'clerk', ev: 'دخول بوابة الجهة', t: stamp() }]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [entOpen, setEntOpen] = useState(false);

  const ROLE_T = { clerk: 'موظف الفرع', head: 'رئيس الفرع', hq: 'المقر' };
  const firstNav = (r) => r === 'clerk' ? 'dashboard' : r === 'head' ? 'head-home' : 'hq-home';
  const NAVSET = { clerk: CLERK_NAV, head: HEAD_NAV, hq: HQ_NAV };
  const NAV = NAVSET[role];

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  const logAccess = (ent, region, rl, ev, secret) => setAudit((a) => [{ ent, region, role: rl, ev, secret, t: stamp() }, ...a].slice(0, 60));
  const resetView = () => { setRec(null); setGuard(null); setUrgent(null); setHeadItem(null); setOpen(false); setAuditOpen(false); setEntOpen(false); };
  const switchRole = (r) => { setRole(r); setActive(firstNav(r)); resetView(); logAccess(currentEnt, currentBranch, r, 'تبديل الدور — ' + ROLE_T[r]); };
  const switchEnt = (v) => { const b = ENT_BRANCHES[v][0]; setCurrentEnt(v); setCurrentBranch(b); setActive(firstNav(role)); resetView(); logAccess(v, b, role, 'دخول بوابة الجهة'); };
  const switchBranch = (code) => { setCurrentBranch(code); setActive(firstNav(role)); resetView(); logAccess(currentEnt, code, role, 'دخول فرع — ' + branchLabel(currentEnt, code)); };
  const go = (id) => { setActive(id); setRec(null); setGuard(null); setUrgent(null); setHeadItem(null); setOpen(false); };
  const openRec = (r) => { setRec({ ...r, entity: currentEnt }); setGuard(null); if (r.secret && r.secret.charAt(0) === 'C') logAccess(currentEnt, currentBranch, role, 'اطّلاع على طلب', r.secret); (typeof window!=='undefined' && window.scrollTo(0,0)); };
  const approve = async (f) => {
    if (rec && rec.linked === false) { setRec(null); setGuard(true); (typeof window!=='undefined' && window.scrollTo(0,0)); return; }
    const r = rec;
    const fd = f || {};
    // رفعٌ حقيقيّ للقاعدة: قضيةٌ بمصدر «جهة» تدخل طابور الفرز (RPC مقيّد بـ competent_body).
    const res = await submitRecommendation({
      role: fd.role || r?.cat || 'شاهد',
      entity: ENT_NAMES[currentEnt],
      crime: fd.crimeDesc || fd.caseSummary || 'توصية جهة مختصّة',
      reason: fd.reasons || [fd.why1, fd.why2, fd.why3].filter(Boolean).join(' · ') || 'مسوّغات التوصية المرفوعة للمركز',
      caseNo: fd.caseNo || r?.caseNo || '',
      provide: fd.provide ? fd.provide === 'توفير' : true,
      details: { types: (fd.types || []).filter(Boolean), branch: currentBranch },
    });
    if (!res.ok) { showToast('تعذّر رفع التوصية: ' + res.error); return; }
    if (r && r.secret && r.secret.charAt(0) === 'C') {
      setPendingExtra((p) => [{ entity: currentEnt, region: currentBranch, secret: r.secret, cat: r.cat || '—', caseNo: r.caseNo || '—', outcome: 'توفير', preparedBy: 'ضابط الاتصال (أنت)' }, ...p]);
    }
    setRec(null); setActive('incoming'); showToast('رُفِعت التوصية للمركز — الرمز ' + res.secret + ' (دخلت طابور الفرز).');
  };
  const guardDone = () => { setGuard(null); setActive('incoming'); showToast('عولِج الطلب الابتدائي عبر الحارس الآلي.'); };

  const headQueue = (() => {
    const map = {};
    byScope(recIn, currentEnt, currentBranch).filter((r) => r.status === 'pending' && !decided[r.secret]).forEach((r) => {
      map[r.secret] = { secret: r.secret, cat: r.cat, caseNo: r.caseNo, outcome: r.recOutcome || 'توفير', preparedBy: r.preparedBy || 'الموظف المختص', deadlineDays: Math.max(0, 5 - r.days) };
    });
    pendingExtra.filter((p) => p.entity === currentEnt && (p.region || 'RUH') === currentBranch && !decided[p.secret]).forEach((p) => {
      if (!map[p.secret]) map[p.secret] = { secret: p.secret, cat: p.cat, caseNo: p.caseNo, outcome: p.outcome || 'توفير', preparedBy: p.preparedBy || 'ضابط الاتصال', deadlineDays: 5 };
    });
    return Object.values(map);
  })();
  const headRaised = [
    ...raised.filter((x) => x.entity === currentEnt && (x.region || 'RUH') === currentBranch),
    ...byScope(recSent, currentEnt, currentBranch).map((r) => ({ secret: r.secret, cat: r.cat, caseNo: r.caseNo, outcome: r.outcome, at: r.sentAt })),
  ];
  const onApproveHead = (item) => { setRaised((a) => [{ entity: currentEnt, region: currentBranch, secret: item.secret, cat: item.cat, caseNo: item.caseNo, outcome: item.outcome, at: 'الآن' }, ...a]); setDecided((d) => ({ ...d, [item.secret]: 'approved' })); setHeadItem(null); logAccess(currentEnt, currentBranch, 'head', 'اعتماد توصية', item.secret); showToast('اعتُمدت التوصية ورُفِعت للمركز.'); (typeof window!=='undefined' && window.scrollTo(0,0)); };
  const onReturnHead = (item) => { setDecided((d) => ({ ...d, [item.secret]: 'returned' })); setHeadItem(null); logAccess(currentEnt, currentBranch, 'head', 'إعادة توصية للموظف', item.secret); showToast('أُعيدت التوصية للموظف بملاحظة.'); (typeof window!=='undefined' && window.scrollTo(0,0)); };

  const hqStats = ENT_BRANCHES[currentEnt].map((code) => {
    const inc = byScope(recIn, currentEnt, code);
    const pend = inc.filter((r) => r.status === 'pending' && !decided[r.secret]).length + pendingExtra.filter((p) => p.entity === currentEnt && (p.region || 'RUH') === code && !decided[p.secret]).length;
    const rz = byScope(recSent, currentEnt, code).length + raised.filter((x) => x.entity === currentEnt && (x.region || 'RUH') === code).length;
    const od = inc.filter((r) => r.days >= 4).length;
    return { code, name: branchLabel(currentEnt, code), incoming: inc.length, pending: pend, raised: rz, overdue: od };
  });
  const hqEsc = byEnt(INCOMING, currentEnt).filter((r) => r.days >= 4).map((r) => ({ secret: r.secret, cat: r.cat, caseNo: r.caseNo, region: r.region || 'RUH', regionName: branchLabel(currentEnt, r.region || 'RUH'), days: r.days }));
  const onReassign = (item, toCode) => { logAccess(currentEnt, item.region, 'hq', 'إعادة إسناد → ' + branchLabel(currentEnt, toCode), item.secret); showToast('أُعيد إسناد ' + item.secret + ' إلى ' + branchLabel(currentEnt, toCode) + ' (عرض تجريبي).'); };

  const cur = NAV.find((n) => n.id === active) || NAV[0];
  const th = threadsFor(currentEnt, currentBranch);
  const badges = {};
  if (role === 'clerk') {
    badges.incoming = byScope(recIn, currentEnt, currentBranch).filter((r) => r.status === 'awaiting').length;
    badges.notifications = byScope(NOTIFS, currentEnt, currentBranch).filter((n) => n.unread).length;
    badges.messages = ['center', 'applicant'].filter((k) => { const arr = th[k]; return arr.length && arr[arr.length - 1].side === 'in'; }).length;
  } else if (role === 'head') {
    badges['head-approvals'] = headQueue.length;
  } else {
    badges['hq-esc'] = hqEsc.length;
  }

  const branchChip = role === 'hq' ? 'كل الفروع (المقر)' : branchLabel(currentEnt, currentBranch);
  const person = role === 'clerk' ? { name: ENT_OFFICERS[currentEnt], sub: ENT_ROLE[currentEnt] } : role === 'head' ? { name: 'رئيس الفرع المباشر', sub: branchLabel(currentEnt, currentBranch) } : { name: 'الإدارة العامة (المقر)', sub: ENT_NAMES[currentEnt] };
  const title = role === 'clerk' ? (urgent ? 'بلاغ عاجل' : guard ? 'الحارس الآلي' : rec ? 'نموذج التوصية' : cur.t) : role === 'head' ? (headItem ? 'اعتماد التوصية' : cur.t) : cur.t;

  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="gavel" size={22} fill color="#fff" /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-strong)', lineHeight: 1.2 }}>بوابة الجهات المختصة</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ENT_NAMES[currentEnt]} · {branchChip}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={'nav-item' + (active === n.id && !rec && !urgent && !guard && !headItem ? ' on' : '')} onClick={() => n.action ? openRec({ secret: '— يُسنَد لاحقاً', cat: '', caseNo: '', referred: 'الآن', days: 1, status: 'new', linked: false, entity: currentEnt }) : n.urgent ? (setUrgent({ entity: currentEnt, caseNo: '' }), setRec(null), setGuard(null), setHeadItem(null), setOpen(false), window.scrollTo(0,0)) : go(n.id)}>
              <I name={n.icon} size={20} style={n.urgent ? { color: 'var(--color-error)' } : undefined} /> <span style={n.urgent ? { color: 'var(--color-error)', fontWeight: 600 } : undefined}>{n.t}</span>
              {badges[n.id] ? <span className="nav-badge">{badges[n.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">تبادل مؤمّن مع مركز الحماية. الهوية بالرمز السري. البيانات معزولة بـ(جهة، فرع) والوصول مُسجَّل في التدقيق.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{title}</span>
          <span className="who">
            <div className="audit-wrap">
              <button className="audit-btn" onClick={() => setAuditOpen((o) => !o)} title="سجل الوصول للبيانات (تدقيق)"><I name="fact_check" size={16} /> التدقيق <span className="audit-count">{audit.length}</span></button>
              {auditOpen && (
                <>
                  <div className="audit-scrim" onClick={() => setAuditOpen(false)} />
                  <div className="audit-panel">
                    <div className="audit-head"><b>سجل الوصول (تدقيق)</b><div className="muted" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>يُدوَّن كل وصول للبيانات بمبدأ الحاجة إلى المعرفة (م24–32).</div></div>
                    {audit.map((a, i) => (
                      <div className="audit-row" key={i}>
                        <div className="audit-ico"><I name={a.secret ? 'visibility' : 'login'} size={16} color="var(--color-primary)" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{a.ev}{a.secret ? <span className="mono" style={{ marginInlineStart: 5, fontWeight: 700 }}>{a.secret}</span> : null}</div>
                          <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>{ENT_NAMES[a.ent]}{a.region ? ' · ' + branchLabel(a.ent, a.region) : ''} · {ROLE_T[a.role] || ''} · {a.t}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="roleseg">
              {[['clerk', 'badge', 'موظف الفرع'], ['head', 'approval', 'رئيس الفرع'], ['hq', 'corporate_fare', 'المقر']].map(([id, ic, t]) => (
                <button key={id} className={role === id ? 'on' : ''} onClick={() => switchRole(id)}><I name={ic} size={15} /> {t}</button>
              ))}
            </div>
            <div className="ent-switch">
              <div className="ent-id"><I name="apartment" size={16} color="var(--color-primary)" fill /><div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}><span>{ENT_NAMES[currentEnt]}</span><span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{branchChip}</span></div></div>
              <div className="prev-wrap">
                <button className="prev-btn" onClick={() => setEntOpen((o) => !o)} title="معاينة جهة/فرع آخر — في الإنتاج تدخل كل جهة ببوابتها الخاصة"><span className="prev-tag">معاينة</span><I name="swap_horiz" size={16} /></button>
                {entOpen && (
                  <>
                    <div className="audit-scrim" onClick={() => setEntOpen(false)} />
                    <div className="prev-menu">
                      <div className="prev-menu-head">معاينة <span className="muted" style={{ fontWeight: 400 }}>— أداة عرض فقط؛ في الإنتاج تدخل كل جهة/فرع ببوابته وبياناته معزولة</span></div>
                      <div className="prev-sub" style={{ borderTop: 'none', marginTop: 0 }}>الجهة</div>
                      {ENT_ORDER.map((k) => (
                        <button key={k} className={'prev-item' + (k === currentEnt ? ' on' : '')} onClick={() => switchEnt(k)}>
                          <I name={k === currentEnt ? 'radio_button_checked' : 'radio_button_unchecked'} size={17} color={k === currentEnt ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                          <span style={{ flex: 1 }}>{ENT_NAMES[k]}</span>
                        </button>
                      ))}
                      <div className="prev-sub">الفرع / المنطقة</div>
                      {role === 'hq'
                        ? <div className="muted" style={{ padding: '6px 10px 8px', fontSize: 12, lineHeight: 1.5 }}>المقر يشمل كل فروع {ENT_NAMES[currentEnt]} — لا يُختار فرع.</div>
                        : ENT_BRANCHES[currentEnt].map((code) => (
                          <button key={code} className={'prev-item' + (code === currentBranch ? ' on' : '')} onClick={() => switchBranch(code)}>
                            <I name={code === currentBranch ? 'radio_button_checked' : 'radio_button_unchecked'} size={17} color={code === currentBranch ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                            <span style={{ flex: 1 }}>{branchLabel(currentEnt, code)}</span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>{person.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{person.sub}</span>
            </div>
            <div className="avatar"><I name="support_agent" size={18} /></div>
            <button className="signout-btn" title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = 'http://localhost:3000/'; }).catch(() => { window.location.href = 'http://localhost:3000/'; }); }}><I name="logout" size={18} /></button>
          </span>
        </header>
        <main className="content">
          {toast && <InlineAlert kind="success" title="تمّ" style={{ marginBottom: 16 }}>{toast}</InlineAlert>}
          {role === 'clerk' ? (
            urgent ? <UrgentForm rec={urgent} onBack={() => setUrgent(null)} />
            : guard ? <GuardReview onBack={() => { setGuard(null); setActive('incoming'); }} onDone={guardDone} />
            : rec ? <RecommendationForm rec={rec} onApprove={approve} onBack={() => setRec(null)} />
            : (() => { const C = cur.C; return <C key={currentEnt + currentBranch} go={go} openRec={openRec} ent={currentEnt} br={currentBranch} recIn={recIn} recSent={recSent} />; })()
          ) : role === 'head' ? (
            headItem ? <HB.HeadReview item={headItem} branchName={branchLabel(currentEnt, currentBranch)} onApprove={onApproveHead} onReturn={onReturnHead} onBack={() => setHeadItem(null)} />
            : active === 'head-approvals' ? <HB.HeadApprovals branchName={branchLabel(currentEnt, currentBranch)} queue={headQueue} onOpen={(it) => { setHeadItem(it); (typeof window!=='undefined' && window.scrollTo(0,0)); }} />
            : active === 'head-raised' ? <HB.HeadRaised branchName={branchLabel(currentEnt, currentBranch)} raised={headRaised} />
            : <HB.HeadHome branchName={branchLabel(currentEnt, currentBranch)} stats={{ pending: headQueue.length, overdue: byScope(recIn, currentEnt, currentBranch).filter((r) => r.days >= 4).length, raised: headRaised.length }} onGo={go} />
          ) : (
            active === 'hq-esc' ? <HB.HQEscalations entName={ENT_NAMES[currentEnt]} items={hqEsc} branches={ENT_BRANCHES[currentEnt].map((c) => ({ code: c, name: branchLabel(currentEnt, c) }))} onReassign={onReassign} />
            : <HB.HQHome entName={ENT_NAMES[currentEnt]} stats={hqStats} />
          )}
        </main>
      </div>
    </div>
  );
}

export function CompetentEntitiesPortal() {
  return <App />;
}
