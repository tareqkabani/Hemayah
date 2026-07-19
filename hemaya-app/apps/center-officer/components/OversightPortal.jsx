'use client';
/* ============================================================
   قيادة المركز — الإشراف التنفيذي (منقول من oversight-portal.jsx)
   window→@hemaya/ui + وحدات محلّية. المخازن الخارجيّة (Metrics/Handoff/Challenges)
   محروسةٌ للـSSR وتسقط لبدائلها. مرحلة القرار انتقلت لبوابة القرار
   الموحّدة (منطقة /decision) — تحديث 15 يوليو؛ هنا بطاقة عبورٍ إليها فقط.
   role ∈ 'chair' | 'deputy'.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { Card, Tag, InlineAlert, SecretCode, RiskLevel, DeadlineTimer } from "@hemaya/ui";
import { createClient } from "@hemaya/supabase/src/browser";
import { HemayaChallenges } from "./challenges-store";
import { HemayaHandoff } from "./execution-handoff";
import { HemayaMetrics } from "./center-metrics";
import "./oversight.css";

const { App } = (function () {
  var _ot;

  const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) =>
    <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

  // ===== الأدوار =====
  const ROLE = {
    chair: {
      name: 'د. إسحاق الحصين', title: 'رئيس المركز', unit: 'الإدارة العليا',
      authority: 'سلطة نهائية', badge: 'chair', icon: 'shield_person',
      perms: 'اطّلاع كامل على جميع المسارات · توجيه واعتماد نهائي · تفويض النائب',
      canDirect: true, canDelegate: true,
    },
    deputy: {
      name: 'علي الدوهان', title: 'نائب رئيس المركز', unit: 'الإدارة العليا',
      authority: 'اطّلاع · متابعة · تصعيد', badge: 'deputy', icon: 'supervisor_account',
      perms: 'اطّلاع كامل على جميع المسارات · المتابعة والتصعيد للرئيس · البتّ عند التفويض',
      canDirect: false, canDelegate: false,
    },
  };

  // ===== بيانات الإشراف (تجميعية — مرمَّزة الهوية) =====
  const KPIS = [
    { id: 'active', v: '148', l: 'طلب نشط في المركز', icon: 'folder_open', tone: ['var(--info-10)', 'var(--color-info)'], foot: '+12 هذا الأسبوع', dir: 'up' },
    { id: 'council', v: '9', l: 'بانتظار بتّ المجلس', icon: 'how_to_vote', tone: ['var(--green-10)', 'var(--color-primary)'], foot: 'منها 2 عاجلة', dir: 'flat' },
    { id: 'breach', v: '3', l: 'تجاوزت المهلة النظامية', icon: 'gpp_maybe', tone: ['var(--error-10)', 'var(--color-error)'], foot: 'تتطلّب توجيهاً', dir: 'down' },
    { id: 'covered', v: '86', l: 'مشمول تحت الحماية', icon: 'verified_user', tone: ['var(--green-10)', 'var(--color-primary)'], foot: '+4 هذا الشهر', dir: 'up' },
    { id: 'cycle', v: '11', l: 'متوسط زمن الدورة (يوم)', icon: 'timelapse', tone: ['var(--surface-subtle)', 'var(--text-secondary)'], foot: 'يومان أقل', dir: 'up' },
    { id: 'periodic', v: 'يوم 68 / 90', l: 'التقرير الربع سنوي للنائب العام', icon: 'event_repeat', tone: ['var(--info-10)', 'var(--color-info)'], foot: 'م3/9/ت لائحة · عن جميع أعمال المركز · يتبقّى 22 يوماً', dir: 'flat' },
    { id: 'closed', v: '27', l: 'منجز هذا الشهر', icon: 'task_alt', tone: ['var(--green-10)', 'var(--color-primary)'], foot: '+6 عن الشهر السابق', dir: 'up' },
  ];

  const TRACKS = [
    { k: 'عادي', v: 88, c: 'var(--neutral-300, #9aa4b2)' },
    { k: 'عاجل', v: 38, c: 'var(--warning-50)' },
    { k: 'طارئ', v: 14, c: 'var(--color-error)' },
    { k: 'أجنبي', v: 8, c: 'var(--color-info)' },
  ];

  // مصادر الطلب — تظهر للقيادة في كل بطاقة
  const SRC = {
    'جهة':   { icon: 'account_balance', tone: ['var(--green-10)', 'var(--color-primary)'] },
    'ذاتي':  { icon: 'person', tone: ['var(--info-10)', 'var(--color-info)'] },
    'أجنبي': { icon: 'public', tone: ['var(--info-10)', 'var(--color-info)'] },
  };
  const STAGES = (HemayaMetrics && HemayaMetrics.pipeline) ? HemayaMetrics.pipeline.map((p, i) => ({ k: p.l, v: p.v, c: ['var(--info-50, #5b8def)', 'var(--color-primary)', 'var(--warning-50)', 'var(--green-70)'][i] || 'var(--color-primary)' })) : [
    { k: 'الفرز المبدئي', v: 34, c: 'var(--info-50, #5b8def)' },
    { k: 'الدراسة والتقييم', v: 52, c: 'var(--color-primary)' },
    { k: 'قرار المجلس', v: 9, c: 'var(--warning-50)' },
    { k: 'التنفيذ والمتابعة', v: 53, c: 'var(--green-70)' },
  ];
  const CATS = []; // (غير مستعمل — أُزيل التلفيق)

  // مسار الإجراءات — عيّنة من الطلبات في كل مرحلة (مع مصدر الطلب وتفاصيله للاطّلاع القيادي الكامل)
  const PIPE = {}; // لا قضايا مُلفّقة في المسار

  const STAFF = []; // لا أداء موظّفين مُلفّق

  const ALERTS = []; // لا تنبيهات مُلفّقة

  const AUDIT = []; // لا سجلّ تدقيق مُلفّق

  const fmtTrack = (t) => <span className={'pill track-' + t}>{t}</span>;
  const slaCls = (s) => s === 'breach' ? ' sla-breach' : s === 'warn' ? ' sla-warn' : '';

  // ===== رسوم =====
  function Donut({ data, total, label }) {
    let acc = 0; const stops = [];
    data.forEach((d) => { const a = acc / total * 360, b = (acc + d.v) / total * 360; stops.push(`${d.c} ${a}deg ${b}deg`); acc += d.v; });
    return (<div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops.join(',')})` }}>
        <div className="donut-c"><div><div className="donut-n">{total}</div><div className="donut-t">{label}</div></div></div>
      </div>
      <div className="legend" style={{ flex: 1 }}>{data.map((d) => (
        <div className="legend-i" key={d.k}><span className="legend-d" style={{ background: d.c }} /><span>{d.k}</span><span className="legend-v">{d.v}</span></div>
      ))}</div>
    </div>);
  }
  function Bars({ data, max }) {
    const m = max || Math.max(...data.map((d) => d.v));
    return (<div className="bars">{data.map((d) => (
      <div className="bar-row" key={d.k}>
        <span className="bar-k">{d.k}</span>
        <div className="bar-track"><div className="bar-fill" style={{ width: (d.v / m * 100) + '%', background: d.c || 'var(--color-primary)' }} /></div>
        <span className="bar-v">{d.v}</span>
      </div>
    ))}</div>);
  }

  // ===== النظرة الشاملة =====
  function Overview({ role, acting, setActing, toast, stats }) {
    const r = ROLE[role];
    // عدّادات حقيقيّة من القاعدة فقط — ما لا سند حقيقيّ له يظهر «—» (لا أرقام مُلفّقة).
    const kpiVal = (k) => (stats && stats.kpis && stats.kpis[k.id] != null) ? String(stats.kpis[k.id]) : '—';
    const realStages = (stats && stats.pipeline) ? stats.pipeline.map((p, i) => ({ k: p.k, v: p.v, c: STAGES[i] ? STAGES[i].c : 'var(--color-primary)' })) : [];
    const realTracks = (stats && stats.tracks) ? stats.tracks.map((t, i) => ({ ...t, c: TRACKS[i] ? TRACKS[i].c : 'var(--color-primary)' })) : [];
    const tracksTotal = realTracks.reduce((n, t) => n + t.v, 0);
    const effChair = role === 'chair' || acting;
    return (<div>
      {role === 'chair' && (
        <div className="auth-banner chair">
          <div className="auth-ico" style={{ background: 'var(--green-10)' }}><I name="shield_person" size={22} fill color="var(--color-primary)" /></div>
          <div><div className="auth-t">إشراف تنفيذي كامل — سلطة نهائية</div>
            <div className="auth-m">ترى كل ما يجري داخل المركز عبر المسارات والمراحل. لك التوجيه والاعتماد النهائي وتفويض النائب أثناء الإجازة.</div></div>
        </div>)}
      {role === 'deputy' && !acting && (
        <div className="auth-banner deputy">
          <div className="auth-ico" style={{ background: 'color-mix(in srgb, var(--color-info) 14%, transparent)' }}><I name="supervisor_account" size={22} fill color="var(--color-info)" /></div>
          <div><div className="auth-t">اطّلاع ومتابعة وتصعيد — دون البتّ النهائي</div>
            <div className="auth-m">ترى الصورة الكاملة وتتابع الأعمال وتُصعّد للرئيس ما يستلزم توجيهاً. تُفعَّل صلاحيات البتّ تلقائياً عند تفويض الرئيس (إجازة/غياب).</div></div>
        </div>)}
      {role === 'deputy' && acting && (
        <div className="auth-banner acting">
          <div className="auth-ico" style={{ background: 'var(--warning-10)' }}><I name="gavel" size={22} fill color="var(--warning-70)" /></div>
          <div><div className="auth-t">مُفوَّض حالياً بصلاحيات الرئيس — بقرار تفويض رقم ت-1447/22</div>
            <div className="auth-m">تتولّى التوجيه والاعتماد النهائي بالنيابة عن الرئيس أثناء إجازته. تنتهي الصلاحية تلقائياً بانتهاء مدّة التفويض، وكل إجراء يُسجَّل باسمك «بالنيابة».</div></div>
        </div>)}

      <div className="kpis">{KPIS.filter((k) => stats && stats.kpis && stats.kpis[k.id] != null).map((k) => (
        <Card className="card kpi" key={k.id}>
          <div className="kpi-top"><div className="kpi-ico" style={{ background: k.tone[0] }}><I name={k.icon} size={20} fill color={k.tone[1]} /></div>
            <div><div className="kpi-v">{kpiVal(k)}</div><div className="kpi-l">{k.l}</div></div></div>
        </Card>))}</div>

      <div className="grid2 wide">
        <Card className="card pad">
          <p className="sec-h"><I name="account_tree" size={18} color="var(--color-primary)" /> توزيع الطلبات على المراحل</p>
          <Bars data={realStages} max={Math.max(1, ...realStages.map((s) => s.v))} />
        </Card>
        <Card className="card pad">
          <p className="sec-h"><I name="donut_large" size={18} color="var(--color-primary)" /> حسب المسار</p>
          {tracksTotal > 0
            ? <Donut data={realTracks} total={tracksTotal} label="قضيّة" />
            : <p className="muted" style={{ textAlign: 'center', padding: 20 }}>لا بيانات بعد.</p>}
        </Card>
      </div>

      <Card className="card pad" style={{ marginBottom: 14 }}>
        <p className="sec-h"><I name="notification_important" size={18} color="var(--color-error)" /> ما يستلزم انتباه القيادة</p>
        {ALERTS.filter((a) => a.esc).map((a, i) => <AlertRow key={i} a={a} role={role} acting={acting} toast={toast} />)}
      </Card>

      {role === 'chair' && (
        <Card className="card pad">
          <p className="sec-h"><I name="manage_accounts" size={18} color="var(--color-primary)" /> تفويض النائب أثناء الإجازة</p>
          <p className="muted" style={{ margin: '0 0 14px', lineHeight: 1.7 }}>عند إجازتك أو غيابك، يمكنك تفويض نائب الرئيس بصلاحيات البتّ والتوجيه مؤقّتاً. تُفعَّل صلاحياته تلقائياً وتنتهي بانتهاء المدّة، وكل إجراء يُسجَّل «بالنيابة» في سجل التدقيق.</p>
          <DelegateCard toast={toast} />
        </Card>)}
    </div>);
  }

  function DelegateCard({ toast }) {
    const [on, setOn] = useState(false);
    const [days, setDays] = useState('5 أيام');
    return (<div>
      <div className="ro-field" style={{ marginBottom: 12 }}>
        <span className="row" style={{ gap: 10 }}><I name="supervisor_account" size={18} color="var(--text-secondary)" /><span className="ro-v">نائب الرئيس — علي الدوهان</span></span>
        <Tag tone={on ? 'success' : 'neutral'} size="sm">{on ? 'تفويض نشط' : 'غير مُفوَّض'}</Tag>
      </div>
      {on && <div className="fld" style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        <span className="muted">مدّة التفويض</span>
        <div className="row" style={{ gap: 8 }}>{['5 أيام', '10 أيام', 'حتى العودة'].map((d) => (
          <button key={d} className={'tab' + (days === d ? ' on' : '')} onClick={() => setDays(d)}>{d}</button>))}</div>
      </div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className={'btn ' + (on ? 'btn-ghost' : 'btn-primary')} onClick={() => { setOn(!on); toast(on ? 'أُلغي التفويض' : 'فُوِّض النائب بصلاحيات البتّ — ' + days); }}>
          <I name={on ? 'lock' : 'verified_user'} size={18} />{on ? 'إلغاء التفويض' : 'تفويض النائب'}</button>
      </div>
    </div>);
  }

  // ===== مسار الإجراءات + الاطّلاع الكامل =====
  function CaseDetail({ c, stage, back }) {
    const sc = SRC[c.src];
    return (<div>
      <button className="link-back" onClick={back}><I name="arrow_forward" size={18} /> العودة لمسار الإجراءات</button>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, margin: '6px 0 14px' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <SecretCode code={c.s} canReveal={false} /><Tag tone="info" size="sm">{c.cat}</Tag><RiskLevel level={c.risk} />{fmtTrack(c.track)}
        </div>
        <Tag tone="neutral" size="sm">{stage}</Tag>
      </div>

      <div className="detail-banner"><I name="visibility" size={18} fill color="var(--color-primary)" />
        <span>اطّلاع قيادي كامل — ترى القيادة كل تفاصيل الطلب ومساره منذ تقديمه؛ بيانات الشخص المعنيّ تبقى مرمّزة بالرمز السري.</span></div>

      <div className="grid2 wide">
        <Card className="card pad">
          <p className="sec-h"><I name="trip_origin" size={18} color="var(--color-primary)" /> مصدر الطلب</p>
          <div className="src-box">
            <div className="src-ico" style={{ background: sc.tone[0] }}><I name={sc.icon} size={22} fill color={sc.tone[1]} /></div>
            <div><div className="src-name">{c.srcName}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{c.src === 'ذاتي' ? 'مقدّم ذاتياً عبر نفاذ الوطني' : c.src === 'أجنبي' ? 'مسار أجنبي — تنسيق دولي' : 'توصية جهة مختصّة نيابةً عن الشخص'}</div></div>
          </div>
          <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
            <div className="ro-field"><span className="ro-k">تاريخ التقديم</span><span className="ro-v">{c.submitted}</span></div>
            <div className="ro-field"><span className="ro-k">المسار</span><span className="ro-v">{c.track}</span></div>
            <div className="ro-field"><span className="ro-k">الفئة</span><span className="ro-v">{c.cat}</span></div>
            <div className="ro-field"><span className="ro-k">المسؤول الحالي</span><span className="ro-v">{c.who}</span></div>
          </div>
        </Card>
        <Card className="card pad">
          <p className="sec-h"><I name="summarize" size={18} color="var(--color-primary)" /> ملخّص الحالة</p>
          <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-body)', margin: 0 }}>{c.summary}</p>
          {c.track === 'أجنبي' && <InlineAlert kind="info" title="اعتبارات المسار الأجنبي" style={{ marginTop: 12 }}>يخضع لتنسيق وزارة الخارجية والجوازات والتعاون الدولي؛ لم يُفوّض بعدُ جهة محدّدة لتولّيه — تحت إشراف القيادة مباشرةً.</InlineAlert>}
        </Card>
      </div>

      <Card className="card pad" style={{ marginTop: 14 }}>
        <p className="sec-h"><I name="timeline" size={18} color="var(--color-primary)" /> مسار الطلب منذ التقديم</p>
        <div className="tl">{c.tl.map((e, i) => (
          <div className="tl-i" key={i}><span className="tl-dot" />
            <div className="tl-t">{e[0]}</div>
            <div className="tl-m">{e[1]}{e[2] && e[2] !== '—' ? ' · ' + e[2] : ''}</div></div>))}</div>
      </Card>
    </div>);
  }

  function Pipeline({ role, acting, toast }) {
    const [trk, setTrk] = useState('الكل');
    const [open, setOpen] = useState(null); // {c, stage}
    const filt = (arr) => trk === 'الكل' ? arr : arr.filter((x) => x.track === trk);
    if (open) return <CaseDetail c={open.c} stage={open.stage} back={() => setOpen(null)} />;
    return (<div>
      <h2 className="h2">مسار الإجراءات</h2>
      <p className="lede">كل طلب نشط في موضعه عبر مراحل المركز الأربع. اضغط أي بطاقة للاطّلاع الكامل على الطلب ومصدره ومساره منذ تقديمه.</p>
      <div className="tabs">{['الكل', 'عادي', 'عاجل', 'طارئ', 'أجنبي'].map((t) => (
        <button key={t} className={'tab' + (trk === t ? ' on' : '')} onClick={() => setTrk(t)}>{t}</button>))}</div>
      <div className="pipe">{Object.keys(PIPE).map((stage) => {
        const items = filt(PIPE[stage]);
        return (<div className="pipe-col" key={stage}>
          <div className="pipe-h"><span className="pipe-ht">{stage}</span><span className="pipe-cnt">{items.length}</span></div>
          {items.length === 0 && <p className="muted" style={{ padding: '8px 4px', margin: 0 }}>لا طلبات</p>}
          {items.map((x) => {
            const sc = SRC[x.src];
            return (
            <button className={'tile tile-btn' + slaCls(x.sla)} key={x.s} onClick={() => setOpen({ c: x, stage })}>
              <div className="tile-top"><SecretCode code={x.s} canReveal={false} /><Tag tone="info" size="sm">{x.cat}</Tag></div>
              <div className="src-chip"><I name={sc.icon} size={13} color={sc.tone[1]} /><span>{x.srcName}</span></div>
              <div className="tile-meta">{fmtTrack(x.track)}<span><I name="person" size={13} style={{ verticalAlign: '-2px' }} /> {x.who}</span></div>
              <div className="tile-foot"><span className="muted"><I name="schedule" size={13} style={{ verticalAlign: '-2px' }} /> {x.days}</span>
                {x.sla === 'breach' && <Tag tone="error" size="sm">تجاوز المهلة</Tag>}
                {x.sla === 'warn' && <Tag tone="warning" size="sm">يقترب</Tag>}</div>
            </button>);
          })}
        </div>);
      })}</div>
    </div>);
  }

  // ===== التنبيهات =====
  function AlertRow({ a, role, acting, toast }) {
    const canDirect = role === 'chair' || acting;
    return (<div className={'alert-row ' + a.lvl}>
      <div className="alert-ico" style={{ background: a.lvl === 'breach' ? 'var(--error-10)' : 'var(--warning-10)' }}>
        <I name={a.icon} size={19} fill color={a.lvl === 'breach' ? 'var(--color-error)' : 'var(--warning-70)'} /></div>
      <div className="alert-b"><div className="alert-t">{a.t}</div><div className="alert-m">{a.m}</div></div>
      <div className="row" style={{ gap: 7, flexWrap: 'nowrap' }}>
        <Tag tone="neutral" size="sm">{a.stage}</Tag>
        {canDirect
          ? <button className="btn btn-primary btn-sm" onClick={() => toast('صدر توجيه قيادي — سُجِّل في التدقيق' + (acting ? ' (بالنيابة)' : ''))}><I name="campaign" size={16} /> توجيه</button>
          : <button className="btn btn-ghost btn-sm" onClick={() => toast('رُفع للرئيس للتوجيه')}><I name="arrow_upward" size={16} /> تصعيد</button>}
      </div>
    </div>);
  }
  function Alerts({ role, acting, toast }) {
    return (<div>
      <h2 className="h2">المواعيد والتنبيهات</h2>
      <p className="lede">متابعة المهل النظامية على مستوى المركز. {role === 'chair' || acting ? 'لك التوجيه المباشر على أي بند.' : 'تُصعّد للرئيس ما يستلزم توجيهاً.'}</p>
      <Card className="card pad">{ALERTS.map((a, i) => <AlertRow key={i} a={a} role={role} acting={acting} toast={toast} />)}</Card>
    </div>);
  }

  // ===== إنجازات الموظفين =====
  function Staff() {
    const units = ['الفرز المبدئي', 'الدراسة والتقييم', 'التنفيذ والمتابعة', 'الإدارة الأمنية'];
    const unitLoad = units.map((u) => ({ k: u, v: STAFF.filter((s) => s.unit === u).reduce((a, s) => a + s.assigned, 0) }));
    return (<div>
      <h2 className="h2">إنجازات الموظفين والوحدات</h2>
      <p className="lede">العبء والمنجز والالتزام بالمهل لكل موظف. للاطّلاع والمتابعة — لا تتضمّن بيانات المشمولين.</p>
      <Card className="card pad" style={{ marginBottom: 14 }}>
        <p className="sec-h"><I name="groups" size={18} color="var(--color-primary)" /> العبء حسب الوحدة</p>
        <Bars data={unitLoad} />
      </Card>
      <div className="tbl-wrap">
        <table><thead><tr>
          <th>الموظف</th><th>الوحدة</th><th>مُسند</th><th>منجز</th><th>متوسط (يوم)</th><th>الالتزام بالمهل</th>
        </tr></thead><tbody>{STAFF.map((s) => (
          <tr key={s.n}>
            <td style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{s.n}</td>
            <td>{s.unit}</td><td>{s.assigned}</td><td>{s.done}</td><td className="mono">{s.avg}</td>
            <td><div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <div className="mini-bar" style={{ flex: 1 }}><div className="mini-fill" style={{ width: s.sla + '%', background: s.sla >= 90 ? 'var(--color-primary)' : s.sla >= 85 ? 'var(--warning-50)' : 'var(--color-error)' }} /></div>
              <span style={{ fontWeight: 700, fontSize: 12.5, minWidth: 34 }}>{s.sla}%</span></div></td>
          </tr>))}</tbody></table>
      </div>
    </div>);
  }

  // ===== سجل التدقيق =====
  function Audit() {
    return (<div>
      <h2 className="h2">سجل التدقيق</h2>
      <p className="lede">سلسلة موثّقة لكل إجراء داخل المركز — لا يقبل التعديل أو الحذف (م24 لائحة).</p>
      <Card className="card pad"><div className="tl">{AUDIT.map((e, i) => (
        <div className="tl-i" key={i}><span className="tl-dot" /><div className="tl-t">{e.t}</div><div className="tl-m">{e.m}</div></div>))}</div></Card>
    </div>);
  }

  // ===== الملف الشخصي =====
  function Profile({ role, acting }) {
    const r = ROLE[role];
    const rows = [
      ['الاسم', r.name], ['الصفة', r.title], ['الوحدة', r.unit],
      ['نطاق الصلاحية', r.authority], ['الدخول', 'عبر نفاذ الوطني الموحّد'],
      ['الحالة', role === 'deputy' ? (acting ? 'مُفوَّض حالياً بصلاحيات الرئيس' : 'صلاحيات اعتيادية') : 'سلطة نهائية كاملة'],
    ];
    return (<div>
      <h2 className="h2">الملف الشخصي</h2>
      <p className="lede">{r.perms}</p>
      <Card className="card pad" style={{ maxWidth: 560 }}>
        <div className="row" style={{ gap: 14, marginBottom: 18 }}>
          <div className="auth-ico" style={{ width: 54, height: 54, background: 'var(--green-10)' }}><I name={r.icon} size={28} fill color="var(--color-primary)" /></div>
          <div><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-strong)' }}>{r.name}</div>
            <div className="muted">{r.title}</div></div>
        </div>
        <div style={{ display: 'grid', gap: 9 }}>{rows.map(([k, v]) => (
          <div className="ro-field" key={k}><span className="ro-k">{k}</span><span className="ro-v">{v}</span></div>))}</div>
      </Card>
    </div>);
  }

  // ===== التصويت وإصدار القرار مدمجان من المخزن المشترك (DecisionApprovals/DecisionVoting أعلاه).
  // [أُزيل قسم التصويت القديم المدمج COUNCIL/VOTES/VoteCard/Voting — شيفرة ميتة، 3 يوليو]

  // ===== المراسلات — تنسيقٌ حقيقيٌّ عبر coord_messages (المركز ↔ النائب/المكتب الفني) + Realtime =====
  const COORD_CONTACTS = [
    { id: 'ag', who: 'مكتب النائب العام', icon: 'balance' },
    { id: 'technical', who: 'المكتب الفني', icon: 'shield_person' },
  ];
  function Messages({ role, toast }) {
    const supabase = useRef(createClient()).current;
    const ME = 'center', MY_LABEL = 'قيادة المركز';
    const [sel, setSel] = useState('ag');
    const [rows, setRows] = useState([]);
    const [draft, setDraft] = useState('');
    const bodyRef = useRef(null);
    useEffect(() => {
      let live = true;
      const load = () => supabase.from('coord_messages')
        .or(`and(from_authority.eq.${ME},to_authority.eq.${sel}),and(from_authority.eq.${sel},to_authority.eq.${ME})`)
        .order('created_at', { ascending: true })
        .then(({ data }) => { if (live) setRows(data ?? []); });
      load();
      const ch = supabase.channel('coord-center-' + sel).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coord_messages' }, (p) => {
        const m = p.new;
        if ((m.from_authority === ME && m.to_authority === sel) || (m.from_authority === sel && m.to_authority === ME)) setRows((r) => r.some((x) => x.id === m.id) ? r : [...r, m]);
      }).subscribe();
      return () => { live = false; try { supabase.removeChannel(ch); } catch (e) {} };
    }, [supabase, sel]);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [rows]);
    const send = async () => {
      const v = draft.trim(); if (!v) return; setDraft('');
      const { data } = await supabase.from('coord_messages').insert({ from_authority: ME, to_authority: sel, sender_label: MY_LABEL, body: v }).select().single();
      if (data) { setRows((r) => r.some((x) => x.id === data.id) ? r : [...r, data]); if (toast) toast('أُرسلت الرسالة'); }
    };
    const cur = COORD_CONTACTS.find((m) => m.id === sel);
    const fmt = (ts) => { try { return new Date(ts).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } };
    return (<div>
      <h2 className="h2">المراسلات</h2>
      <p className="lede">قناة تنسيقٍ مؤمّنة مع النائب العام والمكتب الفني حول سير الأعمال — لا تتضمّن بيانات المشمولين الصريحة (يُكتفى بالرمز السري).</p>
      <div className="msg-grid">
        <div className="msg-list">{COORD_CONTACTS.map((m) => (
          <button key={m.id} className={'thread' + (sel === m.id ? ' on' : '')} onClick={() => setSel(m.id)}>
            <span className="thread-ico"><I name={m.icon} size={18} color="var(--color-primary)" /></span>
            <span className="thread-b"><span className="thread-t">{m.who}</span></span>
          </button>))}</div>
        <Card className="card pad">
          <div className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 12 }}>
            <span className="row" style={{ gap: 8 }}><I name={cur.icon} size={19} color="var(--color-primary)" /><b style={{ fontSize: 14.5, color: 'var(--text-strong)' }}>{cur.who}</b></span>
            <Tag tone="error" size="sm" iconLeft={<I name="lock" size={12} />}>مؤمّنة</Tag>
          </div>
          <div className="conv" ref={bodyRef}>
            {rows.length === 0 ? <div className="muted" style={{ textAlign: 'center', padding: 32 }}>ابدأ التنسيق مع {cur.who}.</div>
            : rows.map((x) => { const mine = x.from_authority === ME; return (
              <div key={x.id} className={'bub ' + (mine ? 'me' : 'them')}>{!mine && <div className="bub-from">{x.sender_label || cur.who}</div>}{x.body}<div className="bub-time">{fmt(x.created_at)}</div></div>); })}
          </div>
          <div className="composer">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالة…" dir="auto" onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
            <button className="btn btn-primary btn-sm" disabled={!draft.trim()} onClick={send}><I name="send" size={16} /> إرسال</button>
          </div>
        </Card>
      </div>
    </div>);
  }

  // ===== الإشعارات =====
  const NOTIF = [
    ...(HemayaHandoff ? HemayaHandoff.list().slice(0, 8).map((h) => ({ icon: 'move_up', tone: ['var(--green-10)', 'var(--color-primary)'], t: 'تسليمٌ للتنفيذ — ' + ((HemayaHandoff.TRACKS[h.track] || {}).label || ''), m: h.secret + ' — ' + (h.status === 'active' ? 'مُفعّل تحت الحماية.' : 'أُحيل للتنفيذ بانتظار توقيع اتفاقية الحماية.') })) : []),
  ];
  function Notifs({ role, acting }) {
    const extra = role === 'deputy' && acting
      ? [{ icon: 'gavel', tone: ['var(--warning-10)', 'var(--warning-70)'], t: 'فُوِّضت بصلاحيات الرئيس', m: 'قرار تفويض رقم ت-1447/22 — سارية أثناء إجازة الرئيس.', time: 'أمس', unread: false }]
      : role === 'chair' ? [{ icon: 'manage_accounts', tone: ['var(--green-10)', 'var(--color-primary)'], t: 'تذكير: لم تُفعّل أي تفويض', m: 'عند إجازتك، فوّض النائب من «النظرة الشاملة» لضمان استمرار البتّ.', time: 'أمس', unread: false }] : [];
    const list = [...extra, ...NOTIF];
    return (<div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات نظامية تخصّ مهام القيادة — مرتبطة بالتصويت والمهل والمراسلات.</p>
      <Card className="card pad">{list.map((n, i) => (
        <div className="alert-row" key={i} style={n.unread ? { borderInlineStartColor: 'var(--color-primary)', background: 'color-mix(in srgb, var(--green-10) 30%, transparent)' } : {}}>
          <div className="alert-ico" style={{ background: n.tone[0] }}><I name={n.icon} size={19} fill color={n.tone[1]} /></div>
          <div className="alert-b"><div className="alert-t">{n.t}{n.unread && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', marginInlineStart: 7, verticalAlign: 'middle' }} />}</div><div className="alert-m">{n.m}</div></div>
          <span className="muted" style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}>{n.time}</span>
        </div>))}</Card>
    </div>);
  }

  // ===== مرحلة القرار — انتقلت لبوابة القرار الموحّدة (تحديث 15 يوليو) =====
  // دورة الاعتماد الجديدة (إعداد ← اعتماد النائب ← طرح ← تصويت ← إصدار الرئيس)
  // تُدار كاملةً في منطقة /decision؛ من هنا عبورٌ مباشر بدور القيادة.
  function DecisionHandoff({ role, kind }) {
    const t = kind === 'approvals' ? 'اعتماد القرارات' : 'التصويت وإصدار القرار';
    const d = kind === 'approvals'
      ? 'مراجعة القرارات المرفوعة من المعدّ واعتمادها أو إعادتها بملاحظة — صلاحية نائب رئيس المركز حصراً.'
      : 'الاطّلاع على الحصيلة والتصويت كعضو، ثم إصدار القرار وإشعار الطرفين (م10) — الإصدار بيد رئيس المركز.';
    return (<div>
      <h2 className="h2">{t}</h2>
      <p className="lede">انتقلت مرحلة «القرار والإشعار» إلى بوابة القرار الموحّدة بدورة الاعتماد الجديدة: إعداد ← اعتماد النائب ← الطرح ← التصويت ← الإصدار.</p>
      <Card className="card pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><b style={{ color: 'var(--text-strong)' }}>{t} — في بوابة القرار</b><div className="muted" style={{ marginTop: 3 }}>{d}</div></div>
        {/* رابط خام (بلا بادئة المنطقة) — يعبر من منطقة /center إلى منطقة /decision */}
        <a className="btn btn-primary" href="/decision" style={{ textDecoration: 'none' }}><I name={kind === 'approvals' ? 'approval' : 'gavel'} size={18} /> الانتقال لبوابة القرار</a>
      </Card>
    </div>);
  }

  // ===== التطبيق =====
  (function () {
    if (typeof document === 'undefined' || document.getElementById('challenges-css')) return;
    var st = document.createElement('style'); st.id = 'challenges-css';
    st.textContent = `
.chal-feed { display:flex; align-items:center; gap:9px; margin:2px 0 20px; padding:12px 16px; border-radius:12px; background:#f4efe6; border:1px solid rgba(172,147,109,.32); font-size:13px; color:#7c6338; line-height:1.6; }
.chal-feed a { color:#7c6338; font-weight:700; }
.chal-note { display:flex; align-items:center; gap:9px; margin:2px 0 18px; padding:12px 16px; border-radius:12px; background:var(--info-10); border:1px solid color-mix(in srgb, var(--color-info) 30%, transparent); font-size:13px; color:var(--color-info); line-height:1.55; }
.chal-kick { display:flex; align-items:center; gap:10px; margin:24px 0 13px; }
.chal-kick .ln { flex:1; height:1px; background:var(--border-subtle); }
.chal-kick b { font-size:13.5px; color:var(--text-strong); display:inline-flex; align-items:center; gap:8px; white-space:nowrap; }
.chal-sug { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.chal-card { border:1px solid var(--border-subtle); border-radius:14px; padding:15px 16px; background:var(--surface-card); box-shadow:var(--shadow-xs); display:flex; flex-direction:column; }
.chal-sig { align-self:flex-start; display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; color:var(--color-info); background:var(--info-10); padding:4px 10px; border-radius:20px; margin-bottom:10px; }
.chal-c { font-size:13.5px; font-weight:700; color:var(--text-strong); line-height:1.6; margin-bottom:6px; }
.chal-s { font-size:12.5px; color:var(--text-body); line-height:1.65; margin-bottom:9px; }
.chal-m { font-size:11.5px; color:var(--text-secondary); font-family:var(--font-mono); margin-bottom:12px; }
.chal-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:9px 15px; border-radius:10px; font-family:var(--font-sans); font-size:13px; font-weight:600; cursor:pointer; border:1px solid var(--border-default); background:var(--surface-card); color:var(--text-body); margin-top:auto; align-self:flex-start; }
.chal-btn:hover { border-color:var(--color-primary); color:var(--color-primary); }
.chal-btn.p { background:var(--color-primary); border-color:var(--color-primary); color:#fff; }
.chal-btn.p:hover { color:#fff; }
.chal-btn.added { background:var(--green-10); border-color:var(--green-20); color:var(--green-80); cursor:default; }
.chal-item { border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface-card); box-shadow:var(--shadow-xs); margin-bottom:12px; overflow:hidden; }
.chal-ih { display:flex; align-items:center; gap:10px; padding:11px 15px; background:var(--surface-subtle); border-bottom:1px solid var(--border-subtle); }
.chal-in { width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,#AC936D,#b8912f); color:#fff; display:grid; place-items:center; font-weight:800; font-size:12.5px; flex-shrink:0; }
.chal-ih b { font-size:13px; color:var(--text-strong); }
.chal-tools { margin-inline-start:auto; display:flex; gap:4px; }
.chal-ico { width:32px; height:32px; border:1px solid var(--border-subtle); border-radius:8px; background:var(--surface-card); cursor:pointer; display:grid; place-items:center; color:var(--text-secondary); }
.chal-ico:hover { border-color:var(--color-primary); color:var(--color-primary); }
.chal-ico:disabled { opacity:.4; cursor:not-allowed; }
.chal-ico.del:hover { border-color:var(--color-error); color:var(--color-error); }
.chal-body { padding:15px; display:grid; gap:13px; }
.chal-fld label { font-size:12px; font-weight:700; color:var(--text-strong); display:flex; align-items:center; gap:6px; margin-bottom:6px; }
.chal-fld textarea, .chal-fld input { width:100%; font-family:var(--font-sans); font-size:13.5px; color:var(--text-body); border:1px solid var(--border-default); border-radius:10px; padding:10px 12px; background:var(--field-bg); box-sizing:border-box; resize:vertical; line-height:1.6; }
.chal-fld textarea:focus, .chal-fld input:focus { outline:none; border-color:var(--color-primary); }
.chal-ro { font-size:13.5px; color:var(--text-body); line-height:1.9; }
.chal-ro .ev { color:#7c6338; font-weight:600; }
.chal-empty { text-align:center; padding:28px; color:var(--text-secondary); border:1px dashed var(--border-default); border-radius:14px; }
@media (max-width:760px){ .chal-sug { grid-template-columns:1fr; } }
`;
    document.head.appendChild(st);
  })();

  function Challenges({ role, acting, toast }) {
    const HC = HemayaChallenges;
    const [items, setItems] = useState(() => HC ? HC.list() : []);
    const [added, setAdded] = useState({});
    if (!HC) return <div className="chal-note" style={{ background: 'var(--warning-10)', borderColor: 'var(--warning-50)', color: 'var(--warning-70)' }}><I name="warning" size={18} /> تعذّر تحميل مخزن التحديات (challenges-store.js).</div>;
    const canEdit = role === 'chair' || acting;
    const sugg = HC.suggestions();
    const addSug = (sg) => { HC.add({ c: sg.c, s: sg.s, evidence: sg.metric }); setAdded((a) => ({ ...a, [sg.id]: true })); setItems(HC.list()); toast && toast('أُضيف التحدّي إلى التقرير'); };
    const addManual = () => { HC.add({ c: '', s: '', evidence: '' }); setItems(HC.list()); };
    const edit = (id, p) => { setItems((l) => l.map((i) => i.id === id ? { ...i, ...p } : i)); HC.update(id, p); };
    const del = (id) => { HC.remove(id); setItems(HC.list()); };
    const move = (id, d) => { HC.move(id, d); setItems(HC.list()); };
    return (<div>
      <h2 className="h2" style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }}>مُحرّر التحديات والحلول</h2>
      <p style={{ fontSize: 14, color: 'var(--text-body)', margin: '0 0 14px', lineHeight: 1.6 }}>القسم النوعيّ من التقرير الربع سنوي (م4/9/ت) — يقترح النظام تحدياتٍ من إشارات الربع، والصياغةُ والاعتماد لرئيس المركز.</p>
      <div className="chal-feed"><I name="sync_alt" size={18} color="#7c6338" /><span>تُحفظ فوراً وتُغذّي قسم «التحديات والحلول» في <a href="../../../بوابة النائب العام/البوابة.html#periodic" target="_blank" rel="noopener">التقرير المرفوع لمعالي النائب العام</a>.</span></div>
      {!canEdit && <div className="chal-note"><I name="visibility" size={18} /> التحرير من اختصاص رئيس المركز؛ لكم الاطّلاع (ويُفعّل عند التفويض).</div>}
      {canEdit && (<React.Fragment>
        <div className="chal-kick"><b><I name="auto_awesome" size={18} color="var(--color-primary)" /> مقترحاتٌ آلية من إشارات الربع</b><span className="ln" /></div>
        <div className="chal-sug">{sugg.map((sg) => (
          <div className="chal-card" key={sg.id}>
            <span className="chal-sig"><I name="insights" size={13} /> {sg.signal}</span>
            <div className="chal-c">{sg.c}</div><div className="chal-s">{sg.s}</div><div className="chal-m">الدليل: {sg.metric}</div>
            {added[sg.id] ? <span className="chal-btn added"><I name="check" size={16} /> أُضيف</span> : <button className="chal-btn p" onClick={() => addSug(sg)}><I name="add" size={16} /> إضافة للتقرير</button>}
          </div>))}</div>
      </React.Fragment>)}
      <div className="chal-kick"><b><I name="fact_check" size={18} color="var(--color-primary)" /> تحديات التقرير المعتمدة ({items.length})</b><span className="ln" /></div>
      {items.length === 0 ? <div className="chal-empty">لا تحديات بعد.</div>
        : items.map((it, idx) => (
          <div className="chal-item" key={it.id}>
            <div className="chal-ih"><span className="chal-in">{idx + 1}</span><b>تحد٣ّ وحلّه</b>
              {canEdit && <div className="chal-tools">
                <button className="chal-ico" onClick={() => move(it.id, -1)} disabled={idx === 0} title="أعلى"><I name="arrow_upward" size={17} /></button>
                <button className="chal-ico" onClick={() => move(it.id, 1)} disabled={idx === items.length - 1} title="أسفل"><I name="arrow_downward" size={17} /></button>
                <button className="chal-ico del" onClick={() => del(it.id)} title="حذف"><I name="delete" size={17} /></button>
              </div>}
            </div>
            {canEdit
              ? <div className="chal-body">
                  <div className="chal-fld"><label><I name="report_problem" size={15} color="var(--color-warning)" /> التحدّي</label><textarea rows={2} value={it.c} onChange={(e) => edit(it.id, { c: e.target.value })} placeholder="صف التحدّي الذي واجهه المركز…" dir="auto" /></div>
                  <div className="chal-fld"><label><I name="check_circle" size={15} color="var(--color-primary)" /> الحلّ المتّبع</label><textarea rows={2} value={it.s} onChange={(e) => edit(it.id, { s: e.target.value })} placeholder="صف الحلّ أو الإجراء المتّخذ…" dir="auto" /></div>
                  <div className="chal-fld"><label><I name="link" size={15} color="#7c6338" /> الإسناد بالدليل</label><input value={it.evidence || ''} onChange={(e) => edit(it.id, { evidence: e.target.value })} placeholder="مثال: الالتزام بمهلة التظلّم 92%" dir="auto" /></div>
                </div>
              : <div className="chal-body"><div className="chal-ro"><b>التحدّي:</b> {it.c || '—'}<br /><b>الحلّ:</b> {it.s || '—'}{it.evidence ? <span className="ev"> · مسنودٌ بـ{it.evidence}</span> : null}</div></div>}
          </div>))}
      {canEdit && <button className="chal-btn" onClick={addManual} style={{ marginTop: 6 }}><I name="add" size={17} /> إضافة تحد٣ّ يدوي</button>}
    </div>);
  }

  (function () {
    if (typeof document === 'undefined' || document.getElementById('handoff-css')) return;
    var st = document.createElement('style'); st.id = 'handoff-css';
    st.textContent = `
.ho-note { display:flex; align-items:center; gap:9px; margin:2px 0 18px; padding:12px 16px; border-radius:12px; background:var(--info-10); border:1px solid color-mix(in srgb, var(--color-info) 28%, transparent); font-size:13px; color:var(--color-info); line-height:1.6; }
.ho-sum { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.ho-stat { flex:1 1 160px; padding:14px 16px; border:1px solid var(--border-subtle); border-radius:13px; background:var(--surface-card); box-shadow:var(--shadow-xs); }
.ho-stat b { font-size:22px; font-weight:800; color:var(--text-strong); display:block; line-height:1; }
.ho-stat span { font-size:12px; color:var(--text-secondary); margin-top:5px; display:block; }
.ho-card { border:1px solid var(--border-subtle); border-radius:14px; background:var(--surface-card); box-shadow:var(--shadow-xs); margin-bottom:12px; overflow:hidden; }
.ho-edge { height:4px; }
.ho-body { padding:15px 17px; }
.ho-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px; }
.ho-badge { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:800; padding:4px 11px; border-radius:20px; }
.ho-status { margin-inline-start:auto; display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; padding:4px 11px; border-radius:20px; }
.ho-note2 { font-size:13px; color:var(--text-body); line-height:1.7; margin:8px 0 10px; }
.ho-meta { font-size:12px; color:var(--text-secondary); display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.ho-types { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.ho-type { font-size:11.5px; padding:3px 10px; border-radius:20px; background:var(--green-10); color:var(--green-80); }
.ho-board { display:flex; align-items:center; gap:9px; margin-top:12px; padding:10px 13px; border-radius:10px; background:var(--warning-10); border:1px solid var(--warning-50); color:var(--warning-70); font-size:12.5px; font-weight:600; }
.ho-ack { display:inline-flex; align-items:center; gap:6px; margin-top:12px; padding:8px 14px; border-radius:9px; border:1px solid var(--border-default); background:var(--surface-card); color:var(--text-body); font-family:var(--font-sans); font-size:12.5px; font-weight:600; cursor:pointer; }
.ho-ack.on { background:var(--green-10); border-color:var(--green-20); color:var(--green-80); cursor:default; }
`;
    document.head.appendChild(st);
  })();

  function Handoff({ role, toast }) {
    const HH = HemayaHandoff;
    const [, force] = useState(0);
    const [ack, setAck] = useState({});
    React.useEffect(() => { const h = () => force((n) => n + 1); window.addEventListener('hemaya-handoff', h); window.addEventListener('storage', h); return () => { window.removeEventListener('hemaya-handoff', h); window.removeEventListener('storage', h); }; }, []);
    if (!HH) return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>ناقل التسليم للتنفيذ غير محمّل.</div>;
    const items = HH.list();
    const pend = items.filter((i) => i.status === 'await-agreement').length;
    const activeN = items.filter((i) => i.status === 'active').length;
    const board = items.filter((i) => i.track === 'urgent' && i.boardReviewDue != null).length;
    const TR = HH.TRACKS;
    const toneMap = { error: ['var(--error-10)', 'var(--color-error)'], bronze: ['#f4efe6', '#7c6338'], info: ['var(--info-10)', 'var(--color-info)'] };
    const edgeMap = { error: 'var(--color-error)', bronze: '#AC936D', info: 'var(--color-info)' };
    return (<div>
      <h2 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }}>التسليم للتنفيذ</h2>
      <p style={{ fontSize: 14, color: 'var(--text-body)', margin: '0 0 14px', lineHeight: 1.6 }}>ما يؤول من قرارات المسارات الثلاثة (العاجل م8 · الأجنبي م6 · التظلّم م21) إلى مرحلة «التنفيذ والتجديد» — للإشراف والإحاطة. القيادة تُشرف ولا تبتّ.</p>
      <div className="ho-note"><I name="notifications_active" size={18} /> تصلكم إحاطةٌ بكل قرارٍ يؤول للتنفيذ، ويظهر هنا وفي «مسار الإجراءات».</div>
      <div className="ho-sum">
        <div className="ho-stat"><b className="num">{pend}</b><span>بانتظار توقيع الاتفاقية</span></div>
        <div className="ho-stat"><b className="num">{activeN}</b><span>مُفعّل تحت الحماية</span></div>
        <div className="ho-stat"><b className="num">{board}</b><span>عاجل بانتظار عرض المجلس (م8)</span></div>
      </div>
      {items.map((it) => { const t = TR[it.track] || {}; const tone = toneMap[t.tone] || toneMap.info; return (
        <div className="ho-card" key={it.id}>
          <div className="ho-edge" style={{ background: edgeMap[t.tone] || 'var(--color-info)' }} />
          <div className="ho-body">
            <div className="ho-top">
              <span className="ho-badge" style={{ background: tone[0], color: tone[1] }}><I name={t.icon} size={13} fill /> {t.label} · {t.article}</span>
              <SecretCode code={it.secret} canReveal={false} />
              <span className="ho-status" style={it.status === 'active' ? { background: 'var(--green-10)', color: 'var(--green-80)' } : { background: 'var(--warning-10)', color: 'var(--warning-70)' }}><I name={it.status === 'active' ? 'verified_user' : 'draw'} size={13} fill /> {it.status === 'active' ? 'مُفعّل تحت الحماية' : 'بانتظار توقيع الاتفاقية'}</span>
            </div>
            <div className="ho-note2">{it.note}</div>
            <div className="ho-meta"><span>القرار: {it.decidedBy}</span><span>·</span><span>{it.decidedAt}</span>{it.region && it.region !== '—' ? <span>· المنطقة: {it.region}</span> : null}</div>
            {it.types && it.types.length ? <div className="ho-types">{it.types.map((x) => <span className="ho-type" key={x}>{x}</span>)}</div> : null}
            {it.boardReviewDue != null && <div className="ho-board"><I name="event_upcoming" size={16} /> عرضٌ على المجلس خلال {it.boardReviewDue} يوماً — لقرارٍ دائم (م8)</div>}
            <button className={'ho-ack' + (ack[it.id] ? ' on' : '')} onClick={() => { if (ack[it.id]) return; setAck((a) => ({ ...a, [it.id]: true })); toast && toast('أُحيطت القيادة علماً'); }}><I name={ack[it.id] ? 'check' : 'visibility'} size={15} /> {ack[it.id] ? 'أحاطت القيادة علماً' : 'إحاطة القيادة علماً'}</button>
          </div>
        </div>); })}
    </div>);
  }

  const NAV = [
    { id: 'overview', t: 'النظرة الشاملة', icon: 'dashboard' },
    { id: 'pipeline', t: 'مسار الإجراءات', icon: 'account_tree' },
    { id: 'approvals', t: 'اعتماد القرارات', icon: 'approval' },
    { id: 'voting', t: 'التصويت وإصدار القرار', icon: 'how_to_vote' },
    { id: 'challenges', t: 'مُحرّر التحديات', icon: 'edit_note' },
    { id: 'handoff', t: 'التسليم للتنفيذ', icon: 'move_up' },
    { id: 'alerts', t: 'المواعيد والتنبيهات', icon: 'notification_important', badge: 2 },
    { id: 'staff', t: 'إنجازات الموظفين', icon: 'groups' },
    { id: 'messages', t: 'المراسلات', icon: 'forum' },
    { id: 'notifications', t: 'الإشعارات', icon: 'notifications' },
    { id: 'audit', t: 'سجل التدقيق', icon: 'history' },
    { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' },
  ];

  function App({ role, initialData }) {
    const r = ROLE[role];
    const [active, setActive] = useState('overview');
    const [open, setOpen] = useState(false);
    const [acting, setActing] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const toast = (m) => { setToastMsg(m); clearTimeout(_ot); _ot = setTimeout(() => setToastMsg(null), 2600); };
    const go = (id) => { setActive(id); setOpen(false); window.scrollTo(0, 0); };
    const cur = NAV.find((n) => n.id === active);
    let body;
    if (active === 'pipeline') body = <Pipeline role={role} acting={acting} toast={toast} />;
    else if (active === 'approvals') body = <DecisionHandoff role={role} kind="approvals" />;
    else if (active === 'voting') body = <DecisionHandoff role={role} kind="voting" />;
    else if (active === 'challenges') body = <Challenges role={role} acting={acting} toast={toast} />;
    else if (active === 'handoff') body = <Handoff role={role} toast={toast} />;
    else if (active === 'alerts') body = <Alerts role={role} acting={acting} toast={toast} />;
    else if (active === 'staff') body = <Staff />;
    else if (active === 'messages') body = <Messages role={role} toast={toast} />;
    else if (active === 'notifications') body = <Notifs role={role} acting={acting} />;
    else if (active === 'audit') body = <Audit />;
    else if (active === 'profile') body = <Profile role={role} acting={acting} />;
    else body = <Overview role={role} acting={acting} setActing={setActing} toast={toast} stats={initialData && initialData.stats} />;
    return (
      <div className="shell">
        <aside className={'side' + (open ? ' open' : '')}>
          <div className="brand"><div className="brand-mark"><I name={r.icon} size={22} fill color="#fff" /></div>
            <div><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)', lineHeight: 1.2 }}>{r.title}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>قيادة المركز · إشراف</div></div></div>
          <nav className="nav">{NAV.map((n) => (
            <button key={n.id} className={'nav-item' + (active === n.id ? ' on' : '')} onClick={() => go(n.id)}>
              <I name={n.icon} size={20} /> <span>{n.t}</span>{n.badge && <span className="nav-badge">{n.badge}</span>}</button>))}</nav>
          <div className="side-foot">{r.perms}</div>
        </aside>
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <div className="main">
          <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
            <span className="topbar-title">{cur.t}</span>
            <span className="row" style={{ marginInlineStart: 'auto', gap: 8 }}>
              <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>سري للغاية</Tag>
              {role === 'deputy' && (
                <select value={acting ? 'act' : 'norm'} onChange={(e) => setActing(e.target.value === 'act')}
                  style={{ width: 'auto', height: 36, padding: '0 10px', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-strong)' }} title="محاكاة وضع التفويض">
                  <option value="norm">الوضع: اعتيادي</option><option value="act">الوضع: مُفوَّض (إجازة الرئيس)</option>
                </select>)}
              <Tag tone={role === 'chair' ? 'success' : 'info'} size="sm">{r.name.split(' ').slice(0, 2).join(' ')}</Tag>
              <button title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); }} style={{ width: 34, height: 34, flexShrink: 0, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}><I name="logout" size={18} /></button>
            </span>
          </header>
          <main className="content">{body}</main>
        </div>
        {toastMsg && <div style={{ position: 'fixed', insetInlineStart: '50%', bottom: 26, transform: 'translateX(-50%)', zIndex: 50, background: 'var(--text-strong)', color: 'var(--surface-card)', padding: '12px 20px', borderRadius: 'var(--radius-full)', fontSize: 13.5, fontWeight: 600, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <I name="check_circle" size={18} fill color="var(--green-50)" />{toastMsg}</div>}
      </div>);
  }

  return { App };

})();

export function OversightPortal({ role = 'chair', initialData }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <App role={role} initialData={initialData} />;
}
