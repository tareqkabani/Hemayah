"use client";
/* ============================================================
   «المرسلة» — ما فُرِّغ وأُرسل لاستكمال الرحلة (قرار ٦ و٧):
   طلبات الحماية إلى الفرز المبدئي، وتوصية الجهة على طلبٍ مُحال
   تُدمج في صفّ الطلب وتمضي إلى الدراسة والتقييم. وكل صفٍّ يحمل
   اسم مُدخِله وصفته وقت الإدخال — سندٌ يطابق سجل التدقيق.
   ============================================================ */
import React, { useState } from "react";
import { InlineAlert } from "@hemaya/ui";
import { I, chLabel, fmtD } from "./parts";

const dest = (r) => (r.docKind === "rec" ? "study" : "triage");

export function SentList({ rows }) {
  const [f, setF] = useState("all");
  const shown = rows.filter((r) => f === "all" || f === dest(r));
  const n = (k) => rows.filter((r) => dest(r) === k).length;

  return (
    <div className="pi-wrap">
      <div className="kick">بوابة موظف المركز · الإدخال اليدوي للطلبات</div>
      <h1>المرسلة</h1>
      <p className="sub">ما فُرِّغ وأُرسل لاستكمال الرحلة: طلبات الحماية تُرسل للـ<b>فرز المبدئي</b>، وتوصية الجهة على طلبٍ مُحال تُدمج في صفّ الطلب وتُرسل لـ<b>الدراسة والتقييم</b>. وكل إدخال موثّق باسم مُدخِله في التدقيق.</p>

      <div className="entseg" style={{ marginBottom: 16 }}>
        <button className={f === "all" ? "on" : ""} onClick={() => setF("all")}>الكل ({rows.length})</button>
        <button className={f === "triage" ? "on" : ""} onClick={() => setF("triage")}>إلى الفرز المبدئي ({n("triage")})</button>
        <button className={f === "study" ? "on" : ""} onClick={() => setF("study")}>إلى الدراسة والتقييم ({n("study")})</button>
      </div>

      {shown.length ? (
        <div className="card"><div className="tbl-wrap"><table className="pi-tbl">
          <thead><tr><th>الرمز</th><th>نوع الوارد</th><th>القناة</th><th>قيد الورود</th><th>أُرسل إلى</th><th>مُدخِل النموذج</th><th>الهوية</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id}>
              <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{r.secret}</td>
              <td>{r.docKind === "rec" ? "توصية جهة على طلبٍ مُحال" : r.channel === "mail" ? "طلب جهة نيابةً عن الشخص" : "طلب طالب الحماية"}</td>
              <td>{chLabel(r.channel)}</td>
              <td className="mono">{r.regNo || "—"}</td>
              <td>{dest(r) === "study"
                ? <span className="pill ok"><I name="conversion_path" size={14} /> الدراسة والتقييم</span>
                : <span className="pill warn"><I name="fact_check" size={14} /> الفرز المبدئي</span>}</td>
              <td>{r.byName || "—"}{r.byRole ? <div className="muted" style={{ fontSize: 11.5 }}>{r.byRole}</div> : null}
                {r.at ? <div className="muted" style={{ fontSize: 11.5 }}>{fmtD(r.at)}</div> : null}</td>
              <td>{r.verified
                ? <span className="pill ok">موثّقة</span>
                : <span className="pill bronze">غير موثّقة</span>}</td>
            </tr>
          ))}</tbody>
        </table></div></div>
      ) : (
        <InlineAlert kind="info" title="لا مُرسلات بعد">ما تُفرّغه من الواردة يظهر هنا وفي مرحلته التالية معاً.</InlineAlert>
      )}
    </div>
  );
}
