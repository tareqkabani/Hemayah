"use client";
/* ============================================================
   «الواردة» — ما وصل الوحدة بقنواتها المعروفة ولم يُفرَّغ بعد.
   قسمان: طابور التفريغ (من intake_inbox) وإحالات الفرز بانتظار
   توصية الجهة (من list_referred_for_entity) — وفتح أيّهما يورّث
   قيده للنموذج مقفلاً فلا يُعاد إدخاله (قرار ٥ و٩).
   ============================================================ */
import React, { useState } from "react";
import { InlineAlert } from "@hemaya/ui";
import { I, Field, CHANNELS, DOCKINDS, chLabel, todayISO, bizDaysSince, fmtD } from "./parts";

const REC_DEADLINE_DAYS = 5; // مهلة توصية الجهة (م9) بأيام العمل

export function Inbox({ rows, awaiting, busy, err, onRegister, onClaim, onOpen, onOpenRec, onDirect }) {
  const [f, setF] = useState({ ch: "", kind: "req", regNo: "", arrived: todayISO() });
  const ok = f.ch && f.regNo.trim() && f.arrived && !busy;
  const submit = async () => {
    const done = await onRegister({ channel: f.ch, docKind: f.ch === "mail" ? f.kind : "req", regNo: f.regNo.trim(), arrivedOn: f.arrived });
    if (done) setF({ ch: "", kind: "req", regNo: "", arrived: todayISO() });
  };

  return (
    <div className="pi-wrap">
      <div className="kick">بوابة موظف المركز · الإدخال اليدوي للطلبات</div>
      <h1>الواردة</h1>
      <p className="sub">ما وصل الوحدة بالقنوات المعروفة ولم يُفرَّغ بعد — يُسجّل بقيده وتاريخ وروده، ثم يُفرَّغ بالنموذج الموافق لقناته (موقع إلكتروني · حضوري · خطاب جهة)، ويُورَّث القيد للنموذج فلا يُعاد إدخاله.</p>

      {err && <InlineAlert kind="error" title="تعذّر التنفيذ" style={{ marginBottom: 14 }}>{err}</InlineAlert>}

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="sec-h"><I name="move_to_inbox" size={19} /> تسجيل وصول مستند</div>
        <div className="rf" style={{ maxWidth: "none" }}><div className="rf-grid2">
          <Field label="قناة الورود" req>
            <select value={f.ch} onChange={(e) => setF({ ...f, ch: e.target.value })}>
              <option value="">— اختر —</option>
              {CHANNELS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </Field>
          {f.ch === "mail" && (
            <Field label="نوع المستند" req>
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {DOCKINDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </Field>
          )}
          <Field label="تاريخ الورود" req hint="(منه تُحسب المُهل — م10)">
            <input type="date" value={f.arrived} max={todayISO()} onChange={(e) => setF({ ...f, arrived: e.target.value })} />
          </Field>
          <Field label={f.ch === "legacy" ? "رقم الطلب في الموقع الإلكتروني" : "رقم القيد الإداري"} req>
            <input className="mono" dir="ltr" value={f.regNo} onChange={(e) => setF({ ...f, regNo: e.target.value })}
              placeholder={f.ch === "legacy" ? "مثال: 641803" : "مثال: 1447/إد/2291"} />
          </Field>
        </div></div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <button className="link" onClick={onDirect}><I name="note_add" size={16} /> تفريغ مباشر بلا قيد مُسبق</button>
          <button className="btn btn-primary" disabled={!ok} onClick={submit}><I name="add" size={18} /> تسجيل الوارد</button>
        </div>
      </div>

      <div className="sec-h"><I name="pending_actions" size={19} /> بانتظار التفريغ ({rows.length})</div>
      {rows.length ? (
        <div className="card"><div className="tbl-wrap"><table className="pi-tbl">
          <thead><tr><th>القناة</th><th>نوع المستند</th><th>قيد الورود</th><th>تاريخ الورود</th><th>من استلمه</th><th /></tr></thead>
          <tbody>{rows.map((r) => {
            const days = bizDaysSince(r.arrivedOn);
            return (
              <tr key={r.id}>
                <td>{chLabel(r.channel)}</td>
                <td>{r.docKind === "rec" ? <span className="pill info">توصية جهة</span> : "طلب حماية"}</td>
                <td className="mono">{r.regNo}</td>
                <td>{fmtD(r.arrivedOn)}{days > 0 && <div className="muted" style={{ fontSize: 11.5 }}>منذ {days} أيام عمل</div>}</td>
                <td>{r.claimedName || <button className="link" disabled={busy} onClick={() => onClaim(r.id)}><I name="how_to_reg" size={16} /> استلام</button>}</td>
                <td><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onOpen(r)}><I name="edit_note" size={17} /> تفريغ</button></td>
              </tr>
            );
          })}</tbody>
        </table></div></div>
      ) : (
        <InlineAlert kind="info" title="لا وارد بانتظار التفريغ">كل ما وصل الوحدة فُرِّغ وأُرسل — راجع «المرسلة».</InlineAlert>
      )}

      <div className="sec-h" style={{ marginTop: 26 }}><I name="outgoing_mail" size={19} /> مُحالة من الفرز — بانتظار توصية الجهة ({awaiting.length})</div>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 12.5 }}>طلباتٌ أحالها الفرز لجهاتها المختصّة بمهلة <b>{REC_DEADLINE_DAYS} أيام عمل</b>، وترد توصياتها بالبريد الرسمي — متى ورد الخطاب افتحه من هنا فيُربط بطلبه تلقائياً.</p>
      {awaiting.length ? (
        <div className="card"><div className="tbl-wrap"><table className="pi-tbl">
          <thead><tr><th>الرمز</th><th>الفئة</th><th>الجهة المُحال إليها</th><th>أُحيل في</th><th>المهلة</th><th /></tr></thead>
          <tbody>{awaiting.map((r) => {
            const left = REC_DEADLINE_DAYS - bizDaysSince(r.referredAt);
            return (
              <tr key={r.entKey + r.caseId}>
                <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{r.secret}</td>
                <td>{r.cat}</td>
                <td style={{ fontSize: 12.5 }}>{r.entName}</td>
                <td>{fmtD(r.referredAt)}</td>
                <td><span className={"pill " + (left <= 0 ? "over" : "ok")}>{left <= 0 ? "متجاوزة" : "متبقٍّ " + left + " أيام عمل"}</span></td>
                <td><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onOpenRec(r)}><I name="mail" size={17} /> وردت توصيتها — تفريغ</button></td>
              </tr>
            );
          })}</tbody>
        </table></div></div>
      ) : (
        <InlineAlert kind="info" title="لا طلبات بانتظار توصية">ما يُحيله الفرز لجهة مختصّة يظهر هنا.</InlineAlert>
      )}
    </div>
  );
}
