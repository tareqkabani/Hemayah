"use client";
/* ============================================================
   لبنات وحدة الإدخال اليدوي المشتركة — يستهلكها المعالج وشاشتا
   الواردة والمرسلة معاً، فلا تُنسخ ثلاث مرّات.
   ============================================================ */
import React from "react";
import { businessDaysBetween } from "@hemaya/domain";

export const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

export const Field = ({ label, hint, req, children }) => (
  <div className="rf-fld"><label className="rf-label">{label}{req && <span className="rf-req">*</span>}{hint && <span className="rf-hint">{hint}</span>}</label>{children}</div>
);

export const Choice = ({ value, set, options, danger }) => (
  <div className="rf-chips">{options.map((o) => {
    const v = typeof o === "string" ? o : o.v;
    const on = value === v;
    return <button type="button" key={v} className={"rf-chip" + (on ? " on" : "") + (danger && danger.includes(v) && on ? " danger" : "")} onClick={() => set(v)}>{typeof o === "string" ? o : o.t}</button>;
  })}</div>
);

export const Multi = ({ value, set, options }) => (
  <div className="rf-chips">{options.map((o) => {
    const on = value.includes(o);
    return <button type="button" key={o} className={"rf-chip" + (on ? " on" : "")} onClick={() => set(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>;
  })}</div>
);

export const Sec = ({ n, title, sub, fed, children }) => (
  <section className="rf-sec"><div className="rf-sec-head"><span className="rf-sec-n">{n}</span><div style={{ flex: 1 }}><h3 className="rf-sec-t">{title}</h3>{sub && <p className="rf-sec-sub">{sub}</p>}</div>{fed && <span className="rf-fed" title="تُغذّي مرحلة الدراسة والتقييم آلياً"><I name="conversion_path" size={14} /> يُورَّث للدراسة</span>}</div><div className="rf-sec-body">{children}</div></section>
);

/** حقل موروث مقفل — هوية الطلب المُحال القائم (لا تُدخل يدوياً). */
export const Locked = ({ label, value, src }) => (
  <div className="rf-fld"><label className="rf-label">{label}</label>
    <div className="rf-locked"><span className="rf-locked-v">{value}</span><span className="rf-src"><I name="verified" size={14} fill color="var(--color-primary)" /> {src}</span></div>
  </div>
);

/** التسمية المعروضة → مفتاح البند في طبقة المحتوى (وهو عين قيمة الـenum).
 *  النماذج تعرض التسمية العربية والقاعدة تخزّن المفتاح — والترجمة هنا في
 *  موضعٍ واحد على حدّ الإرسال، لا خريطةٌ عربيةٌ منسوخة في كل ملف. */
export const keyOf = (items, label) => {
  const s = (label || "").trim();
  const hit = (items || []).find((i) => i.label === s || i.key === s);
  return hit ? hit.key : s;   // غير المعروف يمرّ كما هو ليرفضه الخادم صراحةً
};

/* الجهات المختصة — موحّدة مع جهات الإحالة في الفرز (المسمّى الكامل والترتيب) */
export const ENTS = [
  ["prosecution", "النيابة العامة"],
  ["state_security", "رئاسة أمن الدولة"],
  ["moi", "وزارة الداخلية"],
  ["nazaha", "هيئة الرقابة ومكافحة الفساد"],
  ["moj", "وزارة العدل"],
];
export const entName = (k) => (ENTS.find(([e]) => e === k) || ["", "جهة مختصّة"])[1];

/* سجلّ الجهات المختصة — مسمّى المُحرّر والمعتمِد يُشتقّ من الجهة */
export const ENTITIES = {
  prosecution:    { name: "النيابة العامة",              drafter: "محقق القضية",   approver: "رئيس النيابة المتخصصة" },
  moi:            { name: "وزارة الداخلية",              drafter: "الضابط المختص",  approver: "مدير الإدارة المختصة" },
  moj:            { name: "وزارة العدل",                 drafter: "الباحث المختص",  approver: "رئيس المحكمة / مدير الإدارة المختصة" },
  state_security: { name: "رئاسة أمن الدولة",            drafter: "الضابط المختص",  approver: "مدير الإدارة المختصة" },
  nazaha:         { name: "هيئة الرقابة ومكافحة الفساد", drafter: "المحقق المختص",  approver: "مدير الإدارة المختصة" },
};

/* قنوات ورود المستند وأنواعه — مطابقة لـintake_channel/intake_doc_kind في القاعدة */
export const CHANNELS = [
  ["legacy",   "الموقع الإلكتروني (تقديم عبر نفاذ)", "language"],
  ["inperson", "حضوري",                              "record_voice_over"],
  ["mail",     "خطاب رسمي بالبريد",                   "mail"],
];
export const DOCKINDS = [["req", "طلب حماية"], ["rec", "توصية جهة على طلبٍ مُحال"]];
export const chLabel = (k) => (CHANNELS.find(([c]) => c === k) || ["", "—"])[1];

/* ── قيد الورود — تُحسب مُهل م10 وSLA من تاريخ الورود لا من لحظة الإدخال ── */
export const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export const bizDaysSince = (iso) => (iso ? businessDaysBetween(new Date(String(iso).slice(0, 10) + "T00:00:00"), new Date()) : 0);
export const fmtD = (iso) => (iso ? String(iso).slice(0, 10).replace(/-/g, "/") : "—");

/** شريط الخطوات — ثلاث خطوات لا صفحةً طويلةً واحدة (قرار ٨). */
export const Stepper = ({ steps, step, go }) => (
  <div className="wz">{steps.map((t, i) => {
    const n = i + 1;
    const st = n === step ? "on" : n < step ? "done" : "";
    return (
      <button type="button" key={t} className={"wz-s " + st} onClick={() => n < step && go(n)}>
        <span className="wz-n">{n < step ? <I name="check" size={15} /> : n}</span><span>{t}</span>
      </button>
    );
  })}</div>
);

/** السياق المقفل — القناة وقيد الورود موروثان من الواردة، لا يُعاد إدخالهما (قرار ٥). */
export const LockedCtx = ({ ch, meta, note }) => (
  <div className="ctx">
    <span className="ctx-i"><I name="lock" size={15} /> موروث من الواردة</span>
    <span><b>{chLabel(ch)}</b></span>
    <span>قيد الورود <b className="mono">{meta.regNo || "—"}</b></span>
    <span>ورد <b>{fmtD(meta.receivedDate)}</b> · منه تُحسب المُهل</span>
    {note && <details className="ctx-d"><summary>تفاصيل</summary><span>{note}</span></details>}
  </div>
);

/** قيد الورود المُدخَل يدوياً — يظهر في «التفريغ المباشر بلا قيد مُسبق» فقط. */
export const PaperMeta = ({ meta, setMeta, ch }) => {
  const legacy = ch === "legacy";
  return (
    <div className="card pad rf" style={{ marginBottom: 14, maxWidth: "none" }}>
      <div className="sec-h"><I name="event_available" size={19} /> {legacy ? "مرجع الطلب في الموقع الإلكتروني" : "قيد الورود الورقيّ"} <span className="rf-hint" style={{ fontWeight: 400 }}>(المُهل النظامية — م10 — تُحسب من {legacy ? "تاريخ التقديم في الموقع الإلكتروني" : "تاريخ الورود"} لا من لحظة الإدخال)</span></div>
      <div className="rf-grid2">
        <Field label={legacy ? "تاريخ تقديم الطلب في الموقع الإلكتروني" : "تاريخ ورود المستند الورقيّ"} req>
          <input type="date" value={meta.receivedDate} max={todayISO()} onChange={(e) => setMeta({ ...meta, receivedDate: e.target.value })} />
        </Field>
        <Field label={legacy ? "رقم الطلب في الموقع الإلكتروني" : "رقم القيد الإداري"} req hint={legacy ? "(كما يظهر في الموقع الإلكتروني)" : "(من سجلّ الوارد)"}>
          <input className="mono" value={meta.regNo} onChange={(e) => setMeta({ ...meta, regNo: e.target.value })} placeholder={legacy ? "مثال: 641794" : "مثال: و-1447/0231"} dir="ltr" />
        </Field>
      </div>
      {meta.receivedDate && <div className="man" style={{ marginBottom: 0 }}><I name="timer" size={16} /> انقضى منذ {legacy ? "التقديم" : "الورود"}: <b style={{ marginInline: 4 }}>{bizDaysSince(meta.receivedDate)} يوم عمل</b> — ومنه تبدأ المُهل والمؤقّتات، لا من لحظة الإدخال.</div>}
    </div>
  );
};
