"use client";
/* ============================================================
   المراسلات والإشعارات الحيّة + تحديث حالة الطلب فوريّاً (Realtime).
   تقرأ من Supabase (RLS: المستفيد يرى قضاياه فقط) وتشترك في التغييرات.
   ============================================================ */
import React, { useEffect, useState, useContext, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@hemaya/supabase/src/browser";
import { Tag, InlineAlert } from "@hemaya/ui";
import { RequestsContext } from "./identity-context";

const Ic = ({ name, size = 20, fill = false, color = "currentColor", style = {} }: any) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

const EMPTY = (icon: string, title: string, desc: string) => (
  <div className="card"><div className="empty">
    <span className="empty-ic"><Ic name={icon} size={30} color="var(--color-primary)" /></span>
    <div><div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)" }}>{title}</div>
      <p className="muted" style={{ maxWidth: "40ch", margin: "6px auto 0" }}>{desc}</p></div>
  </div></div>
);

/* ── المراسلات الحيّة ── */
export function Messages() {
  const requests = useContext(RequestsContext);
  const caseId = requests[0]?.id ?? null;
  const [thread, setThread] = useState<"center" | "body">("center");
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    supabase.from("messages").select("*").eq("case_id", caseId).order("created_at", { ascending: true })
      .then(({ data }) => { if (active) setMsgs(data ?? []); });
    const ch = supabase.channel("msgs-" + caseId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `case_id=eq.${caseId}` },
        (p: any) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [caseId, supabase]);

  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs, thread]);

  if (!caseId) return EMPTY("forum", "لا توجد مراسلات بعد", "تُفتح قناة المراسلة من المركز أو الجهة بعد تقديم طلبك.");

  const shown = msgs.filter((m) => m.thread === thread);
  const canReply = shown.some((m) => m.direction === "in"); // القناة مفتوحة إن ورد شيء

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const { data } = await supabase.from("messages").insert({ case_id: caseId, thread, direction: "out", body, sender_label: "أنت" }).select().single();
    if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  };

  return (
    <div className="card pad">
      <p className="lede" style={{ marginBottom: 14 }}>قناة تواصل مؤقّتة بالرمز السرّي — خيط منفصل مع المركز وآخر مع الجهة المختصة.</p>
      <div className="threads">
        <button className={"thread-tab" + (thread === "center" ? " on" : "")} onClick={() => setThread("center")}><Ic name="account_balance" size={16} /> المركز</button>
        <button className={"thread-tab" + (thread === "body" ? " on" : "")} onClick={() => setThread("body")}><Ic name="gavel" size={16} /> الجهة المختصة</button>
      </div>
      <div className="msg-list" ref={listRef} style={{ maxHeight: 420, overflowY: "auto" }}>
        {shown.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 20 }}>لا رسائل في هذا الخيط بعد.</p>}
        {shown.map((m) => (
          <div key={m.id} className={"msg " + (m.direction === "out" ? "out" : m.direction === "note" ? "note" : "in")}>
            <div className="msg-meta">
              {m.direction === "note" ? <Ic name="call" size={13} /> : null}
              <span>{m.sender_label || (m.direction === "out" ? "أنت" : "المركز")}</span>
              <span>· {new Date(m.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {m.body}
          </div>
        ))}
      </div>
      <div className="composer">
        <input placeholder={canReply ? "اكتب ردّك…" : "القناة تُفتح من المركز — لا يمكن البدء بالكتابة"} disabled={!canReply}
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="send" disabled={!canReply || !text.trim()} onClick={send}><Ic name="send" size={20} /></button>
      </div>
    </div>
  );
}

/* ── الإشعارات الحيّة ── */
export function Notifications({ go }: { go?: (id: string) => void }) {
  const requests = useContext(RequestsContext);
  const [items, setItems] = useState<any[]>([]);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    let active = true;
    const load = () => supabase.from("notifications").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (active) setItems(data ?? []); });
    load();
    const ch = supabase.channel("notifs")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [supabase]);

  const open = async (n: any) => {
    if (!n.read) { await supabase.from("notifications").update({ read: true }).eq("id", n.id); setItems((s) => s.map((x) => x.id === n.id ? { ...x, read: true } : x)); }
    if (n.target_tab && go) go(n.target_tab);
  };

  if (!requests.length) return EMPTY("notifications", "لا إشعارات بعد", "ستصلك إشعارات القرار والرسائل والمهل هنا بعد تقديم طلبك.");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 20 }}>لا إشعارات.</p>}
      {items.map((n) => (
        <button key={n.id} className={"ntf" + (n.read ? "" : " unread")} style={{ cursor: "pointer", textAlign: "start", width: "100%" }} onClick={() => open(n)}>
          <span className="ntf-ico" style={{ background: "var(--green-10)" }}><Ic name={n.type === "submission" ? "task_alt" : "notifications"} size={20} color="var(--color-primary)" fill /></span>
          <div style={{ flex: 1 }}>
            <div className="ntf-t">{n.title || "إشعار"}</div>
            <div className="ntf-d">{n.body}</div>
            <div className="ntf-time">{new Date(n.created_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
          {!n.read && <span className="dot-unread" />}
        </button>
      ))}
    </div>
  );
}

/* ── تحديث حالة الطلب فوريّاً: يشترك في تغييرات protection_cases ويعيد الجلب ── */
export function RealtimeRefresh() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  useEffect(() => {
    const ch = supabase.channel("cases-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "protection_cases" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [router, supabase]);
  return null;
}
