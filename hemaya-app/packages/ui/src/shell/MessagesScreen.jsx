"use client";
// شاشة المراسلات الموحّدة — سياسة المراسلة كلّها من config.messaging:
// من يبدأ، مع من، عزل الخيط بالطلب، قصر البدء على النشط، إيصال التسليم،
// ووسم الهوية. عدّاد غير مقروء لكل خيط وفتحه يصفّره (ثبات في القاعدة).
import React, { useState } from "react";
import { I, fmtWhen } from "./util";
import { Card, Tag } from "../components";

const SEL_STYLE = {
  height: 44,
  padding: "0 13px",
  border: "1px solid var(--field-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--field-bg)",
  color: "var(--text-strong)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  width: "100%",
};

export function MessagesScreen({
  config,
  lede,
  threads, // [{ id, secret, caseId, party, unread, msgs: [{from:'me'|'party', body, at}] }]
  activeCases, // [{ caseId, secret, label }] — يجوز بدء مراسلة عليها
  onOpenThread, // فتح الخيط → تصفير عدّاده في القاعدة
  onSend, // (thread, body)
  onStart, // (caseId, partyId) → ينشئ/يعيد الخيط
  senderLabel,
  now = new Date(),
}) {
  const M = config.messaging;
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [cReq, setCReq] = useState("");
  const [cWith, setCWith] = useState("");
  const cur = threads.find((t) => t.id === sel);
  const partyLabel = (id) => (M.parties.find((p) => p.id === id) || {}).label || id;

  const openThread = (t) => {
    setSel(t.id);
    if (t.unread > 0) onOpenThread(t);
  };
  const send = () => {
    if (!draft.trim() || !cur) return;
    onSend(cur, draft.trim());
    setDraft("");
  };
  const start = async () => {
    if (!cReq || !cWith) return;
    const ex = threads.find((t) => String(t.caseId) === String(cReq) && t.party === cWith);
    setComposing(false);
    setCReq("");
    setCWith("");
    if (ex) {
      openThread(ex);
      return;
    }
    const id = await onStart(cReq, cWith);
    if (id) setSel(id);
  };
  const bub = (me) => ({
    maxWidth: "80%",
    background: me ? "var(--color-primary)" : "var(--surface-card)",
    color: me ? "#fff" : "var(--text-strong)",
    border: me ? "none" : "1px solid var(--border-subtle)",
    padding: "10px 14px",
    borderRadius: 14,
    fontSize: 13.5,
    lineHeight: 1.7,
  });

  if (cur) {
    const L = partyLabel(cur.party);
    return (
      <div>
        <button className="link" onClick={() => setSel(null)} style={{ marginBottom: 12 }}>
          <I name="arrow_forward" size={16} /> رجوع للمراسلات
        </button>
        <Card className="card">
          <div
            className="row"
            style={{ justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div className="row" style={{ gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--surface-subtle)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <I name="shield_person" size={20} color="var(--color-primary)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{L}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  بشأن الطلب <span className="mono">{cur.secret}</span> · قناة مؤمّنة
                </div>
              </div>
            </div>
            <span className="row" style={{ gap: 6 }}>
              <Tag tone="neutral" size="sm" iconLeft={<I name="badge" size={13} />}>
                {M.identityTag}
              </Tag>
              <Tag tone="info" size="sm" iconLeft={<I name="lock" size={13} />}>
                مؤمّنة
              </Tag>
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 16,
              background: "var(--surface-page)",
              minHeight: 180,
            }}
          >
            {cur.msgs.length === 0 && (
              <p className="muted" style={{ textAlign: "center", margin: "auto", fontSize: 12.5 }}>
                لا رسائل بعد — اكتب أول رسالة.
              </p>
            )}
            {cur.msgs.map((m, i) => (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", alignItems: m.from === "me" ? "flex-start" : "flex-end" }}
              >
                <div style={bub(m.from === "me")}>{m.body}</div>
                <span className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>
                  {m.from === "me" ? senderLabel : L} · {fmtWhen(m.at, now)}
                  {m.from === "me" && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        marginInlineStart: 6,
                        color: "var(--green-70)",
                      }}
                    >
                      <I name="done_all" size={12} /> {M.deliveryReceipt}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 9, padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب رسالة…"
              dir="auto"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" disabled={!draft.trim()} onClick={send}>
              <I name="send" size={17} />
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const canInitiate = M.mode === "initiator";
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 className="h2">المراسلات</h2>
          <p className="lede">{lede}</p>
        </div>
        {canInitiate && !composing && (
          <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setComposing(true)}>
            <I name="add_comment" size={18} /> بدء مراسلة
          </button>
        )}
      </div>
      {composing && (
        <Card className="card pad" style={{ marginBottom: 16 }}>
          <b style={{ color: "var(--text-strong)", display: "block", marginBottom: 10 }}>بدء مراسلة مع القيادة</b>
          <div className="fld">
            <span className="fld-label">بشأن الطلب</span>
            <select value={cReq} onChange={(e) => setCReq(e.target.value)} style={SEL_STYLE}>
              <option value="">اختر الطلب النشط…</option>
              {activeCases.map((r) => (
                <option key={r.caseId} value={r.caseId}>
                  {r.secret} — {r.label}
                </option>
              ))}
            </select>
          </div>
          {M.activeCasesOnly && (
            <p className="muted" style={{ margin: "-8px 2px 14px", fontSize: 11.5 }}>
              <I name="lock" size={13} style={{ verticalAlign: "middle" }} /> الطلبات النشطة فقط؛ المكتملة لا تُفتح لها
              مراسلة. كل مراسلة معزولة بطلبها ولا تتداخل مع غيرها.
            </p>
          )}
          <div className="fld" style={{ marginBottom: 0 }}>
            <span className="fld-label">إلى</span>
            <div className="chips">
              {M.parties.map((p) => (
                <button key={p.id} className={"chip" + (cWith === p.id ? " on" : "")} onClick={() => setCWith(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setComposing(false);
                setCReq("");
                setCWith("");
              }}
            >
              إلغاء
            </button>
            <button className="btn btn-primary" disabled={!cReq || !cWith} onClick={start}>
              <I name="arrow_back" size={17} /> بدء المراسلة
            </button>
          </div>
        </Card>
      )}
      {threads.length === 0 && (
        <div className="ntf-empty" style={{ marginTop: 14 }}>
          <I name="forum" size={34} color="var(--text-disabled)" />
          <span>لا مراسلات بعد — ابدأ مراسلة على طلب نشط.</span>
        </div>
      )}
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {threads.map((t) => {
          const last = t.msgs[t.msgs.length - 1] || { body: "مراسلة جديدة", at: null };
          return (
            <div
              key={t.id}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer" }}
              onClick={() => openThread(t)}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "var(--surface-subtle)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <I name="shield_person" size={20} color="var(--color-primary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-strong)" }}>
                    {partyLabel(t.party)}{" "}
                    <span className="mono muted" style={{ fontWeight: 400 }}>
                      · {t.secret}
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                    {last.at ? fmtWhen(last.at, now) : ""}
                  </span>
                </div>
                <div
                  className="muted"
                  style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {last.body}
                </div>
              </div>
              {t.unread > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "var(--color-error)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {t.unread}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
