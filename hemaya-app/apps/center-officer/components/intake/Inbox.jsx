"use client";
/* ============================================================
   «الواردة» — ما وصل الوحدة بقنواتها المعروفة ولم يُفرَّغ بعد.
   ثلاثة أقسام:
     · طابور التفريغ (من intake_inbox) — وفتحه يورّث قيده للنموذج مقفلاً
       فلا يُعاد إدخاله (قرار ٥ و٩).
     · «مُحالة من الفرز» بانتظار توصية الجهة (intake_referred_list) —
       ببحثٍ وترقيمٍ على الخادم (فجوة التسليم ٥).
     · «بلا حساب — لم تُضمّ بعد» (intake_unclaimed_cases) — فجوة التسليم ٦.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";
import { InlineAlert } from "@hemaya/ui";
import { I, Field, CHANNELS, DOCKINDS, ENTS, entName, chLabel, todayISO, bizDaysSince, fmtD } from "./parts";
import { listReferred, revealSubjectContact, logOutreach } from "@/lib/paper-intake-actions";

const REC_DEADLINE_DAYS = 5; // مهلة توصية الجهة (م9) بأيام العمل

export function Inbox({ rows, awaiting, awaitingTotal, unclaimed, busy, err, onRegister, onClaim, onOpen, onOpenRec, onDirect }) {
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

      <AwaitingSection rows={awaiting} total={awaitingTotal} busy={busy} onOpenRec={onOpenRec} />

      <UnclaimedSection rows={unclaimed} busy={busy} />
    </div>
  );
}

/* ── «مُحالة من الفرز» — بحثٌ وترقيمٌ وتصفية على الخادم (فجوة التسليم ٥) ──
   كان القسم يرسم awaiting.map كاملةً: كلّ ما انتظر توصيتَه منذ إطلاق النظام
   في جدولٍ واحد، بلا بحثٍ ولا صفحات. والنمط هنا نمط «المرسلة» نفسه حرفاً
   بحرف (تهدئة ٣٠٠ms · صفحات ٢٥ · العودة للصفحة الأولى عند تغيّر المرشِّح)
   فلا لهجتان في وحدةٍ واحدة. */
const PAGE = 25;

function AwaitingSection({ rows: initialRows, total: initialTotal, busy, onOpenRec }) {
  const [rows, setRows] = useState(initialRows || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [q, setQ] = useState("");
  const [ent, setEnt] = useState("");
  const [due, setDue] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      setLoading(true); setErr("");
      const res = await listReferred({
        q, entity: ent || null, due: due || null, limit: PAGE, offset: page * PAGE,
      });
      setLoading(false);
      if (!res.ok) { setErr(res.error); return; }
      setRows(res.rows); setTotal(res.total);
    }, 300);
    return () => clearTimeout(t);
  }, [q, ent, due, page]);

  // تغيّر البحث أو المرشِّح يعيد للصفحة الأولى — وإلا بقي المستخدم في صفحةٍ خاوية
  const onQ = (v) => { setQ(v); setPage(0); };
  const onEnt = (v) => { setEnt(v); setPage(0); };
  const onDue = (v) => { setDue(v); setPage(0); };

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const from = total ? page * PAGE + 1 : 0;
  const to = Math.min(total, (page + 1) * PAGE);
  const filtered = !!(q || ent || due);

  return (
    <>
      <div className="sec-h" style={{ marginTop: 26 }}><I name="outgoing_mail" size={19} /> مُحالة من الفرز — بانتظار توصية الجهة ({total})</div>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 12.5 }}>طلباتٌ أحالها الفرز لجهاتها المختصّة بمهلة <b>{REC_DEADLINE_DAYS} أيام عمل</b>، وترد توصياتها بالبريد الرسمي — متى ورد الخطاب افتحه من هنا فيُربط بطلبه تلقائياً.</p>

      <div className="card pad" style={{ marginBottom: 12 }}>
        <div className="rf" style={{ maxWidth: "none" }}>
          <div className="rf-fld" style={{ marginBottom: 12 }}>
            <label className="rf-label">بحث <span className="rf-hint">(بالرمز السري أو رقم القضية)</span></label>
            <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="مثال: C-2026-0512 أو 1447/ق/338" dir="auto" />
          </div>
          <div className="rf-grid2">
            <Field label="الجهة المُحال إليها">
              <select value={ent} onChange={(e) => onEnt(e.target.value)}>
                <option value="">كل الجهات</option>
                {ENTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </Field>
            <Field label="المهلة">
              <select value={due} onChange={(e) => onDue(e.target.value)}>
                <option value="">الكل</option>
                <option value="over">متجاوزة المهلة</option>
                <option value="open">ضمن المهلة</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {err && <InlineAlert kind="error" title="تعذّر الجلب" style={{ marginBottom: 12 }}>{err}</InlineAlert>}

      {rows.length ? (
        <>
          <div className="card"><div className="tbl-wrap"><table className="pi-tbl">
            <thead><tr><th>الرمز</th><th>الفئة</th><th>الجهة المُحال إليها</th><th>أُحيل في</th><th>المهلة</th><th /></tr></thead>
            <tbody>{rows.map((r) => {
              const left = REC_DEADLINE_DAYS - bizDaysSince(r.referredAt);
              return (
                <tr key={r.caseId}>
                  <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{r.secret}</td>
                  <td>{r.cat}</td>
                  <td style={{ fontSize: 12.5 }}>{entName(r.entity)}</td>
                  <td>{fmtD(r.referredAt)}</td>
                  {/* المهلة من الخادم (is_over) لا من حسابٍ محلّيّ — فالتقويم الرسميّ عنده */}
                  <td><span className={"pill " + (r.isOver ? "over" : "ok")}>{r.isOver ? "متجاوزة" : "متبقٍّ " + Math.max(0, left) + " أيام عمل"}</span></td>
                  <td><button className="btn btn-ghost btn-sm" disabled={busy || loading} onClick={() => onOpenRec(r)}><I name="mail" size={17} /> وردت توصيتها — تفريغ</button></td>
                </tr>
              );
            })}</tbody>
          </table></div></div>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {loading ? "يُحمَّل…" : <>يُعرض <b>{from}–{to}</b> من <b>{total}</b></>}
            </span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
                <I name="chevron_right" size={17} /> السابق
              </button>
              <span className="muted" style={{ fontSize: 12.5 }}>صفحة {page + 1} من {pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page + 1 >= pages || loading} onClick={() => setPage(page + 1)}>
                التالي <I name="chevron_left" size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <InlineAlert kind="info" title={filtered ? "لا نتائج مطابقة" : "لا طلبات بانتظار توصية"}>
          {filtered ? "جرّب رمزاً أو قيداً آخر، أو أزل المرشِّحات." : "ما يُحيله الفرز لجهة مختصّة يظهر هنا."}
        </InlineAlert>
      )}
    </>
  );
}

/* ── «بلا حساب — لم تُضمّ بعد» (فجوة التسليم ٦) ──
   القضية المُدخَلة ورقياً لا مالك لها حتى يدخل صاحبها بنفاذ مرّةً فتُضمّ
   تلقائياً. والآلية سليمة، والمفقود أن يعلم أحدٌ مَن ينتظر: فصاحبها لا يرى
   قراره ولا يوقّع الاتفاقية (م11) ولا يتظلّم (م21).

   ⚠️ التسمية «لم تُضمّ» لا «بانتظار تفعيل نفاذ»: بعضها **موثّقة الهوية**
   أصلاً (القادمة من الموقع الإلكتروني) — الناقص لها الحساب لا التوثيق.

   ولا زرّ «أرسل دعوة»: نصفها بلا وسيلة اتصالٍ مخزَّنة، ورجعتها عبر رقم
   طلبها في الموقع أو عبر الجهة المُرسِلة. فالجدول يقول أهناك وسيلةٌ أم لا،
   والتواصل يقع خارج النظام ويُسجَّل أثره هنا. */
const OUTREACH_CHANNELS = [
  ["phone", "هاتف صاحبها"],
  ["entity", "عبر الجهة المُحيلة"],
  ["website", "عبر سجلّ الموقع الإلكتروني"],
  ["other", "أخرى"],
];

function UnclaimedSection({ rows: initial, busy }) {
  const [rows, setRows] = useState(initial || []);
  const [open, setOpen] = useState(null);   // caseId المفتوح لتسجيل محاولة
  const [shown, setShown] = useState({});   // caseId → {name, contact}
  const [form, setForm] = useState({ channel: "phone", note: "" });
  const [work, setWork] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const reveal = async (id) => {
    setWork(true); setErr("");
    const r = await revealSubjectContact(id);
    setWork(false);
    if (!r.ok) return setErr(r.error);
    setShown((s) => ({ ...s, [id]: { name: r.name, contact: r.contact } }));
  };

  const submit = async () => {
    setWork(true); setErr(""); setMsg("");
    const r = await logOutreach(open, form.channel, form.note.trim());
    setWork(false);
    if (!r.ok) return setErr(r.error);
    setRows((xs) => xs.map((x) => x.caseId === open
      ? { ...x, outreachCount: x.outreachCount + 1, lastOutreachAt: new Date().toISOString() }
      : x));
    setOpen(null); setForm({ channel: "phone", note: "" });
    setMsg("سُجّلت المحاولة — مُقيَّدة في التدقيق باسمك");
  };

  return (
    <>
      <div className="sec-h" style={{ marginTop: 26 }}><I name="person_off" size={19} /> بلا حساب — لم تُضمّ بعد ({rows.length})</div>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 12.5 }}>
        حالاتٌ أُدخلت ورقياً ولم يدخل أصحابها بنفاذ بعد، فلا مالك لها — ومن ثمّ <b>لا يرى صاحبها قراره ولا يوقّع الاتفاقية (م11) ولا يتظلّم (م21)</b>.
        ودخولُه بنفاذ مرّةً واحدة يضمّها تلقائياً. والتواصل يقع خارج النظام، ويُسجَّل أثره هنا.
      </p>

      {err && <InlineAlert kind="error" title="تعذّر التنفيذ" style={{ marginBottom: 12 }}>{err}</InlineAlert>}
      {msg && <InlineAlert kind="success" title={msg} style={{ marginBottom: 12 }} />}

      {rows.length ? (
        <div className="card"><div className="tbl-wrap"><table className="pi-tbl">
          <thead><tr><th>الرمز</th><th>القناة</th><th>قيد الورود</th><th>الانتظار</th><th>الهوية</th><th>وسيلة الاتصال</th><th>المحاولات</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <React.Fragment key={r.caseId}>
              <tr>
                <td className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{r.secret}</td>
                <td>{chLabel(r.channel)}</td>
                <td className="mono">{r.regNo || "—"}</td>
                <td><span className={"pill " + (r.daysWaiting >= 5 ? "over" : "ok")}>{r.daysWaiting} أيام عمل</span></td>
                <td>{r.verified
                  ? <span className="pill ok">موثّقة</span>
                  : <span className="pill bronze">غير موثّقة</span>}</td>
                <td>{r.hasContact
                  ? (shown[r.caseId]
                      ? <span className="mono" dir="ltr">{shown[r.caseId].contact || "—"}</span>
                      : <button className="link" disabled={work} onClick={() => reveal(r.caseId)}><I name="visibility" size={15} /> كشف</button>)
                  : <span className="muted" style={{ fontSize: 12 }}>لا وسيلة مسجّلة</span>}</td>
                <td>{r.outreachCount || "—"}{r.lastOutreachAt ? <div className="muted" style={{ fontSize: 11.5 }}>آخرها {fmtD(r.lastOutreachAt)}</div> : null}</td>
                <td><button className="btn btn-ghost btn-sm" disabled={busy || work}
                      onClick={() => { setOpen(open === r.caseId ? null : r.caseId); setMsg(""); }}>
                  <I name="how_to_reg" size={17} /> سجّل محاولة
                </button></td>
              </tr>
              {open === r.caseId && (
                <tr><td colSpan={8} style={{ background: "var(--surface-subtle)" }}>
                  <div className="rf" style={{ maxWidth: "none", padding: "4px 0" }}>
                    <div className="rf-grid2">
                      <Field label="قناة المحاولة" req>
                        <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                          {OUTREACH_CHANNELS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="ما جرى" req hint="(يُقيَّد في التدقيق)">
                        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                          dir="auto" placeholder="مثال: اتُّصل برقمه المسجّل ولم يُجب — يُعاد غداً" />
                      </Field>
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-ghost btn-sm" disabled={work} onClick={() => setOpen(null)}>إلغاء</button>
                      <button className="btn btn-primary btn-sm" disabled={work || !form.note.trim()} onClick={submit}>
                        <I name="save" size={17} /> تسجيل
                      </button>
                    </div>
                  </div>
                </td></tr>
              )}
            </React.Fragment>
          ))}</tbody>
        </table></div></div>
      ) : (
        <InlineAlert kind="info" title="لا حالات بلا حساب">كلّ ما أُدخل ورقياً ضُمّ لحساب صاحبه.</InlineAlert>
      )}
    </>
  );
}
