'use client';
/* ============================================================
   نموذج التوصية + البلاغ العاجل — منقول من lib-recommendation-form.jsx
   window/HP → @hemaya/ui. يُصدَّر RecommendationForm و UrgentForm.
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";

const I = ({ name, size = 20, fill = false, color = 'currentColor', style }) =>
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>;

const Field = ({ label, hint, children, req }) => (
  <div className="rf-fld">
    <label className="rf-label">{label}{req && <span className="rf-req">·</span>}{hint && <span className="rf-hint">{hint}</span>}</label>
    {children}
  </div>
);
const Locked = ({ label, value, src }) => (
  <div className="rf-fld">
    <label className="rf-label">{label}</label>
    <div className="rf-locked">
      <span className="rf-locked-v">{value}</span>
      <span className="rf-src"><I name="verified" size={14} fill color="var(--color-primary)" /> {src}</span>
    </div>
  </div>
);
const Choice = ({ value, set, options, danger }) => (
  <div className="rf-chips">
    {options.map((o) => {
      const v = typeof o === 'string' ? o : o.v;
      const on = value === v;
      return <button type="button" key={v} className={'rf-chip' + (on ? ' on' : '') + (danger && danger.includes(v) && on ? ' danger' : '')} onClick={() => set(v)}>{typeof o === 'string' ? o : o.t}</button>;
    })}
  </div>
);
const Multi = ({ value, set, options }) => (
  <div className="rf-chips">
    {options.map((o) => {
      const on = value.includes(o);
      return <button type="button" key={o} className={'rf-chip' + (on ? ' on' : '')} onClick={() => set(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>;
    })}
  </div>
);
const Sec = ({ n, title, sub, fed, children }) => (
  <section className="rf-sec">
    <div className="rf-sec-head">
      <span className="rf-sec-n">{n}</span>
      <div style={{ flex: 1 }}>
        <h3 className="rf-sec-t">{title}</h3>
        {sub && <p className="rf-sec-sub">{sub}</p>}
      </div>
      {fed && <span className="rf-fed" title="تُغذّي مرحلة الدراسة والتقييم آلياً"><I name="conversion_path" size={14} /> يُورَّث للدراسة</span>}
    </div>
    <div className="rf-sec-body">{children}</div>
  </section>
);

const ENTITIES = {
  prosecution:    { name: 'النيابة العامة',  drafter: 'محقق القضية',     approver: 'رئيس النيابة المتخصصة' },
  moi:            { name: 'وزارة الداخلية',  drafter: 'الضابط المختص',    approver: 'مدير الإدارة المختصة' },
  moj:            { name: 'وزارة العدل',     drafter: 'الباحث المختص',    approver: 'رئيس المحكمة / مدير الإدارة المختصة' },
  state_security: { name: 'أمن الدولة',      drafter: 'الضابط المختص',    approver: 'مدير الإدارة المختصة' },
  nazaha:         { name: 'نزاهة',           drafter: 'المحقق المختص',    approver: 'مدير الإدارة المختصة' },
};
const WAQIA = ['الاعتداء على الأشخاص', 'الآداب العامة', 'الأموال', 'المخدرات', 'الجرائم الاقتصادية', 'الماسة بالثقة العامة', 'الأسرة والأحداث', 'الاتجار بالأشخاص', 'الجرائم المعلوماتية', 'الأمن الوطني'];
const PROTECTION_TYPES = [
  'الحماية الأمنية', 'إخفاء البيانات الشخصية', 'النقل من العمل (مؤقّت/دائم)', 'إيجاد عمل بديل',
  'الإرشاد القانوني/النفسي/الاجتماعي', 'توفير وسائل الإبلاغ الفوري', 'تغيير أرقام الاتصال',
  'تغيير محل الإقامة', 'المرافقة الأمنية', 'الإدلاء بوسائط إلكترونية (تغيير الصوت وإخفاء الوجه)',
  'حماية المسكن', 'المساعدة المالية', 'أخرى (ما تراه الإدارة مناسباً)',
];

export function RecommendationForm({ rec, onApprove, onBack }) {
  const linked = rec.linked !== false;
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution;
  const [f, setF] = useState({
    psychHistory: '', health: '', healthNote: '', criminal: 'لا يوجد', criminalNote: '',
    reveal: '', role: rec.cat || '', obName: '', obNid: '', obPhone: '',
    reasons: '', caseNo: rec.caseNo || '', caseSummary: '', caseStage: '', applicantRole: '',
    contacted: '', contactKind: '', crimeType: '', waqia: [], crimeDesc: '',
    hidden2: '', threatExists: '', threatType: '', riskLevel: '', harmExists: '', harmType: '',
    extends: '', extendsWho: '', adapt: '', provide: '', why1: '', why2: '', why3: '',
    types: [], alternatives: '', duration: '', durationNote: '', attachMap: {},
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [ack, setAck] = useState(false);
  const [noId, setNoId] = useState(false);

  return (
    <div className="rf">
      <div className="rf-top">
        <button className="link" onClick={onBack}><I name="arrow_forward" size={18} /> رجوع إلى الطلبات المحالة</button>
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
          ? <>هوية مقدم الطلب وعنوانه وعمله <b>موروثة موثّقة</b> من طلبه (نفاذ · سبل · الموارد البشرية) — مقفلة للقراءة. أنت تُكمل ما تعرفه الجهة وحدها (القضية، التقييم، المسوّغات).</>
          : <>هذا طلب تنشئه الجهة <b>نيابةً عن الشخص</b> دون طلب سابق — تُدخل الجهة بياناته كاملة، ويُنشأ له حساب لاحقاً.</>}
      </InlineAlert>

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
              <Locked label="الاسم الرباعي" value="•••• •••• •••• ••••" src="نفاذ" />
              <Locked label="رقم الهوية" value="•••••••••• " src="نفاذ" />
              <Locked label="الجنس" value="••••" src="نفاذ" />
              <Locked label="الجنسية" value="•••••••" src="نفاذ" />
              <Locked label="الحالة الاجتماعية" value="••••••" src="نفاذ" />
              <Locked label="مقر الإقامة" value="•••• — العنوان الوطني" src="سبل" />
              <Locked label="جهة العمل" value="••••••••" src="الموارد البشرية" />
              <Locked label="المستوى التعليمي" value="••••••" src="الموارد البشرية" />
            </div>
            <div className="rf-divider"><I name="edit_note" size={16} color="var(--text-secondary)" /> ما تُدخله الجهة (يخصّ القضية والتقييم)</div>
          </>
        ) : noId ? (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات غير موثّقة — بانتظار التحقّق</b></div>
            <p className="muted" style={{ margin: '0 0 12px' }}>الشخص لا يملك هوية أو إقامة أو جواز (حالة مخالفي نظام الإقامة). تُدخل البيانات يدوياً وتُوسم للتحقّق اللاحق.</p>
            <InlineAlert kind="warning" title="نقطة معلّقة">آلية التحقّق لهذه الحالة <b>قيد النقاش مع الجهات المختصة</b>؛ تُعامل مؤقتاً كبيانات غير مؤكّدة.</InlineAlert>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setNoId(false)}><I name="arrow_forward" size={16} /> عودة إلى الجلب بالهوية</button>
          </div>
        ) : (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات تُدخلها الجهة — غير موثّقة بعد</b></div>
            <p className="muted" style={{ margin: '0 0 12px' }}>تُدخل الجهة بيانات الشخص وترفق صورة هويته وكل المتطلبات؛ ويأخذ الطلب مجراه فوراً. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ ويُفعّل الطلب.</p>
            <div className="rf-grid2">
              <Field label="الاسم الرباعي" req><input value={f.obName} onChange={(e) => set('obName', e.target.value)} dir="auto" /></Field>
              <Field label="رقم الهوية / الإقامة" req><input value={f.obNid} onChange={(e) => set('obNid', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="1XXXXXXXXX" dir="ltr" /></Field>
              <Field label="رقم الجوال" req hint="(للإشعار بتفعيل الحساب)"><input value={f.obPhone} onChange={(e) => set('obPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="05XXXXXXXX" dir="ltr" /></Field>
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

      <Sec n="٢" title="تفاصيل وأسباب طلب الحماية">
        <Field label="التفاصيل والأسباب" req><textarea value={f.reasons} onChange={(e) => set('reasons', e.target.value)} dir="auto" style={{ minHeight: 110 }} /></Field>
      </Sec>

      <Sec n="٣" title="ملخص القضية ودور مقدم الطلب">
        <div className="rf-grid2">
          <Field label="رقم القضية" req><input value={f.caseNo} onChange={(e) => set('caseNo', e.target.value)} className="mono" dir="auto" /></Field>
          <Field label="المرحلة الحالية للقضية" req><input value={f.caseStage} onChange={(e) => set('caseStage', e.target.value)} dir="auto" /></Field>
        </div>
        <Field label="ملخص القضية" req><textarea value={f.caseSummary} onChange={(e) => set('caseSummary', e.target.value)} dir="auto" style={{ minHeight: 90 }} /></Field>
        <Field label="دور مقدم الطلب وأهمية معلوماته وأدلته" req><textarea value={f.applicantRole} onChange={(e) => set('applicantRole', e.target.value)} dir="auto" /></Field>
      </Sec>

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

      <Sec n="٥" title="أنواع الحماية المقترحة" fed>
        <Multi value={(f.types || []).filter((t) => PROTECTION_TYPES.includes(t))} set={(v) => set('types', v)} options={PROTECTION_TYPES} />
        <p className="rf-sec-sub" style={{ marginTop: 8 }}>تُختار من بنود الحماية المعتمدة (المادة 14)؛ والقرار النهائي بأنواعها للمجلس.</p>
        <Field label="الحلول البديلة المقترحة (إن وجدت)"><textarea value={f.alternatives} onChange={(e) => set('alternatives', e.target.value)} dir="auto" /></Field>
      </Sec>

      <Sec n="٦" title="مدة الحماية المقترحة" fed>
        <Choice value={f.duration} set={(v) => set('duration', v)} options={['30 يوماً', 'إلى حين انتهاء القضية', 'مدة أخرى']} />
        {f.duration === 'مدة أخرى' && <Field label="حدّد المدة" hint=""><input value={f.durationNote} onChange={(e) => set('durationNote', e.target.value)} dir="auto" style={{ maxWidth: 320 }} /></Field>}
      </Sec>

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

      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--green-20)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="approval" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>{linked ? 'الاعتماد ورفع التوصية' : 'الاعتماد ورفع الطلب'}</b></div>
        <div className="rf-grid2" style={{ marginBottom: 14 }}>
          <div className="rf-sign"><span className="muted">{ent.drafter} (المُحرِّر)</span><b>أنت</b><Tag tone="info" size="sm">مسوّدة</Tag></div>
          <div className="rf-sign"><span className="muted">الرئيس المباشر (المعتمِد)</span><b>يعتمد قبل الرفع</b><Tag tone="warning" size="sm">بانتظار الاعتماد</Tag></div>
        </div>
        <label className="rf-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{linked ? 'أقرّ بصحة البيانات واكتمال المسوّغات، وأرفع التوصية لاعتماد الرئيس المباشر تمهيداً لإرسالها للمركز خلال المهلة النظامية.' : 'أقرّ بصحة البيانات واكتمال المسوّغات، وأرفع الطلب لاعتماد الرئيس المباشر تمهيداً لإرساله للمركز.'}</span></label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-ghost"><I name="save" size={18} /> حفظ كمسوّدة</button>
          <button className="btn btn-primary" disabled={!ack || (!linked && !(f.attachMap || {})['الهوية الوطنية لطالب الحماية والتابعين'])} onClick={() => onApprove && onApprove(f)}><I name="send" size={18} /> {linked ? 'رفع للاعتماد' : 'رفع الطلب'}</button>
        </div>
      </Card>
    </div>
  );
}

export function UrgentForm({ rec, onSubmit, onBack }) {
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution;
  const [u, setU] = useState({
    obName: '', obNid: '', obPhone: '', cat: '', crimeType: '', waqia: [], danger: '', source: '', requested: '', requestedTypes: [],
    extends: '', extendsWho: '', caseNo: rec.caseNo || '',
  });
  const set = (k, v) => setU((p) => ({ ...p, [k]: v }));
  const [ack, setAck] = useState(false);
  const [sent, setSent] = useState(false);

  const ready = u.obName.trim() && u.obNid.length === 10 && u.cat && u.crimeType && u.danger.trim() && u.source.trim() && u.requestedTypes.length > 0 && u.extends && (u.extends === 'لا' || u.extendsWho.trim()) && ack;

  if (sent) {
    return (
      <div className="rf">
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}><I name="arrow_forward" size={18} /> رجوع</button>
        <Card className="card pad" style={{ textAlign: 'center', padding: '44px 24px', borderColor: 'var(--color-error)' }}>
          <div style={{ width: 60, height: 60, margin: '0 auto 16px', borderRadius: 'var(--radius-lg)', background: 'var(--error-10)', display: 'grid', placeItems: 'center' }}><I name="emergency" size={30} color="var(--color-error)" fill /></div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-strong)' }}>رُفع البلاغ العاجل مباشرةً للنائب العام</div>
          <p className="muted" style={{ maxWidth: 520, margin: '10px auto 0', lineHeight: 1.7 }}>رقم البلاغ <b className="mono">U-2026-0052</b>. وصل إلى بوابة النائب العام للبتّ الفوري، ومركز الحماية مطّلع على المسار. ستصلكم نتيجة البتّ عبر الإشعارات والمراسلات.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-primary" onClick={onBack}><I name="check" size={18} /> تمّ</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="rf">
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}><I name="arrow_forward" size={18} /> رجوع</button>

      <InlineAlert kind="error" title="بلاغ عاجل — خطر وشيك على الحياة" style={{ marginBottom: 18 }}>
        يُرفع هذا البلاغ <b>مباشرةً إلى النائب العام</b> للبتّ الفوري (المادة الثامنة)، ويتجاوز الفرز والدراسة والمجلس. لا يُستخدم إلا عند وجود خطر وشيك يهدّد الحياة؛ ولغير ذلك استخدم نموذج التوصية المعتاد.
      </InlineAlert>

      <div className="rf-officer">
        <div className="rf-officer-ico"><I name="support_agent" size={20} color="var(--color-primary)" fill /></div>
        <div className="rf-officer-main">
          <div className="rf-officer-role">ضابط الاتصال المعتمد · <span className="rf-officer-ent">{ent.name}</span></div>
          <div className="rf-officer-sub">أنت الرافع للبلاغ العاجل؛ هويتك ودورك موثّقان آلياً في سجلّ التدقيق.</div>
        </div>
        <div className="rf-officer-meta"><Tag tone="success" size="sm" iconLeft={<I name="verified_user" size={13} />}>دخول عبر نفاذ</Tag></div>
      </div>

      <Sec n="١" title="المعنيّ بالحماية" sub="تُجلب الهوية آلياً من نفاذ / المركز الوطني للمعلومات لمنع خطأ الإدخال.">
        <div className="rf-fetch unverified">
          <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: 'var(--text-strong)' }}>بيانات تُدخلها الجهة — غير موثّقة بعد</b></div>
          <p className="muted" style={{ margin: '0 0 12px' }}>تُدخل الجهة بيانات المعنيّ وترفق صورة هويته؛ ويُرفع البلاغ فوراً للنائب العام. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ لاحقاً.</p>
          <div className="rf-grid2">
            <Field label="الاسم الرباعي" req><input value={u.obName} onChange={(e) => set('obName', e.target.value)} dir="auto" /></Field>
            <Field label="رقم الهوية / الإقامة" req><input value={u.obNid} onChange={(e) => set('obNid', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="1XXXXXXXXX" dir="ltr" /></Field>
            <Field label="رقم الجوال" req hint="(للإشعار بالتفعيل)"><input value={u.obPhone} onChange={(e) => set('obPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mono" inputMode="numeric" placeholder="05XXXXXXXX" dir="ltr" /></Field>
          </div>
          <Field label="صفة المعنيّ" req hint=""><Choice value={u.cat} set={(v) => set('cat', v)} options={['شاهد', 'مبلّغ', 'خبير', 'ضحية']} /></Field>
        </div>
      </Sec>

      <Sec n="٢" title="القضية محل البلاغ">
        <div className="rf-grid2">
          <Locked label="الجهة الرافعة" value={ent.name} src="حساب الجهة" />
          <Field label="رقم القضية" req><input value={u.caseNo} onChange={(e) => set('caseNo', e.target.value)} dir="auto" placeholder="مثال: ق-5102/1447" /></Field>
        </div>
        <Field label="نوع الجريمة" req><Choice value={u.crimeType} set={(v) => set('crimeType', v)} options={['كبيرة موجبة للتوقيف', 'ليست كبيرة موجبة للتوقيف']} /></Field>
        <Field label="الواقعة (يمكن اختيار أكثر من واحدة)"><Multi value={u.waqia} set={(v) => set('waqia', v)} options={WAQIA} /></Field>
      </Sec>

      <Sec n="٣" title="طبيعة الخطر الوشيك" sub="بيانات مختصرة كافية للبتّ الفوري." fed>
        <Field label="وصف الخطر الوشيك" req hint="ما الذي يجعل الخطر داهماً الآن؟">
          <textarea value={u.danger} onChange={(e) => set('danger', e.target.value)} dir="auto" placeholder="مثال: تهديد مباشر بالقتل عقب الإدلاء بالشهادة، ورُصد تتبّع للمسكن مساء أمس…" />
        </Field>
        <Field label="مصدر التهديد" req><textarea value={u.source} onChange={(e) => set('source', e.target.value)} dir="auto" placeholder="من مصدر التهديد، وهل هو محدّد الهوية؟" /></Field>
        <Field label="هل يمتدّ الخطر لوثيقي الصلة؟" req><Choice value={u.extends} set={(v) => set('extends', v)} options={['نعم', 'لا']} /></Field>
        {u.extends === 'نعم' && <Field label="من يمتدّ إليهم الخطر" req><input value={u.extendsWho} onChange={(e) => set('extendsWho', e.target.value)} dir="auto" placeholder="مثال: الزوجة وابنان قاصران" /></Field>}
      </Sec>

      <Sec n="٤" title="التدابير المؤقّتة المطلوبة" sub="تُختار من الأنواع الـ(13) المنصوص عليها في المادة الرابعة عشرة؛ والنائب العام يبتّ بالتدابير النهائية." fed>
        <Field label="التدابير المطلوبة (يمكن اختيار أكثر من واحد)" req>
          <Multi value={u.requestedTypes} set={(v) => set('requestedTypes', v)} options={PROTECTION_TYPES} />
        </Field>
        <Field label="إيضاح الإجراء العاجل (اختياري)" hint="تفاصيل تساعد النائب على البتّ الفوري">
          <textarea value={u.requested} onChange={(e) => set('requested', e.target.value)} dir="auto" placeholder="مثال: مرافقة أمنية فورية ونقل مؤقّت لمكان آمن لحين انعقاد المجلس." />
        </Field>
      </Sec>

      <Sec n="٥" title="المرفقات الداعمة" sub="مستندات تُرفع مع البلاغ وتُحفظ في ملف الحالة؛ يستند إليها مركز الحماية لاحقاً عند إعداد دراسة الحالة وتجديد مدّة التدابير المؤقّتة (الحدّ الأقصى 30 يوماً — المادة الثامنة).">
        <div className="rf-attach-grid">
          {['الهوية الوطنية للمعنيّ بالحماية والتابعين', 'بيانات القضية والإجراءات النظامية', 'أدلّة الخطر الوشيك (وسائط، تسجيلات، صور، أوراق)', 'المحضر الهاتفي / إثبات التهديد', 'تقرير تقييم المخاطر إن وُجد', 'تقرير طبي للحالة الصحية إن وُجد', 'أي مسوّغات تدعم البلاغ'].map((a, i) => (
            <label key={i} className="rf-attach"><input type="checkbox" /><I name="upload_file" size={16} color="var(--text-secondary)" /><span>{a}</span></label>
          ))}
        </div>
        <InlineAlert kind="info" style={{ marginTop: 12 }}>
          رفع المرفقات لا يؤخّر البتّ الفوري؛ يُرفع البلاغ فوراً، وتبقى المرفقات متاحةً لمركز الحماية لإعداد الدراسة الكاملة وتجديد المدّة قبل انقضائها.
        </InlineAlert>
      </Sec>

      <Card className="card pad" style={{ marginTop: 8, borderColor: 'var(--color-error)' }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="bolt" size={22} color="var(--color-error)" fill /><b style={{ fontSize: 16, color: 'var(--text-strong)' }}>رفع البلاغ العاجل</b></div>
        <label className="rf-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>أقرّ بصحّة البيانات، وأنّ الخطر وشيك ويهدّد الحياة فعلاً، وأرفع البلاغ مباشرةً للنائب العام للبتّ الفوري — تحت مسؤوليتي النظامية.</span></label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-danger" disabled={!ready} onClick={() => { setSent(true); if (typeof window !== 'undefined') window.scrollTo(0, 0); if (onSubmit) onSubmit(u); }}><I name="send" size={18} /> رفع البلاغ للنائب العام</button>
        </div>
        {!ready && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>أكمل الحقول الإلزامية وأقرّ بالتعهّد لتفعيل الرفع.</p>}
      </Card>
    </div>
  );
}
