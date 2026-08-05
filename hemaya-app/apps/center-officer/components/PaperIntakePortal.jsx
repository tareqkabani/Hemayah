"use client";
/* ============================================================
   الإدخال اليدوي للطلبات — مطابق لتصميم
   «بوابة موظف المركز/الإدخال اليدوي للطلبات/البوابة.html».
   وحدة مؤقّتة لفترة التحوّل الرقميّ:
   - قيد الورود الورقيّ (تاريخ الورود + رقم القيد) — منه تُحسب المُهل (م10).
   - مسار طالب الحماية: الموقع القديم (نفاذ) أو ورقيّ حضوري بمحضر مقابلة.
   - مسار الجهة: خطاب رسمي وارد بالبريد — «توصية على طلبٍ مُحال» تُربط
     إلزامياً بطلبٍ قائم فتُدمج في سجلّه (لا سجلّ مكرّر)، أو «طلب نيابةً
     عن الشخص» بنموذج التوصية الكامل.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";
import { businessDaysBetween } from "@hemaya/domain";
import {
  submitPaperIntake,
  submitPaperRecommendation,
  listReferredForEntity,
} from "@/lib/paper-intake-actions";
import "./paper-intake.css";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) => <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

const Field = ({ label, hint, req, children }) => (
  <div className="rf-fld"><label className="rf-label">{label}{req && <span className="rf-req">*</span>}{hint && <span className="rf-hint">{hint}</span>}</label>{children}</div>
);
const Choice = ({ value, set, options, danger }) => (
  <div className="rf-chips">{options.map((o) => {
    const v = typeof o === 'string' ? o : o.v;
    const on = value === v;
    return <button type="button" key={v} className={'rf-chip' + (on ? ' on' : '') + (danger && danger.includes(v) && on ? ' danger' : '')} onClick={() => set(v)}>{typeof o === 'string' ? o : o.t}</button>;
  })}</div>
);
const Multi = ({ value, set, options }) => (
  <div className="rf-chips">{options.map((o) => {
    const on = value.includes(o);
    return <button type="button" key={o} className={'rf-chip' + (on ? ' on' : '')} onClick={() => set(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>;
  })}</div>
);
const Sec = ({ n, title, sub, fed, children }) => (
  <section className="rf-sec"><div className="rf-sec-head"><span className="rf-sec-n">{n}</span><div style={{ flex: 1 }}><h3 className="rf-sec-t">{title}</h3>{sub && <p className="rf-sec-sub">{sub}</p>}</div>{fed && <span className="rf-fed" title="تُغذّي مرحلة الدراسة والتقييم آلياً"><I name="conversion_path" size={14} /> يُورَّث للدراسة</span>}</div><div className="rf-sec-body">{children}</div></section>
);
// حقل موروث مقفل — هوية الطلب المُحال القائم (لا تُدخل يدوياً)
const Locked = ({ label, value, src }) => (
  <div className="rf-fld"><label className="rf-label">{label}</label>
    <div className="rf-locked"><span className="rf-locked-v">{value}</span><span className="rf-src"><I name="verified" size={14} fill color="var(--color-primary)" /> {src}</span></div>
  </div>
);

// الجهات المختصة — موحّدة مع جهات الإحالة في الفرز (المسمّى الكامل والترتيب)
const ENTS = [['prosecution', 'النيابة العامة'], ['state_security', 'رئاسة أمن الدولة'], ['moi', 'وزارة الداخلية'], ['nazaha', 'هيئة الرقابة ومكافحة الفساد'], ['moj', 'وزارة العدل']];

// سجلّ الجهات المختصة — مسمّى المُحرّر والمعتمِد يُشتقّ من الجهة
const ENTITIES = {
  prosecution:    { name: 'النيابة العامة',              drafter: 'محقق القضية',   approver: 'رئيس النيابة المتخصصة' },
  moi:            { name: 'وزارة الداخلية',              drafter: 'الضابط المختص',  approver: 'مدير الإدارة المختصة' },
  moj:            { name: 'وزارة العدل',                 drafter: 'الباحث المختص',  approver: 'رئيس المحكمة / مدير الإدارة المختصة' },
  state_security: { name: 'رئاسة أمن الدولة',            drafter: 'الضابط المختص',  approver: 'مدير الإدارة المختصة' },
  nazaha:         { name: 'هيئة الرقابة ومكافحة الفساد', drafter: 'المحقق المختص',  approver: 'مدير الإدارة المختصة' },
};
const REGIONS = { RUH: 'الرياض', MAK: 'مكة المكرمة', MED: 'المدينة المنورة', QAS: 'القصيم', EAS: 'الشرقية', ASR: 'عسير', TAB: 'تبوك', HAI: 'حائل', NOR: 'الحدود الشمالية', JAZ: 'جازان', NAJ: 'نجران', BAH: 'الباحة', JOF: 'الجوف' };
const WAQIA = ['الاعتداء على الأشخاص', 'الآداب العامة', 'الأموال', 'المخدرات', 'الجرائم الاقتصادية', 'الماسة بالثقة العامة', 'الأسرة والأحداث', 'الاتجار بالأشخاص', 'الجرائم المعلوماتية', 'الأمن الوطني'];
// أنواع الحماية الـ(13) المنصوص عليها في المادة الرابعة عشرة
const PROTECTION_TYPES = [
  'الحماية الأمنية', 'إخفاء البيانات الشخصية', 'النقل من العمل (مؤقّت/دائم)', 'إيجاد عمل بديل',
  'الإرشاد القانوني/النفسي/الاجتماعي', 'توفير وسائل الإبلاغ الفوري', 'تغيير أرقام الاتصال',
  'تغيير محل الإقامة', 'المرافقة الأمنية', 'الإدلاء بوسائط إلكترونية (تغيير الصوت وإخفاء الوجه)',
  'حماية المسكن', 'المساعدة المالية', 'أخرى (ما تراه الإدارة مناسباً)',
];

// ── قيد الورود الورقيّ — تُحسب مُهل م10 وSLA من تاريخ الورود لا من لحظة الإدخال ──
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const bizDaysSince = (iso) => (iso ? businessDaysBetween(new Date(iso + 'T00:00:00'), new Date()) : 0);
const fmtD = (iso) => (iso ? String(iso).slice(0, 10).replace(/-/g, '/') : '—');

const PaperMeta = ({ meta, setMeta, ch }) => {
  const legacy = ch === 'legacy';
  return (
  <div className="card pad rf" style={{ marginBottom: 14, maxWidth: 'none' }}>
    <div className="sec-h"><I name="event_available" size={19} /> {legacy ? 'مرجع الطلب في الموقع القديم' : 'قيد الورود الورقيّ'} <span className="rf-hint" style={{ fontWeight: 400 }}>(المُهل النظامية — م10 — تُحسب من {legacy ? 'تاريخ التقديم في الموقع القديم' : 'تاريخ الورود'} لا من لحظة الإدخال)</span></div>
    <div className="rf-grid2">
      <Field label={legacy ? 'تاريخ تقديم الطلب في الموقع القديم' : 'تاريخ ورود المستند الورقيّ'} req><input type="date" value={meta.receivedDate} max={todayISO()} onChange={(e) => setMeta({ ...meta, receivedDate: e.target.value })} /></Field>
      <Field label={legacy ? 'رقم الطلب في الموقع القديم' : 'رقم القيد الإداري'} req hint={legacy ? '(كما يظهر في الموقع القديم)' : '(من سجلّ الوارد)'}><input className="mono" value={meta.regNo} onChange={(e) => setMeta({ ...meta, regNo: e.target.value })} placeholder={legacy ? 'مثال: 641794' : 'مثال: و-1447/0231'} dir="ltr" /></Field>
    </div>
    {meta.receivedDate && <div className="man" style={{ marginBottom: 0 }}><I name="timer" size={16} /> انقضى منذ {legacy ? 'التقديم' : 'الورود'}: <b style={{ marginInline: 4 }}>{bizDaysSince(meta.receivedDate)} يوم عمل</b> — ومنه تبدأ المُهل والمؤقّتات، لا من لحظة الإدخال.</div>}
  </div>
  );
};

// نموذج التوصية الكامل — منقول من «بوابة الجهات المختصة/lib-recommendation-form.jsx».
// linked=true: توصية على طلبٍ مُحال قائم — الهوية موروثة موثّقة (مقفلة، لا إدخال يدويّ).
function RecommendationForm({ rec, onApprove, onBack }) {
  const linked = rec.linked !== false;
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution; // الجهة المختصة ومسمّياتها
  const [f, setF] = useState({
    // قسم ١ — في الطلب المرتبط تُورث الهوية؛ وإلا تُدخَل يدوياً من الخطاب الورقيّ
    psychHistory: '', health: '', healthNote: '', criminal: 'لا يوجد', criminalNote: '',
    reveal: '', role: rec.cat || '',
    obName: '', obNid: '', obPhone: '', obGender: '', obNationality: '', obMarital: '', obResidence: '', obEmployer: '', obEducation: '',
    // قسم ٢ و ٣
    reasons: '', caseNo: rec.caseNo || '', caseSummary: '', caseStage: '', applicantRole: '',
    // قسم ٤ — مهيكل
    contacted: '', contactKind: '', crimeType: '', waqia: [], crimeDesc: '',
    hidden2: '', threatExists: '', threatType: '', riskLevel: '', harmExists: '', harmType: '',
    extends: '', extendsWho: '', adapt: '', provide: '', why1: '', why2: '', why3: '',
    // قسم ٥ و ٦
    types: [], alternatives: '', duration: '', durationNote: '', attachMap: {},
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [ack, setAck] = useState(false);
  const [noId, setNoId] = useState(false);

  return (
    <div className="rf">
      {/* رأس */}
      <div className="rf-top">
        <button className="link" onClick={onBack}><I name="arrow_forward" size={18} /> رجوع إلى اختيار المصدر</button>
        <div className="rf-top-main">
          <div>
            <div className="rf-kicker">{linked ? 'نموذج التوصية' : 'طلب حماية نيابةً عن الشخص'}</div>
            <h2 className="rf-h">{linked ? 'توصية الجهة المختصة بشأن طلب حماية' : 'إنشاء طلب حماية نيابةً عن الشخص'}</h2>
          </div>
          <div className="rf-top-meta">
            <SecretCode code={rec.secret} canReveal={false} />
            <DeadlineTimer label={linked ? 'رفع التوصية للمركز' : 'رفع الطلب للمركز'} totalDays={5} daysElapsed={rec.days || 1} articleRef="م7 لائحة" />
          </div>
        </div>
      </div>

      <InlineAlert kind="info" title="مصدر البيانات" style={{ marginBottom: 18 }}>
        {linked
          ? <>توصية واردة بخطاب رسمي على طلبٍ مُحال قائم: هوية مقدّم الطلب <b>موروثة موثّقة</b> من الطلب القائم — مقفلة، لا تُدخل يدوياً. أنت تُفرِّغ ما ورد في خطاب الجهة (القضية والتقييم والمسوّغات) وتُرفق صورته.</>
          : <>استقبالٌ ورقيّ: تُدخَل بيانات مقدّم الطلب (الهوية والعنوان والعمل) <b>يدوياً</b> من الخطاب الوارد وتُرفق صورته — <b>غير موثّقة</b> بعد، وتُفعَّل عبر نفاذ حين يدخل الشخص بحسابه لاحقاً (لازمٌ للاتفاقية م11 والتظلّم م21). ثمّ تُكمِل الجهة القضية والتقييم والمسوّغات.</>}
      </InlineAlert>

      {/* بطاقة ضابط الاتصال المسؤول */}
      <div className="rf-officer">
        <div className="rf-officer-ico"><I name="support_agent" size={20} color="var(--color-primary)" fill /></div>
        <div className="rf-officer-main">
          <div className="rf-officer-role">ضابط الاتصال المسؤول <span className="rf-officer-ent">· {ent.name}</span></div>
          <div className="rf-officer-sub">نقطة التواصل الوحيدة مع المركز — يوزّع داخلياً ويتابع المهلة.</div>
        </div>
        <div className="rf-officer-meta">
          <Tag tone="success" size="sm" iconLeft={<I name="circle" size={10} fill />}>متاح</Tag>
          <span className="rf-officer-alt">بديل عند الغياب: مسؤول المناوبة</span>
        </div>
      </div>
      <Sec n="١" title="بيانات مقدم الطلب">
        {linked ? (
          <>
            <div className="rf-grid2">
              <Locked label="الاسم الرباعي" value="•••• •••• •••• ••••" src="الطلب القائم" />
              <Locked label="رقم الهوية" value="••••••••••" src="الطلب القائم" />
              <Locked label="الجنس" value="••••" src="الطلب القائم" />
              <Locked label="الجنسية" value="•••••••" src="الطلب القائم" />
              <Locked label="مقر الإقامة" value="•••• — العنوان الوطني" src="الطلب القائم" />
              <Locked label="جهة العمل" value="••••••••" src="الطلب القائم" />
            </div>
            <div className="rf-divider"><I name="edit_note" size={16} color="var(--text-secondary)" /> ما ورد في خطاب الجهة (يخصّ القضية والتقييم)</div>
          </>
        ) : noId ? (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات غير موثّقة — بانتظار التحقّق</b></div>
            <p className="muted" style={{ margin: '0 0 12px' }}>الشخص لا يملك هوية أو إقامة أو جواز (حالة مخالفي نظام الإقامة). تُدخل البيانات يدوياً وتُوسم للتحقّق اللاحق.</p>
            <InlineAlert kind="warning" title="نقطة معلّقة">آلية التحقّق لهذه الحالة <b>قيد النقاش مع الجهات المختصة</b>؛ تُعامل مؤقتاً كبيانات غير مؤكّدة.</InlineAlert>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setNoId(false)}><I name="arrow_forward" size={16} /> عودة إلى الإدخال بالهوية</button>
          </div>
        ) : (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات تُدخَل يدوياً من الخطاب الوارد — غير موثّقة بعد</b></div>
            <p className="muted" style={{ margin: '0 0 12px' }}>يُدخل موظف المركز بيانات الشخص من الخطاب الوارد وترفق صورة هويته وكل المتطلبات؛ ويأخذ الطلب مجراه فوراً. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ ويُفعّل الطلب.</p>
            <div className="rf-grid2">
              <Field label="الاسم الرباعي" req><input value={f.obName} onChange={(e) => set('obName', e.target.value)} dir="auto" placeholder="كما في الخطاب الوارد" /></Field>
              <Field label="رقم الهوية / الإقامة" req><input value={f.obNid} onChange={(e) => set('obNid', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="1XXXXXXXXX" dir="ltr" /></Field>
              <Field label="رقم الجوال" req hint="(للإشعار بتفعيل الحساب)"><input value={f.obPhone} onChange={(e) => set('obPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="05XXXXXXXX" dir="ltr" /></Field>
              <Field label="الجنس"><Choice value={f.obGender} set={(v) => set('obGender', v)} options={['ذكر', 'أنثى']} /></Field>
              <Field label="الجنسية"><input value={f.obNationality} onChange={(e) => set('obNationality', e.target.value)} dir="auto" placeholder="مثال: سعودي" /></Field>
              <Field label="الحالة الاجتماعية"><input value={f.obMarital} onChange={(e) => set('obMarital', e.target.value)} dir="auto" placeholder="أعزب / متزوّج…" /></Field>
              <Field label="مقر الإقامة" hint="(العنوان الوطني)"><input value={f.obResidence} onChange={(e) => set('obResidence', e.target.value)} dir="auto" placeholder="المدينة — الحي" /></Field>
              <Field label="جهة العمل"><input value={f.obEmployer} onChange={(e) => set('obEmployer', e.target.value)} dir="auto" /></Field>
              <Field label="المستوى التعليمي"><input value={f.obEducation} onChange={(e) => set('obEducation', e.target.value)} dir="auto" /></Field>
            </div>
            <InlineAlert kind="info" title="التفعيل عبر نفاذ لاحقاً">يدخل الشخص بحسابه في نفاذ ويُفعّل الطلب — وهو لازمٌ لتوقيع اتفاقية الحماية عند القبول، ولرفع التظلّم عند الاعتراض على أنواع الحماية أو قرار الرفض.</InlineAlert>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setNoId(true)}><I name="help" size={16} /> الشخص لا يملك هوية / إقامة / جواز؟</button>
            <div className="rf-divider"><I name="edit_note" size={16} color="var(--text-secondary)" /> ما تُدخله الجهة (يخصّ القضية والتقييم)</div>
          </div>
        )}
        <Field label="صفة مقدم الطلب" req>
          <Choice value={f.role} set={(v) => set('role', v)} options={['مُبلِّغ', 'شاهد', 'خبير', 'ضحية']} />
        </Field>
        <div className="rf-grid2">
          <Field label="الحالة الصحية" req>
            <Choice value={f.health} set={(v) => set('health', v)} options={['سليم', 'غير سليم']} />
          </Field>
          {f.health === 'غير سليم' && <Field label="يعاني من" hint="(يُرفق تقرير طبي)"><input value={f.healthNote} onChange={(e) => set('healthNote', e.target.value)} dir="auto" /></Field>}
          <Field label="التاريخ الجنائي" req>
            <Choice value={f.criminal} set={(v) => set('criminal', v)} options={['لا يوجد', 'يوجد']} />
          </Field>
          {f.criminal === 'يوجد' && <Field label="تفاصيل التاريخ الجنائي" hint="(يُرفق إن وجد)"><input value={f.criminalNote} onChange={(e) => set('criminalNote', e.target.value)} dir="auto" /></Field>}
        </div>
        <Field label="التاريخ النفسي (للتقييم)" hint="(يُرفق إن وجد)"><textarea value={f.psychHistory} onChange={(e) => set('psychHistory', e.target.value)} dir="auto" /></Field>
        <Field label="رغبة مقدم الطلب في الكشف عن هويته" req>
          <Choice value={f.reveal} set={(v) => set('reveal', v)} options={['يرغب', 'لا يرغب']} />
        </Field>
      </Sec>

      {/* ② تفاصيل وأسباب الطلب */}
      <Sec n="٢" title="تفاصيل وأسباب طلب الحماية">
        <Field label="التفاصيل والأسباب" req><textarea value={f.reasons} onChange={(e) => set('reasons', e.target.value)} dir="auto" style={{ minHeight: 110 }} /></Field>
      </Sec>

      {/* ③ ملخص القضية */}
      <Sec n="٣" title="ملخص القضية ودور مقدم الطلب">
        <div className="rf-grid2">
          <Field label="رقم القضية" req><input value={f.caseNo} onChange={(e) => set('caseNo', e.target.value)} className="mono" dir="auto" /></Field>
          <Field label="المرحلة الحالية للقضية" req><input value={f.caseStage} onChange={(e) => set('caseStage', e.target.value)} dir="auto" /></Field>
        </div>
        <Field label="ملخص القضية" req><textarea value={f.caseSummary} onChange={(e) => set('caseSummary', e.target.value)} dir="auto" style={{ minHeight: 90 }} /></Field>
        <Field label="دور مقدم الطلب وأهمية معلوماته وأدلته" req><textarea value={f.applicantRole} onChange={(e) => set('applicantRole', e.target.value)} dir="auto" /></Field>
      </Sec>

      {/* ④ مسوّغات توفير الحماية — مهيكل */}
      <Sec n="٤" title="مسوّغات توفير الحماية" sub="حقول مهيكلة — تُورَّث آلياً لتقييم عوامل المادة التاسعة وتصنيف الأخطار، دون تلخيص يُسقِط بيانات." fed>
        <Field label="هل تم التواصل مع مقدم الطلب؟" req>
          <Choice value={f.contacted} set={(v) => set('contacted', v)} options={['نعم', 'لا']} />
        </Field>
        {f.contacted === 'نعم' && <Field label="نوع التواصل"><Choice value={f.contactKind} set={(v) => set('contactKind', v)} options={['حضوري', 'اتصال هاتفي']} /></Field>}
        <Field label="نوع الجريمة" req>
          <Choice value={f.crimeType} set={(v) => set('crimeType', v)} options={['كبيرة موجبة للتوقيف', 'ليست كبيرة موجبة للتوقيف']} />
        </Field>
        <Field label="الواقعة" hint="(يُمكن اختيار أكثر من تصنيف)" req>
          <Multi value={f.waqia} set={(v) => set('waqia', v)} options={WAQIA} />
        </Field>
        <Field label="الوصف الإجرامي"><textarea value={f.crimeDesc} onChange={(e) => set('crimeDesc', e.target.value)} dir="auto" /></Field>
        <Field label="هل أُخفيت بياناته استناداً للمادة الثانية من النظام؟">
          <Choice value={f.hidden2} set={(v) => set('hidden2', v)} options={['نعم', 'لا']} />
        </Field>
        <div className="rf-grid2">
          <Field label="وجود خطر يهدد طالب الحماية" req>
            <Choice value={f.threatExists} set={(v) => set('threatExists', v)} options={['يوجد', 'لا يوجد']} danger={['يوجد']} />
          </Field>
          {f.threatExists === 'يوجد' && <Field label="نوع الخطر"><input value={f.threatType} onChange={(e) => set('threatType', e.target.value)} dir="auto" /></Field>}
        </div>
        {f.threatExists === 'يوجد' && (
          <Field label="مستوى الخطر" req>
            <Choice value={f.riskLevel} set={(v) => set('riskLevel', v)} options={['شديد', 'متوسط', 'منخفض']} danger={['شديد']} />
          </Field>
        )}
        <div className="rf-grid2">
          <Field label="وجود ضرر نتيجة دوره في القضية">
            <Choice value={f.harmExists} set={(v) => set('harmExists', v)} options={['يوجد', 'لا يوجد']} danger={['يوجد']} />
          </Field>
          {f.harmExists === 'يوجد' && <Field label="نوع الضرر"><input value={f.harmType} onChange={(e) => set('harmType', e.target.value)} dir="auto" /></Field>}
        </div>
        <div className="rf-grid2">
          <Field label="امتداد الخطر أو التهديد إلى الغير" hint="(لائحة م5/4)" req>
            <Choice value={f.extends} set={(v) => set('extends', v)} options={['نعم', 'لا']} danger={['نعم']} />
          </Field>
          {f.extends === 'نعم' && <Field label="إلى من يمتدّ؟"><input value={f.extendsWho} onChange={(e) => set('extendsWho', e.target.value)} dir="auto" placeholder="الزوج/الأقارب…" /></Field>}
        </div>
        <Field label="قدرة مقدم الطلب والتابعين على التكيّف مع برنامج الحماية" req>
          <Choice value={f.adapt} set={(v) => set('adapt', v)} options={['نعم', 'لا']} />
        </Field>
        {linked && (
        <div className="rf-recommend">
          <Field label="توصية الجهة بتوفير الحماية" req>
            <Choice value={f.provide} set={(v) => set('provide', v)} options={['توفير', 'عدم توفير']} danger={['عدم توفير']} />
          </Field>
          <div className="rf-why">
            <span className="rf-why-l">الأسباب:</span>
            <input value={f.why1} onChange={(e) => set('why1', e.target.value)} placeholder="السبب الأول" dir="auto" />
            <input value={f.why2} onChange={(e) => set('why2', e.target.value)} placeholder="السبب الثاني" dir="auto" />
            <input value={f.why3} onChange={(e) => set('why3', e.target.value)} placeholder="السبب الثالث" dir="auto" />
          </div>
          {f.provide === 'عدم توفير' && <InlineAlert kind="info" title="لا إغلاق تلقائي" style={{ marginTop: 12 }}>توصية الجهة استشارية؛ القرار النهائي لإدارة برنامج الحماية بالمركز بعد الدراسة والتقييم.</InlineAlert>}
        </div>
        )}
      </Sec>

      {/* ⑤ أنواع الحماية المقترحة */}
      <Sec n="٥" title="أنواع الحماية المقترحة" fed>
        <Multi value={(f.types || []).filter((t) => PROTECTION_TYPES.includes(t))} set={(v) => set('types', v)} options={PROTECTION_TYPES} />
        <p className="rf-sec-sub" style={{ marginTop: 8 }}>تُختار من بنود الحماية المعتمدة (المادة 14)؛ والقرار النهائي بأنواعها للمجلس.</p>
        <Field label="الحلول البديلة المقترحة (إن وجدت)"><textarea value={f.alternatives} onChange={(e) => set('alternatives', e.target.value)} dir="auto" /></Field>
      </Sec>

      {/* ⑥ مدة الحماية */}
      <Sec n="٦" title="مدة الحماية المقترحة" fed>
        <Choice value={f.duration} set={(v) => set('duration', v)} options={['30 يوماً', 'إلى حين انتهاء القضية', 'مدة أخرى']} />
        {f.duration === 'مدة أخرى' && <Field label="حدّد المدة" hint=""><input value={f.durationNote} onChange={(e) => set('durationNote', e.target.value)} dir="auto" style={{ maxWidth: 320 }} /></Field>}
      </Sec>

      {/* المرفقات — مستندات مسمّاة، لكل مستند حقل إرفاق (PDF) يُرفع عند وجوده */}
      <Sec n="" title="المستندات المطلوبة (مرفقات)" sub={linked ? 'PDF — صورة خطاب الجهة الوارد إلزامية سنداً للتدقيق؛ وأرفق ما ورد معه.' : 'PDF — لكل مستند حقل إرفاق مستقلّ؛ أرفق ما ينطبق (بعضها اختياري: التاريخ الجنائي/النفسي إن وُجد).'}>
        <div className="rf-attach-grid">
          {(linked
            ? ['صورة خطاب الجهة الوارد (التوصية)', 'بيانات القضية والإجراءات النظامية', 'تقرير تقييم المخاطر', 'معلومات أخرى للتهديد (وسائط، أوراق)', 'أي مسوّغات تدعم التوصية']
            : ['الهوية الوطنية لطالب الحماية والتابعين', 'بيانات القضية والإجراءات النظامية', 'تقرير تقييم المخاطر', 'تقرير طبي للحالة الصحية', 'التاريخ الجنائي (إن وجد)', 'التاريخ النفسي (إن وجد)', 'معلومات أخرى للتهديد (وسائط، أوراق)', 'أي مسوّغات تدعم الطلب', 'طلب الحماية المسبّب']
          ).map((d) => {
            const fn = (f.attachMap || {})[d];
            return (
              <label key={d} className="rf-attach" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="file" accept="application/pdf" style={{ display: 'none' }}
                  onChange={(e) => { const x = e.target.files && e.target.files[0]; if (x) set('attachMap', { ...(f.attachMap || {}), [d]: x.name }); e.target.value = ''; }} />
                <I name={fn ? 'check_circle' : 'upload_file'} size={16} color={fn ? 'var(--color-primary)' : 'var(--text-secondary)'} fill={!!fn} />
                <span>{d}{fn && <b style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', marginTop: 2 }}>{fn} ✓</b>}</span>
              </label>);
          })}
        </div>
      </Sec>

      {/* الاعتماد */}
      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--green-20)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="approval" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>{linked ? 'تسجيل التوصية الواردة' : 'الاعتماد ورفع الطلب'}</b></div>
        <div className="rf-grid2" style={{ marginBottom: 14 }}>
          <div className="rf-sign"><span className="muted">{ent.drafter} (المُحرِّر في الجهة)</span><b>{rec.letterBy || 'كما في الخطاب الوارد'}</b><Tag tone="info" size="sm">خطاب رسمي</Tag></div>
          <div className="rf-sign"><span className="muted">المُدخِل (موظف المركز)</span><b>أنت — نيابةً عن الجهة</b><Tag tone="warning" size="sm">يُسجَّل في التدقيق</Tag></div>
        </div>
        <label className="rf-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{linked ? 'أقرّ بأنّ التوصية فُرِّغت مطابقةً لخطاب الجهة الوارد وصورته مُرفقة، وتُدمج في سجلّ الطلب المُحال نفسه، ويُسجَّل إدخالي في التدقيق باسمي ووقته.' : 'أقرّ بأنّ البيانات أُدخلت مطابقةً للخطاب الوارد واكتمال المسوّغات، وأرفع الطلب ليأخذ مجراه في الفرز المبدئي.'}</span></label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-primary" disabled={!ack || (linked && !f.provide) || (!linked && !(f.attachMap || {})['الهوية الوطنية لطالب الحماية والتابعين'])} onClick={() => onApprove(f)}><I name="send" size={18} /> {linked ? 'تسجيل التوصية ودمجها في الطلب' : 'رفع الطلب'}</button>
        </div>
        {linked && !f.provide && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>حدّد توصية الجهة (توفير / عدم توفير) كما وردت في الخطاب.</p>}
      </Card>
    </div>
  );
}

// ── نموذج طالب الحماية الورقيّ (يطابق حقول بوابة الطالب) ──
function SeekerPaperForm({ onDone, onBack, meta, setMeta, metaOk, busy }) {
  const [s, setS] = useState({
    name: '', nid: '', phone: '', ecName: '', ecRel: '', ecPhone: '',
    role: '', category: '', priorSubmit: '', entity: '', repId: '', repName: '', repAge: '',
    crime: '', reason: '', caseNo: '', scanReq: false, scanId: false, extras: [], ackTrue: false,
    ivDate: todayISO(), ivNote: '',
    nat: '', dob: '', marital: '', cityIn: '', email: '', reqType: 'طلب جديد', prevRef: ''
  });
  const [ch, setCh] = useState(''); // legacy = الموقع القديم (نفاذ) · inperson = ورقيّ حضوري
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: (v && v.target) ? v.target.value : v }));
  const onBehalfRole = !!s.role && !s.role.startsWith('أصيل');
  const minor = onBehalfRole && s.repAge !== '' && Number(s.repAge) < 18;
  const repOk = !onBehalfRole || (s.repId.trim() && s.repName.trim() && s.repAge !== '');
  const ivOk = ch !== 'inperson' || (s.ivDate && s.ivNote.trim());
  const legacyOk = ch !== 'legacy' || (s.nat.trim() && s.cityIn.trim());
  const legacy = ch === 'legacy';
  const ready = ch && metaOk && ivOk && legacyOk && s.name.trim() && s.nid.trim().length === 10 && s.phone.trim() && s.role && s.category && s.priorSubmit && s.entity && s.crime.trim() && s.reason.trim() && repOk && s.ackTrue && !busy;

  return (
    <div className="rf">
      <div className="rf-top">
        <button className="link" onClick={onBack}><I name="arrow_forward" size={18} /> رجوع لاختيار المصدر</button>
        <div className="rf-top-main"><div><div className="rf-kicker">إدخال يدويّ · طالب الحماية</div><h2 className="rf-h">إدخال طلب طالب الحماية</h2></div></div>
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="sec-h"><I name="alt_route" size={19} /> قناة ورود الطلب <span className="rf-req">*</span></div>
        <div className="entseg">
          <button className={ch === 'legacy' ? 'on' : ''} onClick={() => setCh('legacy')}>الموقع القديم (تقديم عبر نفاذ)</button>
          <button className={ch === 'inperson' ? 'on' : ''} onClick={() => setCh('inperson')}>ورقيّ حضوري (نادر)</button>
        </div>
        {ch === 'legacy' && <div className="man" style={{ marginTop: 12, marginBottom: 0, background: 'var(--green-10)', borderColor: 'var(--green-20)', color: 'var(--color-primary)' }}><I name="verified_user" size={16} /> قدّم طالب الحماية طلبه بنفسه في صفحة الاستقبال القديمة بعد دخوله عبر نفاذ — الهوية موثّقة، وتُنسخ البيانات من الطلب المطبوع كما وردت.</div>}
        {ch === 'inperson' && <div className="man" style={{ marginTop: 12, marginBottom: 0 }}><I name="record_voice_over" size={16} /> تقديم ورقيّ حضوري — يوجب النظام واللائحة <b style={{ marginInline: 4 }}>مقابلة طالب الحماية</b> وتوثيق محضرها (القسم ٥ أدناه).</div>}
      </div>

      {ch && <PaperMeta meta={meta} setMeta={setMeta} ch={ch} />}

      {ch ? (<React.Fragment>
      <Sec n="١" title="بيانات مقدّم الطلب">
        {legacy
          ? <div className="man" style={{ background: 'var(--green-10)', borderColor: 'var(--green-20)', color: 'var(--color-primary)' }}><I name="verified_user" size={16} /> الهوية <b style={{ marginInline: 4 }}>موثّقة عبر نفاذ</b> (الموقع القديم) — انسخ البيانات من الطلب المطبوع كما وردت.</div>
          : <div className="man"><I name="gpp_maybe" size={16} /> تُدخَل يدوياً من الورق — <b style={{ marginInlineStart: 4 }}>غير موثّقة</b>؛ يُفعّل الشخص حسابه عبر نفاذ لاحقاً (لازمٌ للاتفاقية م11 والتظلّم م21).</div>}
        <div className="rf-grid2">
          <Field label="الاسم الكامل" req><input value={s.name} onChange={set('name')} dir="auto" placeholder="كما في الطلب الورقيّ" /></Field>
          <Field label="رقم الهوية / الإقامة" req><input value={s.nid} onChange={(e) => setS((x) => ({ ...x, nid: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="numeric" placeholder="١٠ أرقام" /></Field>
          <Field label="رقم الجوال" req><input value={s.phone} onChange={(e) => setS((x) => ({ ...x, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="tel" placeholder="05XXXXXXXX" /></Field>
          <Field label="صفة مقدّم الطلب" hint="(م7/1 · م5/1)" req><Choice value={s.role} set={set('role')} options={['أصيل (عن شخصه)', 'وليّ', 'وصيّ', 'وكيل', 'محامٍ']} /></Field>
          {onBehalfRole && <div style={{ gridColumn: '1 / -1' }}><div className="rf-divider"><I name="supervisor_account" size={16} color="var(--text-secondary)" /> بيانات طالب الحماية (المُقدَّم نيابةً عنه) — لائحة م5/1</div>
          <div className="rf-grid2">
            <Field label="رقم هوية الشخص" req><input value={s.repId} onChange={(e) => setS((x) => ({ ...x, repId: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="numeric" placeholder="١٠ أرقام" /></Field>
            <Field label="اسم الشخص" req><input value={s.repName} onChange={set('repName')} dir="auto" placeholder="الاسم الكامل" /></Field>
            <Field label="العمر" req><input type="number" value={s.repAge} onChange={set('repAge')} placeholder="بالسنوات" /></Field>
            {minor && <div className="man" style={{ gridColumn: '1 / -1', background: 'var(--warning-10)', borderColor: 'var(--warning-50)', color: 'var(--warning-70)' }}><I name="info" size={16} /> الشخص قاصر — يتطلّب ولياً/وصياً معتمداً.</div>}
          </div></div>}
          <Field label="دور مقدّم الطلب" hint="(م1 — فئات الحماية)" req><select value={s.category} onChange={set('category')}><option value="">— اختر —</option>{['مبلّغ', 'شاهد', 'خبير', 'ضحية'].map((o) => <option key={o}>{o}</option>)}</select></Field>
          {legacy && <React.Fragment>
            <div className="rf-divider" style={{ gridColumn: '1 / -1' }}><I name="content_copy" size={16} color="var(--text-secondary)" /> حقول نموذج الموقع القديم (تُنسخ كما في الطلب المطبوع)</div>
            <Field label="الجنسية" req><input value={s.nat} onChange={set('nat')} dir="auto" placeholder="كما في الطلب المطبوع" /></Field>
            <Field label="تاريخ الميلاد"><input value={s.dob} onChange={set('dob')} className="mono" placeholder="1418/01/01" dir="ltr" /></Field>
            <Field label="الحالة الاجتماعية"><input value={s.marital} onChange={set('marital')} dir="auto" placeholder="أعزب / متزوج …" /></Field>
            <Field label="المدينة" req hint="(عنوان الإقامة)"><input value={s.cityIn} onChange={set('cityIn')} dir="auto" placeholder="مثال: مكة المكرمة" /></Field>
            <Field label="البريد الإلكتروني" hint="(معلومات التواصل)"><input value={s.email} onChange={set('email')} className="mono" dir="ltr" placeholder="name@example.com" /></Field>
          </React.Fragment>}
        </div>
      </Sec>

      <Sec n="٢" title="جهة الاتصال في الحالات الطارئة" sub={legacy ? 'غير موجودة في نموذج الموقع القديم — اختيارية، تُستكمل عند تفعيل الحساب أو في التواصل مع طالب الحماية.' : undefined}>
        <div className="rf-grid2">
          <Field label="الاسم" req={!legacy}><input value={s.ecName} onChange={set('ecName')} dir="auto" placeholder="اسم جهة الاتصال" /></Field>
          <Field label="صلة القرابة"><input value={s.ecRel} onChange={set('ecRel')} dir="auto" placeholder="مثال: أخ / زوج" /></Field>
          <Field label="رقم الجوال" req={!legacy}><input value={s.ecPhone} onChange={(e) => setS((x) => ({ ...x, ecPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="tel" placeholder="05XXXXXXXX" /></Field>
        </div>
      </Sec>

      <Sec n="٣" title="القضية وأسباب الطلب">
        <Field label="نوع الجريمة محل الحماية" hint="(م1 — الجرائم الكبيرة)" req><textarea value={s.crime} onChange={set('crime')} dir="auto" placeholder="وصف موجز لطبيعة الجريمة المشمولة بالنظام…" /></Field>
        <Field label="سبب طلب الحماية ومسوّغاته" hint="(طلب مسبّب — م7/1)" req><textarea value={s.reason} onChange={set('reason')} dir="auto" placeholder="اذكر طبيعة الخطر والمسوّغات التي تستدعي توفير الحماية…" style={{ minHeight: 100 }} /></Field>
        <div className="rf-grid2">
          <Field label="هل سبق التقديم إلى الجهة المختصة؟" req><select value={s.priorSubmit} onChange={set('priorSubmit')}><option value="">— اختر —</option><option value="نعم">نعم</option><option value="لا">لا</option></select></Field>
          <Field label="اسم الجهة المختصة" hint="(م1/5 · جهة التحقيق أو المحاكمة)" req><select value={s.entity} onChange={set('entity')}><option value="">— اختر —</option>{ENTS.map(([, n]) => <option key={n}>{n}</option>)}</select></Field>
        </div>
        <Field label="رقم القضية" hint="(إن وجد)"><input value={s.caseNo} onChange={set('caseNo')} dir="auto" placeholder="مثال: 1447/…" /></Field>
      </Sec>

      <Sec n="٤" title="المرفقات" sub="المرفقات اختيارية — أضفها إن توفّرت تعزيزاً لسند التدقيق.">
        <div className="rf-attach-grid">
          <label className="rf-attach" style={{ cursor: 'pointer' }} onClick={() => setS((x) => ({ ...x, scanReq: !x.scanReq }))}>
            <I name={s.scanReq ? 'check_circle' : 'upload_file'} size={18} color={s.scanReq ? 'var(--color-primary)' : 'var(--text-secondary)'} fill={s.scanReq} />
            <span>{legacy ? (s.scanReq ? 'نسخة الطلب المطبوعة من الموقع القديم ✓' : 'نسخة الطلب المطبوعة من الموقع القديم (اختياري)') : (s.scanReq ? 'صورة الطلب الورقيّ ✓' : 'صورة الطلب الورقيّ (اختياري)')}</span>
          </label>
          {!legacy && <label className="rf-attach" style={{ cursor: 'pointer' }} onClick={() => setS((x) => ({ ...x, scanId: !x.scanId }))}>
            <I name={s.scanId ? 'check_circle' : 'badge'} size={18} color={s.scanId ? 'var(--color-primary)' : 'var(--text-secondary)'} fill={s.scanId} />
            <span>{s.scanId ? 'صورة الهوية / الإقامة ✓' : 'صورة الهوية / الإقامة (اختياري)'}</span>
          </label>}
          {s.extras.map((x, i) => <label key={i} className="rf-attach"><I name="check_circle" size={18} color="var(--color-primary)" fill /><span>{x} ✓</span><button className="link" style={{ marginInlineStart: 'auto', fontSize: 12 }} onClick={(e) => { e.preventDefault(); setS((st) => ({ ...st, extras: st.extras.filter((_, j) => j !== i) })); }}><I name="close" size={15} /></button></label>)}
        </div>
        <button className="link" style={{ marginTop: 10 }} onClick={() => { const n = window.prompt('اسم المرفق الإضافي (مثال: تقرير طبي · محضر بلاغ)'); if (n && n.trim()) setS((x) => ({ ...x, extras: [...x.extras, n.trim()] })); }}><I name="add" size={16} /> إضافة مرفق آخر</button>
      </Sec>

      {ch === 'inperson' && (
      <Sec n="٥" title="محضر مقابلة طالب الحماية" sub="يوجب النظام واللائحة مقابلة طالب الحماية عند التقديم الحضوري — المحضر إلزاميّ ويُسجّل في التدقيق ويظهر لموظف الفرز.">
        <div className="rf-grid2">
          <Field label="تاريخ المقابلة" req><input type="date" value={s.ivDate} max={todayISO()} onChange={set('ivDate')} /></Field>
          <Field label="الموظف المُقابِل"><div className="rf-locked"><span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>موظف الاستقبال والإدخال (أنت)</span><span className="rf-src"><I name="history" size={14} /> يُسجّل في التدقيق</span></div></Field>
        </div>
        <Field label="ملخص المقابلة" req hint="(ما تم التحقّق منه وجوهر ما ذكره طالب الحماية)"><textarea value={s.ivNote} onChange={set('ivNote')} dir="auto" placeholder="مثال: قوبل طالب الحماية حضورياً، وتُحُقّق من مطابقة هويته للمستند، وأفاد بـ…" style={{ minHeight: 90 }} /></Field>
      </Sec>
      )}

      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--green-20)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="fact_check" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>الإقرار والإحالة</b></div>
        <label className="rf-ack" style={{ marginBottom: 10 }}><input type="checkbox" checked={s.ackTrue} onChange={(e) => setS((x) => ({ ...x, ackTrue: e.target.checked }))} /><span>{legacy ? 'أقرّ بأنّ البيانات نُسخت مطابقةً للطلب المطبوع من الموقع القديم ونسخته مُرفقة، ويُسجل إدخالي في التدقيق باسمي ووقته.' : 'أقرّ بأنّ البيانات أُدخلت مطابقةً للطلب الورقيّ الوارد وصورته مُرفقة، ويُسجل إدخالي في التدقيق باسمي ووقته.'}</span></label>
        {legacy
          ? <div className="man" style={{ marginBottom: 0, background: 'var(--green-10)', borderColor: 'var(--green-20)', color: 'var(--color-primary)' }}><I name="verified_user" size={16} /> <span>استوفى طالب الحماية الموافقة على الشروط والأحكام عند تقديمه عبر نفاذ في الموقع القديم — وتبقى الاتفاقية (م11) والتظلّم (م21) عبر حسابه في المنصة.</span></div>
          : <div className="man" style={{ marginBottom: 0 }}><I name="verified_user" size={16} /> <span>تُستوفى موافقة مقدّم الطلب على الشروط والأحكام وسياسة الخصوصية <b>عند تفعيل حسابه عبر نفاذ</b> — وهي لازمة لاتفاقية الحماية (م11) والتظلّم (م21).</span></div>}
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={!ready} onClick={() => onDone('seeker', { ...s, onBehalf: onBehalfRole ? 'نعم' : 'لا', channel: ch })}><I name="send" size={18} /> تسجيل وإحالة للفرز المبدئي</button>
        </div>
        {!ready && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>{ch === 'inperson' ? 'أكمل القيد والحقول الإلزامية ومحضر المقابلة، وأقرّ لتفعيل الإحالة.' : 'أكمل القيد والحقول الإلزامية، وأقرّ لتفعيل الإحالة.'}</p>}
      </Card>
      </React.Fragment>) : null}
    </div>
  );
}

function Intake() {
  const [stage, setStage] = useState('select'); // select | seeker | entity | done
  const [entity, setEntity] = useState('prosecution');
  const [entMode, setEntMode] = useState('onbehalf');
  const [linkSel, setLinkSel] = useState(null);   // الطلب المُحال المختار (وضع التوصية)
  const [refList, setRefList] = useState(null);   // الطلبات المُحالة بانتظار توصية الجهة المختارة (null = يُحمَّل)
  const [meta, setMeta] = useState({ receivedDate: todayISO(), regNo: '' }); // قيد الورود الورقيّ
  const [letter, setLetter] = useState({ no: '', date: todayISO(), by: '' }); // الخطاب الرسمي الوارد بالبريد (مسار الجهات)
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const metaOk = !!(meta.receivedDate && meta.regNo.trim());
  const letterOk = !!(letter.no.trim() && letter.date);
  const entName = (ENTS.find(([k]) => k === entity) || ['', 'جهة مختصّة'])[1];

  // خطوة الربط الإلزامية: تُجلب الطلبات المُحالة للجهة المختارة من القاعدة (RPC).
  useEffect(() => {
    if (stage !== 'entity' || entMode !== 'rec') return;
    let alive = true;
    setRefList(null);
    listReferredForEntity(entity).then((res) => {
      if (!alive) return;
      if (!res.ok) { setErr(res.error || 'تعذّر جلب الطلبات المُحالة.'); setRefList([]); return; }
      setRefList(res.rows);
    });
    return () => { alive = false; };
  }, [stage, entMode, entity]);

  const resetAll = () => {
    setDone(null); setLinkSel(null); setRefList(null); setErr('');
    setMeta({ receivedDate: todayISO(), regNo: '' });
    setLetter({ no: '', date: todayISO(), by: '' });
    setStage('select');
  };

  const letterStamp = () => 'خطاب ' + letter.no + ' بتاريخ ' + fmtD(letter.date) + (letter.by ? ' · مُعِدّه: ' + letter.by : '');
  const regStamp = () => 'قيد إداري ' + meta.regNo + ' · ورد ورقياً ' + fmtD(meta.receivedDate);

  const finish = async (src, data) => {
    const d = data || {};
    const isRec = src === 'entity' && entMode === 'rec' && linkSel;
    setErr(''); setBusy(true);
    try {
      if (isRec) {
        // توصية ورقية مربوطة بطلبٍ مُحال قائم — تُدمج في سجلّه (لا سجلّ مكرّر).
        const durationDays = d.duration === '30 يوماً' ? 30 : null;
        const res = await submitPaperRecommendation({
          caseId: linkSel.caseId,
          provide: d.provide === 'توفير',
          factors9: {
            health: d.health || '', healthNote: d.healthNote || '',
            criminal: d.criminal || '', criminalNote: d.criminalNote || '',
            psychHistory: d.psychHistory || '', reveal: d.reveal || '',
            crimeType: d.crimeType || '', waqia: d.waqia || [], crimeDesc: d.crimeDesc || '', hidden2: d.hidden2 || '',
            threatExists: d.threatExists || '', threatType: d.threatType || '', riskLevel: d.riskLevel || '',
            harmExists: d.harmExists || '', harmType: d.harmType || '',
            extends: d.extends || '', extendsWho: d.extendsWho || '', adapt: d.adapt || '',
            caseSummary: d.caseSummary || '', caseStage: d.caseStage || '', applicantRoleDesc: d.applicantRole || '',
            contacted: d.contacted || '', contactKind: d.contactKind || '',
            reasons: [d.why1, d.why2, d.why3].filter(Boolean),
            alternatives: d.alternatives || '', duration: d.duration || '', durationNote: d.durationNote || '',
          },
          types: d.types || [],
          durationDays,
          notes: 'توصية ' + entName + ' الواردة بخطاب رسمي عبر البريد بشأن الطلب المُحال (' + letterStamp() + ' · ' + regStamp() + ').',
          receivedDate: meta.receivedDate,
          regNo: meta.regNo,
          letterNo: letter.no,
          letterDate: letter.date,
          letterBy: letter.by,
        });
        if (!res.ok) { setErr(res.error || 'تعذّر تسجيل التوصية.'); setBusy(false); window.scrollTo(0, 0); return; }
        setDone({ ref: linkSel.secret, src, linked: true, channel: null, regNo: meta.regNo, when: fmtD(meta.receivedDate), letter: { no: letter.no, date: fmtD(letter.date) } });
        setStage('done'); window.scrollTo(0, 0);
        return;
      }

      // مسار السجلّ الجديد (طالب الحماية / طلب نيابةً عن الشخص)
      const details = { paper_source: src, entity_mode: src === 'entity' ? entMode : undefined };
      details.channel = src === 'seeker' ? d.channel : 'mail';
      // الهوية المُدخَلة يدوياً (غير موثّقة في المنصة — تُفعّل عبر نفاذ لاحقاً)؛
      // قناة الموقع القديم موثّقة نفاذياً في المصدر وتُوسم بذلك.
      details.identity = src === 'entity'
        ? { name: d.obName || '', nid: d.obNid || '', phone: d.obPhone || '', gender: d.obGender || '',
            nationality: d.obNationality || '', marital: d.obMarital || '', residence: d.obResidence || '',
            employer: d.obEmployer || '', education: d.obEducation || '', verified: false }
        : { name: d.name || '', nid: d.nid || '', phone: d.phone || '', nationality: d.nat || '',
            dob: d.dob || '', marital: d.marital || '', email: d.email || '',
            source_verified: d.channel === 'legacy', verified: false };
      if (src === 'seeker') {
        details.city = d.cityIn || '';
        details.emergency_contact = { name: d.ecName || '', rel: d.ecRel || '', phone: d.ecPhone || '' };
        details.on_behalf = d.onBehalf === 'نعم' ? { nid: d.repId || '', name: d.repName || '', age: d.repAge || '' } : null;
        details.attachments = [
          ...(d.scanReq ? [d.channel === 'legacy' ? 'نسخة الطلب المطبوعة' : 'صورة الطلب الورقيّ'] : []),
          ...((d.channel !== 'legacy' && d.scanId) ? ['صورة الهوية / الإقامة'] : []),
          ...(d.extras || []),
        ];
        if (d.channel === 'inperson') details.interview = { date: d.ivDate, note: d.ivNote };
        details.assess = { caseStage: '' };
        details.applicant_kind = d.role || '';
      } else {
        details.letter = { no: letter.no, date: letter.date, by: letter.by };
        details.recommendation = d.provide || null; // توفير | عدم توفير (توصية الجهة الفعليّة)
        details.assess = {
          health: d.health || '', healthNote: d.healthNote || '',
          criminal: d.criminal || '', criminalNote: d.criminalNote || '',
          psychHistory: d.psychHistory || '', reveal: d.reveal || '',
          crimeType: d.crimeType || '', waqia: d.waqia || [], crimeDesc: d.crimeDesc || '', hidden2: d.hidden2 || '',
          threatExists: d.threatExists || '', threatType: d.threatType || '', riskLevel: d.riskLevel || '',
          harmExists: d.harmExists || '', harmType: d.harmType || '',
          extends: d.extends || '', extendsWho: d.extendsWho || '', adapt: d.adapt || '',
          caseSummary: d.caseSummary || '', caseStage: d.caseStage || '', applicantRoleDesc: d.applicantRole || '',
          contacted: d.contacted || '', contactKind: d.contactKind || '',
        };
        details.rec = {
          provide: d.provide || '', reasons: [d.why1, d.why2, d.why3].filter(Boolean),
          types: d.types || [], alternatives: d.alternatives || '',
          duration: d.duration || '', durationNote: d.durationNote || '',
        };
      }

      const res = await submitPaperIntake({
        source: src,
        applicantRole: src === 'entity' ? 'جهة مختصّة' : (d.role || ''),
        category: src === 'entity' ? (d.role || d.cat || 'شاهد') : (d.category || 'شاهد'),
        entity: src === 'entity' ? entName : (d.entity || ''),
        crime: src === 'entity' ? (d.crimeDesc || d.reasons || d.caseSummary || 'خطاب جهة (ورقيّ)') : (d.crime || ''),
        reason: src === 'entity' ? ([d.why1, d.why2, d.why3].filter(Boolean).join(' · ') || d.reasons || 'مسوّغات الخطاب الوارد') : (d.reason || ''),
        priorSubmit: src === 'entity' ? true : (d.priorSubmit === 'نعم'),
        caseNo: d.caseNo || '',
        receivedDate: meta.receivedDate,
        regNo: meta.regNo,
        details,
      });
      if (!res.ok) { setErr(res.error || 'تعذّر تسجيل الطلب.'); setBusy(false); window.scrollTo(0, 0); return; }
      setDone({
        ref: res.secret, src, linked: false,
        channel: src === 'seeker' ? d.channel : 'mail',
        atts: src === 'seeker' ? ((details.attachments || []).length) : 0,
        regNo: meta.regNo, when: fmtD(meta.receivedDate),
        letter: src === 'entity' ? { no: letter.no, date: fmtD(letter.date) } : null,
      });
      setStage('done');
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    } catch (e) {
      setErr(String(e && e.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'done') {
    return (<div className="pi-wrap"><div className="card done-card">
      <div className="done-ico"><I name="task_alt" size={32} color="var(--color-primary)" fill /></div>
      <h1 style={{ marginBottom: 8 }}>{done.linked ? 'سُجلت التوصية ودُمجت في صفّ الطلب المُحال القائم' : 'سُجِّل الطلب وأُحيل للفرز المبدئي'}</h1>
      <p className="sub" style={{ marginBottom: 0 }}>الرمز <span className="mono">{done.ref}</span>{done.linked ? <> — رُبطت التوصية بالطلب المُحال نفسه، فصار «وردت التوصية» في الفرز المبدئي — لا سجلّ مكرّر.</> : <> — ظهر الآن في «الطلبات الواردة» بالفرز المبدئي، ويسلك مساره كأيّ طلب.</>}</p>
      <div className="flags">
        <div className="flag"><I name="description" size={17} /> قناة الورود: <b>{done.channel === 'legacy' ? 'الموقع القديم (نفاذ) — طُبع وأُدخل يدوياً' : done.channel === 'inperson' ? 'ورقيّ حضوري — مُدخَل يدوياً' : 'بريد رسمي — مُدخَل يدوياً'}</b></div>
        <div className="flag"><I name="tag" size={17} /> {done.channel === 'legacy' ? 'مرجع الموقع القديم:' : 'قيد الورود:'} <b className="mono" style={{ marginInline: 4 }}>{done.regNo}</b> · {done.channel === 'legacy' ? 'قُدّم' : 'ورد'} <b style={{ marginInline: 4 }}>{done.when}</b> — منه تُحسب المُهل (م10)</div>
        {done.letter && <div className="flag"><I name="mail" size={17} /> الخطاب الرسمي: <b className="mono" style={{ marginInline: 4 }}>{done.letter.no}</b> · بتاريخ <b style={{ marginInline: 4 }}>{done.letter.date}</b> — وارد بالبريد</div>}
        {(done.linked || done.channel === 'legacy') && <div className="flag"><I name="verified_user" size={17} /> الهوية: <b>{done.linked ? 'موثّقة — موروثة من الطلب المُحال القائم' : 'موثّقة — دخول عبر نفاذ في الموقع القديم'}</b></div>}
        {!(done.linked || done.channel === 'legacy') && <div className="flag"><I name="gpp_maybe" size={17} color="var(--pp-bronze-ink)" /> الهوية: <b style={{ color: 'var(--pp-bronze-ink)' }}>غير موثّقة — تُفعَّل عبر نفاذ لاحقاً</b></div>}
        <div className="flag"><I name="attach_file" size={17} /> المرفقات: <b>{done.src === 'entity' ? 'صورة الخطاب ومرفقاته' : (done.atts ? done.atts + ' مرفق (اختياري)' : 'بلا مرفقات — اختيارية')}</b></div>
        <div className="flag"><I name="history" size={17} /> مُسجَّل في التدقيق: <b>موظف الاستقبال · الآن</b></div>
        {done.channel === 'inperson' && <div className="flag"><I name="record_voice_over" size={17} /> مقابلة طالب الحماية: <b>موثّقة بمحضر — يوجبها النظام</b></div>}
        <div className="flag"><I name={done.src === 'entity' ? 'gavel' : 'person'} size={17} /> المصدر: <b>{done.src === 'entity' ? (done.linked ? 'جهة مختصّة — توصية على طلبٍ مُحال' : 'جهة مختصّة — طلب نيابةً عن الشخص') : (done.channel === 'legacy' ? 'طالب الحماية — عبر الموقع القديم' : 'طالب الحماية — ورقيّ حضوري')}</b></div>
      </div>
      <div className="man" style={{ maxWidth: 620, margin: '18px auto 0', textAlign: 'start', background: 'var(--green-10)', borderColor: 'var(--green-20)', color: 'var(--color-primary)' }}>
        <I name="conversion_path" size={16} />
        <span>{done.linked
          ? <>يستأنف الطلب دورة حياته من حيث توقّف: <b>وردت التوصية ← قرار الفرز ← الدراسة والتقييم ← قرار المجلس ← الإشعار</b>.</>
          : <>بعد التفريغ يسلك الطلب دورة الحياة كاملةً كأيّ طلب رقمي: <b>الفرز المبدئي ← الدراسة والتقييم ← قرار المجلس ← الإشعار والاتفاقية ← التنفيذ والتجديد</b> — وتُستكمل كل الإجراءات داخل المنصة.</>}</span>
      </div>
      <div style={{ marginTop: 22 }}><button className="btn btn-primary" onClick={resetAll}><I name="add" size={19} /> إدخال طلب آخر</button></div>
    </div></div>);
  }

  if (stage === 'seeker') {
    return (<div className="pi-wrap">{err && <InlineAlert kind="error" title="تعذّر التسجيل" style={{ marginBottom: 14 }}>{err}</InlineAlert>}<SeekerPaperForm onDone={finish} onBack={() => setStage('select')} meta={meta} setMeta={setMeta} metaOk={metaOk} busy={busy} /></div>);
  }

  if (stage === 'entity') {
    const isRec = entMode === 'rec';
    const rows = refList || [];
    return (<div className="pi-wrap">
      <button className="link" onClick={() => setStage('select')} style={{ marginBottom: 12 }}><I name="arrow_forward" size={18} /> رجوع لاختيار المصدر</button>
      <div className="paperbar"><I name="mail" size={17} /><span>{isRec ? <><b>خطاب توصية وارد بالبريد على طلبٍ مُحال.</b> بعض الجهات ترسل حتى الآن بالبريد الرسمي (لا ربط تقنيّ بعد). الربط بطلبٍ قائم <b>إلزاميّ</b>: تُورث هويته الموثّقة من الطلب القائم ولا تُدخل يدوياً، والجهة صاحبة محتوى التوصية. تُرفق صورة الخطاب ويُسجل الإدخال في التدقيق.</> : <><b>خطاب رسمي وارد بالبريد — نموذج التوصية نفسه.</b> بعض الجهات ترسل حتى الآن بالبريد الرسمي (لا ربط تقنيّ بعد، والمنصة لم تُطلق رسمياً)؛ المُدخِل موظف المركز نيابةً عن الجهة؛ الهوية تُدخَل يدوياً (غير موثّقة)، وتُرفق صورة الخطاب ومرفقاته ضمن المرفقات (<b>طلب الحماية المسبّب + الهوية</b> إلزاميّان). يُسجَّل الإدخال في التدقيق.</>}</span></div>
      <PaperMeta meta={meta} setMeta={setMeta} />
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="sec-h"><I name="alt_route" size={19} /> نوع الوارد الورقيّ من الجهة</div>
        <div className="entseg" style={{ marginBottom: 14 }}>
          <button className={entMode === 'onbehalf' ? 'on' : ''} onClick={() => { setEntMode('onbehalf'); setLinkSel(null); }}>طلب نيابةً عن الشخص</button>
          <button className={entMode === 'rec' ? 'on' : ''} onClick={() => { setEntMode('rec'); setLinkSel(null); }}>توصية على طلبٍ مُحال</button>
        </div>
        <div className="sec-h"><I name="account_balance" size={19} /> الجهة المُرسِلة (بالبريد الرسمي)</div>
        <div className="entseg">{ENTS.map(([k, n]) => <button key={k} className={entity === k ? 'on' : ''} onClick={() => { setEntity(k); setLinkSel(null); }}>{n}</button>)}</div>
        <div className="rf" style={{ maxWidth: 'none', marginTop: 16 }}>
          <div className="rf-divider" style={{ borderTop: '1px dashed var(--border-default)', margin: '0 0 14px', paddingTop: 14 }}><I name="mail" size={16} color="var(--text-secondary)" /> بيانات الخطاب الرسمي الوارد</div>
          <div className="rf-grid2">
            <Field label="رقم خطاب الجهة" req hint="(الوارد بالبريد الرسمي)"><input className="mono" dir="ltr" value={letter.no} onChange={(e) => setLetter({ ...letter, no: e.target.value })} placeholder="مثال: 447/12345" /></Field>
            <Field label="تاريخ الخطاب" req><input type="date" value={letter.date} max={todayISO()} onChange={(e) => setLetter({ ...letter, date: e.target.value })} /></Field>
            <Field label="مُعِدّ التوصية في الجهة" hint="(الاسم والصفة كما في الخطاب — اختياري)"><input value={letter.by} onChange={(e) => setLetter({ ...letter, by: e.target.value })} dir="auto" placeholder="كما ورد في الخطاب" /></Field>
          </div>
        </div>
      </div>
      {isRec && (
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="sec-h"><I name="link" size={19} /> ربط التوصية بالطلب المُحال <span className="rf-req">*</span></div>
          <p className="muted" style={{ margin: '0 0 12px' }}>اختر الطلب المُحال إلى {entName} الذي تخصّه التوصية الورقية — تُورث بياناته الموثّقة من الطلب القائم.</p>
          {refList === null ? (
            <p className="muted" style={{ margin: 0 }}>يُحمَّل من القاعدة…</p>
          ) : rows.length ? (
            <div className="lnk">
              {rows.map((r) => {
                const on = linkSel && linkSel.caseId === r.caseId;
                const elapsed = bizDaysSince(String(r.referredAt).slice(0, 10));
                const left = 5 - elapsed;
                return (
                  <button key={r.caseId} className={'lnk-row' + (on ? ' on' : '')} onClick={() => setLinkSel({ ...r, elapsed })}>
                    <I name={on ? 'radio_button_checked' : 'radio_button_unchecked'} size={20} color={on ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                    <div className="lnk-main">
                      <div><span className="mono" style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.secret}</span> · {r.cat}{(r.city || REGIONS[r.region]) ? ' · ' + (r.city || REGIONS[r.region]) : ''}</div>
                      <div className="muted" style={{ marginTop: 2 }}>أُحيل في {fmtD(r.referredAt)}{r.caseNo ? ' · قضية ' + r.caseNo : ''}</div>
                    </div>
                    <div className="lnk-meta">
                      <span className={'lnk-due' + (left <= 0 ? ' over' : '')}>{left <= 0 ? 'المهلة متجاوزة' : 'متبقٍّ ' + left + ' أيام عمل'}</span>
                      <span>مهلة التوصية 5 أيام عمل</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <InlineAlert kind="warning" title="لا طلبات مُحالة إلى هذه الجهة بانتظار توصية">لا تُدخل توصية دون طلبٍ مُحال قائم — راجع الجهة المختارة أو حوّل المستند لمسار «طلب نيابةً عن الشخص».</InlineAlert>
          )}
          <div className="man" style={{ marginTop: 12, marginBottom: 0 }}><I name="help" size={16} /><span>لا يوجد طلب مُحال مطابق للمستند؟ <button className="link" style={{ fontSize: 12 }} onClick={() => { setEntMode('onbehalf'); setLinkSel(null); }}>حوّله إلى «طلب نيابةً عن الشخص»</button> — أو أعد المستند للجهة لتصحيح مرجع الإحالة (يُسجل في التدقيق).</span></div>
        </div>
      )}
      {!(metaOk && letterOk) && (
        <InlineAlert kind="warning" title="أكمل قيد الورود وبيانات الخطاب" style={{ marginBottom: 14 }}>تاريخ الورود ورقم القيد الإداري ورقم خطاب الجهة وتاريخه إلزامية قبل التسجيل والإحالة — والنموذج أدناه متاح للتفريغ. من تاريخ الورود تُحسب المُهل النظامية (م10).</InlineAlert>
      )}
      {err && <InlineAlert kind="error" title="تعذّر التسجيل" style={{ marginBottom: 14 }}>{err}</InlineAlert>}
      {(isRec && !linkSel) ? (
        <InlineAlert kind="info" title="اختر الطلب المُحال أولاً">يُفتح نموذج التوصية بعد ربطها بطلبٍ مُحال قائم.</InlineAlert>
      ) : (
        <RecommendationForm key={entity + entMode + (linkSel ? linkSel.caseId : '')} rec={{ entity, linked: isRec, letterBy: letter.by, secret: isRec ? linkSel.secret : '—', cat: isRec ? linkSel.cat : '', caseNo: isRec ? linkSel.caseNo : '', days: isRec ? Math.max(1, linkSel.elapsed) : Math.max(1, bizDaysSince(meta.receivedDate)) }} onApprove={(f) => { if (!(metaOk && letterOk)) { window.scrollTo(0, 0); return; } if (!busy) finish('entity', f); }} onBack={() => setStage('select')} />
      )}
    </div>);
  }

  return (<div className="pi-wrap">
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <button title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}><I name="logout" size={17} /> تسجيل الخروج</button>
    </div>
    <div className="rm"><I name="schedule" size={18} /><span><b>وحدةٌ مؤقّتة لفترة التحوّل الرقميّ.</b> تُدخِل الطلبات الواردة ورقياً حتى يكتمل التقديم الرقميّ عبر البوابات — ومصمَّمةٌ لتُستغنى عنها لاحقاً بحذف هذه الوحدة وحدها دون أثرٍ على بقية النظام.</span></div>
    <div className="kick">بوابة موظف المركز · الإدخال اليدوي للطلبات</div>
    <h1>إدخال طلبٍ ورقيّ</h1>
    <p className="sub">اختر مصدر الطلب الورقيّ الوارد. تُدخَل الحقول نفسها المعتمدة في البوابة الرقمية، فلا يضيع شيء عند الرقمنة.</p>
    <div className="pick">
      <button className="pick-card" onClick={() => setStage('seeker')}>
        <div className="pick-ico" style={{ background: 'var(--green-10)' }}><I name="person" size={24} color="var(--color-primary)" fill /></div>
        <h3>من طالب الحماية</h3>
        <p>من الموقع القديم (تقديم عبر نفاذ — يُطبع ويُدخل يدوياً) أو ورقيّ حضوري نادر بمحضر مقابلة — بحقول النموذج كاملةً.</p>
      </button>
      <button className="pick-card" onClick={() => setStage('entity')}>
        <div className="pick-ico" style={{ background: 'var(--pp-bronze-soft)' }}><I name="gavel" size={24} color="var(--pp-bronze-ink)" fill /></div>
        <h3>من جهة مختصّة</h3>
        <p>خطاب رسمي وارد بالبريد (لا ربط تقنيّ بعد) — توصية على طلبٍ مُحال أو طلب نيابةً عن الشخص، بنموذج التوصية الكامل نفسه.</p>
      </button>
    </div>
  </div>);
}

export function PaperIntakePortal() {
  return <Intake />;
}
