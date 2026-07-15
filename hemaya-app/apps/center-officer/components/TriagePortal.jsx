'use client';
/* ============================================================
   مكتبة الفرز المبدئي — بقشرة البوابة الموحّدة (تحديث 15 يوليو 2026):
   شريط جانبي قابل للطيّ + شريط علوي بـSecretChip وعدّادات حيّة +
   إشعارات مشتقّة من الوارد الحقيقي (فلاتر/تجميع زمني/ثبات قراءة) +
   لوحة معلومات بدالة nextAction وبطاقة «اتّخذ الإجراء».
   قائمة واردة مشتركة · موظفو الفرز · القيادة (mode: clerks|deputy|chair).
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";
import { triageDecide, addContactLog } from "@/lib/triage-actions";
import "./triage-portal.css";

/* ============================================================
   مكتبة الفرز المبدئي — مرحلة مستقلّة بأشخاصها
   قائمة واردة مشتركة · موظفو الفرز (يقرّرون) · القيادة (اطّلاع/إشراف)
   mountTriage('clerks' | 'deputy' | 'chair')
   ============================================================ */



const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

// رمز سري مقنّع مع كشف مؤقت — يُخفى آلياً بعد 6 ثوانٍ (للشريط العلوي)
function SecretChip({ code }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (show) { const tm = setTimeout(() => setShow(false), 6000); return () => clearTimeout(tm); } }, [show]);
  return (
    <span className="sec-chip" title="الرمز السري للطلب المفتوح — يحلّ محل الاسم، والكشف مُسجّل في التدقيق ويُخفى آلياً بعد ثوانٍ.">
      <I name="lock" size={13} color="var(--color-error)" />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-error)' }}>سري</span>
      <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)', minWidth: 86, textAlign: 'center' }} dir="ltr">{show ? code : '••••••••••'}</span>
      <button className="sec-eye" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء الرمز' : 'كشف الرمز مؤقتاً'}><I name={show ? 'visibility_off' : 'visibility'} size={16} /></button>
    </span>
  );
}

// تجميع زمني للإشعارات: من التاريخ الفعلي (createdAt) وإلا فمن وسم الورود النسبي
function dayGroupOf(r) {
  if (r.createdAt) {
    const d = new Date(r.createdAt);
    if (!isNaN(d)) {
      const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((day(new Date()) - day(d)) / 86400000);
      return diff <= 0 ? 'اليوم' : diff === 1 ? 'أمس' : 'الأقدم';
    }
  }
  return r.days === 'اليوم' ? 'اليوم' : (r.days === 'أمس' || r.days === 'قبل يوم') ? 'أمس' : 'الأقدم';
}

// ===== الأشخاص =====
const CLERKS = {
  c1: { name: 'أ. سعد القحطاني', emp: 'EMP-3120', short: 'موظف الفرز ١', shift: 'الوردية الصباحية' },
  c2: { name: 'أ. ريم العتيبي', emp: 'EMP-3145', short: 'موظف الفرز ٢', shift: 'الوردية الصباحية' },
  c3: { name: 'أ. فيصل الدوسري', emp: 'EMP-3162', short: 'موظف الفرز ٣', shift: 'الوردية المسائية' },
};
const LEAD = {
  deputy: { name: 'نائب رئيس المركز', short: 'نائب الرئيس', icon: 'shield_person' },
  chair:  { name: 'رئيس المركز', short: 'الرئيس', icon: 'shield_person' },
};

const STATUS = {
  triage:  { t: 'بانتظار الفرز', tone: ['var(--warning-10)','var(--warning-70)'], icon: 'fact_check' },
  pending: { t: 'بانتظار توصية الجهة', tone: ['var(--info-10)','var(--info-70)'], icon: 'hourglass_top' },
  replied: { t: 'وردت التوصية', tone: ['var(--green-10)','var(--green-80)'], icon: 'mark_email_read' },
  study:   { t: 'أُحيل للدراسة والتقييم', tone: ['var(--green-10)','var(--green-80)'], icon: 'analytics' },
  closed:  { t: 'محفوظ', tone: ['var(--neutral-100)','var(--neutral-600)'], icon: 'archive' },
};
const SRC = {
  'ذاتي': { c: 'var(--color-info)', icon: 'person', t: 'طلب ذاتي — نفاذ' },
  'جهة':  { c: 'var(--gold-70)', icon: 'account_balance', t: 'مرفوع من جهة مختصة' },
};
// ===== المناطق والفروع — توجيه المركز لفرع المنطقة بالاختصاص المكاني للقضية =====
const REGIONS = { RUH: 'الرياض', MAK: 'مكة المكرمة', MED: 'المدينة المنورة', QAS: 'القصيم', EAS: 'المنطقة الشرقية', ASR: 'عسير', TAB: 'تبوك', HAI: 'حائل', NOR: 'الحدود الشمالية', JAZ: 'جازان', NAJ: 'نجران', BAH: 'الباحة', JOF: 'الجوف' };
const CITY_REGION = { 'الرياض': 'RUH', 'جدة': 'MAK', 'مكة المكرمة': 'MAK', 'المدينة المنورة': 'MED', 'المدينة': 'MED', 'بريدة': 'QAS', 'الدمام': 'EAS', 'الخبر': 'EAS', 'أبها': 'ASR', 'تبوك': 'TAB', 'حائل': 'HAI', 'عرعر': 'NOR', 'جازان': 'JAZ', 'نجران': 'NAJ', 'الباحة': 'BAH', 'سكاكا': 'JOF' };
const regionDisp = (code) => { const n = REGIONS[code] || ''; return (n.charAt(0) === 'ا' && n.charAt(1) === 'ل') ? n : 'منطقة ' + n; };
const ENT_BR_PREFIX = { 'النيابة العامة': 'نيابة', 'رئاسة أمن الدولة': 'فرع', 'وزارة الداخلية': 'فرع', 'هيئة الرقابة ومكافحة الفساد': 'فرع', 'وزارة العدل': 'فرع' };
const branchLabelT = (entity, code) => (ENT_BR_PREFIX[entity] || 'فرع') + ' ' + regionDisp(code);
const SEED = []; // القضايا الحقيقيّة فقط من Supabase (initialRows) — لا حالات مُلفّقة

function Pill({ status }) {
  const s = STATUS[status]; if (!s) return null;
  return <span className="pill" style={{ background: s.tone[0], color: s.tone[1] }}><I name={s.icon} size={13} fill /> {s.t}</span>;
}
function SrcChip({ source }) {
  const s = SRC[source];
  return <span className="src" style={{ color: s.c }}><I name={s.icon} size={15} /> {source}</span>;
}
// ===== القائمة المشتركة =====
function Queue({ rows, open, viewOnly, acct }) {
  const [filter, setFilter] = useState('all');
  const shown = rows.filter((r) => filter === 'all'
    || (filter === 'triage' && r.status === 'triage')
    || (filter === 'replied' && r.status === 'replied')
    || (filter === 'closed' && (r.status === 'closed' || r.status === 'study')));
  return (
    <div>
      <h2 className="h2">{viewOnly ? 'سجلّ الفرز المبدئي' : 'الطلبات الواردة — قائمة مشتركة'}</h2>
      <p className="lede">{viewOnly
        ? 'اطّلاع كامل على كل الطلبات وإجراءات الفرز عبر موظفي المركز — للعرض والإشراف فقط. الهوية بالرمز السري.'
        : 'قائمة واردة مشتركة يراها كل موظف بالمركز له صلاحية الوصول لمرحلة الفرز، ويمكنه معالجة أي طلب وارد — وكل معالجة مُسجّلة في التدقيق باسمه. الفرز المبدئي يستقبل الطلبات العادية فقط؛ أمّا العاجلة والطارئة فتُرفع من الجهات ولها مسارها الخاص (م8) ولا تدخل الفرز.'}</p>
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>الكل ({rows.length})</button>
        <button className={'chip' + (filter === 'triage' ? ' on' : '')} onClick={() => setFilter('triage')}>بانتظار الفرز</button>
        <button className={'chip' + (filter === 'replied' ? ' on' : '')} onClick={() => setFilter('replied')}>وردت التوصية</button>
        <button className={'chip' + (filter === 'closed' ? ' on' : '')} onClick={() => setFilter('closed')}>مُنجزة</button>
      </div>
      <Card className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>الرمز السري</th><th>الفئة</th><th>المصدر</th>{viewOnly && <th>موظف الفرز</th>}<th>الحالة</th><th>الورود</th><th></th>
            </tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} onClick={() => open(r)}>
                  <td><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.secret}</span></td>
                  <td>{r.cat}</td>
                  <td><SrcChip source={r.source} />{r.paper && <span className="src" style={{ color: '#7c6338', marginInlineStart: 6 }}><I name="description" size={14} /> ورقيّ</span>}</td>
                  {viewOnly && <td style={{ fontSize: 12.5 }}>{CLERKS[r.clerk].short}</td>}
                  <td><Pill status={r.status} /></td>
                  <td className="muted">{r.days}</td>
                  <td><span className="link">{viewOnly ? 'عرض' : (r.status === 'triage' ? 'فرز' : r.status === 'replied' ? 'متابعة' : 'عرض')} <I name="chevron_left" size={16} /></span></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={viewOnly ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 28 }}>لا طلبات في هذا التصنيف.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===== بطاقة ملخّص الطلب =====
function SummaryCard({ rec }) {
  const [full, setFull] = useState(false);
  return (
    <Card className="card pad" style={{ marginBottom: 16, borderInlineStart: '3px solid ' + SRC[rec.source].c }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <b style={{ color: 'var(--text-strong)' }}><I name="summarize" size={18} color={SRC[rec.source].c} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />ملخّص الطلب</b>
        <div className="row" style={{ gap: 10 }}>
          <span className="muted" style={{ fontSize: 11.5 }}><I name="verified" size={13} fill style={{ verticalAlign: 'middle' }} /> مجلوب من الطلب</span>
          <button className="link" onClick={() => setFull((f) => !f)}><I name={full ? 'unfold_less' : 'unfold_more'} size={16} /> {full ? 'إخفاء التفاصيل' : 'عرض النموذج كاملاً'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="ro-field"><span className="fld-label">الفئة</span><span style={{ fontWeight: 600 }}>{rec.cat}</span></div>
        <div className="ro-field"><span className="fld-label">مصدر الطلب</span><span style={{ fontWeight: 600 }}>{SRC[rec.source].t}</span></div>
        <div className="ro-field"><span className="fld-label">رقم الطلب</span><span className="mono" style={{ fontWeight: 700 }}>REQ-2026-{rec.secret.slice(-4)}</span></div>
        <div className="ro-field"><span className="fld-label">تاريخ التقديم</span><span style={{ fontWeight: 600 }}>{rec.days}</span></div>
        <div className="ro-field"><span className="fld-label">طلب سابق</span><span style={{ fontWeight: 600, color: rec.prior ? 'var(--color-warning)' : 'var(--text-body)' }}>{rec.prior ? 'نعم — رُصد آلياً' : 'لا'}</span></div>
        <div className="ro-field" style={{ gridColumn: '1 / -1' }}><span className="fld-label">نوع الجريمة محل الحماية</span><span style={{ fontWeight: 600 }}>{rec.crime || '—'}</span></div>
        <div className="ro-field" style={{ gridColumn: '1 / -1' }}><span className="fld-label">سبب طلب الحماية</span><span style={{ fontWeight: 500, lineHeight: 1.7 }}>{rec.reason || '—'}</span></div>
      </div>
      {full &&
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="ro-field"><span className="fld-label">هوية الطالب</span><span style={{ fontWeight: 600 }}><I name="lock" size={13} style={{ verticalAlign: 'middle' }} /> محجوبة — الرمز {rec.secret}</span></div>
            <div className="ro-field"><span className="fld-label">قناة التواصل</span><span style={{ fontWeight: 600 }}>متاحة للاتصال (الكشف مُسجَّل)</span></div>
            <div className="ro-field"><span className="fld-label">المدينة</span><span style={{ fontWeight: 600 }}>{rec.city || '—'}</span></div>
            <div className="ro-field"><span className="fld-label">من ذوي الاحتياجات الخاصة</span><span style={{ fontWeight: 600, color: rec.special ? 'var(--color-info)' : 'var(--text-body)' }}>{rec.special ? 'نعم' : 'لا'}</span></div>
            <div className="ro-field"><span className="fld-label">الجهة المرتبطة</span><span style={{ fontWeight: 600 }}>{rec.entity || '—'}</span></div>
            <div className="ro-field"><span className="fld-label">رقم القضية</span><span className="mono" style={{ fontWeight: 700 }}>{rec.caseNo || 'لا يوجد'}</span></div>
          </div>
          <div className="ro-field" style={{ marginTop: 12 }}>
            <span className="fld-label">المرفقات المقدّمة</span>
            <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {(rec.att || ['صورة الهوية.pdf', 'صحيفة الدعوى.pdf']).map((f, i) => <span key={i} className="attf"><I name="description" size={15} /> {f}</span>)}
            </div>
          </div>
        </div>}
    </Card>
  );
}

// ===== الجدول الزمني للإجراءات =====
function Timeline({ actions }) {
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 14 }}><I name="history" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />سجلّ إجراءات الطلب</b>
      <div className="tl">
        {actions.map((a, i) => (
          <div className="tl-item" key={i}>
            <div className="tl-dot"><I name={a.icon} size={12} color="var(--color-primary)" fill /></div>
            <div className="tl-t">{a.t}</div>
            <div className="tl-m">{a.m}</div>
            <div className="tl-m" style={{ marginTop: 1 }}><I name="schedule" size={11} style={{ verticalAlign: 'middle' }} /> {a.when} · {a.who}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ===== محاضر الاتصال — نموذج إضافة + جدول (مطابق للنظام) =====
const CALL_RESULTS = {
  answered: { t: 'تم الرد', icon: 'call', tone: ['var(--green-10)', 'var(--color-success)'] },
  noanswer: { t: 'لم يُرَد', icon: 'phone_missed', tone: ['var(--warning-10)', 'var(--color-warning)'] },
};
const CALL_CHANNELS = {
  phone:    { t: 'الهاتف', icon: 'call' },
  platform: { t: 'رسائل المنصة', icon: 'chat' },
};
const RESPONSE_OPTIONS = [
  'تم إغلاق الطلب لعدم الرد على التواصل الهاتفي والمراسلات.',
  'تم إغلاق الطلب لوجود طلب سابق.',
  'بناءً على التواصل تم حفظ طلبكم.',
  'تم الحفظ بناءً على طلبكم.',
  'تم إغلاق الطلب لعدم الاختصاص.',
  'تم إغلاق طلب الحماية لوجود قرار رفض انضمام إلى برنامج حماية سابق.',
  'تم الإغلاق لعدم وجود قضية قائمة.',
  'تم الإغلاق حسب توصية الجهة.',
];
const RESPONSE_REASON = {
  'تم إغلاق الطلب لعدم الرد على التواصل الهاتفي والمراسلات.': 'closeNoReply',
  'تم إغلاق الطلب لوجود طلب سابق.': 'closePrior',
  'بناءً على التواصل تم حفظ طلبكم.': 'closeReq',
  'تم الحفظ بناءً على طلبكم.': 'closeReq',
  'تم إغلاق الطلب لعدم الاختصاص.': 'closeJuris',
  'تم إغلاق طلب الحماية لوجود قرار رفض انضمام إلى برنامج حماية سابق.': 'closePrior',
  'تم الإغلاق لعدم وجود قضية قائمة.': 'closeNocase',
  'تم الإغلاق حسب توصية الجهة.': 'closeNocase',
};
function stampNow() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  let h = d.getHours(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12;
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(h)}:${p(d.getMinutes())} ${ap}`;
}
function CallLogs({ rec, actor, viewOnly, isDone, logs, setLogs }) {
  const [result, setResult] = useState('');
  const [channel, setChannel] = useState('phone');
  const [note, setNote] = useState('');
  const canAdd = !viewOnly && !isDone;
  const who = CLERKS[actor] ? CLERKS[actor].name : 'الموظف';
  const save = () => {
    if (!result) return;
    // القضايا الفعليّة: احفظ المحضر في القاعدة (شرطٌ لقرار triage_decide) — append-only + تدقيق.
    if (rec.real && rec.caseId) {
      const summary = note.trim() || (CALL_RESULTS[result] ? CALL_RESULTS[result].t : 'محضر اتصال');
      addContactLog(rec.caseId, channel, summary);
    }
    setLogs((l) => [...l, { date: stampNow(), channel, result, note: note.trim(), by: who }]);
    setResult(''); setNote(''); setChannel('phone');
  };
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <b style={{ color: 'var(--text-strong)' }}><I name="forum" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />محاضر الاتصال</b>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted" style={{ fontSize: 11.5 }}>{logs.length} محضر</span>
          {logs.length > 0 && <button className="link" onClick={() => window.print()}><I name="print" size={16} /> طباعة</button>}
        </div>
      </div>
      <p className="muted" style={{ margin: '0 0 14px' }}>سجلّ التواصل مع طالب الحماية (هاتف أو رسائل المنصة) للتحقق من بياناته. محضر اتصال واحد على الأقل شرطٌ لأي قرار فرز. كل محضر append-only منسوب للموظف مع ختم زمني في التدقيق.</p>
      {canAdd && (
        <div className="cl-form">
          <div className="cl-grid">
            <div className="fld" style={{ margin: 0 }}>
              <span className="fld-label">تاريخ محضر الاتصال</span>
              <div className="cl-stamp"><I name="schedule" size={16} color="var(--text-secondary)" /> {stampNow()}</div>
            </div>
            <div className="fld" style={{ margin: 0 }}>
              <span className="fld-label">قناة التواصل</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                {Object.entries(CALL_CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
              </select>
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12, marginBottom: 0 }}>
            <span className="fld-label">نتيجة الاتصال <span style={{ color: 'var(--color-error)' }}>*</span></span>
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">اختر النتيجة…</option>
              {Object.entries(CALL_RESULTS).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
            </select>
          </div>
          <div className="fld" style={{ marginTop: 12, marginBottom: 0 }}>
            <span className="fld-label">ملاحظات محضر الاتصال</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="توثيق موجز لمضمون الاتصال…" dir="auto" style={{ minHeight: 64 }} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-primary" disabled={!result} onClick={save}><I name="note_add" size={18} /> حفظ المحضر</button>
          </div>
        </div>
      )}
      <div className="tbl-wrap" style={{ marginTop: canAdd ? 16 : 4 }}>
        <table>
          <thead><tr><th style={{ width: 34 }}>#</th><th>تاريخ المحضر</th><th>القناة</th><th>النتيجة</th><th>الملاحظات</th><th>المُعد</th></tr></thead>
          <tbody>
            {logs.map((l, i) => { const r = CALL_RESULTS[l.result] || CALL_RESULTS.answered; const ch = CALL_CHANNELS[l.channel] || CALL_CHANNELS.phone; return (
              <tr key={i} style={{ cursor: 'default' }}>
                <td className="mono">{i + 1}</td>
                <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{l.date}</td>
                <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}><I name={ch.icon} size={14} color="var(--text-secondary)" style={{ verticalAlign: 'middle', marginInlineEnd: 3 }} />{ch.t}</td>
                <td><span className="pill" style={{ background: r.tone[0], color: r.tone[1] }}><I name={r.icon} size={13} fill /> {r.t}</span></td>
                <td style={{ color: 'var(--text-body)', minWidth: 200 }}>{l.note || '—'}</td>
                <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{l.by}</td>
              </tr>
            ); })}
            {logs.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20, cursor: 'default' }}>لا محاضر اتصال بعد — يلزم محضر واحد على الأقل للقرار.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ===== الفحص الشكليّ — قائمة تحقّق تُرشّح القرار =====
const CHECK_ITEMS = [
  { id: 'complete', label: 'اكتمال بيانات الطلب ومستنداته', ref: 'م7/1، م5/1' },
  { id: 'juris', label: 'وقوع الطلب ضمن اختصاص المركز وصفة مشمولة', ref: 'المادة 1' },
  { id: 'case', label: 'وجود قضية/بلاغ قائم أو صفة موجِبة للحماية', ref: 'م1، م5' },
  { id: 'noprior', label: 'لا يوجد طلب سابق أو قرار سابق بشأن الشخص', ref: 'إجرائي' },
  { id: 'verified', label: 'تم التحقق من الطالب عبر محضر اتصال موثّق', ref: 'م7' },
];
function suggestDecision(checks) {
  if (checks.juris === 'no') return { id: 'closeJuris', label: 'حفظ الطلب لعدم الاختصاص' };
  if (checks.noprior === 'no') return { id: 'closePrior', label: 'حفظ الطلب لوجود طلب/قرار سابق' };
  if (CHECK_ITEMS.every((it) => checks[it.id] === 'yes')) return { id: 'accept', label: 'قبول وإسناد للدراسة والتقييم' };
  if (checks.juris === 'yes' && checks.case !== 'yes') return { id: 'refer', label: 'إحالة لجهة مختصة لطلب توصية' };
  return null;
}
function FormalCheck({ checks, setChecks }) {
  const done = CHECK_ITEMS.filter((it) => checks[it.id]).length;
  const sug = suggestDecision(checks);
  const set = (id, v) => setChecks((c) => ({ ...c, [id]: v }));
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <b style={{ color: 'var(--text-strong)' }}><I name="checklist" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />الفحص الشكليّ</b>
        <span className="muted" style={{ fontSize: 11.5 }}>{done}/{CHECK_ITEMS.length} مكتمل</span>
      </div>
      <p className="muted" style={{ margin: '0 0 14px' }}>تحقّق شكليّ لا موضوعي، مُسنَد لنص النظام واللائحة. كل البنود إلزامية قبل اعتماد القرار، وإجاباتك تُرشّح القرار — والقرار الموضوعي بالحماية يبقى للمجلس بعد الدراسة.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {CHECK_ITEMS.map((it) => (
          <div key={it.id} className="chk-row">
            <span className="chk-label"><I name={checks[it.id] === 'yes' ? 'check_circle' : checks[it.id] === 'no' ? 'cancel' : 'radio_button_unchecked'} size={18} color={checks[it.id] === 'yes' ? 'var(--color-success)' : checks[it.id] === 'no' ? 'var(--color-error)' : 'var(--text-disabled)'} fill={!!checks[it.id]} /> {it.label} <span className="chk-ref">{it.ref}</span></span>
            <span className="chk-toggle">
              <button className={'seg' + (checks[it.id] === 'yes' ? ' on' : '')} onClick={() => set(it.id, 'yes')}>نعم</button>
              <button className={'seg danger' + (checks[it.id] === 'no' ? ' on' : '')} onClick={() => set(it.id, 'no')}>لا</button>
            </span>
          </div>
        ))}
      </div>
      {sug &&
        <InlineAlert kind={sug.id === 'accept' ? 'success' : sug.id === 'refer' ? 'info' : 'warning'} title="القرار المُرشَّح بناءً على الفحص" style={{ marginTop: 12 }}>
          {sug.label} — يمكنك اعتماده أو اختيار غيره في «قرار الفرز» أدناه.
        </InlineAlert>}
    </Card>
  );
}

// ===== شاشة التفاصيل / الفرز =====
function CaseDetail({ rec, back, viewOnly, actor, onResolve }) {
  const [decision, setDecision] = useState('');
  const [entity, setEntity] = useState('');
  const [branch, setBranch] = useState(() => CITY_REGION[rec.city] || 'RUH');
  const [note, setNote] = useState('');
  const [checks, setChecks] = useState({});
  const [logs, setLogs] = useState(rec.calls || []);
  const [response, setResponse] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  const isReplied = rec.status === 'replied';
  const isPending = rec.status === 'pending';
  const isDone = rec.status === 'study' || rec.status === 'closed';
  const hasRec = (isReplied || rec.source === 'جهة') && rec.reply;   // توصية متوفرة
  const recDriven = hasRec;                                          // القرار مدفوع بالتوصية
  const urgent = false;                                              // العاجل/الطارئ خارج الفرز — مسار خاص (م8)

  // قواعد التحقق عبر المحاضر
  const hasCall = logs.length > 0;                                   // محضر واحد على الأقل قبل أي قرار
  const noAnswerDays = new Set(logs.filter((l) => l.result === 'noanswer').map((l) => (l.date || '').split(' ')[0])).size;
  const noReplyOk = noAnswerDays >= 3;                               // 3 محاولات موثّقة على أيام مختلفة

  const DEC = [
    { id: 'accept', label: 'قبول وإسناد للدراسة والتقييم', icon: 'check_circle' },
    { id: 'refer', label: 'إحالة لجهة مختصة لطلب توصية', icon: 'send' },
    { id: 'save', label: 'حفظ وإغلاق الطلب', icon: 'inventory_2', danger: true },
  ];

  const isSave = decision === 'save' || decision === 'closeNocase';
  const saveReason = decision === 'closeNocase' ? 'closeNocase' : (RESPONSE_REASON[response] || '');
  const effDecision = decision === 'save' ? saveReason : decision;   // القرار الفعليّ — يُشتقّ سبب الحفظ من الرسالة
  const baseValid = decision === 'accept' || decision === 'closeNocase'
    || (decision === 'save' && response) || (decision === 'refer' && entity && branch);
  const noReplyGate = saveReason !== 'closeNoReply' || noReplyOk;
  // الفحص الشكليّ — إلزامي ومُلزِم إلا بمبرّر
  const needsChecks = rec.status === 'triage' && !recDriven;
  const sug = needsChecks ? suggestDecision(checks) : null;
  const checksComplete = !needsChecks || CHECK_ITEMS.every((it) => checks[it.id]);
  const overriding = sug && effDecision && effDecision !== sug.id;
  const overrideOk = !overriding || note.trim().length > 0;
  const canSubmit = baseValid && hasCall && noReplyGate && checksComplete && overrideOk;

  return (
    <div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للقائمة</button>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="row">
          <SecretCode code={rec.secret} canReveal={true} onReveal={() => setRevealed(true)} />
          <Tag tone="info" size="sm" iconLeft={<I name="badge" size={13} />}>{rec.cat}</Tag>
          <SrcChip source={rec.source} />
        </div>
        <Pill status={rec.status} />
      </div>

      {rec.paper &&
        <InlineAlert kind="warning" title="ورودٌ ورقيّ — هوية غير موثّقة" style={{ marginBottom: 14 }}>
          أُدخل هذا الطلب يدوياً عبر وحدة الاستقبال الورقيّ. الهوية <b>غير موثّقة</b> وتُفعَّل عبر نفاذ لاحقاً (لازمة للاتفاقية م11 والتظلّم م21)، وصورة المستند الورقيّ ضمن المرفقات.
        </InlineAlert>}

      {revealed &&
        <InlineAlert kind="info" title="كشف الهوية مُسجَّل في التدقيق" style={{ marginBottom: 14 }}>
          كُشِفت هوية طالب الحماية بواسطة {CLERKS[actor] ? CLERKS[actor].name : (LEAD[actor] ? LEAD[actor].name : 'المستخدم')} — {stampNow()}. سُجّل حدث الكشف (المستخدم، الطلب، الوقت) في سجلّ التدقيق وفق مبدأ الحاجة إلى المعرفة.
        </InlineAlert>}

      {viewOnly &&
        <InlineAlert kind="info" title="اطّلاع قيادي كامل" style={{ marginBottom: 14 }}>
          {LEAD[actor].name} — اطّلاع كامل على الطلب وكل إجراءات الفرز للعرض والإشراف، دون التدخّل في قرار الموظف. الهوية محفوظة بالرمز السري.
        </InlineAlert>}

      <SummaryCard rec={rec} />

      {isPending && rec.sla &&
        <Card className="card pad" style={{ marginBottom: 16 }}>
          <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 12 }}><I name="timer" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />المهلة النظامية لتوصية الجهة</b>
          {rec.sla.daysElapsed >= rec.sla.totalDays &&
            <InlineAlert kind="error" title="تجاوز مهلة الجهة — مُصَّعد للقيادة" style={{ marginBottom: 12 }}>انقضت المهلة النظامية (5 أيام عمل) دون ورود التوصية. أُرسل تذكير وصُعّد الأمر للقيادة، مع استمرار الانتظار — لا يُحفظ الطلب تلقائياً.</InlineAlert>}
          <div className="row" style={{ alignItems: 'stretch', gap: 12 }}>
            <DeadlineTimer label={'توصية ' + (rec.entity || 'الجهة')} totalDays={rec.sla.totalDays} daysElapsed={rec.sla.daysElapsed} articleRef="5 أيام عمل" />
            <InlineAlert kind="info" title="بانتظار توصية الجهة" style={{ flex: 1 }}>أُحيل الطلب للجهة المختصة ولا يُتّخذ قرار فرز حتى ورود التوصية. عند انقضاء المهلة دون رد: تذكير آلي وتصعيد للقيادة مع استمرار الانتظار (لا يُحفظ تلقائياً). يمكن الاستمرار في تسجيل محاضر الاتصال والمراسلة.</InlineAlert>
          </div>
        </Card>}

      <CallLogs key={rec.secret} rec={rec} actor={actor} viewOnly={viewOnly} isDone={isDone} logs={logs} setLogs={setLogs} />

      {/* توصية الجهة — مرفقة أو واردة */}
      {hasRec && (
        <Card className="card pad" style={{ marginBottom: 16, borderInlineStart: '3px solid ' + (rec.reply.outcome === 'case' ? 'var(--color-success)' : 'var(--color-error)') }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <b style={{ color: 'var(--text-strong)' }}><I name="mark_email_read" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />توصية الجهة المختصة</b>
            <span className="muted" style={{ fontSize: 11.5 }}>{rec.entity} · {rec.reply.when}</span>
          </div>
          <Tag tone={rec.reply.outcome === 'case' ? 'success' : 'error'} size="md" iconLeft={<I name={rec.reply.outcome === 'case' ? 'verified' : 'gpp_bad'} size={14} fill />}>
            {rec.reply.outcome === 'case' ? 'توجد قضية قائمة — توصية بالحماية' : 'لا قضية قائمة'}
          </Tag>
          <p style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7, margin: '10px 0 0' }}>{rec.reply.text}</p>
          {rec.source === 'جهة' && rec.status === 'triage' &&
            <p className="muted" style={{ margin: '8px 0 0' }}><I name="attachment" size={13} style={{ verticalAlign: 'middle' }} /> مرفقة مع الطلب المرفوع من الجهة — دون الحاجة لإحالة لطلب التوصية.</p>}
        </Card>
      )}

      {/* الفحص الشكليّ — للطلب الذاتي بلا توصية */}
      {!viewOnly && rec.status === 'triage' && !recDriven &&
        <FormalCheck checks={checks} setChecks={setChecks} />}

      {/* التوجيه — قرار الفرز */}
      {!viewOnly && (rec.status === 'triage' || isReplied) && (
        <Card className="card pad">
          <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 4 }}><I name="alt_route" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />التوجيه — قرار الفرز</b>
          <p className="muted" style={{ margin: '0 0 12px' }}>
            {recDriven ? 'بناءً على توصية الجهة، اعتمد القرار المناسب.' : 'اعتمد على نتيجة الفحص الشكليّ أعلاه. الفرز شكليّ لا موضوعي؛ والقرار الموضوعي بالحماية يبقى للمجلس بعد الدراسة.'}
          </p>

          {recDriven ? (
            <div className="chips">
              {rec.reply.outcome === 'case'
                ? <button className={'chip' + (decision === 'accept' ? ' on' : '')} onClick={() => setDecision('accept')}><I name="check_circle" size={15} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />قبول وإسناد للدراسة والتقييم</button>
                : <button className={'chip danger' + (decision === 'closeNocase' ? ' on' : '')} onClick={() => setDecision('closeNocase')}><I name="inventory_2" size={15} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />حفظ الطلب — لا قضية قائمة</button>}
            </div>
          ) : (
            <div className="chips">
              {DEC.map((d) => (
                <button key={d.id} className={'chip' + (d.danger ? ' danger' : '') + (decision === d.id ? ' on' : '')} onClick={() => setDecision(d.id)}>
                  <I name={d.icon} size={15} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />{d.label}
                </button>
              ))}
            </div>
          )}

          {decision === 'refer' &&
            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              <div className="fld" style={{ margin: 0 }}>
                <span className="fld-label">الجهة المختصة <span style={{ color: 'var(--color-error)' }}>*</span></span>
                <select value={entity} onChange={(e) => setEntity(e.target.value)}>
                  <option value="">اختر الجهة…</option>
                  {['النيابة العامة', 'رئاسة أمن الدولة', 'وزارة الداخلية', 'هيئة الرقابة ومكافحة الفساد', 'وزارة العدل'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="fld" style={{ margin: 0 }}>
                <span className="fld-label">الفرع المختص مكانياً <span style={{ color: 'var(--color-error)' }}>*</span></span>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {Object.keys(REGIONS).map((code) => <option key={code} value={code}>{branchLabelT(entity, code)}</option>)}
                </select>
                <p className="muted" style={{ margin: '6px 0 0' }}><I name="near_me" size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />مُشتقّ آلياً من الاختصاص المكاني للقضية (المدينة: {rec.city || 'غير محدّدة'}) — قابل للتعديل عند الحاجة.</p>
              </div>
              <InlineAlert kind="info" title="إحالة لطلب توصية (م5/4)">تُوجَّه الإحالة إلى <b>{branchLabelT(entity || 'الجهة المختصة', branch)}</b> — لضابط الاتصال المعتمد بالفرع، لا للجهة ككل. يدخل الطلب «بانتظار توصية الجهة» بمهلة 5 أيام عمل (م5/3 لائحة): فإن وردت بلا قضية قائمة يُحفظ، وإن وردت بالحماية يُقبل ويُسند آلياً للدراسة والتقييم.</InlineAlert>
            </div>}
          {decision === 'accept' &&
            <InlineAlert kind="success" title="إسناد آلي للدراسة (المادة 9)" style={{ marginTop: 14 }}>يُحال الطلب آلياً إلى مرحلة الدراسة والتقييم ويُوزَّع على دارس/مقيّم.{urgent ? ' وبما أنه ' + rec.urgency + '، تُطبَّق تدابير حماية مؤقتة فور الاعتماد المزدوج.' : ''}</InlineAlert>}
          {isSave &&
            <InlineAlert kind="warning" title="حفظ الطلب" style={{ marginTop: 14 }}>
              {saveReason === 'closeReq' ? 'يُحفظ الطلب بناءً على طلب صاحبه. ' : saveReason === 'closeJuris' ? 'يُحفظ لعدم اختصاص المركز. ' : saveReason === 'closeNoReply' ? 'يُحفظ لتعذّر التواصل الهاتفي بعد 3 محاولات موثّقة على أيام مختلفة في محاضر الاتصال. ' : saveReason === 'closePrior' ? 'يُحفظ لوجود طلب سابق أو قرار سابق بشأن الشخص. ' : (saveReason === 'closeNocase' || decision === 'closeNocase') ? 'يُحفظ لعدم وجود قضية قائمة وفق توصية الجهة. ' : 'اختر رسالة «الرد على طالب الحماية» أدناه لتحديد سبب الحفظ. '}
              يُوثَّق السبب كتابةً (المادة 10 — لا حفظ دون سبب)، ويطّلع عليه نائب الرئيس والرئيس، ويُشعَر به طالب الحماية فوراً (وبحدّ أقصى 3 أيام نظاماً، إ10). لا تظلّم في مرحلة الفرز — للطالب تقديم طلب جديد بمستجدّات، والتظلّم يكون بعد قرار المجلس.
            </InlineAlert>}

          {decision === 'save' &&
            <div className="fld" style={{ marginTop: 14 }}>
              <span className="fld-label">الرد على طالب الحماية — سبب الحفظ <span style={{ color: 'var(--color-error)' }}>*</span></span>
              <select value={response} onChange={(e) => setResponse(e.target.value)}>
                <option value="">الرجاء اختيار الرد على طلب الحماية</option>
                {RESPONSE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <p className="muted" style={{ margin: '8px 0 0' }}>الرسالة تحدّد سبب الحفظ وهي الرد الموحّد المُرسَل لطالب الحماية عند اعتماد القرار — يُسجّل في المراسلات والتدقيق (بالرمز السري).</p>
            </div>}

          {overriding &&
            <InlineAlert kind="warning" title="مخالفة القرار المُرشَّح" style={{ marginTop: 12 }}>القرار المُرشَّح بناءً على الفحص الشكليّ هو «{sug.label}». اختيارك يخالفه — يلزم مبرّر موثّق لاعتماد قرار مختلف.</InlineAlert>}
          {decision &&
            <div className="fld" style={{ marginTop: 12 }}>
              <span className="fld-label">{overriding ? 'مبرّر مخالفة القرار المُرشَّح ' : 'ملاحظة الموظف '}{overriding ? <span style={{ color: 'var(--color-error)' }}>*</span> : <span className="muted" style={{ fontWeight: 400 }}>(اختياري)</span>}</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={overriding ? 'اذكر مبرّر مخالفة القرار المُرشَّح…' : 'توثيق موجز للقرار…'} dir="auto" />
            </div>}

          {needsChecks && !checksComplete &&
            <InlineAlert kind="info" title="أكمل الفحص الشكليّ" style={{ marginTop: 12 }}>يجب الإجابة على كل بنود الفحص الشكليّ (نعم/لا) قبل اعتماد القرار.</InlineAlert>}
          {decision && !hasCall &&
            <InlineAlert kind="warning" title="يلزم محضر اتصال" style={{ marginTop: 12 }}>يجب تسجيل محضر اتصال واحد على الأقل قبل اعتماد أي قرار فرز.</InlineAlert>}
          {saveReason === 'closeNoReply' && !noReplyOk &&
            <InlineAlert kind="warning" title="محاولات غير كافية" style={{ marginTop: 12 }}>يتطلّب هذا القرار 3 محاولات «لم يُرَد» موثّقة على أيام مختلفة (المسجّل حالياً: {noAnswerDays}).</InlineAlert>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            <button className="btn btn-ghost" onClick={back}>إلغاء</button>
            <button className="btn btn-primary" disabled={!canSubmit} onClick={() => onResolve(rec, effDecision || decision, decision === 'refer' ? (entity + ' — ' + branchLabelT(entity, branch)) : undefined, needsChecks ? checks : undefined)}>
              اعتماد القرار <I name="arrow_back" size={18} />
            </button>
          </div>
        </Card>
      )}

      {viewOnly && !isDone &&
        <Card className="card pad" style={{ marginTop: 16 }}>
          <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 4 }}><I name="swap_horiz" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />إشراف القيادة — إعادة الإسناد</b>
          <p className="muted" style={{ margin: '0 0 12px' }}>القائمة مشتركة، ولكن للقيادة إعادة إسناد الطلب لموظف بعينه عند الحاجة (المُسنَد حالياً: {CLERKS[rec.clerk].short}). الإجراء مُسجّل في التدقيق.</p>
          <div className="fld" style={{ margin: 0 }}>
            <span className="fld-label">المُسنَد إليه</span>
            <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">اختر موظف الفرز…</option>
              {Object.entries(CLERKS).map(([id, c]) => <option key={id} value={id}>{c.name} — {c.short}</option>)}
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-primary" disabled={!reassignTo || reassignTo === rec.clerk} onClick={() => onResolve(rec, 'reassign', reassignTo)}><I name="swap_horiz" size={18} /> إعادة الإسناد</button>
          </div>
          {reassignTo === rec.clerk && <p className="muted" style={{ margin: '6px 0 0' }}>هذا الموظف مُسنَد إليه الطلب حالياً — اختر موظفاً آخر.</p>}
        </Card>}

      {/* سجل الإجراءات — يظهر دائماً (وهو الأساس للقيادة) */}
      <div style={{ marginTop: 16 }}><Timeline actions={rec.actions} /></div>

      {isDone && !viewOnly &&
        <InlineAlert kind="info" title="طلب مُنجز" style={{ marginTop: 4 }}>اكتمل الفرز على هذا الطلب. الإجراء مسجّل في السجلّ أعلاه.</InlineAlert>}

      {isDone && viewOnly &&
        <Card className="card pad" style={{ marginTop: 4 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13.5, color: 'var(--text-body)' }}><I name="admin_panel_settings" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />بصفتك من القيادة، لك إلغاء قرار الفرز وإعادة الطلب للمعالجة.</span>
            <button className="btn btn-ghost" onClick={() => onResolve(rec, 'reverse')}><I name="undo" size={18} /> إلغاء القرار وإعادة الفتح</button>
          </div>
        </Card>}
    </div>
  );
}

function Stub({ title, icon, note }) {
  return (
    <div>
      <h2 className="h2">{title}</h2>
      <Card className="card pad" style={{ textAlign: 'center', padding: 48 }}>
        <I name={icon} size={44} color="var(--text-disabled)" />
        <p className="muted" style={{ marginTop: 12 }}>{note}</p>
      </Card>
    </div>
  );
}

const STAGE_FLOW = ['استلام الطلب', 'الفرز المبدئي', 'الإحالة للجهة', 'الدراسة والتقييم', 'قرار المركز', 'تفعيل الحماية'];
const stageOf = (r) => r.status === 'study' ? 4 : (r.status === 'pending' || r.status === 'replied') ? 3 : 2;
// الإجراء المطلوب — دالة واحدة تغذّي البطاقات والعدّادات؛ كل إجراء في مرحلته النظامية حصراً (الاستيفاء في الفرز — م7)
function nextAction(r, viewOnly) {
  if (r.status === 'closed' || r.status === 'study') return null;
  if (viewOnly) {
    if (r.status === 'pending' && r.sla && r.sla.daysElapsed >= r.sla.totalDays) return { t: 'تجاوزت الجهة مهلة التوصية — راجع التصعيد وقرِّر إعادة الإسناد أو الاستمرار', icon: 'priority_high' };
    return null;
  }
  if (r.status === 'replied') return { t: 'وردت توصية الجهة — اتخاذ قرار الفرز (م10)', icon: 'gavel' };
  if (r.status === 'triage') return { t: r.paper ? 'ورود ورقيّ (هوية غير موثّقة) — محضر اتصال ثم الفحص الشكلي (م7)' : 'محضر اتصال موثّق ثم الفحص الشكلي فقرار الفرز (م7)', icon: 'fact_check' };
  return null;
}
function Dashboard({ rows, viewOnly, openCase, go, notifs, readIds, markRead }) {
  const n = (f) => rows.filter(f).length;
  const actionable = rows.map((r) => ({ r, act: nextAction(r, viewOnly) })).filter((x) => x.act);
  const prio = { replied: 0, triage: 1, pending: 2 };
  actionable.sort((a, b) => (prio[a.r.status] != null ? prio[a.r.status] : 9) - (prio[b.r.status] != null ? prio[b.r.status] : 9));
  const hero = actionable[0];
  const slas = rows.filter((r) => r.status === 'pending' && r.sla);
  const updates = notifs.slice(0, 4);
  const stats = viewOnly ? [
    { v: actionable.length, l: 'يتطلّب إجراء', icon: 'bolt', tone: ['var(--error-10)','var(--color-error)'] },
    { v: n((r) => r.status === 'triage'), l: 'بانتظار الفرز', icon: 'fact_check', tone: ['var(--warning-10)','var(--color-warning)'] },
    { v: n((r) => r.status === 'pending' || r.status === 'replied'), l: 'لدى الجهات', icon: 'hourglass_top', tone: ['var(--info-10)','var(--color-info)'] },
    { v: n((r) => r.status === 'study'), l: 'أُحيل للدراسة', icon: 'analytics', tone: ['var(--green-10)','var(--color-primary)'] },
    { v: n((r) => r.status === 'closed'), l: 'محفوظ', icon: 'archive', tone: ['var(--neutral-100)','var(--text-secondary)'] },
  ] : [
    { v: actionable.length, l: 'يتطلّب إجراءً منك', icon: 'bolt', tone: ['var(--error-10)','var(--color-error)'] },
    { v: n((r) => r.status === 'triage'), l: 'بانتظار الفرز (مشترك)', icon: 'fact_check', tone: ['var(--warning-10)','var(--color-warning)'] },
    { v: n((r) => r.status === 'replied'), l: 'وردت توصيتها', icon: 'mark_email_read', tone: ['var(--green-10)','var(--color-primary)'] },
    { v: n((r) => r.status === 'pending'), l: 'بانتظار الجهة', icon: 'hourglass_top', tone: ['var(--info-10)','var(--color-info)'] },
    { v: n((r) => r.status === 'study'), l: 'أُحيل للدراسة', icon: 'analytics', tone: ['var(--green-10)','var(--color-primary)'] },
  ];
  return (
    <div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">{viewOnly ? 'نظرة شاملة على أعباء الفرز ومآلات الطلبات عبر موظفي المركز.' : 'نظرة على قائمة الفرز المشتركة ومآلات الطلبات، وكل المؤشرات تحفظ السرية.'}</p>
      {hero ? (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="pill" style={{ background: 'var(--error-10)', color: 'var(--color-error)' }}><I name="bolt" size={13} fill /> يتطلّب إجراء</span>
              <span className="mono" style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{hero.r.secret}</span>
              <Tag tone="info" size="sm">{hero.r.cat}</Tag>
              <Pill status={hero.r.status} />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{hero.r.days}</span>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 14.5, fontWeight: 600, color: 'var(--text-strong)' }}>الإجراء المطلوب منك: {hero.act.t}</p>
          <p className="muted" style={{ margin: 0 }}>{[hero.r.crime, hero.r.city].filter(Boolean).join(' · ') || '—'}</p>
          <div className="stp">{STAGE_FLOW.map((s, i) => <span key={i} className={i < stageOf(hero.r) ? 'on' : ''} title={s} />)}</div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>المرحلة {stageOf(hero.r)} من {STAGE_FLOW.length} — {STAGE_FLOW[stageOf(hero.r) - 1]}</span>
            <button className="btn btn-primary" onClick={() => openCase(hero.r)}><I name={hero.act.icon} size={18} /> اتّخذ الإجراء</button>
          </div>
        </div>
      ) : (
        <div className="card pad" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <I name="check_circle" size={22} color="var(--color-success)" fill />
          <span style={{ fontSize: 14, color: 'var(--text-body)' }}>{viewOnly ? 'لا تصعيدات تتطلّب تدخّلكم الآن.' : 'لا إجراءات معلّقة عليك الآن — القائمة المشتركة مُغطّاة.'}</span>
        </div>
      )}
      <div className="stats">
        {stats.map((s, i) => (
          <button key={i} className="card stat" onClick={() => go('queue')} title="فتح القائمة">
            <div className="stat-ico" style={{ background: s.tone[0], color: s.tone[1] }}><I name={s.icon} size={22} /></div>
            <div><div className="stat-v">{s.v}</div><div className="stat-l">{s.l}</div></div>
          </button>
        ))}
      </div>
      <div className="dash-cols">
        <div className="card pad">
          <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 12 }}><I name="timer" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />المهلة النظامية الجارية</b>
          {slas.length === 0 ? <p className="muted" style={{ margin: 0 }}>لا مُهل جارية الآن.</p> :
            <div style={{ display: 'grid', gap: 14 }}>
              {slas.map((r) => (
                <div key={r.secret}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-strong)' }}>{r.secret}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{r.entity}</span>
                  </div>
                  <DeadlineTimer label="مهلة توصية الجهة" totalDays={r.sla.totalDays} daysElapsed={r.sla.daysElapsed} articleRef="م5/4" />
                </div>
              ))}
            </div>}
        </div>
        <div className="card" style={{ padding: '16px 10px 10px' }}>
          <b style={{ color: 'var(--text-strong)', display: 'block', margin: '0 8px 8px' }}><I name="update" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />آخر التحديثات</b>
          {updates.length === 0 && <p className="muted" style={{ margin: '4px 8px 10px' }}>لا تحديثات بعد.</p>}
          {updates.map((u) => (
            <button key={u.id} className="dash-ntf" onClick={() => { markRead(u.id); go(u.dest); }}>
              <div className="ntf-ico" style={{ width: 32, height: 32, background: NT[u.tone][0], color: NT[u.tone][1] }}><I name={u.icon} size={17} fill /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{u.t}</div>
                <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.d}</div>
              </div>
              {!readIds.includes(u.id) && <span className="dot-unread" style={{ marginTop: 0 }} />}
            </button>
          ))}
        </div>
      </div>
      <Card className="card pad">
        <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 12 }}><I name="groups" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />توزّع العبء على موظفي الفرز (ترشيح)</b>
        <div style={{ display: 'grid', gap: 10 }}>
          {Object.entries(CLERKS).map(([id, c]) => {
            const cnt = rows.filter((r) => r.clerk === id).length;
            const act = rows.filter((r) => r.clerk === id && (r.status === 'triage' || r.status === 'replied')).length;
            return (
              <div key={id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="row" style={{ gap: 8 }}><div className="avatar" style={{ width: 30, height: 30 }}><I name="person" size={17} /></div><span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</span><span className="muted">· {c.short} · {c.shift}</span></span>
                <span className="row" style={{ gap: 8 }}><Tag tone="info" size="sm">{cnt} مُرشَّح</Tag>{act > 0 && <Tag tone="warning" size="sm">{act} نشط</Tag>}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Profile({ actor, viewOnly }) {
  const who = viewOnly ? LEAD[actor] : CLERKS[actor];
  const rows = viewOnly
    ? [['الدور', who.name], ['نطاق العمل', 'الإشراف على مرحلة الفرز المبدئي'], ['الصلاحية', 'اطّلاع كامل — دون تدخّل في القرار'], ['المصادقة الثنائية (MFA)', 'مُفعّلة']]
    : [['الاسم', who.name], ['الرقم الوظيفي', who.emp], ['الدور', 'موظف الفرز المبدئي'], ['المناوبة', who.shift], ['نطاق العمل', 'مرحلة الفرز المبدئي — قائمة مشتركة'], ['المصادقة الثنائية (MFA)', 'مُفعّلة']];
  const perms = viewOnly
    ? ['الاطّلاع الكامل على كل الطلبات', 'الاطّلاع على إجراءات الفرز وسجلّاتها', 'إعادة إسناد الطلبات بين الموظفين', 'تعديل أو إلغاء قرار الفرز', 'متابعة أعباء الموظفين والمواعيد']
    : ['معالجة أي طلب وارد من القائمة المشتركة', 'تسجيل محاضر الاتصال', 'إجراء الفحص الشكليّ', 'الإحالة لجهة مختصة لطلب توصية', 'قبول وإسناد للدراسة والتقييم', 'حفظ الطلب بأسبابه', 'مراسلة طالب الحماية والجهات المختصة', 'عرض الرمز السري وكشفه (مُسجّل)'];
  return (<div>
    <h2 className="h2">{viewOnly ? 'الملف الشخصي' : 'الملف الشخصي للموظف'}</h2>
    <p className="lede">البيانات والصلاحيات ونطاق العمل. الوصول مقيّد بالدور ومُسجّل في التدقيق.</p>
    <Card className="card pad" style={{ marginBottom: 16 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{rows.map(([l, v], i) => <div className="ro-field" key={i}><span className="fld-label">{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div>)}</div></Card>
    <Card className="card pad"><b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 10 }}><I name="key" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />الصلاحيات</b><div style={{ display: 'grid', gap: 8 }}>{perms.map((p, i) => <div className="row" key={i} style={{ gap: 8 }}><I name="check_circle" size={18} color="var(--color-success)" fill /><span style={{ fontSize: 13.5 }}>{p}</span></div>)}</div></Card>
  </div>);
}

const NT = { primary: ['var(--green-10)', 'var(--color-primary)'], warning: ['var(--warning-10)', 'var(--color-warning)'], info: ['var(--info-10)', 'var(--color-info)'], error: ['var(--error-10)', 'var(--color-error)'] };
const NOTIF_FILTERS = {
  clerks: [{ id: 'all', t: 'الكل' }, { id: 'unread', t: 'غير المقروء' }, { id: 'incoming', t: 'الوارد' }, { id: 'reco', t: 'التوصيات والإحالات' }, { id: 'deadline', t: 'المهل' }, { id: 'msg', t: 'الرسائل' }],
  lead: [{ id: 'all', t: 'الكل' }, { id: 'unread', t: 'غير المقروء' }, { id: 'incoming', t: 'الوارد' }, { id: 'deadline', t: 'المهل' }],
};
// الإشعارات تُشتقّ من الوارد الحقيقيّ (لا إشعارات مُلفّقة): بند يتطلّب إجراء · إحالة جارية · تجاوز مهلة (عاجل)
function notifsOf(rows, viewOnly) {
  const out = [];
  rows.forEach((r) => {
    const over = r.status === 'pending' && r.sla && r.sla.daysElapsed >= r.sla.totalDays;
    const act = nextAction(r, viewOnly);
    if (over) out.push({ id: 'dl:' + r.secret, icon: 'hourglass_top', tone: 'error', cat: 'deadline', crit: true, t: viewOnly ? 'تصعيد: تجاوز مهلة الجهة' : 'تجاوز مهلة توصية الجهة', d: r.secret + ' — انقضت مهلة ' + (r.entity || 'الجهة المختصة') + ' (5 أيام عمل) والانتظار مستمر (لا حفظ تلقائي).', time: r.days, group: dayGroupOf(r), dest: 'queue', deadline: { label: 'مهلة توصية الجهة — ' + r.secret, total: r.sla.totalDays, elapsed: r.sla.daysElapsed, ref: 'م5/4' } });
    if (act && r.status !== 'pending') out.push({ id: 'act:' + r.secret + ':' + r.status, icon: r.status === 'replied' ? 'mark_email_read' : 'inbox', tone: r.status === 'replied' ? 'primary' : 'warning', cat: r.status === 'replied' ? 'reco' : 'incoming', t: r.status === 'replied' ? 'وردت توصية الجهة' : 'طلب وارد جديد', d: r.secret + ' — ' + (r.cat || '') + ' · ' + (r.days || '') + '. الإجراء المطلوب منك: ' + act.t, time: r.days, group: dayGroupOf(r), dest: 'queue' });
    if (r.status === 'pending' && !over) out.push({ id: 'ref:' + r.secret, icon: 'send', tone: 'info', cat: 'reco', t: 'أُحيل طلب لجهة مختصة', d: r.secret + ' — أُحيل إلى ' + (r.entity || 'الجهة المختصة') + ' لطلب توصية خلال 5 أيام عمل.', time: r.days, group: dayGroupOf(r), dest: 'queue' });
  });
  return out;
}
function Notifs({ viewOnly, items, readIds, markRead, markAllRead, go }) {
  const [flt, setFlt] = useState('all');
  const isUnread = (n) => !readIds.includes(n.id);
  const filters = NOTIF_FILTERS[viewOnly ? 'lead' : 'clerks'];
  const countOf = (f) => f === 'all' ? items.length : f === 'unread' ? items.filter(isUnread).length : items.filter((n) => n.cat === f).length;
  const shown = items.filter((n) => flt === 'all' || (flt === 'unread' ? isUnread(n) : n.cat === flt));
  const crit = shown.filter((n) => n.crit);
  const rest = shown.filter((n) => !n.crit);
  const Item = ({ n }) => { const [bg, fg] = NT[n.tone]; const u = isUnread(n); return (
    <button className={'ntf' + (u ? ' unread' : '') + (n.crit ? ' crit' : '')} onClick={() => { markRead(n.id); go(n.dest); }}>
      <div className="ntf-ico" style={{ background: n.crit ? 'var(--error-10)' : bg, color: n.crit ? 'var(--color-error)' : fg }}><I name={n.icon} size={20} fill /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}><span className="ntf-t">{n.t}</span>{n.crit && <span className="pill" style={{ background: 'var(--color-error)', color: '#fff' }}><I name="priority_high" size={12} fill /> عاجل</span>}</div>
        <div className="ntf-d">{n.d}</div>
        {n.deadline && <div style={{ marginTop: 10, maxWidth: 420 }}><DeadlineTimer label={n.deadline.label} totalDays={n.deadline.total} daysElapsed={n.deadline.elapsed} articleRef={n.deadline.ref} /></div>}
        <div className="row" style={{ gap: 10, marginTop: 6 }}><span className="ntf-time">{n.time}</span><span className="link" style={{ fontSize: 12 }}>فتح الوجهة <I name="arrow_back" size={13} /></span></div>
      </div>
      {u && <span className="dot-unread" />}
    </button>); };
  const groups = ['اليوم', 'أمس', 'الأقدم'];
  return (<div>
    <h2 className="h2">الإشعارات</h2>
    <p className="lede">{viewOnly ? 'تنبيهات إجراءات الفرز عبر موظفي المركز — النقر على الإشعار يفتح وجهته ويعلّمه مقروءاً.' : 'تنبيهات الوارد المشترك وتوصيات الجهات والمهل — النقر على الإشعار يفتح وجهته ويعلّمه مقروءاً.'}</p>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
      <div className="row" style={{ gap: 6 }}>{filters.map((f) => <button key={f.id} className={'flt' + (flt === f.id ? ' on' : '')} onClick={() => setFlt(f.id)}>{f.t}<span className="flt-n">{countOf(f.id)}</span></button>)}</div>
      <button className="btn btn-ghost" style={{ height: 36, fontSize: 13 }} onClick={markAllRead} disabled={!items.some(isUnread)}><I name="done_all" size={16} /> تعليم الكل كمقروء</button>
    </div>
    {shown.length === 0 && <div className="ntf-empty"><I name="notifications_off" size={34} color="var(--text-disabled)" /><b style={{ color: 'var(--text-strong)' }}>لا إشعارات هنا</b><span style={{ fontSize: 13 }}>{flt === 'unread' ? 'قرأت كل إشعاراتك.' : 'لا إشعارات في هذا التصنيف بعد.'}</span></div>}
    {crit.length > 0 && <div style={{ display: 'grid', gap: 10, marginBottom: 4 }}>{crit.map((n) => <Item n={n} key={n.id} />)}</div>}
    {groups.map((g) => { const list = rest.filter((n) => (n.group || 'الأقدم') === g); return list.length === 0 ? null : (
      <div key={g}><div className="ntf-group">{g}</div><div style={{ display: 'grid', gap: 10 }}>{list.map((n) => <Item n={n} key={n.id} />)}</div></div>); })}
  </div>);
}

// ===== المراسلات =====
const MSG_PARTY = {
  seeker: { t: 'طالب الحماية', icon: 'person', color: 'var(--color-info)' },
  entity: { t: 'الجهة المختصة', icon: 'account_balance', color: 'var(--gold-70)' },
};
const REFERRAL_ENTITIES = ['النيابة العامة', 'رئاسة أمن الدولة', 'وزارة الداخلية', 'هيئة الرقابة ومكافحة الفساد', 'وزارة العدل'];
function MessagesScreen({ viewOnly, threads, setThreads, rows }) {
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [cReq, setCReq] = useState('');
  const [cParty, setCParty] = useState('');
  const [cEntity, setCEntity] = useState('');
  const cur = threads.find((t) => t.id === sel);
  const reqObj = rows.find((s) => s.secret === cReq);
  const reqEntity = reqObj && reqObj.entity;
  const convoEntity = reqEntity || cEntity;
  const startValid = cReq && (cParty === 'seeker' || (cParty === 'entity' && convoEntity));
  const resetCompose = () => { setComposing(false); setCReq(''); setCParty(''); setCEntity(''); };
  const send = () => {
    if (!draft.trim() || !cur) return;
    setThreads((ts) => ts.map((t) => t.id === sel ? { ...t, msgs: [...t.msgs, { from: 'clerk', t: draft.trim(), when: 'الآن' }] } : t));
    setDraft('');
  };
  const startConvo = () => {
    if (!startValid) return;
    const existing = threads.find((t) => t.secret === cReq && t.party === cParty);
    if (existing) { setSel(existing.id); resetCompose(); return; }
    const id = 'tn' + Date.now();
    setThreads((ts) => [{ id, secret: cReq, party: cParty, unread: 0,
      entity: cParty === 'entity' ? convoEntity : undefined,
      officer: cParty === 'entity' ? ('ضابط الاتصال — ' + convoEntity) : undefined,
      msgs: [] }, ...ts]);
    setSel(id); resetCompose();
  };
  if (cur) {
    const p = MSG_PARTY[cur.party];
    const rcCur = rows.find((s) => s.secret === cur.secret);
    const reqClosed = !!rcCur && rcCur.status === 'closed';
    return (
      <div>
        <button className="link" onClick={() => setSel(null)} style={{ marginBottom: 12 }}><I name="arrow_forward" size={16} /> رجوع للمراسلات</button>
        {cur.party === 'seeker' ? (() => {
          const rc = rows.find((s) => s.secret === cur.secret) || {};
          return (
            <Card className="card pad" style={{ marginBottom: 12, borderInlineStart: '3px solid var(--color-info)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <b style={{ color: 'var(--text-strong)' }}><I name="badge" size={18} color="var(--color-info)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />الطرف المعني بالمراسلة — طالب الحماية</b>
                <SecretCode code={cur.secret} canReveal={true} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="ro-field"><span className="fld-label">الفئة</span><span style={{ fontWeight: 600 }}>{rc.cat || '—'}</span></div>
                <div className="ro-field"><span className="fld-label">رقم الطلب</span><span className="mono" style={{ fontWeight: 700 }}>REQ-2026-{cur.secret.slice(-4)}</span></div>
                <div className="ro-field"><span className="fld-label">المدينة</span><span style={{ fontWeight: 600 }}>{rc.city || '—'}</span></div>
                <div className="ro-field"><span className="fld-label">نوع الجريمة محل الحماية</span><span style={{ fontWeight: 600 }}>{rc.crime || '—'}</span></div>
                <div className="ro-field"><span className="fld-label">من ذوي الاحتياجات الخاصة</span><span style={{ fontWeight: 600, color: rc.special ? 'var(--color-info)' : 'var(--text-body)' }}>{rc.special ? 'نعم' : 'لا'}</span></div>
              </div>
              <p className="muted" style={{ margin: '10px 0 0' }}><I name="lock" size={13} style={{ verticalAlign: 'middle' }} /> الهوية محجوبة بالرمز السري — الكشف عند الضرورة مُسجّل في التدقيق. المراسلة تخصّ هذا الطلب فقط.</p>
            </Card>
          );
        })() : (() => {
          const rc = rows.find((s) => s.secret === cur.secret) || {};
          return (
            <Card className="card pad" style={{ marginBottom: 12, borderInlineStart: '3px solid var(--gold-70)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <b style={{ color: 'var(--text-strong)' }}><I name="account_balance" size={18} color="var(--gold-70)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />الطرف المعني بالمراسلة — الجهة المختصة</b>
                <Tag tone="warning" size="sm" iconLeft={<I name="verified_user" size={13} />}>ضابط اتصال معتمد</Tag>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="ro-field"><span className="fld-label">الجهة</span><span style={{ fontWeight: 600 }}>{cur.entity || rc.entity || '—'}</span></div>
                <div className="ro-field"><span className="fld-label">ضابط الاتصال</span><span style={{ fontWeight: 600 }}>{cur.officer || 'ضابط الاتصال المعتمد'}</span></div>
                <div className="ro-field"><span className="fld-label">الطلب المرتبط</span><span className="mono" style={{ fontWeight: 700 }}>{cur.secret}</span></div>
                <div className="ro-field"><span className="fld-label">فئة صاحب الطلب</span><span style={{ fontWeight: 600 }}>{rc.cat || '—'}</span></div>
              </div>
              <p className="muted" style={{ margin: '10px 0 0' }}><I name="lock" size={13} style={{ verticalAlign: 'middle' }} /> التواصل عبر ضابط الاتصال المعتمد ويخصّ هذا الطلب فقط. هوية صاحب الطلب لا تُفصح للجهة إلا في الأحوال النظامية.</p>
            </Card>
          );
        })()}
        <Card className="card">
          <div className="msg-head">
            <div className="row" style={{ gap: 10 }}>
              <div className="avatar" style={{ background: 'var(--surface-subtle)', color: p.color }}><I name={p.icon} size={20} /></div>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-strong)' }}>{cur.secret}</span>
                  <Tag tone={cur.party === 'seeker' ? 'info' : 'warning'} size="sm" iconLeft={<I name={p.icon} size={12} />}>{cur.party === 'seeker' ? 'طالب الحماية' : cur.entity}</Tag>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{cur.party === 'seeker' ? 'محادثة مقصورة على هذا الطلب — بالرمز السري' : cur.officer + ' · محادثة مقصورة على هذا الطلب'}</div>
              </div>
            </div>
            <Tag tone={cur.party === 'seeker' ? 'error' : 'info'} size="sm" iconLeft={<I name={cur.party === 'seeker' ? 'lock' : 'verified_user'} size={13} />}>{cur.party === 'seeker' ? 'سري' : 'قناة رسمية'}</Tag>
          </div>
          <div className="msg-body">
            {cur.msgs.length === 0 && <p className="muted" style={{ textAlign: 'center', margin: 'auto', fontSize: 12.5 }}>لا رسائل بعد — اكتب أول رسالة أدناه.</p>}
            {cur.msgs.map((m, i) => (
              <div key={i} className={'msg ' + (m.from === 'clerk' ? 'me' : 'them')}>
                <div className="msg-bubble">{m.t}</div>
                <div className="msg-meta">{m.from === 'clerk' ? 'الموظف' : (cur.party === 'seeker' ? cur.secret : cur.entity)} · {m.when}</div>
              </div>
            ))}
          </div>
          {viewOnly
            ? <div className="msg-composer"><p className="muted" style={{ margin: 0, padding: '6px 2px' }}>اطّلاع فقط — القيادة لا تراسل نيابةً عن الموظف.</p></div>
            : reqClosed
              ? <div className="msg-composer"><p className="muted" style={{ margin: 0, padding: '6px 2px', display: 'flex', alignItems: 'center', gap: 6 }}><I name="lock" size={15} color="var(--text-secondary)" /> الطلب محفوظ — المراسلة مقفلة للاطّلاع فقط. أي مستجدّ يُخاطَب بتقديم طلب جديد.</p></div>
              : <div className="msg-composer">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالة…" dir="auto" />
                  <button className="btn btn-primary" disabled={!draft.trim()} onClick={send}><I name="send" size={18} /> إرسال</button>
                </div>}
        </Card>
      </div>
    );
  }
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 className="h2">المراسلات</h2>
          <p className="lede">قنوات التواصل مع طالب الحماية (بالرمز السري) والجهات المختصة (ضابط الاتصال المعتمد) — لتسريع إجراءات الفرز. كل رسالة مسجّلة في التدقيق.</p>
        </div>
        {!viewOnly && !composing &&
          <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setComposing(true)}><I name="add_comment" size={18} /> بدء مراسلة</button>}
      </div>

      {composing && !viewOnly &&
        <Card className="card pad" style={{ marginBottom: 16 }}>
          <b style={{ color: 'var(--text-strong)', display: 'block', marginBottom: 4 }}><I name="add_comment" size={18} color="var(--color-primary)" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />بدء مراسلة جديدة</b>
          <p className="muted" style={{ margin: '0 0 14px' }}>حدّد الطلب، ثم المُرسَل إليه على نفس الطلب — إمّا طالب الحماية أو الجهة المختصة.</p>
          <div className="fld">
            <span className="fld-label">الطلب <span style={{ color: 'var(--color-error)' }}>*</span></span>
            <select value={cReq} onChange={(e) => { setCReq(e.target.value); setCParty(''); setCEntity(''); }}>
              <option value="">اختر الطلب النشط…</option>
              {rows.filter((s) => s.status !== 'closed').map((s) => <option key={s.secret} value={s.secret}>{s.secret} — {s.cat}</option>)}
            </select>
            <p className="muted" style={{ margin: '6px 2px 0', fontSize: 11.5 }}><I name="info" size={13} style={{ verticalAlign: 'middle' }} /> تُعرض الطلبات النشطة فقط. الطلبات المحفوظة/المقفلة لا تُفتح لها مراسلة جديدة — تُخاطَب بتقديم طلب جديد بمستجدّات.</p>
          </div>
          {cReq &&
            <div className="fld" style={{ marginTop: 12 }}>
              <span className="fld-label">المُرسَل إليه — على الطلب {cReq} <span style={{ color: 'var(--color-error)' }}>*</span></span>
              <div className="chips">
                <button className={'chip' + (cParty === 'seeker' ? ' on' : '')} onClick={() => setCParty('seeker')}><I name="person" size={15} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />طالب الحماية (بالرمز السري)</button>
                <button className={'chip' + (cParty === 'entity' ? ' on' : '')} onClick={() => setCParty('entity')}><I name="account_balance" size={15} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />الجهة المختصة</button>
              </div>
            </div>}
          {cParty === 'entity' && !reqEntity &&
            <div className="fld" style={{ marginTop: 12 }}>
              <span className="fld-label">الجهة المختصة <span style={{ color: 'var(--color-error)' }}>*</span></span>
              <select value={cEntity} onChange={(e) => setCEntity(e.target.value)}>
                <option value="">اختر الجهة…</option>
                {REFERRAL_ENTITIES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>}
          {cParty === 'entity' && reqEntity &&
            <InlineAlert kind="info" title="جهة الطلب" style={{ marginTop: 12 }}>الجهة المرتبطة بهذا الطلب: {reqEntity} — عبر ضابط الاتصال المعتمد.</InlineAlert>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            <button className="btn btn-ghost" onClick={resetCompose}>إلغاء</button>
            <button className="btn btn-primary" disabled={!startValid} onClick={startConvo}><I name="arrow_back" size={18} /> بدء المراسلة</button>
          </div>
        </Card>}

      {threads.length === 0 && !composing && <div className="ntf-empty"><I name="forum" size={34} color="var(--text-disabled)" /><b style={{ color: 'var(--text-strong)' }}>لا مراسلات بعد</b><span style={{ fontSize: 13 }}>{viewOnly ? 'تُعرض هنا مراسلات الموظفين على الطلبات للاطّلاع.' : 'ابدأ مراسلة على طلب نشط عند الحاجة.'}</span></div>}
      {(() => {
        const groups = {};
        threads.forEach((t) => { (groups[t.secret] = groups[t.secret] || []).push(t); });
        return (
          <div style={{ display: 'grid', gap: 18 }}>
            {Object.entries(groups).map(([secret, list]) => (
              <div key={secret}>
                <div className="msg-group-hd"><I name="folder_shared" size={16} color="var(--color-primary)" /> طلب <span className="mono" style={{ fontWeight: 800 }}>{secret}</span> <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· قناتان كحدّ أقصى: طالب الحماية والجهة</span>{(() => { const rg = rows.find((s) => s.secret === secret); return rg && rg.status === 'closed' ? <span className="pill" style={{ background: 'var(--neutral-100)', color: 'var(--text-secondary)', marginInlineStart: 6 }}><I name="lock" size={12} fill /> محفوظ — للاطّلاع</span> : null; })()}</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {list.map((t) => { const p = MSG_PARTY[t.party]; const last = t.msgs[t.msgs.length - 1] || { when: '', t: 'مراسلة جديدة' }; return (
                    <div key={t.id} className="card thread" onClick={() => { setSel(t.id); setThreads((ts) => ts.map((x) => x.id === t.id ? { ...x, unread: 0 } : x)); }}>
                      <div className="avatar" style={{ background: 'var(--surface-subtle)', color: p.color, flexShrink: 0 }}><I name={p.icon} size={20} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-strong)' }}>{t.party === 'seeker' ? 'طالب الحماية' : t.entity}</span>
                          <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{last.when}</span>
                        </div>
                        <div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.t} · {last.t}</div>
                      </div>
                      {t.unread > 0 && <span className="nav-badge" style={{ position: 'static' }}>{t.unread}</span>}
                    </div>
                  ); })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ===== التطبيق =====
function App({ mode, initialRows }) {
  const viewOnly = mode === 'deputy' || mode === 'chair';
  const [acct] = useState(viewOnly ? mode : 'c1');
  const [active, setActive] = useState('dashboard');
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [readIds, setReadIds] = useState([]);
  const [threads, setThreads] = useState([]); // خيوط المراسلات — لا محادثات مُلفّقة
  const readKey = 'triageNotifRead-' + mode + '-v1';
  // تحميل ثبات الطيّ والقراءة بعد الترسية (SSR-safe — لا فرق خادم/عميل عند أول رسم)
  useEffect(() => { try { setCollapsed(localStorage.getItem('triageSb-v1') === '1'); } catch (e) {} }, []);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(readKey) || 'null'); if (Array.isArray(s)) setReadIds(s); } catch (e) {} }, [readKey]);
  const toggleSide = () => setCollapsed((c) => { try { localStorage.setItem('triageSb-v1', c ? '0' : '1'); } catch (e) {} return !c; });
  const persistRead = (ids) => { setReadIds(ids); try { localStorage.setItem(readKey, JSON.stringify(ids)); } catch (e) {} };

  // القضايا الفعليّة من Supabase (initialRows) تتصدّر القائمة؛ حالات SEED تبقى للعرض التوضيحيّ.
  const [rows, setRows] = useState(() => {
    const real = Array.isArray(initialRows) ? initialRows : [];
    const seen = new Set(real.map((r) => r.secret));
    return [...real, ...SEED.filter((r) => !seen.has(r.secret))];
  }); // قائمة مشتركة يراها الجميع — الحقيقيّة أولاً ثم SEED

  // إشعارات مشتقّة من الوارد الحقيقيّ + عدّادات حيّة موحّدة (الشارات والبطاقات من المصدر نفسه)
  const notifs = notifsOf(rows, viewOnly);
  const markRead = (id) => { if (!readIds.includes(id)) persistRead([...readIds, id]); };
  const markAllRead = () => persistRead(Array.from(new Set([...readIds, ...notifs.map((x) => x.id)])));
  const unreadNotifs = notifs.filter((x) => !readIds.includes(x.id)).length;
  const unreadMsgs = threads.reduce((a, t) => a + (t.unread || 0), 0);
  const goNav = (id) => { setActive(id); setSel(null); setOpen(false); };
  const onResolve = async (rec, decision, extra, checks) => {
    const map = { reassign: 'أُعيد إسناد الطلب لموظف آخر', accept: 'قُبل الطلب وأُسند للدراسة والتقييم', refer: 'أُحيل لجهة مختصة لطلب توصية', closeReq: 'حُفظ الطلب بطلب من طالب الحماية', closeNoReply: 'حُفظ الطلب — لعدم الرد على التواصل', closePrior: 'حُفظ الطلب — لوجود طلب/قرار سابق', closeJuris: 'حُفظ الطلب — لعدم الاختصاص', closeNocase: 'حُفظ الطلب — لا قضية قائمة', reverse: 'أُلغي القرار وأُعيد الطلب للمعالجة' };
    const statusMap = { accept: 'study', refer: 'pending', closeReq: 'closed', closeNoReply: 'closed', closePrior: 'closed', closeJuris: 'closed', closeNocase: 'closed', reverse: 'triage' };

    // القضايا الفعليّة (Supabase): افرض آلة الحالة عبر triage_decide ذرّياً.
    if (rec.real && rec.caseId) {
      const rpcDec = decision === 'accept' ? 'study' : decision === 'refer' ? 'refer'
        : (String(decision).startsWith('close') ? 'close' : null);
      if (rpcDec) {
        const reason = rpcDec === 'close' ? (map[decision] || 'حُفظ الطلب') : (rpcDec === 'refer' ? (extra || '') : '');
        const res = await triageDecide(rec.caseId, rpcDec, reason, checks || {}, decision === 'refer' ? (extra || null) : null);
        if (!res.ok) { setToast('تعذّر حفظ القرار: ' + res.error); setTimeout(() => setToast(''), 4200); return; }
      }
    }

    setRows((rs) => rs.map((r) => {
      if (r.secret !== rec.secret) return r;
      if (decision === 'reassign') return { ...r, clerk: extra || r.clerk };
      if (decision === 'refer') return { ...r, status: 'pending', entity: extra || r.entity };
      return statusMap[decision] ? { ...r, status: statusMap[decision] } : r;
    }));
    setToast(decision === 'refer' && extra ? 'أُحيل إلى ' + extra + ' لطلب توصية (م5/4)' : (map[decision] || 'تم اعتماد القرار')); setSel(null);
    setTimeout(() => setToast(''), 3200);
  };

  const openCase = (r) => { setActive('queue'); setSel(r); setOpen(false); };
  const needCount = rows.filter((r) => nextAction(r, viewOnly)).length;
  const NAV = viewOnly
    ? [{ id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' }, { id: 'queue', t: 'سجلّ الفرز', icon: 'inbox', badge: needCount || null }, { id: 'messages', t: 'المراسلات', icon: 'forum', badge: unreadMsgs || null }, { id: 'notifications', t: 'الإشعارات', icon: 'notifications', badge: unreadNotifs || null }, { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' }]
    : [{ id: 'dashboard', t: 'لوحة المعلومات', icon: 'dashboard' }, { id: 'queue', t: 'الطلبات الواردة', icon: 'inbox', badge: rows.filter((r) => r.status === 'triage').length || null }, { id: 'messages', t: 'المراسلات', icon: 'forum', badge: unreadMsgs || null }, { id: 'notifications', t: 'الإشعارات', icon: 'notifications', badge: unreadNotifs || null }, { id: 'profile', t: 'الملف الشخصي', icon: 'account_circle' }];

  const signout = () => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); };

  let body;
  if (active === 'queue') body = sel ? <CaseDetail rec={sel} back={() => setSel(null)} viewOnly={viewOnly} actor={acct} onResolve={onResolve} /> : <Queue rows={rows} open={setSel} viewOnly={viewOnly} acct={acct} />;
  else if (active === 'dashboard') body = <Dashboard rows={rows} viewOnly={viewOnly} openCase={openCase} go={goNav} notifs={notifs} readIds={readIds} markRead={markRead} />;
  else if (active === 'profile') body = <Profile actor={acct} viewOnly={viewOnly} />;
  else if (active === 'notifications') body = <Notifs viewOnly={viewOnly} items={notifs} readIds={readIds} markRead={markRead} markAllRead={markAllRead} go={goNav} />;
  else if (active === 'messages') body = <MessagesScreen viewOnly={viewOnly} threads={threads} setThreads={setThreads} rows={rows} />;
  else body = <Stub title="المراسلات" icon="forum" note="خيوط التواصل مع طالب الحماية والجهة المختصة." />;

  const who = viewOnly ? LEAD[acct] : CLERKS[acct];
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '') + (collapsed ? ' collapsed' : '')}>
        <div className="brand">
          <div className="brand-mark"><I name="shield_person" size={22} fill color="#fff" /></div>
          <div className="brand-txt brand-logos">
            {/* التطبيق يعمل خلف basePath /center — وسم <img> يحتاج البادئة صراحةً */}
            <img src="/center/brand/logo-center.png" alt="مركز حماية الشهود والمبلّغين والخبراء والضحايا — النيابة العامة" />
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>{viewOnly ? 'الفرز المبدئي — إشراف القيادة' : 'بوابة الفرز المبدئي — موظفو المركز'}</div>
          </div>
          <button className="collapse-btn" onClick={toggleSide} title={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'} aria-label={collapsed ? 'توسيع القائمة' : 'طيّ القائمة'}>
            <I name={collapsed ? 'left_panel_open' : 'left_panel_close'} size={20} />
          </button>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={'nav-item' + (active === n.id && !sel ? ' on' : '')} title={collapsed ? n.t : undefined} onClick={() => goNav(n.id)}>
              <I name={n.icon} size={20} /> <span className="nav-lbl">{n.t}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-user" title={who.name + ' — موثّق عبر نفاذ'}>
            <span className="su-av">{(who.name || '؟').trim().charAt(0)}</span>
            <span className="nav-lbl" style={{ minWidth: 0 }}>
              <span className="su-name" style={{ display: 'block' }}>{who.name}</span>
              <span className="su-badge"><I name="verified_user" size={12} fill /> موثّق عبر نفاذ</span>
            </span>
          </div>
          <button className="logout-btn" title="تسجيل الخروج" onClick={() => setConfirmOut(true)}><I name="logout" size={18} /><span className="nav-lbl">تسجيل الخروج</span></button>
          <div className="side-copy nav-lbl">© 2026 النيابة العامة</div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><I name="menu" size={22} /></button>
          {sel && <SecretChip code={sel.secret} />}
          <span className="who">
            <button className="qa-btn" title="المراسلات" onClick={() => goNav('messages')}><I name="forum" size={20} />{unreadMsgs > 0 && <span className="qa-badge">{unreadMsgs}</span>}</button>
            <button className="qa-btn" title="الإشعارات" onClick={() => goNav('notifications')}><I name="notifications" size={20} />{unreadNotifs > 0 && <span className="qa-badge">{unreadNotifs}</span>}</button>
            <Tag tone={viewOnly ? 'info' : 'error'} size="sm" iconLeft={<I name={viewOnly ? 'visibility' : 'lock'} size={13} />}>{viewOnly ? 'اطّلاع وإشراف' : 'سري للغاية'}</Tag>
            <div className="avatar"><I name="person" size={20} /></div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{who.short}</span>
          </span>
        </header>
        <main className="content">{body}</main>
      </div>
      {confirmOut &&
        <div className="nf-scrim" onClick={() => setConfirmOut(false)}>
          <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
            <I name="logout" size={36} color="var(--color-error)" />
            <h3 style={{ margin: '10px 0 6px', fontSize: 17, color: 'var(--text-strong)' }}>تأكيد تسجيل الخروج</h3>
            <p className="muted" style={{ margin: '0 0 18px', lineHeight: 1.7 }}>ستُقفل الجلسة ويُسجَّل الخروج في التدقيق، وأي عمل غير محفوظ سيُفقد.</p>
            <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmOut(false)}>إلغاء</button>
              <button className="btn" style={{ background: 'var(--color-error)', color: '#fff' }} onClick={signout}><I name="logout" size={18} /> تسجيل الخروج</button>
            </div>
          </div>
        </div>}
      {toast &&
        <div style={{ position: 'fixed', insetInlineStart: 24, bottom: 24, zIndex: 60, background: 'var(--text-strong)', color: '#fff', padding: '12px 18px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}>
          <I name="check_circle" size={18} color="var(--green-40)" fill /> {toast}
        </div>}
    </div>
  );
}

export function TriagePortal({ mode = 'clerks', initialRows }) {
  return <App mode={mode} initialRows={initialRows} />;
}
