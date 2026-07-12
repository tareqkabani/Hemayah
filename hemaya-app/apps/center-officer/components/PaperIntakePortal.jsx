"use client";
/* ============================================================
   الاستقبال الورقيّ — منقول من «الاستقبال الورقيّ/البوابة.html».
   وحدة مؤقّتة: إدخال يدويّ للطلبات الورقية (طالب/جهة) وإحالتها للفرز.
   نموذج التوصية (مسار الجهة) عنصرٌ نائبٌ يُربط عند نقل بوابة الجهات المختصة.
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";
import { submitPaperIntake } from "@/lib/paper-intake-actions";
import "./paper-intake.css";

const PaperIntake = undefined; // مخزن البروتوتايب؛ يُستبدَل بـ Supabase لاحقاً (الكود يحرسه).
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

const ENTS = [['prosecution', 'النيابة العامة'], ['moi', 'وزارة الداخلية'], ['moj', 'وزارة العدل'], ['state_security', 'أمن الدولة'], ['nazaha', 'نزاهة']];

// سجلّ الجهات المختصة — مسمّى المُحرّر والمعتمِد يُشتقّ من الجهة
const ENTITIES = {
  prosecution:    { name: 'النيابة العامة',  drafter: 'محقق القضية',     approver: 'رئيس النيابة المتخصصة' },
  moi:            { name: 'وزارة الداخلية',  drafter: 'الضابط المختص',    approver: 'مدير الإدارة المختصة' },
  moj:            { name: 'وزارة العدل',     drafter: 'الباحث المختص',    approver: 'رئيس المحكمة / مدير الإدارة المختصة' },
  state_security: { name: 'أمن الدولة',      drafter: 'الضابط المختص',    approver: 'مدير الإدارة المختصة' },
  nazaha:         { name: 'نزاهة',           drafter: 'المحقق المختص',    approver: 'مدير الإدارة المختصة' },
};
const WAQIA = ['الاعتداء على الأشخاص', 'الآداب العامة', 'الأموال', 'المخدرات', 'الجرائم الاقتصادية', 'الماسة بالثقة العامة', 'الأسرة والأحداث', 'الاتجار بالأشخاص', 'الجرائم المعلوماتية', 'الأمن الوطني'];
// أنواع الحماية الـ(13) المنصوص عليها في المادة الرابعة عشرة
const PROTECTION_TYPES = [
  'الحماية الأمنية', 'إخفاء البيانات الشخصية', 'النقل من العمل (مؤقّت/دائم)', 'إيجاد عمل بديل',
  'الإرشاد القانوني/النفسي/الاجتماعي', 'توفير وسائل الإبلاغ الفوري', 'تغيير أرقام الاتصال',
  'تغيير محل الإقامة', 'المرافقة الأمنية', 'الإدلاء بوسائط إلكترونية (تغيير الصوت وإخفاء الوجه)',
  'حماية المسكن', 'المساعدة المالية', 'أخرى (ما تراه الإدارة مناسباً)',
];

// نموذج التوصية الكامل — منقول حرفياً من «بوابة الجهات المختصة/lib-recommendation-form.jsx».
// window.PlatformsCodeDesignSystem/HP → @hemaya/ui. يخدم مسار «من جهة مختصّة» في الاستقبال الورقيّ.
function RecommendationForm({ rec, onApprove, onBack }) {
  const linked = rec.linked !== false; // مرتبط بطلب طالب حماية (مسار ١)
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution; // الجهة المختصة ومسمّياتها
  const [f, setF] = useState({
    // قسم ١ — الهوية تُدخَل يدوياً من الطلب الورقيّ (لا وراثة من نفاذ في الاستقبال الورقيّ)
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
        استقبالٌ ورقيّ: تُدخَل بيانات مقدّم الطلب (الهوية والعنوان والعمل) <b>يدوياً</b> من الطلب الورقيّ وتُرفق صورته — <b>غير موثّقة</b> بعد، وتُفعَّل عبر نفاذ حين يدخل الشخص بحسابه لاحقاً (لازمٌ للاتفاقية م11 والتظلّم م21). ثمّ تُكمِل الجهة القضية والتقييم والمسوّغات.
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
        {noId ? (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات غير موثّقة — بانتظار التحقّق</b></div>
            <p className="muted" style={{ margin: '0 0 12px' }}>الشخص لا يملك هوية أو إقامة أو جواز (حالة مخالفي نظام الإقامة). تُدخل البيانات يدوياً وتُوسم للتحقّق اللاحق.</p>
            <InlineAlert kind="warning" title="نقطة معلّقة">آلية التحقّق لهذه الحالة <b>قيد النقاش مع الجهات المختصة</b>؛ تُعامل مؤقتاً كبيانات غير مؤكّدة.</InlineAlert>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setNoId(false)}><I name="arrow_forward" size={16} /> عودة إلى الإدخال بالهوية</button>
          </div>
        ) : (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات تُدخَل يدوياً من الطلب الورقيّ — غير موثّقة بعد</b></div>
            <p className="muted" style={{ margin: '0 0 12px' }}>يُدخل موظف المركز بيانات الشخص من الطلب الورقيّ وترفق صورة هويته وكل المتطلبات؛ ويأخذ الطلب مجراه فوراً. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ ويُفعّل الطلب.</p>
            <div className="rf-grid2">
              <Field label="الاسم الرباعي" req><input value={f.obName} onChange={(e) => set('obName', e.target.value)} dir="auto" placeholder="كما في الطلب الورقيّ" /></Field>
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
      <Sec n="" title="المستندات المطلوبة (مرفقات)" sub="PDF — لكل مستند حقل إرفاق مستقلّ؛ أرفق ما ينطبق (بعضها اختياري: التاريخ الجنائي/النفسي إن وُجد).">
        <div className="rf-attach-grid">
          {['الهوية الوطنية لطالب الحماية والتابعين', 'بيانات القضية والإجراءات النظامية', 'تقرير تقييم المخاطر', 'تقرير طبي للحالة الصحية', 'التاريخ الجنائي (إن وجد)', 'التاريخ النفسي (إن وجد)', 'معلومات أخرى للتهديد (وسائط، أوراق)', 'أي مسوّغات تدعم الطلب', 'طلب الحماية المسبّب'].map((d) => {
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

      {/* الاعتماد المزدوج */}
      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--green-20)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="approval" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>{linked ? 'الاعتماد ورفع التوصية' : 'الاعتماد ورفع الطلب'}</b></div>
        <div className="rf-grid2" style={{ marginBottom: 14 }}>
          <div className="rf-sign"><span className="muted">{ent.drafter} (المُحرِّر)</span><b>أنت</b><Tag tone="info" size="sm">مسوّدة</Tag></div>
          <div className="rf-sign"><span className="muted">الرئيس المباشر (المعتمِد)</span><b>يعتمد قبل الرفع</b><Tag tone="warning" size="sm">بانتظار الاعتماد</Tag></div>
        </div>
        <label className="rf-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{linked ? 'أقرّ بصحة البيانات واكتمال المسوّغات، وأرفع التوصية لاعتماد الرئيس المباشر تمهيداً لإرسالها للمركز خلال المهلة النظامية.' : 'أقرّ بصحة البيانات واكتمال المسوّغات، وأرفع الطلب لاعتماد الرئيس المباشر تمهيداً لإرساله للمركز.'}</span></label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-ghost"><I name="save" size={18} /> حفظ كمسوّدة</button>
          <button className="btn btn-primary" disabled={!ack || (!linked && !(f.attachMap || {})['الهوية الوطنية لطالب الحماية والتابعين'])} onClick={() => onApprove(f)}><I name="send" size={18} /> {linked ? 'رفع للاعتماد' : 'رفع الطلب'}</button>
        </div>
      </Card>
    </div>
  );
}

function SeekerPaperForm({ onDone, onBack }) {
  const [s, setS] = useState({
    name: '', nid: '', phone: '', ecName: '', ecRel: '', ecPhone: '',
    role: '', category: '', priorSubmit: '', entity: '', onBehalf: 'لا', repId: '', repName: '', repAge: '',
    crime: '', reason: '', caseNo: '', scan: false, ackTrue: false, ackTerms: false
  });
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: (v && v.target) ? v.target.value : v }));
  const minor = s.onBehalf === 'نعم' && s.repAge !== '' && Number(s.repAge) < 18;
  const repOk = s.onBehalf === 'لا' || (s.repId.trim() && s.repName.trim() && s.repAge !== '');
  const ready = s.name.trim() && s.nid.trim().length === 10 && s.phone.trim() && s.role && s.category && s.priorSubmit && s.entity && s.crime.trim() && s.reason.trim() && repOk && s.scan && s.ackTrue && s.ackTerms;

  return (
    <div className="rf">
      <div className="rf-top">
        <button className="link" onClick={onBack}><I name="arrow_forward" size={18} /> رجوع لاختيار المصدر</button>
        <div className="rf-top-main"><div><div className="rf-kicker">استقبال ورقيّ · طالب الحماية</div><h2 className="rf-h">إدخال طلب طالب الحماية</h2></div></div>
      </div>
      <Sec n="١" title="بيانات مقدّم الطلب">
        <div className="man"><I name="gpp_maybe" size={16} /> تُدخَل يدوياً من الورق — <b style={{ marginInlineStart: 4 }}>غير موثّقة</b>؛ يُفعّل الشخص حسابه عبر نفاذ لاحقاً (لازمٌ للاتفاقية م11 والتظلّم م21).</div>
        <div className="rf-grid2">
          <Field label="الاسم الكامل" req><input value={s.name} onChange={set('name')} dir="auto" placeholder="كما في الطلب الورقيّ" /></Field>
          <Field label="رقم الهوية / الإقامة" req><input value={s.nid} onChange={(e) => setS((x) => ({ ...x, nid: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="numeric" placeholder="١٠ أرقام" /></Field>
          <Field label="رقم الجوال" req><input value={s.phone} onChange={(e) => setS((x) => ({ ...x, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="tel" placeholder="05XXXXXXXX" /></Field>
          <Field label="صفة مقدّم الطلب" hint="(م7/1 · م5/1)" req><select value={s.role} onChange={set('role')}><option value="">— اختر —</option><option>أصيل (المشمول)</option><option>وليّ</option><option>وصيّ</option><option>وكيل</option><option>محامٍ</option></select></Field>
          <Field label="دور مقدّم الطلب" hint="(م1 — فئات الحماية)" req><select value={s.category} onChange={set('category')}><option value="">— اختر —</option><option>شاهد</option><option>مبلّغ</option><option>خبير</option><option>ضحية</option></select></Field>
        </div>
      </Sec>
      <Sec n="٢" title="جهة الاتصال في الحالات الطارئة">
        <div className="rf-grid2">
          <Field label="الاسم" req><input value={s.ecName} onChange={set('ecName')} dir="auto" placeholder="اسم جهة الاتصال" /></Field>
          <Field label="صلة القرابة"><input value={s.ecRel} onChange={set('ecRel')} dir="auto" placeholder="مثال: أخ / زوج" /></Field>
          <Field label="رقم الجوال" req><input value={s.ecPhone} onChange={(e) => setS((x) => ({ ...x, ecPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="tel" placeholder="05XXXXXXXX" /></Field>
        </div>
      </Sec>
      <Sec n="٣" title="نيابةً عن الشخص (اختياري)" sub="إن كان الطلب مقدَّماً نيابةً عن شخصٍ آخر (قاصر أو غير قادر).">
        <Field label="تقديم نيابةً عن الشخص؟" req><Choice value={s.onBehalf} set={set('onBehalf')} options={['لا', 'نعم']} /></Field>
        {s.onBehalf === 'نعم' && (
          <div className="rf-grid2">
            <Field label="رقم هوية الشخص" req><input value={s.repId} onChange={(e) => setS((x) => ({ ...x, repId: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="mono" inputMode="numeric" placeholder="١٠ أرقام" /></Field>
            <Field label="اسم الشخص" req><input value={s.repName} onChange={set('repName')} dir="auto" placeholder="الاسم الكامل" /></Field>
            <Field label="العمر" req><input type="number" value={s.repAge} onChange={set('repAge')} placeholder="بالسنوات" /></Field>
            {minor && <div className="man" style={{ gridColumn: '1 / -1', background: 'var(--warning-10)', borderColor: 'var(--warning-50)', color: 'var(--warning-70)' }}><I name="info" size={16} /> الشخص قاصر — يتطلّب ولياً/وصياً معتمداً.</div>}
          </div>
        )}
      </Sec>
      <Sec n="٤" title="القضية وأسباب الطلب">
        <Field label="نوع الجريمة محل الحماية" hint="(م1 — الجرائم الكبيرة)" req><textarea value={s.crime} onChange={set('crime')} dir="auto" placeholder="وصف موجز لطبيعة الجريمة المشمولة بالنظام…" /></Field>
        <Field label="سبب طلب الحماية ومسوّغاته" hint="(طلب مسبّب — م7/1)" req><textarea value={s.reason} onChange={set('reason')} dir="auto" placeholder="اذكر طبيعة الخطر والمسوّغات التي تستدعي توفير الحماية…" style={{ minHeight: 100 }} /></Field>
        <div className="rf-grid2">
          <Field label="هل سبق التقديم إلى الجهة المختصة؟" req><select value={s.priorSubmit} onChange={set('priorSubmit')}><option value="">— اختر —</option><option value="نعم">نعم</option><option value="لا">لا</option></select></Field>
          <Field label="اسم الجهة المختصة" hint="(م1/5 · جهة التحقيق أو المحاكمة)" req><select value={s.entity} onChange={set('entity')}><option value="">— اختر —</option><option>النيابة العامة</option><option>رئاسة أمن الدولة</option><option>وزارة الداخلية</option><option>هيئة الرقابة ومكافحة الفساد</option><option>وزارة العدل</option></select></Field>
        </div>
        <Field label="رقم القضية" hint="(إن وجد)"><input value={s.caseNo} onChange={set('caseNo')} dir="auto" placeholder="مثال: 1447/…" /></Field>
      </Sec>
      <Sec n="٥" title="إرفاق المستند الورقيّ">
        <label className="rf-attach" style={{ cursor: 'pointer' }} onClick={() => setS((x) => ({ ...x, scan: !x.scan }))}>
          <I name={s.scan ? 'check_circle' : 'upload_file'} size={18} color={s.scan ? 'var(--color-primary)' : 'var(--text-secondary)'} fill={s.scan} />
          <span>{s.scan ? 'أُرفقت صورة الطلب الورقيّ والهوية ✓' : 'إرفاق صورة الطلب الورقيّ + الهوية (إلزاميّ — سند التدقيق)'}</span>
        </label>
      </Sec>
      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--green-20)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="fact_check" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>الإقرار والإحالة</b></div>
        <label className="rf-ack" style={{ marginBottom: 10 }}><input type="checkbox" checked={s.ackTrue} onChange={(e) => setS((x) => ({ ...x, ackTrue: e.target.checked }))} /><span>أقرّ بأنّ البيانات أُدخلت مطابقةً للطلب الورقيّ الوارد وصورته مُرفقة، ويُسجَّل إدخالي في التدقيق باسمي ووقته.</span></label>
        <label className="rf-ack"><input type="checkbox" checked={s.ackTerms} onChange={(e) => setS((x) => ({ ...x, ackTerms: e.target.checked }))} /><span>يوافق مقدّم الطلب (بحسب طلبه الورقيّ) على الشروط والأحكام وسياسة الخصوصية.</span></label>
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={!ready} onClick={() => onDone('seeker', s)}><I name="send" size={18} /> تسجيل وإحالة للفرز المبدئي</button>
        </div>
        {!ready && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>أكمل الحقول الإلزامية، وأرفق المستند، وأقرّ لتفعيل الإحالة.</p>}
      </Card>
    </div>
  );
}

function Intake() {
  const [stage, setStage] = useState('select');
  const [entity, setEntity] = useState('prosecution');
  const [entMode, setEntMode] = useState('onbehalf');
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // لا رمز مُلفّق قبل الحفظ — يُخصَّص الرمز الحقيقيّ من القاعدة عند الإرسال (res.secret).
  const draftSecret = '—';
  const entName = (ENTS.find(([k]) => k === entity) || [, ''])[1];
  const finish = async (src, data) => {
    const d = data || {};
    setErr(''); setBusy(true);
    // التفاصيل المهيكلة الكاملة — تُخزَّن في protection_requests.details وتُعرض للدارس/المقيّم.
    // مسار الجهة (نموذج التوصية) يحمل التقييم الكامل؛ مسار الطالب يحمل المتاح منه.
    const details = { paper_source: src, entity_mode: src === 'entity' ? entMode : undefined };
    // الهوية المُدخَلة يدوياً من الطلب الورقيّ (غير موثّقة — تُفعّل عبر نفاذ لاحقاً).
    details.identity = src === 'entity'
      ? { name: d.obName || '', nid: d.obNid || '', phone: d.obPhone || '', gender: d.obGender || '',
          nationality: d.obNationality || '', marital: d.obMarital || '', residence: d.obResidence || '',
          employer: d.obEmployer || '', education: d.obEducation || '', verified: false }
      : { name: d.name || '', nid: d.nid || '', phone: d.phone || '', verified: false };
    if (src === 'entity') {
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
    } else {
      details.assess = { caseStage: d.caseStage || '' };
    }
    try {
      const res = await submitPaperIntake({
        source: src,
        applicantRole: src === 'entity' ? 'جهة مختصّة' : (d.role || ''),
        category: src === 'entity' ? (d.role || d.cat || 'شاهد') : (d.category || 'شاهد'),
        entity: src === 'entity' ? entName : (d.entity || ''),
        crime: src === 'entity' ? (d.crimeDesc || d.reasons || d.caseSummary || 'توصية جهة (ورقيّ)') : (d.crime || ''),
        reason: src === 'entity' ? ([d.why1, d.why2, d.why3].filter(Boolean).join(' · ') || d.reasons || 'مسوّغات التوصية الورقية') : (d.reason || ''),
        priorSubmit: src === 'entity' ? true : (d.priorSubmit === 'نعم'),
        caseNo: d.caseNo || '',
        details,
      });
      if (!res.ok) { setErr(res.error || 'تعذّر تسجيل الطلب.'); setBusy(false); return; }
      setDone({ ref: res.secret, src }); setStage('done');
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
      <h1 style={{ marginBottom: 8 }}>سُجِّل الطلب وأُحيل للفرز المبدئي</h1>
      <p className="sub" style={{ marginBottom: 0 }}>الرمز <span className="mono">{done.ref}</span> — ظهر الآن في «الطلبات الواردة» بالفرز المبدئي، ويسلك مساره كأيّ طلب.</p>
      <div className="flags">
        <div className="flag"><I name="description" size={17} /> قناة الورود: <b>ورقيّ — مُدخَل يدوياً</b></div>
        <div className="flag"><I name="gpp_maybe" size={17} color="var(--pp-bronze-ink)" /> الهوية: <b style={{ color: 'var(--pp-bronze-ink)' }}>غير موثّقة — تُفعَّل عبر نفاذ لاحقاً</b></div>
        <div className="flag"><I name="attach_file" size={17} /> صورة المستند الورقيّ: <b>مُرفقة</b></div>
        <div className="flag"><I name="history" size={17} /> مُسجَّل في التدقيق: <b>موظف الاستقبال · الآن</b></div>
        <div className="flag"><I name={done.src === 'entity' ? 'gavel' : 'person'} size={17} /> المصدر: <b>{done.src === 'entity' ? 'جهة مختصّة (بتوصيتها الورقية)' : 'طالب الحماية مباشرةً'}</b></div>
      </div>
      <div style={{ marginTop: 22 }}><button className="btn btn-primary" onClick={() => { setDone(null); setStage('select'); }}><I name="add" size={19} /> إدخال طلب آخر</button></div>
    </div></div>);
  }
  if (stage === 'seeker') {
    return (<div className="pi-wrap">{err && <InlineAlert kind="error" title="تعذّر التسجيل" style={{ marginBottom: 14 }}>{err}</InlineAlert>}<SeekerPaperForm onDone={finish} onBack={() => setStage('select')} /></div>);
  }
  if (stage === 'entity') {
    return (<div className="pi-wrap">
      <div className="paperbar"><I name="schedule" size={17} /><span><b>استقبال ورقيّ — نموذج التوصية نفسه.</b> المُدخِل موظف المركز نيابةً عن الجهة؛ الهوية تُدخَل يدوياً (غير موثّقة)، وتُرفق صورة الطلب الورقيّ ضمن المرفقات (<b>طلب الحماية المسبّب + الهوية</b> إلزاميّان). يُسجَّل الإدخال في التدقيق.</span></div>
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="sec-h"><I name="alt_route" size={19} /> نوع الوارد الورقيّ من الجهة</div>
        <div className="entseg" style={{ marginBottom: 14 }}>
          <button className={entMode === 'onbehalf' ? 'on' : ''} onClick={() => setEntMode('onbehalf')}>طلب نيابةً عن الشخص</button>
          <button className={entMode === 'rec' ? 'on' : ''} onClick={() => setEntMode('rec')}>توصية على طلبٍ مُحال</button>
        </div>
        <div className="sec-h"><I name="account_balance" size={19} /> الجهة المُحيلة (ورقياً)</div>
        <div className="entseg">{ENTS.map(([k, n]) => <button key={k} className={entity === k ? 'on' : ''} onClick={() => setEntity(k)}>{n}</button>)}</div>
      </div>
      {err && <InlineAlert kind="error" title="تعذّر التسجيل" style={{ marginBottom: 14 }}>{err}</InlineAlert>}
      <RecommendationForm rec={{ linked: entMode === 'rec', entity, cat: '', caseNo: '', secret: draftSecret, days: 1 }} onApprove={(f) => finish('entity', f)} onBack={() => setStage('select')} />
    </div>);
  }
  return (<div className="pi-wrap">
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <button title="تسجيل الخروج" onClick={() => { fetch('/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/'; }).catch(() => { window.location.href = '/'; }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}><I name="logout" size={17} /> تسجيل الخروج</button>
    </div>
    <div className="rm"><I name="schedule" size={18} /><span><b>وحدةٌ مؤقّتة لفترة التحوّل الرقميّ.</b> تُدخِل الطلبات الواردة ورقياً حتى يكتمل التقديم الرقميّ عبر البوابات — ومصمَّمةٌ لتُستغنى عنها لاحقاً بحذف هذه الوحدة وحدها دون أثرٍ على بقية النظام.</span></div>
    <div className="kick">بوابة موظف المركز · الاستقبال</div>
    <h1>إدخال طلبٍ ورقيّ</h1>
    <p className="sub">اختر مصدر الطلب الورقيّ الوارد. تُدخَل الحقول نفسها المعتمدة في البوابة الرقمية، فلا يضيع شيء عند الرقمنة.</p>
    <div className="pick">
      <button className="pick-card" onClick={() => setStage('seeker')}>
        <div className="pick-ico" style={{ background: 'var(--green-10)' }}><I name="person" size={24} color="var(--color-primary)" fill /></div>
        <h3>من طالب الحماية</h3>
        <p>طلبٌ ورقيّ قدّمه صاحب الشأن مباشرةً — بحقول نموذج طالب الحماية كاملةً.</p>
      </button>
      <button className="pick-card" onClick={() => setStage('entity')}>
        <div className="pick-ico" style={{ background: 'var(--pp-bronze-soft)' }}><I name="gavel" size={24} color="var(--pp-bronze-ink)" fill /></div>
        <h3>من جهة مختصّة</h3>
        <p>توصيةٌ ورقيّة من جهة — بنموذج التوصية الكامل نفسه (مسوّغات م٩ · أنواع م١٤ · مدة · مرفقات).</p>
      </button>
    </div>
  </div>);
}

export function PaperIntakePortal() {
  return <Intake />;
}
