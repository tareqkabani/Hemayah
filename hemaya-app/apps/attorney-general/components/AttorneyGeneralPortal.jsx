'use client';
/* ============================================================
   بوابة النائب العام — منقولة من «بوابة النائب العام/البوابة.html»
   window/HP → @hemaya/ui. مخازن Metrics/Challenges/Handoff محروسة للـSSR.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer, RiskLevel } from "@hemaya/ui";
import { AG_UrgentPath } from "./ag-urgent-path";
import { useUrgent } from "./urgent-store";
import { useForeign, decideForeign } from "./foreign-store";
import { useGrievancesAG } from "./grievance-store";
import { HemayaHandoff } from "./execution-handoff";
import { HemayaChallenges } from "./challenges-store";
import { HemayaMetrics } from "./center-metrics";
import "./ag.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// مستشارو المكتب الفني (للاطّلاع على توزّع العبء)

// ===== بيانات التظلّمات (اطّلاع فقط — البتّ لدى المكتب الفني) =====
// هوية المعني بالحماية مرمَّزة (المادة الثانية والخامسة عشرة والسادسة عشرة).
// التظلّمات تُقرأ حيّاً من grievances عبر useGrievancesAG() — لا بيانات مُلفّقة.

// ===== أدوات حسابية =====
function statusOf(g) {
  if (g.status === 'upheld') return 'adopted-accept';
  if (g.status === 'dismissed') return 'adopted-reject';
  if (g.status === 'tech_review') return 'await';
  return 'studying'; // filed — بانتظار مراجعة المكتب
}
function statusTag(g) {
  const s = statusOf(g);
  if (s === 'adopted-accept') return <Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} />}>اعتمده المكتب — قبول</Tag>;
  if (s === 'adopted-reject') return <Tag tone="error" size="sm" iconLeft={<I name="block" size={13} />}>اعتمده المكتب — رفض</Tag>;
  if (s === 'await') return <Tag tone="info" size="sm" iconLeft={<I name="how_to_reg" size={13} />}>بانتظار اعتماد المكتب</Tag>;
  return <Tag tone="warning" size="sm" iconLeft={<I name="edit_note" size={13} />}>قيد دراسة المستشار</Tag>;
}
function outcomeTag(o) {
  if (o === 'reject') return <Tag tone="error" size="sm">رفض الطلب</Tag>;
  if (o === 'accept-partial') return <Tag tone="warning" size="sm">قبول جزئي</Tag>;
  return <Tag tone="success" size="sm">قبول</Tag>;
}
function countBy(data, fn) {
  const m = {};
  data.forEach((g) => { const k = fn(g); m[k] = (m[k] || 0) + 1; });
  return m;
}

// توصية المستشار ← مآل (دعم التظلّم = قبول)

function Stat({ icon, v, l, bg, fg, sub }) {
  return <Card className="card stat"><div className="stat-ico" style={{ background: bg, color: fg }}><I name={icon} size={22} fill /></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div>{sub ? <div className="stat-l" style={{ color: fg, fontWeight: 600 }}>{sub}</div> : null}</div></Card>;
}

function BarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (<div className="bars">{rows.map((r, i) => (
    <div className="bar-row" key={i}>
      <span className="bar-k">{r.k}</span>
      <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.v / max) * 100}%`, background: r.c }} /></span>
      <span className="bar-v">{r.v}</span>
    </div>))}</div>);
}

function Donut({ slices, centerV, centerL }) {
  const total = slices.reduce((s, x) => s + x.v, 0) || 1;
  let acc = 0;
  const seg = slices.map((s) => { const from = (acc / total) * 360; acc += s.v; const to = (acc / total) * 360; return `${s.c} ${from}deg ${to}deg`; }).join(', ');
  return (<div className="donut-wrap">
    <div className="donut" style={{ background: `conic-gradient(${seg})` }}><div className="donut-c"><b>{centerV}</b><span>{centerL}</span></div></div>
    <div className="legend">{slices.map((s, i) => (
      <div className="leg-row" key={i}><span className="leg-dot" style={{ background: s.c }} /><span>{s.k}</span><span className="leg-v">{s.v}</span></div>))}</div>
  </div>);
}

// ===== اللوحة الرئيسية =====
function Dashboard({ data, openCase, go }) {
  const fmtAgo = (min) => { if (min < 60) return `منذ ${min} دقيقة`; const h = Math.floor(min / 60), m = min % 60; return m ? `منذ ${h} ساعة و${m} دقيقة` : `منذ ${h} ساعة`; };
  const urgent = useUrgent();
  const urgentPending = urgent.filter((u) => u.status === 'pending').sort((a, b) => (b.elapsed || 0) - (a.elapsed || 0));
  const foreign = useForeign();
  const foreignPending = foreign.filter((f) => !f.decided);
  const decideCount = urgentPending.length + foreignPending.length;

  const total = data.length;
  const aAccept = data.filter((g) => statusOf(g) === 'adopted-accept').length;
  const aReject = data.filter((g) => statusOf(g) === 'adopted-reject').length;
  const adopted = aAccept + aReject;
  const acceptRate = adopted ? Math.round((aAccept / adopted) * 100) : 0;
  const awaiting = data.filter((g) => statusOf(g) === 'await').length;
  const exceeded = data.filter((g) => g.daysElapsed >= 10 && !g.officeDecision).length;
  const approaching = data.filter((g) => g.daysElapsed >= 8 && g.daysElapsed < 10 && !g.officeDecision).length;
  const pnodes = (HemayaMetrics && HemayaMetrics.pipeline) ? HemayaMetrics.pipeline.map((p) => [p.icon, String(p.v), p.l, !!p.exec]) : [['inbox', '12', 'قيد الفرز المبدئي', false], ['biotech', '9', 'قيد الدراسة والتقييم', false], ['how_to_vote', '5', 'بانتظار قرار المجلس', false], ['shield_person', '63', 'تحت التنفيذ والمتابعة', true]];

  return (<div>
    <div className="ctx">
      <div>
        <div className="ctx-kick">مكتب النائب العام</div>
        <h1 className="ctx-h">نظرة اليوم</h1>
        <div className="ctx-sub">ملخّصٌ تنفيذيّ موجز لما يتطلّب قراركم، وحالة المركز، والتقرير المرفوع لمعاليكم.</div>
      </div>
      <div className="ctx-date"><I name="calendar_month" size={17} color="var(--pp-bronze)" /><span>الأحد <b>8 ذو القعدة 1447هـ</b> · الربع الثاني</span></div>
    </div>

    <section className="block">
      <div className="card decide">
        <div className="decide-head">
          <div className="decide-emb"><I name="gavel" size={26} fill color="#fff" /></div>
          <div className="decide-htxt"><h3>يتطلّب قراركم الآن</h3><p>مسؤولياتٌ يبتّ فيها النائب العام مباشرةً — غير مفوّضة، ولا تحتمل التأخير</p></div>
          <div className="decide-count"><b className="num">{decideCount}</b><span>بانتظار بتّكم</span></div>
        </div>
        {decideCount === 0 ? (
          <div className="decide-empty"><I name="task_alt" size={22} color="var(--color-primary)" fill /><span>لا يوجد ما يتطلّب قراركم الآن. جميع الطلبات العاجلة والأجنبية مبتوتة.</span></div>
        ) : (
          <div className="decide-list">
            {urgentPending.map((u) => (
              <div className="drow" key={u.ref} onClick={() => go('urgent')}>
                <div className="drow-tag"><span className="dtag hot">عاجل</span><span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>م8</span></div>
                <div className="drow-main">
                  <h4 className="drow-h">بلاغ عاجل — خطر وشيك على الحياة · {u.cat}</h4>
                  <div className="drow-meta"><span className="mono">{u.ref}</span><span className="dot" /><span>رفعته {u.raisedBy}</span><span className="dot" /><span className="drow-when hot"><I name="timer" size={15} />{fmtAgo(u.elapsed || 0)}</span></div>
                </div>
                <span className="drow-cta">البتّ الفوري <I name="chevron_left" size={17} /></span>
              </div>
            ))}
            {foreignPending.map((f) => (
              <div className="drow" key={f.ref} onClick={() => go('foreign')}>
                <div className="drow-tag"><span className="dtag dip">أجنبي</span><span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>م6</span></div>
                <div className="drow-main">
                  <h4 className="drow-h">طلب أجنبي — {f.country} · {f.cat}</h4>
                  <div className="drow-meta"><span className="mono">{f.ref}</span><span className="dot" /><span>{f.basis} · وارد من {f.authority}</span></div>
                </div>
                <span className="drow-cta">البتّ النهائي <I name="chevron_left" size={17} /></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>

    <section className="block">
      <div className="kicker"><span className="kicker-t"><I name="insights" size={17} color="var(--color-primary)" /> نظرة على المركز</span><span className="kicker-line" /><span className="kicker-note">لقطة حالية · تُحدَّث آلياً من بوابات المركز</span></div>
      <div className="card">
        <div className="pipe">
          <div className="pipe-flow">
            {pnodes.map((n, i, arr) => (
              <React.Fragment key={i}>
                <div className={'pnode' + (n[3] ? ' exec' : '')}>
                  <div className="pnode-ico"><I name={n[0]} size={20} color="var(--color-primary)" /></div>
                  <div className="pnode-v num">{n[1]}</div>
                  <div className="pnode-l">{n[2]}</div>
                </div>
                {i < arr.length - 1 && <div className="pconn"><I name="chevron_left" size={22} /></div>}
              </React.Fragment>
            ))}
          </div>
          <div className="pipe-foot">
            <div className="qfig"><b className="num">148</b><span>طلباً وارداً هذا الربع</span></div>
            <div className="qfig"><b className="num">96</b><span>قراراً صدر</span></div>
            <div className="qfig"><b className="num">65%</b><span>نسبة القبول</span></div>
            <div className="attn">
              <span className="attn-chip"><I name="schedule" size={15} />3 طلبات تجاوزت مهلة توصية الجهة</span>
              {approaching > 0 && <span className="attn-chip" onClick={() => go('reports')} style={{ cursor: 'pointer' }}><I name="gavel" size={15} />{approaching === 1 ? 'تظلّم يقترب' : approaching === 2 ? 'تظلّمان يقتربان' : approaching + ' تظلّمات تقترب'} من مهلة (10) أيام</span>}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="block">
      <div className="kicker"><span className="kicker-t"><I name="event_repeat" size={17} color="var(--pp-bronze-ink)" /> الإحاطة الدورية</span><span className="kicker-line" /><span className="kicker-note">يرفعه رئيس المركز عن جميع أعمال المركز لاطّلاع معاليكم — كل تسعين يوماً</span></div>
      <div className="card report">
        <div className="report-in">
          <div className="report-l">
            <span className="report-seal"><I name="workspace_premium" size={15} /> يُرفع لمعاليكم</span>
            <h3 className="report-h">التقرير الربع سنوي لأعمال المركز</h3>
            <p className="report-sub">الربع الثاني 1447هـ — سير الأعمال والتحدّيات والحلول. تُجمَّع أقسامه آلياً من بوابات المركز، ويرفعه رئيس المركز لاطّلاع معاليكم.</p>
            <div className="report-prog"><span className="muted">اليوم 68 من 90 من دورة الرفع</span><b>يتبقّى 22 يوماً</b></div>
            <div className="prog-track"><div className="prog-fill" style={{ width: '76%' }} /></div>
            <div className="report-chips">{['ملخّص تنفيذي', 'الأرقام والمؤشّرات', 'التحدّيات والحلول', 'الالتزام بالمواعيد'].map((c) => <span className="rchip" key={c}>{c}</span>)}</div>
          </div>
          <div className="report-r">
            <button className="btn-report" onClick={() => go('periodic')}><I name="description" size={19} /> عرض التقرير الكامل</button>
            <div className="report-note">آخر تقرير رُفع: الربع الأول 1447هـ · في موعده</div>
          </div>
        </div>
      </div>
    </section>

    <section className="block" style={{ marginBottom: 0 }}>
      <div className="kicker"><span className="kicker-t"><I name="monitoring" size={17} color="var(--text-secondary)" /> الإشراف على التظلّمات</span><span className="kicker-line" /></div>
      <div className="card">
        <div className="oversee-in">
          <div className="oversee-l">
            <div className="oversee-h"><b>مرحلة التظلّمات</b><span className="ro-tag"><I name="visibility" size={14} /> مفوّضة للمكتب الفني · اطّلاع</span></div>
            <div className="oversee-figs">
              <div className="ofig"><b className="num">{total}</b><span>تظلّمات</span></div>
              <div className="ofig"><b className="num">{acceptRate}%</b><span>نسبة القبول</span></div>
              <div className="ofig"><b className="num">{awaiting}</b><span>بانتظار اعتماد المكتب</span></div>
              <div className={'ofig' + (exceeded ? ' alert' : '')}><b className="num">{exceeded}</b><span>تجاوز مهلة (10) أيام</span></div>
            </div>
          </div>
          <button className="btn" onClick={() => go('reports')}>عرض تقارير التظلّمات <I name="chevron_left" size={18} /></button>
        </div>
      </div>
    </section>
  </div>);
}

// ===== تقارير التظلّمات (قائمة كاملة للقراءة) =====
function Reports({ data, openCase }) {
  return (<div>
    <div className="ctx-kick">الإشراف على التظلّمات · مفوّض للمكتب الفني</div>
    <h2 className="h2">تقارير التظلّمات</h2>
    <p className="lede">سجلّ كامل بكل التظلّمات وحالتها ومآلها — للاطّلاع فقط. افتح أيّ تظلّم لعرض تقرير الحالة الكامل.</p>
    {data.length === 0
      ? <Card className="card pad"><p className="lede" style={{ textAlign: 'center', padding: 24 }}>لا تظلّمات مرفوعة بعد.</p></Card>
      : <Card className="card" style={{ overflow: 'hidden' }}>
      <div className="tbl-wrap"><table>
        <thead><tr><th>رقم التظلّم</th><th>الرمز السري</th><th>الفئة</th><th>محل الاعتراض</th><th>الميعاد</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{data.map((g) => (
          <tr key={g.id} className="clk" onClick={() => openCase(g)}>
            <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{g.ref}</td>
            <td className="mono">{g.secret}</td>
            <td><Tag tone="info" size="sm">{g.cat}</Tag></td>
            <td className="muted">{g.scopeLabel}</td>
            <td><span style={{ fontSize: 12.5, color: (g.daysElapsed >= 8 && !g.decided) ? 'var(--color-error)' : 'var(--color-primary)', fontWeight: 600 }}>{g.decided ? 'بُتّ' : `متبقٍّ ${Math.max(0, 10 - g.daysElapsed)} يوم`}</span></td>
            <td>{statusTag(g)}</td>
            <td><span className="link">تقرير <I name="chevron_left" size={16} /></span></td>
          </tr>))}
        </tbody>
      </table></div>
    </Card>}
  </div>);
}

// ===== تقرير الحالة الكامل (قراءة فقط) =====
function CaseReport({ g, back }) {
  const acc = g.status === 'upheld';
  const fmtD = (ts) => { try { return new Date(ts).toLocaleDateString('ar-SA', { dateStyle: 'medium' }); } catch (e) { return '—'; } };
  return (<div>
    <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى التقارير</button>

    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <I name="gavel" size={26} fill color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>تقرير التظلّم <span className="mono">{g.ref}</span></div>
            <div className="muted">{g.scopeLabel} · رُفِع في {fmtD(g.filedAt)}</div>
          </div>
        </div>
        {statusTag(g)}
      </div>
      <div style={{ marginTop: 14 }}><SecretCode code={g.secret} canReveal={false} /></div>
      {!g.decided && <div style={{ marginTop: 12 }}><DeadlineTimer label="مهلة البتّ في التظلّم" totalDays={10} daysElapsed={g.daysElapsed} articleRef="م21" /></div>}
    </Card>

    <div className="pkg-bar"><I name="visibility" size={18} /><span>تقرير اطّلاعي للنائب العام — هوية المعني بالحماية مرمَّزة (م2/م15/م16)، والبتّ من اختصاص المكتب الفني.</span></div>

    <Card className="card pad" style={{ marginBottom: 14, background: 'var(--warning-10)', borderColor: 'var(--warning-50)' }}>
      <div className="sec-h"><I name="record_voice_over" size={19} color="var(--color-warning)" /> محل التظلّم — كما قدّمه طالب الحماية</div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: 'var(--text-body)' }}>{g.against}</p>
    </Card>

    <div className="conf-note" style={{ marginBottom: 14 }}><I name="info" size={16} /> تفاصيل ملف القضية ودراساتها ليست مرتبطةً بسجلّ هذا التظلّم في قاعدة البيانات، فلا تُعرَض هنا تفادياً لأي بيانٍ غير موثّق.</div>

    <Card className="card pad" style={{ borderColor: g.decided ? (acc ? 'var(--color-primary)' : 'var(--color-error)') : 'var(--border-subtle)' }}>
      <div className="sec-h"><I name="verified" size={19} color="var(--color-primary)" /> مآل التظلّم لدى المكتب الفني</div>
      {g.decided ? (
        <React.Fragment>
          <InlineAlert kind={acc ? 'success' : 'error'} title={acc ? 'اعتمد المكتب الفني قبول التظلّم — نهائي' : 'اعتمد المكتب الفني رفض التظلّم — نهائي'}>
            {acc ? 'يُشمل المتقدّم ببرنامج الحماية مباشرةً، وأُشعِر هو والمركز.' : 'قرار المكتب الفني في التظلّم نهائي، وأُشعِر المتقدّم والمركز.'}
          </InlineAlert>
          {g.techOpinion && <div className="opin" style={{ marginTop: 12 }}>{g.techOpinion}</div>}
        </React.Fragment>
      ) : (
        <InlineAlert kind="warning" title="قيد نظر المكتب الفني">التظلّم قيد المراجعة لدى المكتب الفني ولم يصدر قراره بعد.</InlineAlert>
      )}
    </Card>
  </div>);
}

// ===== الإشعارات =====
// خريطة نوع الإشعار → أيقونة/لون (النمط البصريّ لبوّابة النائب).
const AG_NT = {
  foreign_pg: ['public', 'warning'], foreign_ok: ['verified', 'primary'], foreign_no: ['gavel', 'info'],
  grievance_in: ['fact_check', 'info'], grievance_done: ['verified', 'primary'],
  urgent: ['emergency', 'error'], default: ['notifications', 'info'],
};
const fmtNotifTime = (ts) => { try { return new Date(ts).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } };

function Notifs({ go }) {
  const NT = { primary: ['var(--green-10)', 'var(--color-primary)'], info: ['var(--info-10)', 'var(--color-info)'], warning: ['var(--warning-10)', 'var(--color-warning)'], error: ['var(--error-10)', 'var(--color-error)'], success: ['var(--success-10)', 'var(--color-success)'] };
  const [rows, setRows] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from('notifications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (active) setRows(data ?? []); });
    load();
    const ch = supabase.channel('ag-notifs').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  const items = rows.map((n) => { const [icon, tone] = AG_NT[n.type] || AG_NT.default; return { id: n.id, icon, tone, t: n.title || 'إشعار', d: n.body, time: fmtNotifTime(n.created_at), unread: !n.read, go: n.target_tab }; });
  const unread = items.filter((n) => n.unread).length;
  const markAll = async () => { const ids = rows.filter((n) => !n.read).map((n) => n.id); if (!ids.length) return; await supabase.from('notifications').update({ read: true }).in('id', ids); setRows((s) => s.map((x) => ({ ...x, read: true }))); };
  const open = async (i) => { const it = items[i]; if (it.unread) { await supabase.from('notifications').update({ read: true }).eq('id', it.id); setRows((s) => s.map((x) => x.id === it.id ? { ...x, read: true } : x)); } if (it.go && go) go(it.go); };
  return (<div>
    <div className="ctx-kick">مكتب النائب العام</div>
    <h2 className="h2">الإشعارات</h2>
    <p className="lede">ما يتطلّب بتّكم، مآلات المكتب الفني، تجاوزات المواعيد، والمراسلات — اضغط الإشعار للانتقال إليه.</p>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
      <span className="muted">{unread ? `${unread} غير مقروء` : 'لا جديد'}</span>
      <button className="btn sm" onClick={markAll} disabled={!unread}><I name="done_all" size={17} /> تعليم الكل كمقروء</button>
    </div>
    {items.length === 0 && <p className="lede" style={{ textAlign: 'center', padding: 24 }}>لا إشعارات بعد.</p>}
    <div style={{ display: 'grid', gap: 10 }}>{items.map((n, i) => { const [bg, fg] = NT[n.tone]; return (
      <div key={n.id} onClick={() => open(i)} style={{ display: 'flex', gap: 12, padding: '14px 16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: n.unread ? 'var(--green-10)' : 'var(--surface-card)', alignItems: 'flex-start', cursor: 'pointer' }}>
        <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', display: 'grid', placeItems: 'center', background: bg, color: fg }}><I name={n.icon} size={20} fill /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{n.t}</div><div style={{ fontSize: 13, color: 'var(--text-body)', marginTop: 2, lineHeight: 1.55 }}>{n.d}</div><div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{n.time}</div></div>
        {n.unread ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} /> : <I name="chevron_left" size={18} color="var(--text-tertiary)" style={{ marginTop: 4, flexShrink: 0 }} />}
      </div>); })}</div>
  </div>);
}

// ===== الملف الشخصي =====
function Profile() {
  const fields = [
    ['الاسم', 'النائب العام'],
    ['الصفة', 'النائب العام'],
    ['الجهة', 'النيابة العامة — مكتب النائب العام'],
    ['نطاق العمل', 'الإشراف على التظلّمات + المسار العاجل ومسار الأجنبي'],
    ['الصلاحية في التظلّمات', 'اطّلاع وتقارير فقط (البتّ مفوَّض للمكتب الفني)'],
    ['التوثيق', 'نفاذ + MFA'],
  ];
  return (<div>
    <div className="ctx-kick">الحساب</div>
    <h2 className="h2">الملف الشخصي</h2>
    <p className="lede">حسابك ونطاق إشرافك على مرحلة التظلّمات.</p>
    <Card className="card pad">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {fields.map(([l, v], i) => (<div className="ro-field" key={i}><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{l}</span><span style={{ fontSize: 13, color: 'var(--text-body)' }}>{v}</span></div>))}
      </div>
      <InlineAlert kind="info" title="التفويض والفصل بين الأدوار" style={{ marginTop: 14 }}>فوّض النائب العام البتّ في التظلّمات للمكتب الفني، فبوابته هنا للاطّلاع على سيرها وتقاريرها فقط. أمّا المسار العاجل ومسار الأجنبي فلم يُفوَّضا، ويبتّ فيهما النائب العام مباشرةً ضمن قسمَيهما التشغيليَّين في هذه البوابة.</InlineAlert>
    </Card>
  </div>);
}

// ===== مسار الأجنبي — البتّ النهائي لدى النائب العام (المادة السادسة) =====
// طلبات أجنبية وردت عبر اللجنة الدائمة بوزارة الداخلية، دُرست وصُوِّت عليها بالمركز،
// وتُرفع توصيتها للنائب العام للبتّ النهائي وفق مبدأ المعاملة بالمثل.
// الطلبات الأجنبيّة تُقرأ حيّاً من foreign_requests عبر useForeign() — لا بيانات مُلفّقة.

function fStatusTag(f) {
  if (f.decided === 'approved') return <Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} />}>بتّ النائب — قبول</Tag>;
  if (f.decided === 'declined') return <Tag tone="error" size="sm" iconLeft={<I name="block" size={13} />}>بتّ النائب — رفض</Tag>;
  return <Tag tone="warning" size="sm" iconLeft={<I name="how_to_vote" size={13} />}>بانتظار بتّ النائب</Tag>;
}

function ForeignDecisionPanel({ f, onDecide }) {
  const [outcome, setOutcome] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isReject = outcome === 'reject';
  const ready = outcome && reason.trim() && !busy;
  if (f.decided || done) {
    const acc = (f.decided || (outcome === 'accept' ? 'approved' : 'declined')) === 'approved';
    return (
      <Card className="card pad" style={{ borderColor: acc ? 'var(--color-primary)' : 'var(--color-error)' }}>
        <div className="sec-h"><I name="gavel" size={19} color={acc ? 'var(--color-primary)' : 'var(--color-error)'} /> القرار النهائي للنائب العام</div>
        <InlineAlert kind={acc ? 'success' : 'error'} title={acc ? 'قَبِل النائب العام الطلب الأجنبي — نهائي' : 'رَفَض النائب العام الطلب الأجنبي — نهائي'}>
          {acc
            ? 'يُشمل الشخص ببرنامج الحماية، وتُبلَّغ السلطة الأجنبية والشخص عبر اللجنة الدائمة بوزارة الداخلية — أُشعِرت الداخلية بالقرار لحظيّاً.'
            : 'قرار النائب العام نهائي، وتُبلَّغ السلطة الأجنبية بالأسباب عبر اللجنة الدائمة بوزارة الداخلية — أُشعِرت الداخلية بالقرار لحظيّاً.'}
        </InlineAlert>
        {reason.trim() && <div className="opin" style={{ marginTop: 12 }}>{reason}</div>}
        <div className="row" style={{ marginTop: 10 }}><span className="muted">المقرِّر: النائب العام</span></div>
      </Card>
    );
  }
  const submit = async () => {
    setBusy(true); setErr('');
    const { error } = await decideForeign(f.id, outcome);
    setBusy(false);
    if (error) { setErr('تعذّر حفظ القرار: ' + error.message); return; }
    setDone(true);
    onDecide && onDecide(outcome, reason);
  };
  return (
    <Card className="card pad">
      <div className="sec-h"><I name="gavel" size={19} color="var(--color-primary)" /> البتّ النهائي — النائب العام (المادة السادسة)</div>
      <InlineAlert kind="info" title="القرار النهائي من اختصاصك" style={{ marginBottom: 14 }}>القرار النهائي في الطلب الأجنبي من اختصاصك مباشرةً وفق مبدأ المعاملة بالمثل — قبول أو رفض. يُبلَّغ القرار إلى وزارة الداخلية (اللجنة الدائمة) لحظةَ إصداره.</InlineAlert>
      <div className="fld"><span className="fld-label">القرار النهائي</span>
        <div className="chips">
          <button className={'chip' + (outcome === 'accept' ? ' on' : '')} onClick={() => setOutcome('accept')}>قبول</button>
          <button className={'chip danger' + (outcome === 'reject' ? ' on' : '')} onClick={() => setOutcome('reject')}>رفض</button>
        </div>
      </div>
      <div className="fld"><span className="fld-label">تسبيب القرار {isReject && <span style={{ color: 'var(--color-error)' }}>· إلزامي للرفض</span>}</span>
        <textarea className="ta" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isReject ? 'أسباب الرفض — تُبلَّغ للسلطة الأجنبية عبر اللجنة الدائمة…' : 'مسوّغات القبول…'} dir="auto" />
      </div>
      {err && <InlineAlert kind="error" title="خطأ" style={{ marginBottom: 10 }}>{err}</InlineAlert>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={!ready} onClick={submit}><I name="verified" size={18} /> {busy ? 'جارٍ الحفظ…' : 'إصدار القرار النهائي وإشعار اللجنة'}</button>
      </div>
    </Card>
  );
}

function ForeignDetail({ f, back, onDecide }) {
  return (<div>
    <button className="linkbtn" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> العودة إلى مسار الأجنبي</button>

    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <I name="public" size={26} fill color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>طلب أجنبي <span className="mono">{f.ref}</span></div>
            <div className="muted">{f.country} · {f.basis} · {f.cat}</div>
          </div>
        </div>
        {fStatusTag(f)}
      </div>
      <div style={{ marginTop: 14 }}><SecretCode code={f.secret} canReveal={false} /></div>
    </Card>

    <div className="pkg-bar"><I name="public" size={18} /><span>المسار الأجنبي — معاملة بالمثل (المادة السادسة). وارد من <b>{f.authority}</b> ({f.country}) عبر اللجنة الدائمة بوزارة الداخلية على أساس <b>{f.basis}</b>.</span></div>

    <Card className="card pad" style={{ marginBottom: 14 }}>
      <div className="sec-h"><I name="flag" size={19} color="var(--color-primary)" /> المصدر الأجنبي</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['الدولة الطالبة', f.country], ['السلطة الأجنبية', f.authority], ['المرجع الأجنبي', f.foreignRef || '—'], ['أساس الطلب', f.basis], ['الفئة', f.cat], ['المعاملة بالمثل', f.reciprocity ? 'متوافرة' : '—']].map(([k, v], i) => (
          <div className="ro-field" key={i}><span className="fac-k">{k}</span><span className="fac-v">{v}</span></div>))}
      </div>
      {f.summary ? <div className="opin" style={{ marginTop: 12 }}>{f.summary}</div>
        : <InlineAlert kind="info" title="لا ملخّص" style={{ marginTop: 12 }}>لم يرد ملخّصٌ لهذا الطلب في سجلّه.</InlineAlert>}
    </Card>

    <div className="conf-note" style={{ marginBottom: 14 }}><I name="info" size={16} /> تفاصيل دراسة المركز وتصويت المجلس ليست مرتبطةً بسجلّ هذا الطلب في قاعدة البيانات، فلا تُعرَض هنا تفادياً لأي بيانٍ غير موثّق.</div>

    <ForeignDecisionPanel f={f} onDecide={onDecide} />
  </div>);
}

function ForeignPath() {
  const [sel, setSel] = useState(null);
  const data = useForeign();
  const selF = data.find((f) => f.ref === sel) || null;
  if (selF) return <ForeignDetail f={selF} back={() => setSel(null)} onDecide={() => {}} />;
  const awaiting = data.filter((f) => !f.decided).length;
  return (<div>
    <div className="ctx-kick">المادة السادسة · معاملة بالمثل · بتّ نهائي</div>
    <h2 className="h2">مسار الأجنبي — البتّ النهائي</h2>
    <p className="lede">طلبات حماية واردة من سلطات أجنبية عبر اللجنة الدائمة بوزارة الداخلية، وتُرفع إليك للبتّ النهائي مباشرةً وفق مبدأ المعاملة بالمثل (المادة السادسة) — غير مفوَّض.</p>
    <div className="stats">
      <Stat icon="public" v={data.length} l="إجمالي الطلبات الأجنبية" bg="var(--info-10)" fg="var(--color-info)" />
      <Stat icon="how_to_vote" v={awaiting} l="بانتظار بتّك النهائي" bg="var(--warning-10)" fg="var(--color-warning)" />
      <Stat icon="gavel" v={data.length - awaiting} l="بُتّ فيها" bg="var(--green-10)" fg="var(--color-primary)" />
    </div>
    {data.length === 0
      ? <Card className="card pad"><p className="lede" style={{ textAlign: 'center', padding: 24 }}>لا طلبات أجنبيّة واردة بعد.</p></Card>
      : <Card className="card" style={{ overflow: 'hidden' }}>
      <div className="tbl-wrap"><table>
        <thead><tr><th>المرجع</th><th>الدولة الطالبة</th><th>الفئة</th><th>أساس الطلب</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{data.map((f) => (
          <tr key={f.ref} className="clk" onClick={() => setSel(f.ref)}>
            <td className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{f.ref}</td>
            <td>{f.country}</td>
            <td><Tag tone="info" size="sm">{f.cat}</Tag></td>
            <td className="muted">{f.basis}</td>
            <td>{fStatusTag(f)}</td>
            <td><span className="link">عرض <I name="chevron_left" size={16} /></span></td>
          </tr>))}
        </tbody>
      </table></div>
    </Card>}
  </div>);
}

// ===== التقرير الربع سنوي — وارد لاطّلاع معاليه (م4/9/ت لائحة) =====
function PeriodicReport({ data, go }) {
  const [ack, setAck] = useState(false);
  const [showDir, setShowDir] = useState(false);
  const [dir, setDir] = useState('');
  const [sentDir, setSentDir] = useState(false);
  const [, force] = useState(0);
  const foreign = useForeign();
  const U = useUrgent();
  React.useEffect(() => { const h = () => force((n) => n + 1); window.addEventListener('storage', h); window.addEventListener('hemaya-challenges', h); return () => { window.removeEventListener('storage', h); window.removeEventListener('hemaya-challenges', h); }; }, []);

  const uTotal = U.length;
  const uApproved = U.filter((x) => x.status === 'approved').length;
  const uPend = U.filter((x) => x.status === 'pending').length;
  const gTotal = data.length;
  const gAccept = data.filter((g) => statusOf(g) === 'adopted-accept').length;
  const gReject = data.filter((g) => statusOf(g) === 'adopted-reject').length;
  const gAdopted = gAccept + gReject;
  const gRate = gAdopted ? Math.round((gAccept / gAdopted) * 100) : 0;
  const gExceeded = data.filter((g) => g.daysElapsed >= 10 && !g.officeDecision).length;
  const fTotal = foreign.length;
  const fDecided = foreign.filter((f) => f.decided).length;
  const C = (HemayaMetrics && HemayaMetrics.center) || { reqIn: 148, decisions: 96, accept: 62, reject: 34, acceptRate: 65, cycle: 11, covered: 63, dReq: '+16', dDec: '+8', dAcc: '+4 نقاط', dCyc: '−2 يوم' };

  const measures = (HemayaMetrics && HemayaMetrics.measures) || [
    { k: 'الحماية الأمنية والمرافقة', v: 38 },
    { k: 'إخفاء البيانات الشخصية', v: 27 },
    { k: 'الإرشاد القانوني والنفسي والاجتماعي', v: 19 },
    { k: 'تغيير محل الإقامة', v: 12 },
    { k: 'المساعدة المالية وحماية المسكن', v: 9 },
  ];
  const mMax = Math.max.apply(null, measures.map((m) => m.v));
  const sla = (HemayaMetrics && HemayaMetrics.sla) || [
    { k: 'رفع التوصية من الجهة المختصة', d: '5 أيام عمل', ref: 'م5/3', pct: 96 },
    { k: 'الإشعار بالقبول أو الرفض', d: '3 أيام', ref: 'م10', pct: 100 },
    { k: 'بتّ التظلّم أمام النائب العام', d: '10 أيام', ref: 'م21', pct: 92 },
    { k: 'رفع التقرير الدوري', d: '90 يوماً', ref: 'م4/9/ت', pct: 100 },
  ];
  const chal = (HemayaChallenges && HemayaChallenges.list && HemayaChallenges.list().length) ? HemayaChallenges.list() : [
    { c: 'تفاوت عبء التظلّمات بين مستشاري المكتب الفني مع ضيق مهلة (10) أيام (م21).', s: 'توزيعٌ آليّ حسب الأقل عبئاً، ومؤشّر «اقتراب الميعاد» على لوحة الإشراف للتدخّل المبكر.' },
    { c: 'حفظ هوية المشمولين عبر تعدّد الجهات المنفّذة (المركز، الأمن، الوزارات).', s: 'اعتماد الرمز السري في كل البوابات (م2، م15) وكشف التفاصيل عند الحاجة فقط بسجلّ تدقيق.' },
    { c: 'تنسيق تنفيذ التدابير ومتابعة إنجازها بين المركز والجهات.', s: 'ناقلٌ موحّد (إحالة ← تنفيذ ← اعتماد) يربط المركز بالإدارة الأمنية والوزارات ويعكس حالة كل تدبير.' },
    { c: 'البتّ في الطلبات العاجلة (م8) خارج أوقات انعقاد المجلس.', s: 'مسارٌ مباشر لمعالي النائب العام بقرار مؤقّت (حتّى 30 يوماً) لحين عرض الحالة على المجلس.' },
  ];

  const KPI = ({ v, l, delta, up }) => (
    <div className="rp-kpi">
      <div className="rp-kpi-v num">{v}</div>
      <div className="rp-kpi-l">{l}</div>
      <div className="rp-kpi-delta good"><I name={up ? 'trending_up' : 'trending_down'} size={13} />{delta} <span className="rp-kpi-vs">عن الربع السابق</span></div>
    </div>
  );

  return (<div className="rp-doc">
    <div className="rp-cover">
      <div className="rp-crest">
        <img className="rp-logo" src="../assets/logo-pp-gold.png" alt="النيابة العامة" />
        <span className="rp-crest-div" />
        <img className="rp-logo rp-logo-center" src="../assets/logo-center-gold.png" alt="مركز الحماية" />
      </div>
      <div className="rp-cover-body">
        <div className="rp-doctype">تقريرٌ دوريّ · وارد للاطّلاع</div>
        <h1 className="rp-title">التقرير الربع سنوي لأعمال المركز</h1>
        <div className="rp-period">الربع الثاني — العام 1447هـ</div>
        <div className="rp-raise"><I name="workspace_premium" size={17} /> مرفوعٌ إلى مقام معالي النائب العام</div>
      </div>
      <div className="rp-meta">
        <div className="rp-meta-i"><span>الجهة الرافعة</span><b>إدارة البرنامج — رئيس المركز</b></div>
        <div className="rp-meta-i"><span>المرفوع إليه</span><b>معالي النائب العام</b></div>
        <div className="rp-meta-i"><span>الأساس النظامي</span><b>المادة (4/9/ت) لائحة</b></div>
        <div className="rp-meta-i"><span>الدورية</span><b>ربع سنوي · كل 90 يوماً</b></div>
        <div className="rp-meta-i"><span>رقم التقرير</span><b className="mono">QR-1447-Q2</b></div>
      </div>
    </div>

    <section className="rp-sec">
      <div className="rp-sec-head"><span className="rp-sec-num">1</span><h2 className="rp-sec-title">ملخّص تنفيذي</h2></div>
      <p className="rp-srcnote"><I name="database" size={13} /> المصدر: تُجمَّع من مراحل الطلبات والقرارات والتنفيذ — لقطة الربع</p>
      <p className="rp-lead">واصل المركز خلال الربع الثاني أداء مهامّه في تلقّي طلبات الحماية ودراستها واتّخاذ التدابير وتنفيذها ومتابعتها، مع التزامٍ عالٍ بالمواعيد النظامية وسرّية هوية المشمولين. ارتفعت الطلبات الواردة والقرارات الصادرة عن الربع السابق، وبُتّ في الطلبات العاجلة والأجنبية والتظلّمات ضمن مُهَلها.</p>
      <div className="rp-kpis">
        <KPI v={C.reqIn} l="طلباً وارداً هذا الربع" delta={C.dReq} up={true} />
        <KPI v={C.decisions} l="قراراً صادراً" delta={C.dDec} up={true} />
        <KPI v={C.acceptRate + '%'} l="نسبة القبول" delta={C.dAcc} up={true} />
        <KPI v={C.cycle + ' يوم'} l="متوسط زمن الدورة" delta={C.dCyc} up={false} />
      </div>
    </section>

    <section className="rp-sec">
      <div className="rp-sec-head"><span className="rp-sec-num">2</span><h2 className="rp-sec-title">الطلبات والقرارات</h2></div>
      <p className="rp-srcnote"><I name="database" size={13} /> المصدر: بوابتا الطلبات والجهات ← مرحلة القرار والإشعار ← التنفيذ</p>
      <p className="rp-lead">حركة الطلبات من التقديم حتّى القرار خلال الربع، ومآل القرارات الصادرة عن إدارة البرنامج.</p>
      <div className="rp-figs">
        <div className="rp-fig"><b className="num">{C.reqIn}</b><span>طلباً وارداً</span></div>
        <div className="rp-fig"><b className="num">{C.decisions}</b><span>قراراً صادراً</span></div>
        <div className="rp-fig"><b className="num" style={{ color: 'var(--color-primary)' }}>{C.accept}</b><span>قبول</span></div>
        <div className="rp-fig"><b className="num" style={{ color: 'var(--color-error)' }}>{C.reject}</b><span>رفض مسبّب</span></div>
        <div className="rp-fig"><b className="num">{C.covered}</b><span>تحت التنفيذ حالياً</span></div>
      </div>
    </section>

    <section className="rp-sec">
      <div className="rp-sec-head"><span className="rp-sec-num">3</span><h2 className="rp-sec-title">تدابير الحماية المنفّذة</h2></div>
      <p className="rp-srcnote"><I name="database" size={13} /> المصدر: مرحلة التنفيذ والوزارات المنفّذة (الصحة · الموارد · الأمنية)</p>
      <p className="rp-lead">توزيع أبرز أنواع التدابير المقرّرة خلال الربع (المادة 14 نظام وما أضافته اللائحة).</p>
      <div className="rp-bars">
        {measures.map((m, i) => (
          <div className="rp-bar" key={i}>
            <span className="rp-bar-k">{m.k}</span>
            <span className="rp-bar-track"><span className="rp-bar-fill" style={{ width: Math.round((m.v / mMax) * 100) + '%' }} /></span>
            <span className="rp-bar-v num">{m.v}</span>
          </div>
        ))}
      </div>
    </section>

    <section className="rp-sec">
      <div className="rp-sec-head"><span className="rp-sec-num">4</span><h2 className="rp-sec-title">التظلّمات والطلبات العاجلة والأجنبية</h2></div>
      <p className="rp-srcnote"><I name="database" size={13} /> المصدر: المكتب الفني · المسار العاجل · اللجنة الدائمة بالداخلية والمركز</p>
      <div className="rp-grid3">
        <div className="rp-block">
          <div className="rp-block-h"><I name="gavel" size={17} color="var(--color-primary)" /> التظلّمات (م21)</div>
          <div className="rp-block-figs">
            <div className="rp-mini"><b className="num">{gTotal}</b><span>إجمالي</span></div>
            <div className="rp-mini"><b className="num">{gRate}%</b><span>نسبة القبول</span></div>
            <div className="rp-mini"><b className="num">{gExceeded}</b><span>تجاوز المهلة</span></div>
          </div>
        </div>
        <div className="rp-block">
          <div className="rp-block-h"><I name="bolt" size={17} color="var(--color-error)" fill /> العاجلة (م8)</div>
          <div className="rp-block-figs">
            <div className="rp-mini"><b className="num">{uTotal}</b><span>وارد</span></div>
            <div className="rp-mini"><b className="num">{uApproved}</b><span>بُتّ بتدبير</span></div>
            <div className="rp-mini"><b className="num">{uPend}</b><span>قيد البتّ</span></div>
          </div>
        </div>
        <div className="rp-block">
          <div className="rp-block-h"><I name="public" size={17} color="var(--pp-bronze-ink)" /> الأجنبية (م6)</div>
          <div className="rp-block-figs">
            <div className="rp-mini"><b className="num">{fTotal}</b><span>إجمالي</span></div>
            <div className="rp-mini"><b className="num">{fDecided}</b><span>بُتّ نهائياً</span></div>
            <div className="rp-mini"><b className="num">{fTotal - fDecided}</b><span>قيد البتّ</span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="rp-sec">
      <div className="rp-sec-head"><span className="rp-sec-num">5</span><h2 className="rp-sec-title">الالتزام بالمواعيد النظامية</h2></div>
      <p className="rp-srcnote"><I name="database" size={13} /> المصدر: عدّادات المواعيد النظامية عبر كل المراحل</p>
      <div className="rp-sla">
        {sla.map((r, i) => (
          <div className="rp-sla-row" key={i}>
            <div><div className="rp-sla-k">{r.k}<small>{r.ref}</small></div></div>
            <div className="rp-sla-d">خلال {r.d}</div>
            <span className="rp-sla-track"><span className="rp-sla-fill" style={{ width: r.pct + '%' }} /></span>
            <span className="rp-sla-pct num">{r.pct}%</span>
          </div>
        ))}
      </div>
    </section>

    <section className="rp-sec">
      <div className="rp-sec-head"><span className="rp-sec-num">6</span><h2 className="rp-sec-title">التحدّيات والحلول</h2></div>
      <p className="rp-srcnote"><I name="edit_note" size={13} /> المصدر: مُحرّر التحديات — رئيس المركز (إدارة البرنامج) · يُغذّى آلياً</p>
      <div className="rp-chal">
        {chal.map((it, i) => (
          <div className="rp-chal-row" key={i}>
            <div className="rp-chal-c"><div className="rp-chal-lbl"><I name="report_problem" size={14} /> التحدّي</div><div className="rp-chal-t">{it.c}{it.evidence ? <span className="rp-ev"> · مسنودٌ بـ{it.evidence}</span> : null}</div></div>
            <div className="rp-chal-s"><div className="rp-chal-lbl"><I name="check_circle" size={14} /> الحلّ المتّبع</div><div className="rp-chal-t">{it.s}</div></div>
          </div>
        ))}
      </div>
    </section>

    <div className="rp-close">
      <div className="rp-close-h"><I name="history_edu" size={16} /> خاتمة</div>
      <p>يواصل المركز أداء مهمّته وفق نظام حماية الشهود والمبلّغين والخبراء والضحايا ولائحته التنفيذية، ملتزماً بالمواعيد النظامية وسرّية هوية المشمولين، ويرفع رئيس المركز هذا التقرير لاطّلاع مقام معاليكم وإحاطتكم بمُجمَل أعمال المركز، واعتماد ما ترونه.</p>
    </div>

    <div className="rp-action no-print">
      <div className="rp-action-h"><I name="workspace_premium" size={19} /> إجراء معاليكم</div>
      {ack
        ? <div className="rp-ack-stamp"><I name="verified" size={18} fill /> أحاط معاليكم علماً بالتقرير — <span className="mono">اليوم</span></div>
        : <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>هذا التقرير مرفوعٌ لاطّلاع معاليكم وإحاطتكم بأعمال المركز. لكم الإحاطة، وإبداء ما ترونه من توجيه لرئيس المركز.</p>}
      <div className="rp-action-row">
        {!ack && <button className="rp-btn rp-btn-gold" onClick={() => setAck(true)}><I name="verified" size={18} /> الإحاطة والاعتماد</button>}
        <button className="rp-btn rp-btn-ghost" onClick={() => setShowDir((v) => !v)}><I name="edit_note" size={18} /> إبداء توجيه لرئيس المركز</button>
        <button className="rp-btn rp-btn-ghost" onClick={() => window.print()}><I name="print" size={18} /> طباعة / حفظ PDF</button>
      </div>
      {showDir && (
        <div className="rp-dir">
          {sentDir
            ? <InlineAlert kind="success" title="أُرسل التوجيه">أُرسل توجيه معاليكم إلى رئيس المركز (د. إسحاق الحصين)، وُوثّق في سجلّ التدقيق.</InlineAlert>
            : (<React.Fragment>
                <textarea value={dir} onChange={(e) => setDir(e.target.value)} placeholder="توجيه معاليكم لرئيس المركز بشأن التقرير…" dir="auto" />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><button className="rp-btn rp-btn-gold" disabled={!dir.trim()} onClick={() => setSentDir(true)}><I name="send" size={17} /> إرسال التوجيه</button></div>
              </React.Fragment>)}
        </div>
      )}
    </div>
  </div>);
}

// ===== المراسلات =====
// مراسلات التنسيق — حقيقيّة عبر coord_messages (النائب ↔ المركز/المكتب الفني) + Realtime.
function Messages() {
  const supabase = useRef(createClient()).current;
  const ME = 'ag', MY_LABEL = 'النائب العام';
  const CONTACTS = [
    { id: 'center', name: 'رئيس المركز', role: 'مركز حماية الشهود', icon: 'account_balance' },
    { id: 'technical', name: 'المكتب الفني', role: 'مدير المكتب الفني', icon: 'shield_person' },
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
    const ch = supabase.channel('coord-ag-' + active).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coord_messages' }, (p) => {
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
  return (<div>
    <div className="ctx-kick">قناة تنسيقٍ مؤمّنة</div>
    <h2 className="h2">المراسلات</h2>
    <p className="lede">قناةٌ مؤمّنة يخاطب بها معاليكم رئيسَ المركز والمكتبَ الفني للتنسيق. تُوثّق كل مراسلة، ويُكتفى بالرمز السري عند ذكر أي معنيٍّ بالحماية.</p>
    <div className="msg-wrap">
      <div className="msg-contacts">
        {CONTACTS.map((c) => (
          <button key={c.id} className={'contact' + (active === c.id ? ' on' : '')} onClick={() => setActive(c.id)}>
            <div className="contact-av"><I name={c.icon} size={20} fill /></div>
            <div className="contact-meta"><div className="contact-name">{c.name}</div><div className="contact-role">{c.role}</div></div>
          </button>
        ))}
      </div>
      <div className="card msg-conv">
        <div className="conv-head"><div className="contact-av sm"><I name={cur.icon} size={18} fill /></div><div><div className="contact-name">{cur.name}</div><div className="contact-role">{cur.role}</div></div><span className="conf-chip"><I name="lock" size={13} /> قناة مؤمّنة</span></div>
        <div className="conv-body" ref={bodyRef}>
          {rows.length === 0 ? <div className="conv-empty"><I name="forum" size={30} color="var(--text-disabled)" /><span>ابدأ المراسلة مع {cur.name}.</span></div>
          : rows.map((m) => <div className={'bubble ' + (m.from_authority === ME ? 'out' : 'in')} key={m.id}><div className="bubble-txt">{m.body}</div><div className="bubble-t">{fmt(m.created_at)}</div></div>)}
        </div>
        <div className="composer">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`رسالة إلى ${cur.name}…`} dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <button className="send" onClick={send} disabled={!text.trim()}><I name="send" size={20} /></button>
        </div>
      </div>
    </div>
  </div>);
}

const NAV = [
  { id: 'dashboard', t: 'اللوحة الرئيسية', icon: 'dashboard', C: Dashboard, group: 'decide' },
  { id: 'urgent', t: 'المسار العاجل', icon: 'bolt', C: AG_UrgentPath, group: 'decide' },
  { id: 'foreign', t: 'مسار الأجنبي', icon: 'public', C: ForeignPath, group: 'decide' },
  { id: 'periodic', t: 'التقرير الربع سنوي', icon: 'event_repeat', C: PeriodicReport, group: 'oversee' },
  { id: 'reports', t: 'تقارير التظلّمات', icon: 'fact_check', C: Reports, group: 'oversee' },
  { id: 'messages', t: 'المراسلات', icon: 'forum', C: Messages, group: 'oversee' },
  { id: 'notifs', t: 'الإشعارات', icon: 'notifications', C: Notifs, group: 'oversee' },
  { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle', C: Profile, group: 'account' },
];

function App() {
  const hashId = () => { const h = (typeof location !== 'undefined' ? location.hash : '').replace('#', ''); return NAV.some((n) => n.id === h) ? h : null; };
  const [active, setActive] = useState(() => hashId() || 'dashboard');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const data = useGrievancesAG();

  const cur = NAV.find((n) => n.id === active) || NAV[0];
  const go = (id) => { setActive(id); setSel(null); setOpen(false); try { history.replaceState(null, '', '#' + id); } catch (e) {} window.scrollTo(0, 0); };
  const openCase = (g) => { setSel(g.ref); setActive('reports'); setOpen(false); window.scrollTo(0, 0); };
  const selG = data.find((g) => g.ref === sel) || null;
  const Comp = cur.C;
  React.useEffect(() => {
    const onHash = () => { const h = hashId(); if (h) { setActive(h); setSel(null); setOpen(false); } };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const GROUPS = [['decide', 'القرار المباشر — غير مفوّض'], ['oversee', 'التقارير والإشراف'], ['account', 'الحساب']];

  let body;
  if (sel && selG) body = <CaseReport g={selG} back={() => setSel(null)} />;
  else if (active === 'dashboard') body = <Dashboard data={data} openCase={openCase} go={go} />;
  else if (active === 'reports') body = <Reports data={data} openCase={openCase} />;
  else if (active === 'periodic') body = <PeriodicReport data={data} go={go} />;
  else if (active === 'notifs') body = <Notifs go={go} />;
  else if (active === 'messages') body = <Messages />;
  else body = <Comp />;

  const chip = active === 'foreign'
    ? <span className="view-chip" style={{ background: 'var(--green-10)', color: 'var(--green-80)' }}><I name="gavel" size={15} /> بتّ نهائي</span>
    : active === 'urgent'
    ? <span className="view-chip" style={{ background: 'var(--error-10)', color: 'var(--error-70)' }}><I name="bolt" size={15} fill /> بتّ عاجل مباشر</span>
    : active === 'periodic'
    ? <span className="view-chip" style={{ background: 'var(--info-10)', color: 'var(--color-info)' }}><I name="event_repeat" size={15} /> وارد للاطّلاع</span>
    : active === 'messages'
    ? <span className="view-chip"><I name="lock" size={15} /> قناة مؤمّنة</span>
    : (active === 'reports' || sel)
    ? <span className="view-chip"><I name="visibility" size={15} /> اطّلاع فقط</span>
    : null;

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="balance" size={22} color="#fff" fill /></div>
          <div><div className="brand-t">بوابة النائب العام</div><div className="brand-s">القرار والإشراف الأعلى</div></div>
        </div>
        <nav className="nav">
          {GROUPS.map(([gid, gt]) => (
            <React.Fragment key={gid}>
              <div className="nav-group">{gt}</div>
              {NAV.filter((n) => n.group === gid).map((n) => (
                <button key={n.id} className={'nav-item' + (active === n.id && !sel ? ' on' : '')} onClick={() => go(n.id)}>
                  <I name={n.icon} size={20} />
                  <span>{n.t}</span>
                  {n.badge ? <span className={'nav-badge' + (n.badgeCalm ? ' calm' : '')}>{n.badge}</span> : null}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="side-foot">مركز حماية الشهود والمبلّغين والخبراء والضحايا<br/>النيابة العامة — مكتب النائب العام</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          <span className="topbar-title">{sel ? 'تقرير الحالة' : cur.t}</span>
          <div className="top-right">
            {chip}
            <div className="who">
              <div className="who-meta"><div className="who-name">معالي النائب العام</div><div className="who-role">النيابة العامة</div></div>
              <div className="avatar"><I name="badge" size={18} /></div>
              <button className="ag-signout" title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); }} style={{ display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}><I name="logout" size={18} /></button>
            </div>
          </div>
        </header>
        <main className="content">{body}</main>
      </div>
    </div>
  );
}

export function AttorneyGeneralPortal() {
  return <App />;
}
