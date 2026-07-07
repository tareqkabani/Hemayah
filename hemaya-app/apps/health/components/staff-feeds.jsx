"use client";
/* ============================================================
   إشعارات ورسائل الموظّفين — من Supabase مباشرةً + Realtime (بديل المصفوفات التجريبيّة).
   • الإشعارات: مُوسَمةٌ بالسلطة (RLS: staff_notif_read = has_authority).
   • الرسائل: خيط الجهة 'body' لقضايا سلطة الموظّف (RLS staff_msg_read/write).
   يُشترَك حيّاً عبر postgres_changes (بلا مُرشِّح — RLS يعزل).
   ============================================================ */
import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@hemaya/supabase/src/browser";

const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);
const NT = { referral_in: ["var(--warning-10)", "var(--color-warning)"], referral: ["var(--success-10)", "var(--color-success)"], default: ["var(--green-10)", "var(--color-primary)"] };
const fmtTime = (ts) => { try { return new Date(ts).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } };

/* ── إشعارات الموظّف (من Supabase + Realtime) ── */
export function StaffNotifications({ go }) {
  const [items, setItems] = useState([]);
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    let active = true;
    const load = () => supabase.from("notifications").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (active) setItems(data ?? []); });
    load();
    const ch = supabase.channel("staff-notifs").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load()).subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase]);
  const open = async (n) => {
    if (!n.read) { await supabase.from("notifications").update({ read: true }).eq("id", n.id); setItems((s) => s.map((x) => x.id === n.id ? { ...x, read: true } : x)); }
    if (n.target_tab && go) go(n.target_tab);
  };
  const markAll = async () => { const ids = items.filter((n) => !n.read).map((n) => n.id); if (!ids.length) return; await supabase.from("notifications").update({ read: true }).in("id", ids); setItems((s) => s.map((x) => ({ ...x, read: true }))); };
  return (
    <div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">تنبيهات الطلبات الواردة من المركز، وما يتطلب اعتماداً، واكتمال الخدمات — حيّةً من قاعدة البيانات.</p>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-ghost sm" onClick={markAll}><I name="done_all" size={17} /> تعليم الكل كمقروء</button>
      </div>
      {items.length === 0 && <p className="lede" style={{ textAlign: "center", padding: 24 }}>لا إشعارات بعد.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((n) => {
          const [bg, fg] = NT[n.type] || NT.default;
          return (
            <button className={"ntf" + (n.read ? "" : " unread")} key={n.id} style={{ cursor: "pointer", textAlign: "start", width: "100%" }} onClick={() => open(n)}>
              <div className="ntf-ico" style={{ background: bg, color: fg }}><I name={n.type === "referral_in" ? "inbox" : "notifications"} size={20} fill /></div>
              <div style={{ flex: 1 }}>
                <div className="ntf-t">{n.title || "إشعار"}</div>
                <div className="ntf-d">{n.body}</div>
                <div className="ntf-time">{fmtTime(n.created_at)}</div>
              </div>
              {!n.read && <div className="dot-unread" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── مراسلات الموظّف مع طالب الحماية (خيط الجهة، من Supabase + Realtime) ── */
export function StaffMessages({ authority, senderLabel = "مختص الجهة", source = "referrals" }) {
  const supabase = useRef(createClient()).current;
  const [cases, setCases] = useState([]);   // [{case_id, secret}]
  const [caseId, setCaseId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // قائمة قضايا الموظّف — من إحالاته (referrals) أو من طلباته الأجنبيّة (foreign_requests).
  useEffect(() => {
    let active = true;
    const q = source === "foreign"
      ? supabase.from("foreign_requests").select("case_id, secret").order("created_at", { ascending: false })
      : supabase.from("referrals").select("case_id, protection_cases(secret_code)").eq("authority", authority).order("created_at", { ascending: false });
    q.then(({ data }) => {
      if (!active) return;
      const seen = new Set(); const list = [];
      (data ?? []).forEach((r) => {
        const cid = r.case_id; const secret = source === "foreign" ? r.secret : (r.protection_cases || {}).secret_code;
        if (cid && !seen.has(cid)) { seen.add(cid); list.push({ case_id: cid, secret: secret || "—" }); }
      });
      setCases(list); setCaseId((c) => c || (list[0] && list[0].case_id) || null);
    });
    return () => { active = false; };
  }, [supabase, authority, source]);

  // رسائل القضيّة المختارة (خيط الجهة) + اشتراك حيّ.
  useEffect(() => {
    if (!caseId) return;
    let active = true;
    supabase.from("messages").select("*").eq("case_id", caseId).eq("thread", "body").order("created_at", { ascending: true })
      .then(({ data }) => { if (active) setMsgs(data ?? []); });
    const ch = supabase.channel("staff-msgs-" + caseId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `case_id=eq.${caseId}` },
        (p) => { if (p.new.thread === "body") setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])); })
      .subscribe();
    return () => { active = false; try { supabase.removeChannel(ch); } catch (e) {} };
  }, [supabase, caseId]);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [msgs]);

  const send = async () => {
    const body = text.trim(); if (!body || !caseId) return; setText("");
    // الجهة تُرسل للمستفيد على خيط الجهة → direction='in' (وارد من منظور المستفيد).
    const { data } = await supabase.from("messages").insert({ case_id: caseId, thread: "body", direction: "in", body, sender_label: senderLabel }).select().single();
    if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  };
  const secret = (cases.find((c) => c.case_id === caseId) || {}).secret;

  return (
    <div>
      <h2 className="h2">المراسلات</h2>
      <p className="lede">قناة مؤمّنة مع طالب الحماية (خيط الجهة) لتنسيق الخدمة. الهوية بالرمز السري، ويُسجَّل كل تبادل في التدقيق (م15، م16).</p>
      <div className="thread-head">
        <I name="forum" size={17} color="var(--color-primary)" fill />
        <span>القضيّة:&nbsp;</span>
        <select value={caseId || ""} onChange={(e) => setCaseId(e.target.value)} style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "5px 10px", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", background: "var(--surface-card)" }}>
          {cases.length === 0 && <option value="">لا قضايا</option>}
          {cases.map((c) => <option key={c.case_id} value={c.case_id}>{c.secret}</option>)}
        </select>
      </div>
      <div className="conf-note"><I name="shield_lock" size={16} /> يُكتفى بالرمز السري في الواجهة؛ التفاصيل محصورةٌ بالمختص المعالِج.</div>
      <div className="card pad">
        <div className="msg-list" ref={listRef} style={{ maxHeight: 440, overflowY: "auto" }}>
          {msgs.length === 0 && <p className="lede" style={{ textAlign: "center", padding: 20 }}>لا رسائل في هذه القضيّة بعد.</p>}
          {msgs.map((m) => (
            <div className={"msg " + (m.direction === "in" ? "out" : "in")} key={m.id}>
              <div className="msg-meta"><b>{m.direction === "in" ? (m.sender_label || senderLabel) : "طالب الحماية"}</b> · {fmtTime(m.created_at)}</div>
              {m.body}
            </div>
          ))}
        </div>
        <div className="composer">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={caseId ? "رسالة إلى طالب الحماية…" : "اختر قضيّة"} dir="auto" disabled={!caseId} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <button className="send" onClick={send} disabled={!caseId || !text.trim()}><I name="send" size={20} /></button>
        </div>
      </div>
    </div>
  );
}
