"use client";
// بوابة الدراسة/التقييم — التركيب الحيّ: PortalShell (القشرة الغبية) +
// PortalConfig من @hemaya/domain (الإعداد الذكي) + بيانات Supabase تحت RLS.
// حالة المستخدم كلّها في القاعدة: قراءة الإشعارات (notifications.read)،
// طيّ الجانبية (user_prefs)، عدّادات الخيوط (leadership_messages.read_at).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@hemaya/supabase/src/browser";
import { PORTAL_CONFIGS, businessDaysBetween } from "@hemaya/domain";
import { PortalShell, NotificationsScreen, MessagesScreen } from "@hemaya/ui";
import { Tasks, UnifiedForm, Dashboard, Profile } from "./screens";
import { PROTECTION_TYPES, REJECT_REASONS } from "./lookups";

const TRACK_AR = { local: "عادي", urgent: "عاجل", foreign: "أجنبي" };
const CAT_AR = { reporter: "مبلّغ", witness: "شاهد", expert: "خبير", victim: "ضحية", related: "ذو صلة" };

function mapTask(row, now) {
  const elapsed = businessDaysBetween(new Date(row.assigned_at), now);
  const status = row.submitted_at ? "done" : "new";
  const remainingUmb = 3 - elapsed;
  const due =
    status === "done"
      ? "مكتملة"
      : elapsed < 1
        ? "متبقٍّ يوم عمل"
        : remainingUmb === 2
          ? "متبقٍّ يومان"
          : remainingUmb === 1
            ? "متبقٍّ يوم"
            : remainingUmb <= 0
              ? "متجاوز المهلة"
              : `متبقٍّ ${remainingUmb} أيام`;
  const timer =
    elapsed < 1
      ? { total: 1, elapsed: 0, ref: "يوم عمل · م10" }
      : { total: 3, elapsed, ref: "مظلّة 3 أيام · م10" };
  return {
    caseId: row.case_id,
    secret: row.secret_code,
    refNo: row.ref_no,
    cat: CAT_AR[row.category] || row.category,
    track: TRACK_AR[row.source] || "عادي",
    foreign: row.foreign_info || null,
    peers: Number(row.peers) || 1,
    status,
    due,
    timer,
    assignedAt: row.assigned_at,
    createdAt: row.assigned_at,
    submittedAt: row.submitted_at,
  };
}

export function StudyEvalPortal({ role, me, initial, basePath }) {
  const cfg = PORTAL_CONFIGS[role];
  const supabase = useRef(createClient()).current;
  const now = new Date();

  const [tasks, setTasks] = useState(initial.tasks);
  const [notifRows, setNotifRows] = useState(initial.notifications);
  const [threadRows, setThreadRows] = useState(initial.threads);
  const [localThreads, setLocalThreads] = useState([]); // خيوط بدأها الموظف ولم تُرسل أول رسالة بعد
  const [details] = useState(initial.details || {});
  const [active, setActive] = useState(cfg.defaultScreen);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(!!initial.prefs?.["sidebar-" + role]);

  const rows = useMemo(() => tasks.map((r) => mapTask(r, now)), [tasks]);
  const taskByCase = useMemo(() => Object.fromEntries(rows.map((r) => [r.caseId, r])), [rows]);

  // ── إشعارات: فئات + مؤقّت المهلة للعاجل المثبّت ──
  const notifs = useMemo(
    () =>
      notifRows.map((n) => {
        const t = taskByCase[n.case_id];
        return {
          id: n.id,
          cat: n.type,
          crit: !!n.crit,
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          dest: n.target_tab === "messages" ? "messages" : "tasks",
          read: !!n.read,
          deadline:
            n.crit && t && t.status === "new"
              ? {
                  label: `${cfg.sla.output.label} — ${t.secret}`,
                  total: t.timer.total,
                  elapsed: t.timer.elapsed,
                  ref: t.timer.ref,
                }
              : null,
        };
      }),
    [notifRows, taskByCase]
  );
  const unreadNotifs = notifs.filter((n) => !n.read).length;

  // ── خيوط المراسلة مع القيادة: (طلب، قائد) — عدّاد غير المقروء من read_at ──
  const threads = useMemo(() => {
    const map = new Map();
    for (const m of threadRows) {
      const key = m.case_id + ":" + m.leader;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          caseId: m.case_id,
          secret: (taskByCase[m.case_id] || {}).secret || "—",
          party: m.leader,
          unread: 0,
          msgs: [],
        });
      }
      const t = map.get(key);
      t.msgs.push({ from: m.direction === "out" ? "me" : "party", body: m.body, at: m.created_at });
      if (m.direction === "in" && !m.read_at) t.unread += 1;
    }
    const db = Array.from(map.values());
    const extras = localThreads.filter((lt) => !map.has(lt.id));
    return [...extras, ...db].sort((a, b) => {
      const la = a.msgs[a.msgs.length - 1]?.at || "9999";
      const lb = b.msgs[b.msgs.length - 1]?.at || "9999";
      return la < lb ? 1 : -1;
    });
  }, [threadRows, localThreads, taskByCase]);
  const unreadMsgs = threads.reduce((a, t) => a + t.unread, 0);
  const newCount = rows.filter((r) => r.status === "new").length;

  // ── إعادة الجلب (المصدر الواحد: القاعدة) ──
  const tasksRpc = role === "studier" ? "my_study_tasks" : "my_assessment_tasks";
  const loadTasks = async () => {
    const { data } = await supabase.rpc(tasksRpc);
    if (data) setTasks(data);
  };
  const loadNotifs = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, case_id, type, title, body, target_tab, read, crit, created_at")
      .eq("recipient_id", me.id)
      .order("created_at", { ascending: false });
    if (data) setNotifRows(data);
  };
  const loadThreads = async () => {
    const { data } = await supabase
      .from("leadership_messages")
      .select("id, case_id, leader, direction, body, read_at, created_at")
      .order("created_at", { ascending: true });
    if (data) setThreadRows(data);
  };

  // ريل-تايم: أي تغيّرٍ على إشعاراتي/خيوطي يعيد الجلب (الفلترة عند الجلب لا عند الاشتراك)
  useEffect(() => {
    const ch = supabase
      .channel("se-shell-" + role)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, loadNotifs)
      .on("postgres_changes", { event: "*", schema: "public", table: "leadership_messages" }, loadThreads)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3400);
  };

  // ── الإجراءات — كلّها RPCs مدقَّقة أو تحديثات تحت RLS ──
  const markNotifRead = async (n) => {
    if (!n.read) {
      setNotifRows((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
  };
  const markAllNotifsRead = async () => {
    setNotifRows((xs) => xs.map((x) => ({ ...x, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("recipient_id", me.id).eq("read", false);
  };
  const openNotif = (n) => {
    markNotifRead(n);
    setSel(null);
    setActive(n.dest);
  };
  const revealSecret = async (task) => {
    const caseId = typeof task === "object" ? task.caseId : (rows.find((r) => r.secret === task) || {}).caseId;
    if (caseId) await supabase.rpc("record_secret_reveal", { _case_id: caseId });
  };
  // فتح مرفق في العارض = صف تدقيق (من · أي مستند · متى) — م15/16
  const openDoc = async (task, doc) => {
    await supabase.rpc("record_attachment_open", { _case_id: task.caseId, _doc: doc });
  };
  const toggleCollapsed = async () => {
    const v = !collapsed;
    setCollapsed(v);
    // اقرأ أحدث prefs قبل الدمج كي لا تُداس تفضيلات بوابةٍ أخرى مفتوحةٍ بالتوازي
    const { data: cur } = await supabase.from("user_prefs").select("prefs").eq("user_id", me.id).maybeSingle();
    await supabase.from("user_prefs").upsert(
      {
        user_id: me.id,
        prefs: { ...(cur?.prefs || initial.prefs || {}), ["sidebar-" + role]: v },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  };
  const openThread = async (t) => {
    setThreadRows((xs) =>
      xs.map((x) => (x.case_id === t.caseId && x.leader === t.party ? { ...x, read_at: x.read_at || new Date().toISOString() } : x))
    );
    await supabase.rpc("mark_leader_thread_read", { _case_id: t.caseId, _leader: t.party });
  };
  const sendMessage = async (t, body) => {
    const { error } = await supabase.rpc("send_leader_message", { _case_id: t.caseId, _leader: t.party, _body: body });
    if (error) {
      say("تعذّر الإرسال: " + error.message);
      return;
    }
    setLocalThreads((xs) => xs.filter((x) => x.id !== t.id));
    await loadThreads();
  };
  const startThread = (caseId, partyId) => {
    const key = caseId + ":" + partyId;
    const r = taskByCase[caseId];
    setLocalThreads((xs) =>
      xs.some((x) => x.id === key)
        ? xs
        : [{ id: key, caseId, secret: r ? r.secret : "—", party: partyId, unread: 0, msgs: [] }, ...xs]
    );
    return key;
  };

  const submitOutput = async (task, f) => {
    setBusy(true);
    const rejectReasons =
      f.rec === "رفض الحماية"
        ? Object.keys(f.rej)
            .filter((k) => f.rej[k])
            .map((k) => ({
              k,
              t: (REJECT_REASONS.find((x) => x.k === k) || {}).t || k,
              note: f.rejNote[k] || null,
            }))
        : null;
    const types =
      f.rec === "قبول كلي" || f.rec === "قبول جزئي"
        ? [
            ...Object.keys(f.types)
              .filter((k) => k !== "other" && f.types[k])
              .map((k) => {
                const idx = Number(k.slice(1));
                const label = PROTECTION_TYPES[idx]?.t || k;
                return f.subdur[k] ? `${label} (${f.subdur[k]})` : label;
              }),
            ...(f.types.other && f.otherText ? [`أخرى: ${f.otherText}`] : []),
          ]
        : null;
    const duration = f.dur && f.dur.startsWith("ثلاثون") ? "30 days" : null;
    const notes = [f.dur === "مدة محدّدة" && f.durText ? `المدة المقترحة: ${f.durText}` : null, f.kama || null]
      .filter(Boolean)
      .join(" — ");
    const fn = role === "studier" ? "submit_study" : "submit_assessment";
    const { error } = await supabase.rpc(fn, {
      _case_id: task.caseId,
      _recommendation: f.rec,
      _reject_reasons: rejectReasons,
      _proposed_type: types,
      _proposed_duration: duration,
      _notes: notes || null,
      _partial_reason: f.rec === "قبول جزئي" ? f.partial || null : null,
      // بندا الاطّلاع: «بالاطّلاع على الطلب المرافق تبيّن الآتي» (يوجد/لا يوجد)
      _found_recommendation: f.recExists ? f.recExists === "يوجد" : null,
      _found_request: f.reqExists ? f.reqExists === "يوجد" : null,
    });
    setBusy(false);
    if (error) {
      say("تعذّر الاعتماد: " + error.message);
      return;
    }
    setSel(null);
    say(`اعتُمد ${cfg.strings.output} وأُرسل للتجميع الآلي — ${task.secret}`);
    await Promise.all([loadTasks(), loadNotifs()]);
  };

  const logout = async () => {
    try {
      await fetch(basePath + "/auth/signout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  };

  const go = (id) => {
    setActive(id);
    setSel(null);
  };
  const openTask = (r) => {
    setActive("tasks");
    setSel(r && r.status === "new" ? r : null);
  };

  let body;
  if (active === "tasks")
    body = sel ? (
      <UnifiedForm
        cfg={cfg}
        me={me}
        task={sel}
        detail={details[sel.caseId]}
        back={() => setSel(null)}
        onSubmit={submitOutput}
        onReveal={revealSecret}
        onOpenDoc={openDoc}
        busy={busy}
      />
    ) : (
      <Tasks cfg={cfg} rows={rows} open={setSel} />
    );
  else if (active === "dashboard")
    body = <Dashboard cfg={cfg} rows={rows} openTask={openTask} go={go} notifs={notifs} onOpenNotif={openNotif} />;
  else if (active === "messages")
    body = (
      <MessagesScreen
        config={cfg}
        lede="تواصل مؤمّن مع قيادة المركز (نائب/رئيس المركز) بشأن مهامّك — تصلك تذكيرات اقتراب الميعاد ولك الرد وبدء مراسلة. كل رسالة مسجّلة في التدقيق بالرمز السري."
        threads={threads}
        activeCases={rows.filter((r) => r.status === "new").map((r) => ({ caseId: r.caseId, secret: r.secret, label: r.cat }))}
        onOpenThread={openThread}
        onSend={sendMessage}
        onStart={startThread}
        senderLabel={cfg.label}
      />
    );
  else if (active === "notifications")
    body = <NotificationsScreen config={cfg} items={notifs} onOpen={openNotif} onMarkAllRead={markAllNotifsRead} />;
  else body = <Profile cfg={cfg} me={me} />;

  return (
    <PortalShell
      config={cfg}
      brand={{
        logoSrc: basePath + "/brand/logo-center.png",
        portalTitle: `بوابة ${cfg.label} — الدراسة والتقييم`,
        markIcon: role === "studier" ? "analytics" : "psychology",
      }}
      user={{ name: me.name }}
      active={active}
      onNavigate={go}
      counters={{ tasks: newCount, messages: unreadMsgs, notifications: unreadNotifs }}
      secret={sel ? sel.secret : null}
      onRevealSecret={revealSecret}
      roleTag="سري للغاية"
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      onLogout={logout}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}
