'use client';
/* ============================================================
   المكتب الفني — مرحلة التظلّمات. تُقرأ التظلّمات حيّاً من grievances (Supabase + Realtime)،
   وبتّ المكتب (قبول/رفض + حيثيّات) يُشعِر طالبَ الحماية لحظيّاً عبر المُشغّل القاعديّ.
   لا بيانات مُلفّقة تُعرَض: ما لا سند له في القاعدة لا يظهر.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";
import { createClient } from "@hemaya/supabase/src/browser";
import { useGrievances, decideGrievance } from "./grievance-store";
import "./grievance.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style, className }) =>
  <span className={'material-symbols-rounded' + (className ? ' ' + className : '')} style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

const HEAD = { name: 'م. فهد الدوسري', title: 'مدير المكتب الفني' };
const ADVISOR_META = { a1: { name: 'م. عبدالله العتيبي', spec: 'قانوني' }, a2: { name: 'د. منى الزهراني', spec: 'أمني' }, a3: { name: 'أ. سارة القحطاني', spec: 'نفسي/اجتماعي' } };
const fmtDate = (ts) => { try { return new Date(ts).toLocaleDateString('ar-SA', { dateStyle: 'medium' }); } catch (e) { return '—'; } };
const fmtTime = (ts) => { try { return new Date(ts).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } };

function Stat({ icon, v, l, bg, fg }) {
  return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></Card>;
}
function statusTag(g) {
  if (g.status === 'upheld') return <Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} />}>قُبِل التظلّم</Tag>;
  if (g.status === 'dismissed') return <Tag tone="error" size="sm" iconLeft={<I name="block" size={13} />}>رُفِض التظلّم</Tag>;
  if (g.status === 'tech_review') return <Tag tone="info" size="sm" iconLeft={<I name="how_to_reg" size={13} />}>قيد مراجعة المكتب</Tag>;
  return <Tag tone="warning" size="sm" iconLeft={<I name="edit_note" size={13} />}>وارد — بانتظار البتّ</Tag>;
}

/* ── لوحة الإشراف — إحصاءات حقيقيّة من التظلّمات ── */
function Dashboard({ data, go }) {
  const total = data.length;
  const pending = data.filter((g) => !g.decided).length;
  const decided = data.filter((g) => g.decided).length;
  const upheld = data.filter((g) => g.status === 'upheld').length;
  const exceeded = data.filter((g) => g.daysElapsed >= 10 && !g.decided).length;
  return (<div>
    <h2 className="h2">لوحة الإشراف</h2>
    <p className="lede">إشراف المكتب الفني على التظلّمات الواردة من طالبي الحماية والبتّ فيها ضمن المهلة النظامية (المادة العاشرة والحادية والعشرون).</p>
    <div className="stats">
      <Stat icon="gavel" v={total} l="إجمالي التظلّمات" bg="var(--info-10)" fg="var(--color-info)" />
      <Stat icon="edit_note" v={pending} l="بانتظار البتّ" bg="var(--warning-10)" fg="var(--color-warning)" />
      <Stat icon="verified" v={decided} l="بُتّ فيها" bg="var(--green-10)" fg="var(--color-primary)" />
      <Stat icon="running_with_errors" v={exceeded} l="تجاوزت مهلة (10) أيام" bg="var(--error-10)" fg="var(--color-error)" />
    </div>
    <Card className="card pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <b style={{ color: 'var(--text-strong)' }}>{pending ? `${pending} تظلّمات تنتظر بتّ المكتب` : 'لا تظلّمات معلّقة'}</b>
        <div className="muted" style={{ marginTop: 3 }}>{decided ? `قُبِل منها ${upheld} وصدر قرارٌ في ${decided}.` : 'ستظهر التظلّمات الواردة من طالبي الحماية هنا فور تقديمها.'}</div>
      </div>
      <button className="btn btn-primary" onClick={() => go('cases')}><I name="inbox" size={18} /> التظلّمات</button>
    </Card>
  </div>);
}

/* ── قائمة التظلّمات — من القاعدة ── */
function Cases({ data, openCase }) {
  return (<div>
    <h2 className="h2">التظلّمات الواردة</h2>
    <p className="lede">التظلّمات المرفوعة من طالبي الحماية على قرارات البرنامج — راجِعها وابتّ فيها. هوية المعني بالحماية مرمَّزة بالرمز السري.</p>
    {data.length === 0
      ? <Card className="card pad"><p className="lede" style={{ textAlign: 'center', padding: 24 }}>لا تظلّمات واردة بعد.</p></Card>
      : <Card className="card" style={{ overflow: 'hidden' }}>
      <div className="tbl-wrap"><table>
        <thead><tr><th>رقم التظلّم</th><th>الرمز السري</th><th>الفئة</th><th>محل الاعتراض</th><th>الميعاد</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{data.map((g) => (
          <tr key={g.id} className="clk" onClick={() => openCase(g)}>
            <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{g.ref}</td>
            <td className="mono">{g.secret}</td>
            <td><Tag tone="info" size="sm">{g.cat}</Tag></td>
            <td className="muted">{g.against}</td>
            <td>{g.decided ? <span className="muted" style={{ fontSize: 12.5 }}>—</span> : <span style={{ fontSize: 12.5, color: g.daysElapsed >= 8 ? 'var(--color-error)' : 'var(--color-primary)', fontWeight: 600 }}>متبقٍّ {Math.max(0, 10 - g.daysElapsed)} يوم</span>}</td>
            <td>{statusTag(g)}</td>
            <td><span className="link">عرض <I name="chevron_left" size={16} /></span></td>
          </tr>))}
        </tbody>
      </table></div>
    </Card>}
  </div>);
}

/* ── تفاصيل التظلّم + بتّ المكتب (حقيقيّ) ── */
function GrievanceDetail({ g, onDecide, back }) {
  const [status, setStatus] = useState('');   // 'upheld' | 'dismissed'
  const [opinion, setOpinion] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const ready = status && opinion.trim() && !busy;

  const submit = async () => {
    setBusy(true); setErr('');
    const { error } = await decideGrievance(g.id, status, opinion.trim());
    setBusy(false);
    if (error) { setErr('تعذّر حفظ القرار: ' + error.message); return; }
    setDone(true); onDecide && onDecide();
  };

  const decidedNow = g.decided || done;
  const finalStatus = g.decided ? g.status : status;
  const acc = finalStatus === 'upheld';

  return (<div>
    <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى التظلّمات</button>

    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <I name="gavel" size={26} fill color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>تظلّم <span className="mono">{g.ref}</span></div>
            <div className="muted">{g.against} · رُفِع في {fmtDate(g.filedAt)}</div>
          </div>
        </div>
        {statusTag(g)}
      </div>
      <div style={{ marginTop: 14 }}><SecretCode code={g.secret} canReveal={false} /></div>
      {!g.decided && <div style={{ marginTop: 12 }}><DeadlineTimer label="مهلة البتّ في التظلّم" totalDays={10} daysElapsed={g.daysElapsed} articleRef="م21" /></div>}
    </Card>

    <Card className="card pad" style={{ marginBottom: 14, background: 'var(--warning-10)', borderColor: 'var(--warning-50)' }}>
      <div className="sec-h"><I name="record_voice_over" size={19} color="var(--color-warning)" /> محل التظلّم — كما قدّمه طالب الحماية</div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: 'var(--text-body)' }}>{g.against}</p>
    </Card>

    <div className="conf-note" style={{ marginBottom: 14 }}><I name="info" size={16} /> تفاصيل ملف القضية ودراساتها ليست مرتبطةً بسجلّ هذا التظلّم في قاعدة البيانات، فلا تُعرَض هنا تفادياً لأي بيانٍ غير موثّق. البتّ يستند إلى محل التظلّم والرمز السري.</div>

    <Card className="card pad" style={{ borderColor: 'var(--color-primary)' }}>
      <div className="sec-h"><I name="verified" size={19} color="var(--color-primary)" /> بتّ المكتب الفني</div>
      {decidedNow ? (
        <React.Fragment>
          <InlineAlert kind={acc ? 'success' : 'error'} title={acc ? 'قَبِل المكتب الفني التظلّم — نهائي' : 'رَفَض المكتب الفني التظلّم — نهائي'}>
            {acc
              ? 'يُشمل المتقدّم ببرنامج الحماية مباشرةً دون العودة للدراسة، وأُشعِر طالبُ الحماية بالنتيجة لحظيّاً.'
              : 'قرار المكتب الفني في التظلّم نهائي، وأُشعِر طالبُ الحماية بالنتيجة لحظيّاً.'}
          </InlineAlert>
          {(g.techOpinion || opinion) && <div className="opin" style={{ marginTop: 12 }}>{g.techOpinion || opinion}</div>}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <InlineAlert kind="info" title="قرار نهائي" style={{ marginBottom: 14 }}>يبتّ المكتب الفني في التظلّم بتوجيه النائب العام؛ القرار نهائي، ويُشعَر به طالبُ الحماية والمركز فور إصداره.</InlineAlert>
          <div className="fld">
            <label className="fld-label">قرار المكتب في التظلّم</label>
            <div className="chips">
              <button className={'chip' + (status === 'upheld' ? ' on' : '')} onClick={() => setStatus('upheld')}>قبول التظلّم</button>
              <button className={'chip danger' + (status === 'dismissed' ? ' on' : '')} onClick={() => setStatus('dismissed')}>رفض التظلّم</button>
            </div>
          </div>
          <div className="fld">
            <label className="fld-label">حيثيّات القرار {status === 'dismissed' && <span style={{ color: 'var(--color-error)' }}>· تُبلَّغ للمتقدّم</span>}</label>
            <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="اذكر الأساس النظامي وحيثيّات قرار المكتب — تُبلَّغ لطالب الحماية…" dir="auto" />
          </div>
          {err && <InlineAlert kind="error" title="خطأ" style={{ marginBottom: 10 }}>{err}</InlineAlert>}
          <button className={'btn ' + (status === 'dismissed' ? 'btn-danger' : 'btn-primary')} disabled={!ready} onClick={submit}>
            <I name="draw" size={18} /> {busy ? 'جارٍ الحفظ…' : 'إصدار قرار المكتب وإشعار المتقدّم'}
          </button>
        </React.Fragment>
      )}
    </Card>
  </div>);
}

/* ── إشعارات المكتب الفني — حقيقيّة من Supabase (authority='technical') + Realtime ── */
function Notifs() {
  const [items, setItems] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from('notifications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (active) setItems(data ?? []); });
    load();
    const ch = supabase.channel('to-notifs').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  const open = async (n) => { if (!n.read) { await supabase.from('notifications').update({ read: true }).eq('id', n.id); setItems((s) => s.map((x) => x.id === n.id ? { ...x, read: true } : x)); } };
  const markAll = async () => { const ids = items.filter((n) => !n.read).map((n) => n.id); if (!ids.length) return; await supabase.from('notifications').update({ read: true }).in('id', ids); setItems((s) => s.map((x) => ({ ...x, read: true }))); };
  const tone = (t) => t === 'grievance_in' ? ['var(--warning-10)', 'var(--color-warning)'] : ['var(--green-10)', 'var(--color-primary)'];
  return (<div>
    <h2 className="h2">الإشعارات</h2>
    <p className="lede">التظلّمات الواردة والمواعيد النظامية — حيّةً من قاعدة البيانات.</p>
    <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
      <button className="btn btn-ghost sm" onClick={markAll}><I name="done_all" size={17} /> تعليم الكل كمقروء</button>
    </div>
    {items.length === 0 && <p className="lede" style={{ textAlign: 'center', padding: 24 }}>لا إشعارات بعد.</p>}
    <div style={{ display: 'grid', gap: 10 }}>{items.map((n) => { const [bg, fg] = tone(n.type); return (
      <div key={n.id} onClick={() => open(n)} style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: n.read ? 'var(--surface-card)' : 'var(--green-10)', alignItems: 'flex-start', cursor: 'pointer' }}>
        <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', background: bg, color: fg }}><I name={n.type === 'grievance_in' ? 'gavel' : 'notifications'} size={20} fill /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{n.title || 'إشعار'}</div><div style={{ fontSize: 13, color: 'var(--text-body)', marginTop: 2, lineHeight: 1.55 }}>{n.body}</div><div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{fmtTime(n.created_at)}</div></div>
        {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />}
      </div>); })}</div>
  </div>);
}

/* ── المراسلات — تنسيقٌ حقيقيٌّ عبر coord_messages (المكتب ↔ المركز/النائب) + Realtime ── */
function Messages() {
  const supabase = useRef(createClient()).current;
  const ME = 'technical', MY_LABEL = 'المكتب الفني';
  const CONTACTS = [
    { id: 'center', name: 'مركز الحماية', role: 'مركز حماية الشهود', icon: 'account_balance' },
    { id: 'ag', name: 'مكتب النائب العام', role: 'النائب العام', icon: 'balance' },
  ];
  const [active, setActive] = useState('center');
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const bodyRef = useRef(null);
  useEffect(() => {
    let live = true;
    const load = () => supabase.from('coord_messages')
      .or(`and(from_authority.eq.${ME},to_authority.eq.${active}),and(from_authority.eq.${active},to_authority.eq.${ME})`)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (live) setRows(data ?? []); });
    load();
    const ch = supabase.channel('coord-to-' + active).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coord_messages' }, (p) => {
      const m = p.new;
      if ((m.from_authority === ME && m.to_authority === active) || (m.from_authority === active && m.to_authority === ME)) setRows((r) => r.some((x) => x.id === m.id) ? r : [...r, m]);
    }).subscribe();
    return () => { live = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase, active]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [rows]);
  const send = async () => {
    const v = text.trim(); if (!v) return; setText('');
    const { data } = await supabase.from('coord_messages').insert({ from_authority: ME, to_authority: active, sender_label: MY_LABEL, body: v }).select().single();
    if (data) setRows((r) => r.some((x) => x.id === data.id) ? r : [...r, data]);
  };
  const cur = CONTACTS.find((c) => c.id === active);
  const fmt = (ts) => { try { return new Date(ts).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } };
  const bubble = (mine) => ({ maxWidth: '78%', alignSelf: mine ? 'flex-start' : 'flex-end', background: mine ? 'var(--green-10)' : 'var(--surface-hover, #f1efe8)', color: 'var(--text-strong)', padding: '9px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.7 });
  return (<div>
    <h2 className="h2">المراسلات</h2>
    <p className="lede">قناة تنسيقٍ مؤمّنة بين المكتب الفني والمركز والنائب العام. تُوثّق كل مراسلة، ويُكتفى بالرمز السري عند ذكر أي معنيٍّ بالحماية.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {CONTACTS.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid ' + (active === c.id ? 'var(--color-primary)' : 'var(--border-subtle)'), background: active === c.id ? 'var(--green-10)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
            <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', background: 'var(--info-10)', color: 'var(--color-info)' }}><I name={c.icon} size={20} fill /></div>
            <div><div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-strong)' }}>{c.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{c.role}</div></div>
          </button>
        ))}
      </div>
      <Card className="card pad">
        <div ref={bodyRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', marginBottom: 12, minHeight: 200 }}>
          {rows.length === 0 ? <div className="muted" style={{ textAlign: 'center', padding: 40 }}><I name="forum" size={30} color="var(--text-disabled)" /><div style={{ marginTop: 8 }}>ابدأ التنسيق مع {cur.name}.</div></div>
          : rows.map((m) => { const mine = m.from_authority === ME; return (
            <div key={m.id} style={bubble(mine)}>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 3 }}>{mine ? MY_LABEL : (m.sender_label || cur.name)} · {fmt(m.created_at)}</div>
              {m.body}
            </div>); })}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`رسالة إلى ${cur.name}…`} dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} style={{ flex: 1, height: 42, padding: '0 12px', border: '1px solid var(--field-border, var(--border-default))', borderRadius: 'var(--radius-md)', background: 'var(--field-bg, var(--surface-card))', fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-strong)' }} />
          <button className="btn btn-primary" onClick={send} disabled={!text.trim()}><I name="send" size={19} /></button>
        </div>
      </Card>
    </div>
  </div>);
}

function Profile({ role, meAdvisor }) {
  const me = ADVISOR_META[meAdvisor] || {};
  const name = role === 'advisor' ? (me.name || 'مستشار المكتب الفني') : HEAD.name;
  const titleR = role === 'advisor' ? ('مستشار المكتب الفني · ' + (me.spec || '')) : 'مدير المكتب الفني';
  const fields = [
    ['الاسم', name], ['الصفة', titleR],
    ['الجهة', 'النيابة العامة — مكتب النائب العام'],
    ['نطاق العمل', 'مرحلة التظلّمات (المادة العاشرة والحادية والعشرون)'],
    ['الصلاحية', 'اطّلاع كامل على التظلّمات + البتّ فيها'],
    ['التوثيق', 'نفاذ + MFA'],
  ];
  return (<div>
    <h2 className="h2">الملف الشخصي</h2>
    <p className="lede">حسابك وصلاحياتك ونطاق عملك في مرحلة التظلّمات.</p>
    <Card className="card pad">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {fields.map(([l, v], i) => (<div className="ro-field" key={i}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{l}</span><span style={{ fontSize: 13, color: 'var(--text-body)' }}>{v}</span></div>))}
      </div>
      <InlineAlert kind="info" title="التظلّم أمام النائب العام" style={{ marginTop: 14 }}>يبتّ المكتب الفني في التظلّمات بتوجيهٍ من النائب العام؛ والقرار نهائي ويُبلَّغ طالبُ الحماية والمركز.</InlineAlert>
    </Card>
  </div>);
}

function PortalShell({ role, meAdvisor, brandTitle, brandSub, topRight }) {
  const [active, setActive] = useState('dashboard');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const data = useGrievances();

  const pending = data.filter((g) => !g.decided).length;
  const NAV = [
    { id: 'dashboard', t: 'لوحة الإشراف', icon: 'dashboard' },
    { id: 'cases', t: 'التظلّمات', icon: 'gavel', badge: pending || null },
    { id: 'messages', t: 'المراسلات', icon: 'forum' },
    { id: 'notifs', t: 'الإشعارات', icon: 'notifications' },
    { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' },
  ];
  const cur = NAV.find((n) => n.id === active) || NAV[0];
  const go = (id) => { setActive(id); setSel(null); setOpen(false); };
  const openCase = (g) => { setSel(g.id); setActive('cases'); setOpen(false); };
  const selG = data.find((g) => g.id === sel) || null;

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name={role === 'advisor' ? 'support_agent' : 'shield_person'} size={22} color="#fff" fill /></div>
          <div><div className="brand-t">{brandTitle}</div><div className="brand-s">{brandSub}</div></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={'nav-item' + (active === n.id && !sel ? ' on' : '')} onClick={() => go(n.id)}>
              <I name={n.icon} size={20} />
              <span>{n.t}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">مركز حماية الشهود والمبلّغين والخبراء والضحايا<br />المكتب الفني — مسار التظلّمات (المادة العاشرة والحادية والعشرون)</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{sel ? 'تفاصيل التظلّم' : cur.t}</span>
          {topRight}
        </header>
        <main className="content">
          {active === 'cases' && selG
            ? <GrievanceDetail g={selG} onDecide={() => {}} back={() => setSel(null)} />
            : active === 'cases'
            ? <Cases data={data} openCase={openCase} />
            : active === 'dashboard'
            ? <Dashboard data={data} go={go} />
            : active === 'messages' ? <Messages />
            : active === 'notifs' ? <Notifs />
            : <Profile role={role} meAdvisor={meAdvisor} />}
        </main>
      </div>
    </div>
  );
}

function signOutTO() { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = 'http://localhost:3000/'; }).catch(() => { window.location.href = 'http://localhost:3000/'; }); }

// الدور من المستخدم المسجَّل (الخادم). المستشار والمدير كلاهما من المكتب الفني (authority='technical')،
// ويطّلعان على التظلّمات الحقيقيّة نفسها ويبتّان فيها؛ التمييز في العرض والتوسيم فقط.
export function TechnicalOfficePortal({ role = 'head', meAdvisor = 'a1' }) {
  if (role === 'advisor') {
    const me = ADVISOR_META[meAdvisor] || ADVISOR_META.a1;
    const initials = (me.name || '').replace(/^(م\.|د\.|أ\.)\s*/, '').charAt(0);
    const topRight = (
      <span className="acct" style={{ marginInlineStart: 'auto' }}>
        <span className="acct-meta"><span className="acct-name">{me.name}</span><span className="acct-role">مستشار · {me.spec} · دخول عبر نفاذ</span></span>
        <span className="acct-av">{initials}</span>
        <button className="to-signout" title="تسجيل الخروج" onClick={signOutTO}><I name="logout" size={18} /></button>
      </span>
    );
    return <PortalShell role="advisor" meAdvisor={meAdvisor} brandTitle="بوابة المستشارين" brandSub="المكتب الفني · دراسة التظلّمات" topRight={topRight} />;
  }
  const topRight = (
    <span className="acct" style={{ marginInlineStart: 'auto' }}>
      <span className="acct-meta"><span className="acct-name">{HEAD.name}</span><span className="acct-role">{HEAD.title}</span></span>
      <span className="acct-av"><I name="shield_person" size={19} fill /></span>
      <button className="to-signout" title="تسجيل الخروج" onClick={signOutTO}><I name="logout" size={18} /></button>
    </span>
  );
  return <PortalShell role="head" meAdvisor={null} brandTitle="مدير المكتب الفني" brandSub="إشراف وبتّ التظلّمات" topRight={topRight} />;
}
