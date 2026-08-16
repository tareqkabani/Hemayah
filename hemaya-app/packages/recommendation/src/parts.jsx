"use client";
/* لبنات نموذج التوصية — كانت منسوخةً في بوابتين، وهي هنا مرّةً واحدة. */
import React from "react";

export const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

export const Field = ({ label, hint, req, children }) => (
  <div className="rf-fld">
    <label className="rf-label">{label}{req && <span className="rf-req">*</span>}{hint && <span className="rf-hint">{hint}</span>}</label>
    {children}
  </div>
);

export const Locked = ({ label, value, src }) => (
  <div className="rf-fld">
    <label className="rf-label">{label}</label>
    <div className="rf-locked">
      <span className="rf-locked-v">{value}</span>
      <span className="rf-src"><I name="verified" size={14} fill color="var(--color-primary)" /> {src}</span>
    </div>
  </div>
);

export const Choice = ({ value, set, options, danger }) => (
  <div className="rf-chips">
    {options.map((o) => {
      const v = typeof o === "string" ? o : o.v;
      const on = value === v;
      return (
        <button type="button" key={v} className={"rf-chip" + (on ? " on" : "") + (danger && danger.includes(v) && on ? " danger" : "")} onClick={() => set(v)}>
          {typeof o === "string" ? o : o.t}
        </button>
      );
    })}
  </div>
);

export const Multi = ({ value, set, options }) => (
  <div className="rf-chips">
    {options.map((o) => {
      const on = value.includes(o);
      return (
        <button type="button" key={o} className={"rf-chip" + (on ? " on" : "")} onClick={() => set(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>
      );
    })}
  </div>
);

export const Sec = ({ n, title, sub, fed, children }) => (
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

/* سجلّ الجهات — مسمّى المُحرّر والمعتمِد يُشتقّ من الجهة */
export const ENTITIES = {
  prosecution:    { name: "النيابة العامة",              drafter: "محقق القضية",   approver: "رئيس النيابة المتخصصة" },
  moi:            { name: "وزارة الداخلية",              drafter: "الضابط المختص",  approver: "مدير الإدارة المختصة" },
  moj:            { name: "وزارة العدل",                 drafter: "الباحث المختص",  approver: "رئيس المحكمة / مدير الإدارة المختصة" },
  state_security: { name: "رئاسة أمن الدولة",            drafter: "الضابط المختص",  approver: "مدير الإدارة المختصة" },
  nazaha:         { name: "هيئة الرقابة ومكافحة الفساد", drafter: "المحقق المختص",  approver: "مدير الإدارة المختصة" },
};

/** بنود قائمةٍ من طبقة المحتوى، وإلا فالاحتياطيّ (لا شاشةَ فارغةً عند تعذّر الجلب). */
export const labelsOf = (lists, key, fallback = []) => {
  const xs = (lists?.[key] || []).map((i) => i.label).filter(Boolean);
  return xs.length ? xs : fallback;
};
