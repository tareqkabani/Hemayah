"use client";
/* ============================================================
   نموذج التوصية المشترك في وضع «ورقيّ» (paper):
   · linked=true  — توصية على طلبٍ مُحال: الهوية موروثة موثّقة (مقفلة).
   · linked=false — طلب نيابةً عن الشخص: هوية تُدخَل يدوياً (غير موثّقة).
   في هذا الوضع لا عنوان ولا زرّ رجوع — يملكهما المعالج فوقه.
   بنود القوائم (الفئة · نوع الجريمة · الواقعة · أنواع الحماية · المدة)
   تُقرأ من طبقة المحتوى لا من ثوابت في الشيفرة.
   ============================================================ */
import React, { useState } from "react";
import { Card, Tag, InlineAlert } from "@hemaya/ui";
import { RISK_LEVEL, PROTECTION_TYPE_LABELS_14 } from "@hemaya/domain";
import { I, Field, Choice, Multi, Sec, Locked, ENTITIES } from "./parts";

const labels = (lists, key, fallback) => {
  const xs = (lists?.[key] || []).map((i) => i.label);
  return xs.length ? xs : fallback;
};

export function RecommendationForm({ rec, lists = {}, busy, onApprove }) {
  const linked = rec.linked !== false;
  const ent = ENTITIES[rec.entity] || ENTITIES.prosecution;
  const [f, setF] = useState({
    psych: "لا يوجد", psychHistory: "", health: "", healthNote: "", criminal: "لا يوجد", criminalNote: "",
    reveal: "", role: rec.cat || "",
    obName: "", obNid: "", obPhone: "", obGender: "", obNationality: "", obMarital: "", obResidence: "", obEmployer: "", obEducation: "",
    reasons: "", caseNo: rec.caseNo || "", caseSummary: "", caseStage: "", applicantRole: "",
    contacted: "", contactKind: "", crimeType: "", waqia: [], crimeDesc: "",
    hidden2: "", threatExists: "", threatType: "", riskLevel: "", harmExists: "", harmType: "",
    extends: "", extendsWho: "", adapt: "", provide: "", why1: "", why2: "", why3: "",
    types: [], alternatives: "", duration: "", durationNote: "", attachFiles: [],
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [ack, setAck] = useState(false);
  const [noId, setNoId] = useState(false);

  const CATS = labels(lists, "app_category", ["مبلّغ", "شاهد", "خبير", "ضحية"]);
  const CRIME_TYPES = labels(lists, "crime_type", ["كبيرة موجبة للتوقيف", "ليست كبيرة موجبة للتوقيف"]);
  const WAQIA = labels(lists, "waqia", []);
  const TYPES = labels(lists, "protection_types", PROTECTION_TYPE_LABELS_14);
  const DURATIONS = labels(lists, "duration", ["ثلاثون يوماً", "إلى حين انتهاء القضية", "مدة محدّدة"]);

  const canSend = ack && (linked ? !!f.provide : (f.attachFiles || []).length > 0) && !busy;

  return (
    <div className="rf">
      <InlineAlert kind="info" title="تفريغ حرفيّ — مصدر البيانات النموذج الورقي" style={{ marginBottom: 18 }}>
        {linked
          ? <>انقل محتوى توصية الجهة من <b>الخطاب الوارد</b> كما ورد — هوية مقدم الطلب <b>موروثة موثّقة</b> من طلبه القائم ولا تُدخَل يدوياً.</>
          : <>انقل حقول <b>النموذج الورقي المرفق بخطاب الجهة</b> كما وردت — دون تلخيص أو تصحيح — وأرفق صورة النموذج والخطاب. البيانات غير موثّقة حتى يفعّل الشخص حسابه عبر نفاذ.</>}
      </InlineAlert>

      <div className="rf-officer mail">
        <div className="rf-officer-ico"><I name="mail" size={20} color="var(--warning-70)" fill /></div>
        <div className="rf-officer-main">
          <div className="rf-officer-role">خطاب رسمي وارد بالبريد <span className="rf-officer-ent">· {ent.name}</span></div>
          <div className="rf-officer-sub">لا ربط تقنيّ بعد — يُدخل موظف المركز محتوى الخطاب نيابةً عن الجهة، ويُعيّن ضابط اتصال معتمد عند إطلاق الربط.</div>
        </div>
        <div className="rf-officer-meta"><Tag tone="warning" size="sm">قناة مؤقّتة — بريد ورقي</Tag></div>
      </div>

      <Sec n="١" title="بيانات مقدم الطلب">
        {linked ? (
          <>
            <div className="rf-grid2">
              <Locked label="الاسم الرباعي" value="•••• •••• •••• ••••" src="الطلب القائم" />
              <Locked label="رقم الهوية" value="••••••••••" src="الطلب القائم" />
              <Locked label="الجنس" value="••••" src="الطلب القائم" />
              <Locked label="الجنسية" value="•••••••" src="الطلب القائم" />
              <Locked label="الحالة الاجتماعية" value="••••••" src="الطلب القائم" />
              <Locked label="مقر الإقامة" value="•••• — العنوان الوطني" src="الطلب القائم" />
              <Locked label="جهة العمل" value="••••••••" src="الطلب القائم" />
              <Locked label="المستوى التعليمي" value="••••••" src="الطلب القائم" />
            </div>
            <div className="rf-divider"><I name="edit_note" size={16} color="var(--text-secondary)" /> ما ورد في خطاب الجهة (يخصّ القضية والتقييم)</div>
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
            <div className="row" style={{ gap: 9, marginBottom: 6 }}><I name="running_with_errors" size={20} color="var(--color-warning)" fill /><b style={{ fontSize: 15, color: "var(--text-strong)" }}>بيانات منقولة من النموذج الورقي — غير موثّقة بعد</b></div>
            <p className="muted" style={{ margin: "0 0 12px" }}>انقل بيانات الشخص كما وردت في النموذج الورقي المرفق بخطاب الجهة — دون تلخيص أو تصحيح — وأرفق صورة هويته؛ ويأخذ الطلب مجراه فوراً. تُوثّق الهوية حين يدخل الشخص بحسابه عبر نفاذ ويُفعّل الطلب.</p>
            <div className="rf-grid2">
              <Field label="الاسم الرباعي" req><input value={f.obName} onChange={(e) => set("obName", e.target.value)} dir="auto" placeholder="كما في الخطاب الوارد" /></Field>
              <Field label="رقم الهوية / الإقامة" req><input value={f.obNid} onChange={(e) => set("obNid", e.target.value.replace(/\D/g, "").slice(0, 10))} className="mono" inputMode="numeric" placeholder="1XXXXXXXXX" dir="ltr" /></Field>
              <Field label="رقم الجوال" req hint="(للإشعار بتفعيل الحساب)"><input value={f.obPhone} onChange={(e) => set("obPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} className="mono" inputMode="numeric" placeholder="05XXXXXXXX" dir="ltr" /></Field>
              <Field label="الجنس"><Choice value={f.obGender} set={(v) => set("obGender", v)} options={["ذكر", "أنثى"]} /></Field>
              <Field label="الجنسية"><input value={f.obNationality} onChange={(e) => set("obNationality", e.target.value)} dir="auto" placeholder="مثال: سعودي" /></Field>
              <Field label="الحالة الاجتماعية"><input value={f.obMarital} onChange={(e) => set("obMarital", e.target.value)} dir="auto" placeholder="أعزب / متزوّج…" /></Field>
              <Field label="مقر الإقامة" hint="(العنوان الوطني)"><input value={f.obResidence} onChange={(e) => set("obResidence", e.target.value)} dir="auto" placeholder="المدينة — الحي" /></Field>
              <Field label="جهة العمل"><input value={f.obEmployer} onChange={(e) => set("obEmployer", e.target.value)} dir="auto" /></Field>
              <Field label="المستوى التعليمي"><input value={f.obEducation} onChange={(e) => set("obEducation", e.target.value)} dir="auto" /></Field>
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
        {WAQIA.length > 0 && (
          <Field label="الواقعة" hint="(يُمكن اختيار أكثر من تصنيف)" req><Multi value={f.waqia} set={(v) => set("waqia", v)} options={WAQIA} /></Field>
        )}
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

      {f.provide !== "عدم توفير" && (
        <Sec n="٥" title="أنواع الحماية المقترحة" fed>
          <Multi value={(f.types || []).filter((t) => TYPES.includes(t))} set={(v) => set("types", v)} options={TYPES} />
          <p className="rf-sec-sub" style={{ marginTop: 8 }}>تُختار من بنود الحماية المعتمدة (المادة 14 واللائحة)؛ والقرار النهائي بأنواعها للمجلس.</p>
          <Field label="الحلول البديلة المقترحة (إن وجدت)"><textarea value={f.alternatives} onChange={(e) => set("alternatives", e.target.value)} dir="auto" /></Field>
        </Sec>
      )}

      {f.provide !== "عدم توفير" && (
        <Sec n="٦" title="مدة الحماية المقترحة" fed>
          <Choice value={f.duration} set={(v) => set("duration", v)} options={DURATIONS} />
          {f.duration === "مدة محدّدة" && <Field label="حدّد المدة"><input value={f.durationNote} onChange={(e) => set("durationNote", e.target.value)} dir="auto" style={{ maxWidth: 320 }} /></Field>}
        </Sec>
      )}

      <Sec n="" title="المستندات المطلوبة (مرفقات)" sub={linked ? "PDF — أرفق صورة خطاب الجهة الوارد وما ورد معه دفعةً واحدة." : "PDF — أرفق المستندات الداعمة دفعةً واحدة (الهوية · بيانات القضية · تقييم المخاطر · التقارير والمسوّغات)."}>
        <div className="rf-attach-grid">
          <label className="rf-attach" style={{ cursor: "pointer", alignItems: "flex-start" }}>
            <input type="file" accept="application/pdf,image/*" multiple style={{ display: "none" }}
              onChange={(e) => { const xs = Array.from(e.target.files || []); if (xs.length) set("attachFiles", [...(f.attachFiles || []), ...xs.map((x) => x.name)]); e.target.value = ""; }} />
            <I name={(f.attachFiles || []).length ? "check_circle" : "upload_file"} size={16} color={(f.attachFiles || []).length ? "var(--color-primary)" : "var(--text-secondary)"} fill={!!(f.attachFiles || []).length} />
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
      </Sec>

      <Card className="card pad" style={{ marginTop: 8, borderColor: "var(--green-20)" }}>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}><I name="approval" size={22} color="var(--color-primary)" fill /><b style={{ fontSize: 16, color: "var(--text-strong)" }}>الإقرار والتسجيل</b></div>
        <div className="rf-grid2" style={{ marginBottom: 14 }}>
          <div className="rf-sign"><span className="muted">{ent.drafter} (مُعِدّ التوصية في الجهة)</span><b>{rec.letterBy || "كما ورد في الخطاب الرسمي"}</b><Tag tone="info" size="sm">من الخطاب</Tag></div>
          <div className="rf-sign"><span className="muted">الرئيس المباشر (المعتمِد)</span><b>ورد الخطاب معتمداً</b><Tag tone="success" size="sm">معتمد في الخطاب</Tag></div>
        </div>
        <label className="rf-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>أقرّ بأنّ محتوى التوصية أُدخل مطابقاً للخطاب الرسمي الوارد وصورته مُرفقة، ويُسجل إدخالي في التدقيق باسمي ووقته.</span></label>
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-primary" disabled={!canSend} onClick={() => onApprove(f)}><I name="send" size={18} /> تسجيل وإرسال</button>
        </div>
        {linked && !f.provide && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>حدّد توصية الجهة (توفير / عدم توفير) كما وردت في الخطاب.</p>}
        {!linked && !(f.attachFiles || []).length && <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>أرفق صورة الخطاب والنموذج الورقي قبل التسجيل.</p>}
      </Card>
    </div>
  );
}
