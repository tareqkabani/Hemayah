"use client";
/* ============================================================
   نموذج التوصية — مصدرٌ واحد للبوابتين.

   كان منسوخاً نسختين تفترقان: نسخةُ الجهات المختصة ببنودٍ مثبَّتة في
   الشيفرة، ونسخةُ الإدخال اليدوي تقرأ من طبقة المحتوى. فبندٌ يضيفه الأدمن
   من بوابته يظهر في إحداهما دون الأخرى — وقد افترقتا فعلاً في app_category
   («ذو صلة» غائبة عن الجهات، و«مُبلِّغ» بتشكيلٍ مخالف).

   الفروق كلّها من `variant` لا من نسخةٍ ثانية:
     · electronic — الجهة ترفع توصيتها بنفسها: ترويسةٌ بالرمز والمهلة،
       هوية موروثة من نفاذ/سبل/الموارد، وتوقيعٌ ينتظر اعتماد الرئيس.
     · paper      — موظف المركز يفرّغ خطاباً وارداً: لا ترويسة (يملكها
       المعالج فوقه)، هوية موروثة من الطلب القائم، والخطاب ورد معتمداً.

   و`linked` يفصل «توصيةً على طلبٍ قائم» (هوية مقفلة) عن «طلبٍ نيابةً عن
   الشخص» (هوية تُدخَل يدوياً).
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert, SecretCode, DeadlineTimer } from "@hemaya/ui";
import { RISK_LEVEL, PROTECTION_TYPE_LABELS_14, DURATIONS, isCustomDuration } from "@hemaya/domain";
import { I, Field, Locked, Choice, Multi, Sec, ENTITIES, labelsOf } from "./parts";
import { AttachmentPicker } from "./AttachmentPicker";

const WAQIA_FALLBACK = [
  "الاعتداء على الأشخاص", "الآداب العامة", "الأموال", "المخدرات", "الجرائم الاقتصادية",
  "الماسة بالثقة العامة", "الأسرة والأحداث", "الاتجار بالأشخاص", "الجرائم المعلوماتية", "الأمن الوطني",
];

/* مصدر الهوية الموروثة يختلف بالقناة: الإلكترونية تجلبه من التكاملات،
   والورقية ترثه من الطلب القائم الذي أحاله المركز. */
const LOCKED_SRC = {
  electronic: { id: "نفاذ", addr: "سبل", work: "الموارد البشرية" },
  paper: { id: "الطلب القائم", addr: "الطلب القائم", work: "الطلب القائم" },
};

export function RecommendationForm({
  variant = "electronic",
  rec,
  lists = {},
  busy = false,
  onApprove,
  onBack,
  // رفعٌ حقيقيّ إلى المخزن: { client, regNo, onRecord, onRemove }. بلا هذا
  // العقد يبقى المُرفِق مُسجِّلَ أسماءٍ كما كان — لا تنكسر بوابةٌ لم تُوصَل بعد.
  uploader = null,
}) {
  const paper = variant === "paper";
  const linked = rec.linked !== false;
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution;
  const src = LOCKED_SRC[paper ? "paper" : "electronic"];

  const [f, setF] = useState({
    psych: "لا يوجد", psychHistory: "", health: "", healthNote: "", criminal: "لا يوجد", criminalNote: "",
    reveal: "", role: rec.cat || "",
    obName: "", obNid: "", obPhone: "", obGender: "", obNationality: "", obMarital: "",
    obResidence: "", obEmployer: "", obEducation: "",
    reasons: "", caseNo: rec.caseNo || "", caseSummary: "", caseStage: "", applicantRole: "",
    contacted: "", contactKind: "", crimeType: "", waqia: [], crimeDesc: "",
    hidden2: "", threatExists: "", threatType: "", riskLevel: "", harmExists: "", harmType: "",
    extends: "", extendsWho: "", adapt: "", provide: "", why1: "", why2: "", why3: "",
    types: [], alternatives: "", duration: "", durationNote: "", attachFiles: [], attachRows: [],
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [ack, setAck] = useState(false);
  const [noId, setNoId] = useState(false);

  // البنود من طبقة المحتوى — والاحتياطيّ يمنع شاشةً فارغةً عند تعذّر الجلب.
  const CATS = labelsOf(lists, "app_category", ["مبلّغ", "شاهد", "خبير", "ضحية"]);
  const CRIME_TYPES = labelsOf(lists, "crime_type", ["كبيرة موجبة للتوقيف", "ليست كبيرة موجبة للتوقيف"]);
  const WAQIA = labelsOf(lists, "waqia", WAQIA_FALLBACK);
  const TYPES = labelsOf(lists, "protection_types", [...PROTECTION_TYPE_LABELS_14]);
  const DURS = labelsOf(lists, "duration", [...DURATIONS]);

  const attachOk = (f.attachFiles || []).length > 0;
  const canSend = ack && !busy && (linked ? (paper ? !!f.provide : true) : attachOk);

  return (
    <div className="rf">
      {/* الترويسة للقناة الإلكترونية وحدها — في الورقية يملكها المعالج فوقه */}
      {!paper && (
        <div className="rf-top">
          {onBack && <button className="link" onClick={onBack}><I name="arrow_forward" size={18} /> رجوع إلى الطلبات المحالة</button>}
          <div className="rf-top-main">
            <div>
              <div className="rf-kicker">{linked ? "نموذج التوصية" : "طلب حماية نيابةً عن الشخص"}</div>
              <h2 className="rf-h">{linked ? "توصية الجهة المختصة بشأن طلب حماية" : "إنشاء طلب حماية نيابةً عن الشخص"}</h2>
            </div>
            <div className="rf-top-meta">
              <SecretCode code={rec.secret} canReveal={false} />
              <DeadlineTimer label={linked ? "رفع التوصية للمركز" : "رفع الطلب للمركز"} totalDays={5} daysElapsed={rec.days || 1} articleRef="م7 لائحة" />
            </div>
          </div>
        </div>
      )}

      <InlineAlert kind="info" title={paper ? "تفريغ حرفيّ — مصدر البيانات النموذج الورقي" : "مصدر البيانات"} style={{ marginBottom: 18 }}>
        {paper
          ? (linked
            ? <>انقل محتوى توصية الجهة من <b>الخطاب الوارد</b> كما ورد — هوية مقدم الطلب <b>موروثة موثّقة</b> من طلبه القائم ولا تُدخَل يدوياً.</>
            : <>انقل حقول <b>النموذج الورقي المرفق بخطاب الجهة</b> كما وردت — دون تلخيص أو تصحيح — وأرفق صورة النموذج والخطاب. البيانات غير موثّقة حتى يفعّل الشخص حسابه عبر نفاذ.</>)
          : (linked
            ? <>هوية مقدم الطلب وعنوانه وعمله <b>موروثة موثّقة</b> من طلبه (نفاذ · سبل · الموارد البشرية) — مقفلة للقراءة. أنت تُكمل ما تعرفه الجهة وحدها (القضية، التقييم، المسوّغات).</>
            : <>هذا طلب تنشئه الجهة <b>نيابةً عن الشخص</b> دون طلب سابق — تُدخل الجهة بياناته كاملة، ويُنشأ له حساب لاحقاً.</>)}
      </InlineAlert>

      {/* بطاقة القناة: ضابط اتصالٍ معتمد في الإلكترونية · خطابٌ بريديّ في الورقية */}
      {paper ? (
        <div className="rf-officer mail">
          <div className="rf-officer-ico"><I name="mail" size={20} color="var(--warning-70)" fill /></div>
          <div className="rf-officer-main">
            <div className="rf-officer-role">خطاب رسمي وارد بالبريد <span className="rf-officer-ent">· {ent.name}</span></div>
            <div className="rf-officer-sub">لا ربط تقنيّ بعد — يُدخل موظف المركز محتوى الخطاب نيابةً عن الجهة، ويُعيّن ضابط اتصال معتمد عند إطلاق الربط.</div>
          </div>
          <div className="rf-officer-meta"><Tag tone="warning" size="sm">قناة مؤقّتة — بريد ورقي</Tag></div>
        </div>
      ) : (
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
      )}

      <Sec n="١" title="بيانات مقدم الطلب">
        {linked ? (
          <>
            <div className="rf-grid2">
              <Locked label="الاسم الرباعي" value="•••• •••• •••• ••••" src={src.id} />
              <Locked label="رقم الهوية" value="••••••••••" src={src.id} />
              <Locked label="الجنس" value="••••" src={src.id} />
              <Locked label="الجنسية" value="•••••••" src={src.id} />
              <Locked label="الحالة الاجتماعية" value="••••••" src={src.id} />
              <Locked label="مقر الإقامة" value="•••• — العنوان الوطني" src={src.addr} />
              <Locked label="جهة العمل" value="••••••••" src={src.work} />
              <Locked label="المستوى التعليمي" value="••••••" src={src.work} />
            </div>
            <div className="rf-divider"><I name="edit_note" size={16} color="var(--text-secondary)" /> {paper ? "ما ورد في خطاب الجهة (يخصّ القضية والتقييم)" : "ما تُدخله الجهة (يخصّ القضية والتقييم)"}</div>
          </>
        ) : noId ? (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: "var(--text-strong)" }}>بيانات غير موثّقة — بانتظار التحقّق</b></div>
            <p className="muted" style={{ margin: "0 0 12px" }}>الشخص لا يملك هوية أو إقامة أو جواز (حالة مخالفي نظام الإقامة). تُدخل البيانات يدوياً وتُوسم للتحقّق اللاحق.</p>
            <InlineAlert kind="warning" title="نقطة معلّقة">آلية التحقّق لهذه الحالة <b>قيد النقاش مع الجهات المختصة</b>؛ تُعامل مؤقتاً كبيانات غير مؤكّدة.</InlineAlert>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setNoId(false)}><I name="arrow_forward" size={16} /> عودة إلى الإدخال بالهوية</button>
          </div>
        ) : (
          <div className="rf-fetch unverified">
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: "var(--text-strong)" }}>{paper ? "بيانات منقولة من النموذج الورقي — غير موثّقة بعد" : "بيانات تُدخلها الجهة — غير موثّقة بعد"}</b></div>
            <p className="muted" style={{ margin: "0 0 12px" }}>
              {paper
                ? "انقل بيانات الشخص كما وردت في النموذج الورقي المرفق بخطاب الجهة — دون تلخيص أو تصحيح — وأرفق صورة هويته؛ ويأخذ الطلب مجراه فوراً. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ ويُفعّل الطلب."
                : "تُدخل الجهة بيانات الشخص وترفق صورة هويته وكل المتطلبات؛ ويأخذ الطلب مجراه فوراً. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ ويُفعّل الطلب."}
            </p>
            <div className="rf-grid2">
              <Field label="الاسم الرباعي" req><input value={f.obName} onChange={(e) => set("obName", e.target.value)} dir="auto" placeholder={paper ? "كما في الخطاب الوارد" : undefined} /></Field>
              <Field label="رقم الهوية / الإقامة" req><input value={f.obNid} onChange={(e) => set("obNid", e.target.value.replace(/\D/g, "").slice(0, 10))} className="mono" inputMode="numeric" placeholder="1XXXXXXXXX" dir="ltr" /></Field>
              <Field label="رقم الجوال" req hint="(للإشعار بتفعيل الحساب)"><input value={f.obPhone} onChange={(e) => set("obPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} className="mono" inputMode="numeric" placeholder="05XXXXXXXX" dir="ltr" /></Field>
              {/* الورقية تنقل النموذج المرفق كاملاً؛ والإلكترونية تكتفي بالمعرِّف
                  لأنّ البقية تأتي من التكاملات عند تفعيل الحساب. */}
              {paper && (
                <>
                  <Field label="الجنس"><Choice value={f.obGender} set={(v) => set("obGender", v)} options={["ذكر", "أنثى"]} /></Field>
                  <Field label="الجنسية"><input value={f.obNationality} onChange={(e) => set("obNationality", e.target.value)} dir="auto" placeholder="مثال: سعودي" /></Field>
                  <Field label="الحالة الاجتماعية"><input value={f.obMarital} onChange={(e) => set("obMarital", e.target.value)} dir="auto" placeholder="أعزب / متزوّج…" /></Field>
                  <Field label="مقر الإقامة" hint="(العنوان الوطني)"><input value={f.obResidence} onChange={(e) => set("obResidence", e.target.value)} dir="auto" placeholder="المدينة — الحي" /></Field>
                  <Field label="جهة العمل"><input value={f.obEmployer} onChange={(e) => set("obEmployer", e.target.value)} dir="auto" /></Field>
                  <Field label="المستوى التعليمي"><input value={f.obEducation} onChange={(e) => set("obEducation", e.target.value)} dir="auto" /></Field>
                </>
              )}
            </div>
            <InlineAlert kind="info" title="التفعيل عبر نفاذ لاحقاً">يدخل الشخص بحسابه في نفاذ ويُفعّل الطلب — وهو لازمٌ لتوقيع اتفاقية الحماية عند القبول، ولرفع التظلّم عند الاعتراض على أنواع الحماية أو قرار الرفض.</InlineAlert>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setNoId(true)}><I name="help" size={16} /> الشخص لا يملك هوية / إقامة / جواز؟</button>
            <div className="rf-divider"><I name="edit_note" size={16} color="var(--text-secondary)" /> ما تُدخله الجهة (يخصّ القضية والتقييم)</div>
          </div>
        )}

        <Field label="صفة مقدم الطلب" req><Choice value={f.role} set={(v) => set("role", v)} options={CATS} /></Field>
        <div className="rf-grid2">
          <Field label="الحالة الصحية" req><Choice value={f.health} set={(v) => set("health", v)} options={["سليم", "غير سليم"]} /></Field>
          {f.health === "غير سليم" && <Field label="يعاني من" hint="(يُرفق تقرير طبي)"><input value={f.healthNote} onChange={(e) => set("healthNote", e.target.value)} dir="auto" /></Field>}
          <Field label="التاريخ الجنائي" req><Choice value={f.criminal} set={(v) => set("criminal", v)} options={["لا يوجد", "يوجد"]} /></Field>
          {f.criminal === "يوجد" && <Field label="تفاصيل التاريخ الجنائي" hint="(يُرفق إن وجد)"><input value={f.criminalNote} onChange={(e) => set("criminalNote", e.target.value)} dir="auto" /></Field>}
        </div>
        <div className="rf-grid2">
          <Field label="التاريخ النفسي (للتقييم)" req><Choice value={f.psych} set={(v) => set("psych", v)} options={["لا يوجد", "يوجد"]} /></Field>
          {f.psych === "يوجد" && <Field label="تفاصيل التاريخ النفسي" hint="(يُرفق إن وجد)"><input value={f.psychHistory} onChange={(e) => set("psychHistory", e.target.value)} dir="auto" /></Field>}
        </div>
        <Field label="رغبة مقدم الطلب في الكشف عن هويته" req><Choice value={f.reveal} set={(v) => set("reveal", v)} options={["يرغب", "لا يرغب"]} /></Field>
      </Sec>

      <Sec n="٢" title="تفاصيل وأسباب طلب الحماية">
        <Field label="التفاصيل والأسباب" req><textarea value={f.reasons} onChange={(e) => set("reasons", e.target.value)} dir="auto" style={{ minHeight: 110 }} /></Field>
      </Sec>

      <Sec n="٣" title="ملخص القضية ودور مقدم الطلب">
        <div className="rf-grid2">
          <Field label="رقم القضية" req><input value={f.caseNo} onChange={(e) => set("caseNo", e.target.value)} className="mono" dir="auto" /></Field>
          <Field label="المرحلة الحالية للقضية" req><input value={f.caseStage} onChange={(e) => set("caseStage", e.target.value)} dir="auto" /></Field>
        </div>
        <Field label="ملخص القضية" req><textarea value={f.caseSummary} onChange={(e) => set("caseSummary", e.target.value)} dir="auto" style={{ minHeight: 90 }} /></Field>
        <Field label="دور مقدم الطلب وأهمية معلوماته وأدلته" req><textarea value={f.applicantRole} onChange={(e) => set("applicantRole", e.target.value)} dir="auto" /></Field>
      </Sec>

      <Sec n="٤" title="مسوّغات توفير الحماية" sub="حقول مهيكلة — تُورَّث آلياً لتقييم عوامل المادة التاسعة وتصنيف الأخطار، دون تلخيص يُسقِط بيانات." fed>
        <Field label="هل تم التواصل مع مقدم الطلب؟" req><Choice value={f.contacted} set={(v) => set("contacted", v)} options={["نعم", "لا"]} /></Field>
        {f.contacted === "نعم" && <Field label="نوع التواصل"><Choice value={f.contactKind} set={(v) => set("contactKind", v)} options={["حضوري", "اتصال هاتفي"]} /></Field>}
        <Field label="نوع الجريمة" req><Choice value={f.crimeType} set={(v) => set("crimeType", v)} options={CRIME_TYPES} /></Field>
        <Field label="الواقعة" hint="(يُمكن اختيار أكثر من تصنيف)" req><Multi value={f.waqia} set={(v) => set("waqia", v)} options={WAQIA} /></Field>
        <Field label="الوصف الإجرامي"><textarea value={f.crimeDesc} onChange={(e) => set("crimeDesc", e.target.value)} dir="auto" /></Field>
        <Field label="هل أُخفيت بياناته استناداً للمادة الثانية من النظام؟"><Choice value={f.hidden2} set={(v) => set("hidden2", v)} options={["نعم", "لا"]} /></Field>
        <div className="rf-grid2">
          <Field label="وجود خطر يهدد طالب الحماية" req><Choice value={f.threatExists} set={(v) => set("threatExists", v)} options={["يوجد", "لا يوجد"]} danger={["يوجد"]} /></Field>
          {f.threatExists === "يوجد" && <Field label="نوع الخطر"><input value={f.threatType} onChange={(e) => set("threatType", e.target.value)} dir="auto" /></Field>}
        </div>
        {f.threatExists === "يوجد" && (
          <Field label="مستوى الخطر" req><Choice value={f.riskLevel} set={(v) => set("riskLevel", v)} options={[...Object.values(RISK_LEVEL)].reverse()} danger={[RISK_LEVEL.critical, RISK_LEVEL.high]} /></Field>
        )}
        <div className="rf-grid2">
          <Field label="وجود ضرر نتيجة دوره في القضية"><Choice value={f.harmExists} set={(v) => set("harmExists", v)} options={["يوجد", "لا يوجد"]} danger={["يوجد"]} /></Field>
          {f.harmExists === "يوجد" && <Field label="نوع الضرر"><input value={f.harmType} onChange={(e) => set("harmType", e.target.value)} dir="auto" /></Field>}
        </div>
        <div className="rf-grid2">
          <Field label="امتداد الخطر أو التهديد إلى الغير" hint="(لائحة م5/4)" req><Choice value={f.extends} set={(v) => set("extends", v)} options={["نعم", "لا"]} danger={["نعم"]} /></Field>
          {f.extends === "نعم" && <Field label="إلى من يمتدّ؟"><input value={f.extendsWho} onChange={(e) => set("extendsWho", e.target.value)} dir="auto" placeholder="الزوج/الأقارب…" /></Field>}
        </div>
        <Field label="قدرة مقدم الطلب والتابعين على التكيّف مع برنامج الحماية" req><Choice value={f.adapt} set={(v) => set("adapt", v)} options={["نعم", "لا"]} /></Field>
        {linked && (
          <div className="rf-recommend">
            <Field label="توصية الجهة بتوفير الحماية" req><Choice value={f.provide} set={(v) => set("provide", v)} options={["توفير", "عدم توفير"]} danger={["عدم توفير"]} /></Field>
            <div className="rf-why">
              <span className="rf-why-l">الأسباب:</span>
              <input value={f.why1} onChange={(e) => set("why1", e.target.value)} placeholder="السبب الأول" dir="auto" />
              <input value={f.why2} onChange={(e) => set("why2", e.target.value)} placeholder="السبب الثاني" dir="auto" />
              <input value={f.why3} onChange={(e) => set("why3", e.target.value)} placeholder="السبب الثالث" dir="auto" />
            </div>
            {f.provide === "عدم توفير" && <InlineAlert kind="info" title="لا إغلاق تلقائي" style={{ marginTop: 12 }}>توصية الجهة استشارية؛ القرار النهائي لإدارة برنامج الحماية بالمركز بعد الدراسة والتقييم.</InlineAlert>}
          </div>
        )}
      </Sec>

      {/* ⑤ و⑥ يظهران مع «توفير» فقط — «عدم توفير» يخفيهما ولا يمنع الرفع (حزمة 2026-08-09 محور ٢) */}
      {f.provide !== "عدم توفير" && (
        <Sec n="٥" title="أنواع الحماية المقترحة" fed>
          <Multi value={(f.types || []).filter((t) => TYPES.includes(t))} set={(v) => set("types", v)} options={TYPES} />
          <p className="rf-sec-sub" style={{ marginTop: 8 }}>تُختار من بنود الحماية المعتمدة (المادة 14 واللائحة)؛ والقرار النهائي بأنواعها للمجلس.</p>
          <Field label="الحلول البديلة المقترحة (إن وجدت)"><textarea value={f.alternatives} onChange={(e) => set("alternatives", e.target.value)} dir="auto" /></Field>
        </Sec>
      )}

      {f.provide !== "عدم توفير" && (
        <Sec n="٦" title="مدة الحماية المقترحة" fed>
          <Choice value={f.duration} set={(v) => set("duration", v)} options={DURS} />
          {isCustomDuration(f.duration) && <Field label="حدّد المدة"><input value={f.durationNote} onChange={(e) => set("durationNote", e.target.value)} dir="auto" style={{ maxWidth: 320 }} /></Field>}
        </Sec>
      )}

      <Sec n="" title="المستندات المطلوبة (مرفقات)" sub={paper && linked
        ? "PDF — أرفق صورة خطاب الجهة الوارد وما ورد معه دفعةً واحدة."
        : "PDF — أرفق المستندات الداعمة دفعةً واحدة (الهوية · بيانات القضية · تقييم المخاطر · التقارير والمسوّغات)."}>
        {uploader ? (
          <AttachmentPicker
            regNo={uploader.regNo}
            client={uploader.client}
            onRecord={uploader.onRecord}
            onRemove={uploader.onRemove}
            files={f.attachRows || []}
            setFiles={(rows) => setF((s2) => ({
              ...s2,
              attachRows: typeof rows === "function" ? rows(s2.attachRows || []) : rows,
              // الأسماء تبقى للعرض في سجلّ الفرز وشاشة النجاح
              attachFiles: (typeof rows === "function" ? rows(s2.attachRows || []) : rows).map((x) => x.name),
            }))}
          />
        ) : (
          <div className="rf-attach-grid">
            <label className="rf-attach" style={{ cursor: "pointer", alignItems: "flex-start" }}>
              <input type="file" accept="application/pdf,image/*" multiple style={{ display: "none" }}
                onChange={(e) => { const xs = Array.from(e.target.files || []); if (xs.length) set("attachFiles", [...(f.attachFiles || []), ...xs.map((x) => x.name)]); e.target.value = ""; }} />
              <I name={attachOk ? "check_circle" : "upload_file"} size={16} color={attachOk ? "var(--color-primary)" : "var(--text-secondary)"} fill={attachOk} />
              <span>إرفاق المستندات (يمكن اختيار أكثر من ملف)</span>
            </label>
            {(f.attachFiles || []).map((fn, i) => (
              <label key={fn + i} className="rf-attach" style={{ alignItems: "flex-start" }}>
                <I name="check_circle" size={16} color="var(--color-primary)" fill />
                <span>{fn}</span>
                <button className="link" style={{ marginInlineStart: "auto", fontSize: 12 }} onClick={(e) => { e.preventDefault(); set("attachFiles", (f.attachFiles || []).filter((_, j) => j !== i)); }}><I name="close" size={15} /></button>
              </label>
            ))}
          </div>
        )}
      </Sec>

      <Card className="card pad" style={{ marginTop: 8, borderColor: "var(--green-20)" }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}>
          <I name="approval" size={22} color="var(--color-primary)" fill />
          <b style={{ fontSize: 16, color: "var(--text-strong)" }}>
            {paper ? "الإقرار والتسجيل" : linked ? "الاعتماد ورفع التوصية" : "الاعتماد ورفع الطلب"}
          </b>
        </div>
        <div className="rf-grid2" style={{ marginBottom: 14 }}>
          {paper ? (
            <>
              <div className="rf-sign"><span className="muted">{ent.drafter} (مُعِدّ التوصية في الجهة)</span><b>{rec.letterBy || "كما ورد في الخطاب الرسمي"}</b><Tag tone="info" size="sm">من الخطاب</Tag></div>
              <div className="rf-sign"><span className="muted">الرئيس المباشر (المعتمِد)</span><b>ورد الخطاب معتمداً</b><Tag tone="success" size="sm">معتمد في الخطاب</Tag></div>
            </>
          ) : (
            <>
              <div className="rf-sign"><span className="muted">{ent.drafter} (المُحرِّر)</span><b>أنت</b><Tag tone="info" size="sm">مسوّدة</Tag></div>
              <div className="rf-sign"><span className="muted">الرئيس المباشر (المعتمِد)</span><b>يعتمد قبل الرفع</b><Tag tone="warning" size="sm">بانتظار الاعتماد</Tag></div>
            </>
          )}
        </div>
        <label className="rf-ack">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>
            {paper
              ? "أقرّ بأنّ محتوى التوصية أُدخل مطابقاً للخطاب الرسمي الوارد وصورته مُرفقة، ويُسجل إدخالي في التدقيق باسمي ووقته."
              : linked
                ? "أقرّ بصحة البيانات واكتمال المسوّغات، وأرفع التوصية لاعتماد الرئيس المباشر تمهيداً لإرسالها للمركز خلال المهلة النظامية."
                : "أقرّ بصحة البيانات واكتمال المسوّغات، وأرفع الطلب لاعتماد الرئيس المباشر تمهيداً لإرساله للمركز."}
          </span>
        </label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-primary" disabled={!canSend} onClick={() => onApprove && onApprove(f)}>
            <I name="send" size={18} /> {paper ? "تسجيل وإرسال" : linked ? "رفع للاعتماد" : "رفع الطلب"}
          </button>
        </div>
        {linked && paper && !f.provide && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>حدّد توصية الجهة (توفير / عدم توفير) كما وردت في الخطاب.</p>}
        {!linked && !attachOk && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>أرفق المستندات الداعمة قبل الرفع.</p>}
      </Card>
    </div>
  );
}
