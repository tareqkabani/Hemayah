"use client";
/* ============================================================
   «المرسلة» — ما فُرِّغ وأُرسل لاستكمال الرحلة (قرار ٦ و٧):
   طلبات الحماية إلى الفرز المبدئي، وتوصية الجهة على طلبٍ مُحال تُدمج في
   صفّ الطلب وتمضي إلى الدراسة والتقييم. وكل صفٍّ يحمل اسم مُدخِله وصفته
   وقت الإدخال — سندٌ يطابق سجل التدقيق.

   البحث والترقيم على **الخادم** (فجوة الإنتاج ٥): كانت الشاشة تُرجع كل
   الصفوف دفعةً واحدة بلا بحثٍ ولا صفحات — تثقل بعد أشهر، ويُتصفَّح القيدُ
   بصرياً بين مئات السطور.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";
import { InlineAlert } from "@hemaya/ui";
import { I, chLabel, fmtD } from "./parts";
import { listSent } from "@/lib/paper-intake-actions";

const PAGE = 25;
const dest = (r) => (r.docKind === "rec" ? "study" : "triage");

export function SentList({ rows: initialRows, total: initialTotal }) {
  const [rows, setRows] = useState(initialRows || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const first = useRef(true);

  // البحث مُهدَّأ — لا نداء لكل ضغطة مفتاح
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      setBusy(true); setErr("");
      const res = await listSent({
        q, dest: filter === "all" ? null : filter,
        limit: PAGE, offset: page * PAGE,
      });
      setBusy(false);
      if (!res.ok) { setErr(res.error); return; }
      setRows(res.rows); setTotal(res.total);
    }, 300);
    return () => clearTimeout(t);
  }, [q, filter, page]);

  // تغيّر البحث أو التصنيف يعيد للصفحة الأولى — وإلا بقي المستخدم في صفحةٍ خاوية
  const setFilterTop = (v) => { setFilter(v); setPage(0); };
  const setQTop = (v) => { setQ(v); setPage(0); };

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const from = total ? page * PAGE + 1 : 0;
  const to = Math.min(total, (page + 1) * PAGE);

  return (
    <div className="pi-wrap">
      <div className="kick">بوابة موظف المركز · الإدخال اليدوي للطلبات</div>
      <h1>المرسلة</h1>
      <p className="sub">ما فُرِّغ وأُرسل لاستكمال الرحلة: طلبات الحماية تُرسل للـ<b>فرز المبدئي</b>، وتوصية الجهة على طلبٍ مُحال تُدمج في صفّ الطلب وتُرسل لـ<b>الدراسة والتقييم</b>. وكل إدخال موثّق باسم مُدخِله في التدقيق.</p>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="rf" style={{ maxWidth: "none" }}>
          <div className="rf-fld" style={{ marginBottom: 12 }}>
            <label className="rf-label">بحث <span className="rf-hint">(بالرمز السري أو رقم القيد)</span></label>
            <input value={q} onChange={(e) => setQTop(e.target.value)} placeholder="مثال: C-2026-0512 أو 1447/إد/2291" dir="auto" />
          </div>
        </div>
        <div className="entseg">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilterTop("all")}>الكل</button>
          <button className={filter === "triage" ? "on" : ""} onClick={() => setFilterTop("triage")}>إلى الفرز المبدئي</button>
          <button className={filter === "study" ? "on" : ""} onClick={() => setFilterTop("study")}>إلى الدراسة والتقييم</button>
        </div>
      </div>

      {err && <InlineAlert kind="error" title="تعذّر الجلب" style={{ marginBottom: 14 }}>{err}</InlineAlert>}

      {rows.length ? (
        <>
          <div className="card"><div className="tbl-wrap"><table className="pi-tbl">
            <thead><tr><th>الرمز</th><th>نوع الوارد</th><th>القناة</th><th>قيد الورود</th><th>أُرسل إلى</th><th>مُدخِل النموذج</th><th>الهوية</th></tr></thead>
            <tbody>{rows.map((r) => (
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
                <td>{r.verified ? <span className="pill ok">موثّقة</span> : <span className="pill bronze">غير موثّقة</span>}</td>
              </tr>
            ))}</tbody>
          </table></div></div>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {busy ? "يُحمَّل…" : <>يُعرض <b>{from}–{to}</b> من <b>{total}</b></>}
            </span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>
                <I name="chevron_right" size={17} /> السابق
              </button>
              <span className="muted" style={{ fontSize: 12.5 }}>صفحة {page + 1} من {pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page + 1 >= pages || busy} onClick={() => setPage(page + 1)}>
                التالي <I name="chevron_left" size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <InlineAlert kind="info" title={q || filter !== "all" ? "لا نتائج مطابقة" : "لا مُرسلات بعد"}>
          {q || filter !== "all"
            ? "جرّب رمزاً أو قيداً آخر، أو أزل التصنيف."
            : "ما تُفرّغه من الواردة يظهر هنا وفي مرحلته التالية معاً."}
        </InlineAlert>
      )}
    </div>
  );
}
