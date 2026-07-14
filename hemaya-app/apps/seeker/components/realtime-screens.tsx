"use client";
/* ============================================================
   المراسلات والإشعارات الحيّة (Realtime) — دفعة 12 يوليو الثانية.
   المراسلات: قناة «ردّ فقط» يفتحها المركز/الجهة (يُقفل المؤلّف بعد ردّ
   المستفيد حتى يصل ردّ جديد)، رأس خيط، حالة تسليم، عدّادات غير مقروء.
   الإشعارات: فلاتر بعدّادات، تجميع زمني، فئة طوارئ مثبّتة، مهل حيّة،
   فتح بالنقر يعلّم القراءة في قاعدة البيانات (RLS: قضايا المستفيد فقط).
   ============================================================ */
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@hemaya/supabase/src/browser";
import { Tag, DeadlineTimer } from "@hemaya/ui";

const Ic = ({ name, size = 20, fill = false, color = "currentColor", style = {} }: any) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

/* تصنيف أنواع الإشعارات القاعديّة إلى فئات العرض (أيقونة/لون/فلتر) */
export const NOTIF_META = (type: string): { cat: string; icon: string; tone: string } =>
  (({
    decision: { cat: "decision", icon: "verified", tone: "success" },
    terminate: { cat: "decision", icon: "lock", tone: "error" },
    reminder: { cat: "deadline", icon: "timer", tone: "warning" },
    deadline: { cat: "deadline", icon: "timer", tone: "warning" },
    submission: { cat: "status", icon: "task_alt", tone: "success" },
    triage: { cat: "status", icon: "filter_alt", tone: "info" },
    agreement: { cat: "status", icon: "verified_user", tone: "success" },
    grievance_in: { cat: "status", icon: "gavel", tone: "warning" },
    message: { cat: "message", icon: "forum", tone: "primary" },
    emergency: { cat: "emergency", icon: "e911_emergency", tone: "error" },
  }) as Record<string, { cat: string; icon: string; tone: string }>)[type] || { cat: "status", icon: "notifications", tone: "primary" };

export const NOTIF_TONES: Record<string, [string, string]> = {
  info: ["var(--info-10)", "var(--color-info)"],
  primary: ["var(--green-10)", "var(--color-primary)"],
  warning: ["var(--warning-10)", "var(--color-warning)"],
  success: ["var(--success-10)", "var(--color-success)"],
  error: ["var(--error-10)", "var(--color-error)"],
};

const EMPTY = (icon: string, title: string, desc: string) => (
  <div className="card"><div className="empty">
    <span className="empty-ic"><Ic name={icon} size={30} color="var(--color-primary)" /></span>
    <div><div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)" }}>{title}</div>
      <p className="muted" style={{ maxWidth: "40ch", margin: "6px auto 0" }}>{desc}</p></div>
  </div></div>
);

/* ── المراسلات — القناة يفتحها المركز/الجهة ولطالب الحماية الردّ (منعاً للإغراق) ── */
const THREAD_INFO: Record<string, { title: string; officer: string; icon: string }> = {
  center: { title: "مركز الحماية", officer: "منسّق الحماية", icon: "apartment" },
  body: { title: "الجهة المختصة", officer: "ضابط الاتصال المعتمد", icon: "gavel" },
};

export function Messages({ msgs, sendMsg, msgReadIds, markThreadRead }: {
  msgs: any[]; sendMsg: (thread: string, body: string) => void;
  msgReadIds: string[]; markThreadRead: (thread: string) => void;
}) {
  const [tab, setTab] = useState<"center" | "body">("center");
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const th = THREAD_INFO[tab];
  const shown = msgs.filter((m) => m.thread === tab);
  const hasIn = shown.some((m) => m.direction === "in");
  const real = shown.filter((m) => m.direction !== "note");
  // «الرد فقط»: لا كتابة قبل أول رسالة واردة، ويُقفل المؤلّف بعد ردّك حتى يصل ردّ جديد
  const locked = !hasIn || (real.length > 0 && real[real.length - 1].direction === "out");

  useEffect(() => { markThreadRead(tab); }, [tab, shown.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs, tab]);

  const unreadIn = (key: string) => msgs.filter((m) => m.thread === key && m.direction === "in" && !msgReadIds.includes(m.id)).length;

  if (!msgs.length) return EMPTY("forum", "لا مراسلات بعد", "تُفتح قناة المراسلة من المركز أو الجهة بعد تقديم طلبك.");

  const send = () => {
    const body = text.trim();
    if (locked || !body) return;
    setText("");
    sendMsg(tab, body);
  };

  return (
    <div>
      <p className="lede" style={{ marginBottom: 14 }}>قناة مؤمّنة بالرمز السري ومسجّلة في التدقيق — يفتحها المركز أو الجهة، ولك الردّ عند وصول رسالة. المحاضر الهاتفية تظهر كتوثيق.</p>
      <div className="threads">
        {(["center", "body"] as const).map((key) => (
          <button key={key} className={"thread-tab" + (tab === key ? " on" : "")} onClick={() => setTab(key)}>
            <Ic name={THREAD_INFO[key].icon} size={16} /> {THREAD_INFO[key].title}
            {unreadIn(key) > 0 && <span className="nav-badge" style={{ marginInlineStart: 4 }}>{unreadIn(key)}</span>}
          </button>
        ))}
      </div>
      <div className="card pad">
        <div className="row" style={{ justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
          <div className="row" style={{ gap: 8 }}>
            <Ic name={th.icon} size={18} color="var(--color-primary)" />
            <b style={{ fontSize: 14, color: "var(--text-strong)" }}>{th.officer}</b>
          </div>
          <Tag tone="info" size="sm" iconLeft={<Ic name="lock" size={12} />}>هويتك تظهر لهم بالرمز السري</Tag>
        </div>
        {shown.length === 0 ? (
          <div className="ntf-empty" style={{ margin: "14px 0" }}>
            <Ic name="forum" size={30} color="var(--text-disabled)" />
            <b style={{ color: "var(--text-strong)" }}>لا رسائل بعد</b>
            <span style={{ fontSize: 13 }}>تُفتح المحادثة عند مراسلة {th.title} لك.</span>
          </div>
        ) : (
          <div className="msg-list" ref={listRef} style={{ maxHeight: 420, overflowY: "auto" }}>
            {shown.map((m) => (
              <div key={m.id} className={"msg " + (m.direction === "out" ? "out" : m.direction === "note" ? "note" : "in")}>
                <div className="msg-meta">
                  {m.direction === "note" ? <Ic name="call" size={13} color="var(--warning-50)" /> : null}
                  <b style={{ color: m.direction === "note" ? "var(--warning-70)" : "var(--text-secondary)" }}>{m.sender_label || (m.direction === "out" ? "أنت" : th.officer)}</b>
                  <span>· {new Date(m.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {m.body}
                {m.direction === "out" && <div className="msg-meta" style={{ marginTop: 6, marginBottom: 0, justifyContent: "flex-end" }}><Ic name="check_circle" size={13} color="var(--color-success)" /> سُلّمت — مسجّلة في التدقيق</div>}
              </div>
            ))}
          </div>
        )}
        {locked ? (
          <div className="composer" style={{ alignItems: "center", gap: 10 }}>
            <Ic name="lock_clock" size={20} color="var(--text-disabled)" />
            <span className="muted" style={{ flex: 1 }}>
              {hasIn ? `أُرسلت رسالتك وسُجّلت — تُفتح الكتابة عند وصول ردّ جديد من ${th.title}.` : `القناة يفتحها ${th.title} — لا يمكن البدء بالكتابة.`}
            </span>
          </div>
        ) : (
          <div className="composer">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tab === "body" ? "ردّك للجهة يمرّ عبر المركز…" : "اكتب ردّك المؤمّن…"} dir="auto" onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="send" disabled={!text.trim()} onClick={send}><Ic name="send" size={20} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── الإشعارات الحيّة — فلاتر، تجميع زمني، طوارئ مثبّتة، مهل حيّة ── */
const NOTIF_FILTERS = [
  { id: "all", t: "الكل" }, { id: "unread", t: "غير المقروء" }, { id: "decision", t: "القرارات" }, { id: "deadline", t: "المهل" }, { id: "message", t: "الرسائل" },
];
const dayGroup = (iso: string) => {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = (midnight(new Date()) - midnight(new Date(iso))) / 86400000;
  return diff < 1 ? "اليوم" : diff < 2 ? "أمس" : "الأقدم";
};
const deadlineOf = (n: any) => {
  if (!n.due_at) return null;
  const day = 86400000;
  const total = Math.max(1, Math.round((new Date(n.due_at).getTime() - new Date(n.created_at).getTime()) / day));
  const elapsed = Math.min(total, Math.max(0, Math.floor((Date.now() - new Date(n.created_at).getTime()) / day)));
  return { total, elapsed };
};

export function Notifications({ go }: { go?: (id: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [flt, setFlt] = useState("all");
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

  const isUnread = (n: any) => !n.read;
  const catOf = (n: any) => NOTIF_META(n.type).cat;
  const inCat = (n: any, f: string) => catOf(n) === f || (f === "decision" && catOf(n) === "status");
  const match = (n: any) => (flt === "all" ? true : flt === "unread" ? isUnread(n) : inCat(n, flt));
  const countOf = (f: string) => items.filter((n) => (f === "all" ? true : f === "unread" ? isUnread(n) : inCat(n, f))).length;

  const open = async (n: any) => {
    if (!n.read) { await supabase.from("notifications").update({ read: true }).eq("id", n.id); setItems((s) => s.map((x) => x.id === n.id ? { ...x, read: true } : x)); }
    if (n.target_tab && go) go(n.target_tab);
  };
  const markAllRead = async () => {
    const ids = items.filter(isUnread).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setItems((s) => s.map((x) => ({ ...x, read: true })));
  };

  if (!items.length) return EMPTY("notifications", "لا إشعارات بعد", "ستصلك إشعارات القرار والرسائل والمهل هنا لحظيّاً بعد تقديم طلبك.");

  const visible = items.filter(match);
  const crit = visible.filter((n) => catOf(n) === "emergency");
  const rest = visible.filter((n) => catOf(n) !== "emergency");
  const groups = ["اليوم", "أمس", "الأقدم"].map((g) => [g, rest.filter((n) => dayGroup(n.created_at) === g)] as const).filter(([, arr]) => arr.length);

  const Item = ({ n }: { n: any }) => {
    const meta = NOTIF_META(n.type);
    const [bg, fg] = NOTIF_TONES[meta.tone];
    const unread = isUnread(n);
    const emergency = meta.cat === "emergency";
    const dl = meta.cat === "deadline" ? deadlineOf(n) : null;
    return (
      <button className={"ntf" + (emergency ? " crit" : unread ? " unread" : "")} onClick={() => open(n)}>
        <div className="ntf-ico" style={{ background: emergency ? "var(--color-error)" : bg, color: emergency ? "#fff" : fg }}><Ic name={meta.icon} size={20} fill /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="ntf-t">{n.title || "إشعار"}</span>
            {emergency && <Tag tone="error" size="sm" iconLeft={<Ic name="priority_high" size={12} />}>طوارئ</Tag>}
          </div>
          <div className="ntf-d">{n.body}</div>
          {dl && <div style={{ marginTop: 10, maxWidth: 420 }}><DeadlineTimer label={n.title || "مهلة نظامية"} totalDays={dl.total} daysElapsed={dl.elapsed} articleRef="" /></div>}
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <span className="ntf-time">{new Date(n.created_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</span>
            {n.target_tab && <span className="linkbtn" style={{ fontSize: 12.5 }}>فتح <Ic name="chevron_left" size={14} /></span>}
          </div>
        </div>
        {unread && <span className="dot-unread" />}
      </button>
    );
  };

  return (
    <div>
      <p className="lede">تنبيهات القرارات والمهل والمراسلات — تصل لحظيّاً. انقر أي إشعار لفتح وجهته، وإشعارات الطوارئ مثبّتة أعلى القائمة.</p>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          {NOTIF_FILTERS.map((f) => (
            <button key={f.id} className={"flt" + (flt === f.id ? " on" : "")} onClick={() => setFlt(f.id)}>{f.t}<span className="flt-n">{countOf(f.id)}</span></button>
          ))}
        </div>
        <button className="btn btn-ghost sm" onClick={markAllRead}><Ic name="done_all" size={16} /> تعليم الكل كمقروء</button>
      </div>
      {crit.length > 0 && <div style={{ display: "grid", gap: 10, marginBottom: 4 }}>{crit.map((n) => <Item n={n} key={n.id} />)}</div>}
      {groups.map(([g, arr]) => (
        <div key={g}>
          <div className="ntf-group">{g}</div>
          <div style={{ display: "grid", gap: 10 }}>{arr.map((n) => <Item n={n} key={n.id} />)}</div>
        </div>
      ))}
      {visible.length === 0 && (
        <div className="ntf-empty">
          <Ic name="notifications_off" size={34} color="var(--text-disabled)" />
          <b style={{ color: "var(--text-strong)" }}>لا إشعارات هنا</b>
          <span style={{ fontSize: 13 }}>{flt === "unread" ? "قرأت كل إشعاراتك." : "لا إشعارات في هذا التصنيف بعد."}</span>
        </div>
      )}
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
