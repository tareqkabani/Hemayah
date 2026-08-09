'use client';
/* ============================================================
   بوابة مدير النظام — إدارة كاملة لمحتوى المنصّة (تسليم 7 أغسطس).
   المرجع التصميمي: refs/admin-portal.jsx + refs/admin-screens-c.jsx —
   يُعاد بناؤه على القشرة الموحّدة ولا يُنسخ.
   المبدأ: sysadmin_no_pii — لا بيانات مشمولين هنا أصلاً (RLS)، والمحتوى
   يُقرأ ويُكتب في جداول طبقة المحتوى الحقيقية؛ المقفل يمرّ بطلب اعتماد.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { Card, Tag, InlineAlert, PortalShell } from "@hemaya/ui";
import { ROLE_LABEL, PORTALS } from "@hemaya/domain";
import {
  updateItemLabel, saveItemOrder, setItemActive, addItem,
  submitChangeRequest, saveTemplate, setTemplateActive, saveSystemMessage, setSetting,
  grantRole, revokeRole, addBranchUnit, updateUnit,
} from "@/lib/admin-actions";
import "./admin.css";

const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}>{name}</span>
);

/* شاشات البوابة العشر — القشرة تقرأ التسميات من screenMeta */
const SCREENS = ["overview", "content", "users", "roles", "entities", "settings", "flags", "audit", "health", "profile"];
const SCREEN_META = {
  overview: { t: "النظرة العامة", icon: "dashboard" },
  content: { t: "القوائم والمحتوى", icon: "library_books" },
  users: { t: "المستخدمون", icon: "group" },
  roles: { t: "الأدوار والصلاحيات", icon: "admin_panel_settings" },
  entities: { t: "الجهات ووحداتها", icon: "account_balance" },
  settings: { t: "الإعدادات والمدد", icon: "tune" },
  flags: { t: "أعلام الميزات", icon: "flag" },
  audit: { t: "سجل التدقيق التقني", icon: "receipt_long" },
  health: { t: "صحة النظام", icon: "monitor_heart" },
  profile: { t: "الملف الشخصي", icon: "account_circle" },
};
const SHELL_CONFIG = { screens: SCREENS, screenMeta: SCREEN_META };

/* مجموعات القوائم الخمس (بنية شاشة الأدمن — من المرجع التصميمي) */
const LIST_GROUPS = [
  { id: "intake", t: "الطلب والتقديم", icon: "assignment" },
  { id: "triage", t: "الفرز والدراسة والتقييم", icon: "fact_check" },
  { id: "decision", t: "القرار والتظلّم", icon: "gavel" },
  { id: "exec", t: "التنفيذ والمتابعة", icon: "shield_lock" },
  { id: "gov", t: "الحوكمة والثوابت", icon: "account_balance" },
];
const NOTIF_CATS = { intake: "الطلب والفرز", entity: "الجهات المختصّة", decision: "القرار والاتفاقية", grievance: "التظلّم", exec: "التنفيذ والمتابعة", urgent: "العاجل والأجنبي", internal: "داخليّ للموظفين" };
const CHANNEL_AR = { platform: "المنصّة", app: "التطبيق", sms: "رسالة نصية", official_mail: "بريد رسمي", entity_portal: "بوابة الجهة", staff_portal: "بوابة الموظف" };
const TONE = {
  error: { t: "منع", icon: "block" },
  warning: { t: "تنبيه", icon: "warning" },
  info: { t: "إفادة", icon: "info" },
  success: { t: "تأكيد", icon: "check_circle" },
};
const vars = (s) => (s.match(/\{[^}]+\}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
const hit = (q, ...f) => !q.trim() || f.join(" ").toLowerCase().includes(q.trim().toLowerCase());

export function AdminPortal({ me, lists, itemsByList, templates, sysMessages, legalTexts, changeRequests, settings, techAudit, health, staff, org }) {
  const [active, setActive] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState("");
  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const pendingCcr = changeRequests.filter((c) => c.status === "pending").length;

  const sysMsgOf = (key) => sysMessages.find((m) => m.message_key === key)?.body || "";

  return (
    <PortalShell
      config={SHELL_CONFIG}
      brand={{ logoSrc: "/admin/brand/logo-center.png", portalTitle: "بوابة مدير النظام", markIcon: "settings_account_box" }}
      user={{ name: me.name, verified: true }}
      active={active}
      onNavigate={setActive}
      counters={{ content: pendingCcr || null }}
      roleTag="بلا بيانات مشمولين"
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
      onLogout={() => {
        // مسار الخروج POST يمسح الجلسة ويرجع JSON — ثم ينتقل العميل للبوابة الموحّدة.
        // (كان window.location.href=GET إلى مسارٍ لا يقبل إلا POST ⇒ 405 فلا يخرج.)
        fetch("/admin/auth/signout", { method: "POST" }).finally(() => { window.location.href = "/"; });
      }}
      toast={toast}
    >
      {active === "overview" && (
        <Overview lists={lists} itemsByList={itemsByList} templates={templates}
          sysMessages={sysMessages} legalTexts={legalTexts} pendingCcr={pendingCcr}
          noPiiText={sysMsgOf("s_sysadmin")} go={setActive} />
      )}
      {active === "content" && (
        <ContentScreen lists={lists} itemsByList={itemsByList} templates={templates}
          sysMessages={sysMessages} legalTexts={legalTexts} say={say} noPii={sysMsgOf("s_sysadmin")} />
      )}
      {active === "users" && <UsersScreen staff={staff} me={me} say={say} />}
      {active === "roles" && <RolesScreen staff={staff} />}
      {active === "entities" && <EntitiesScreen org={org} say={say} />}
      {active === "settings" && <SettingsScreen settings={settings} say={say} />}
      {active === "flags" && <FlagsScreen settings={settings} say={say} />}
      {active === "audit" && <AuditScreen rows={techAudit} />}
      {active === "health" && <HealthScreen health={health} />}
      {active === "profile" && <Profile me={me} />}
      {!["overview", "content", "users", "roles", "entities", "settings", "flags", "audit", "health", "profile"].includes(active) && <ComingSoon meta={SCREEN_META[active]} />}
    </PortalShell>
  );
}

/* ═══════════ النظرة العامة ═══════════ */
function Overview({ lists, itemsByList, templates, sysMessages, legalTexts, pendingCcr, noPiiText, go }) {
  const itemsCount = Object.values(itemsByList).reduce((a, x) => a + x.length, 0);
  const activeTpl = templates.filter((t) => t.active).length;
  const S = ({ icon, v, l, tone }) => (
    <Card className="card ad-stat">
      <span className="ad-stat-ico" style={{ background: `var(--${tone}-10, var(--green-10))` }}><I name={icon} size={22} fill color="var(--color-primary)" /></span>
      <span><b className="ad-stat-v">{v}</b><span className="ad-stat-l">{l}</span></span>
    </Card>
  );
  return (
    <div>
      <h2 className="h2">النظرة العامة</h2>
      <p className="lede">إدارة كاملة لمحتوى المنصّة: القوائم التي تغذّي الحقول، ونصوص الإشعارات، ولافتات المنع، والنصوص النظامية — كل تعديل يسري على كل البوابات ويُسجَّل في التدقيق.</p>
      {noPiiText && <InlineAlert kind="warning" title="حجب بيانات المشمولين (sysadmin_no_pii)" style={{ marginBottom: 16 }}>{noPiiText}</InlineAlert>}
      <div className="ad-stats">
        <S icon="list_alt" v={lists.length} l="قائمة مرجعية" tone="green" />
        <S icon="category" v={itemsCount} l="بنداً" tone="green" />
        <S icon="notifications" v={`${activeTpl}/${templates.length}`} l="قالب إشعار مفعّل" tone="info" />
        <S icon="report" v={sysMessages.length} l="رسالة نظام وتحقق" tone="warning" />
        <S icon="gavel" v={legalTexts.length} l="نصوص نظامية وإقرارات" tone="green" />
        <S icon="approval" v={pendingCcr} l="طلب تعديل بانتظار الاعتماد" tone="warning" />
      </div>
      <Card className="card pad" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", rowGap: 10 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <b style={{ fontSize: 15, color: "var(--text-strong)" }}>إدارة محتوى المنصّة</b>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              المخزَّن في جداول الأعمال هو مفتاح البند (item_key) لا نصّه — تحسين الصياغة لا يمسّ السجلات.
              القوائم المسنَدة لمواد نظامية مقفلة: تعديلها يُرفع لاعتماد رئيس المركز قبل السريان.
            </div>
          </div>
          <button className="btn btn-primary sm" onClick={() => go("content")}><I name="library_books" size={17} /> فتح القوائم والمحتوى</button>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════ القوائم والمحتوى — الشاشة الأهم ═══════════ */
function ContentScreen({ lists, itemsByList, templates, sysMessages, legalTexts, say, noPii }) {
  const [tab, setTab] = useState("lists");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null); // {kind, key}

  const counts = { lists: lists.length, notifs: templates.length, sys: sysMessages.length, legals: legalTexts.length };
  const TABS = [["lists", "القوائم المرجعية"], ["notifs", "رسائل الإشعارات"], ["sys", "رسائل النظام والتحقق"], ["legals", "النصوص النظامية والإقرارات"]];

  if (open?.kind === "lists") {
    const l = lists.find((x) => x.list_key === open.key);
    return <ListDetail l={l} items={itemsByList[l.list_key] || []} back={() => setOpen(null)} say={say} />;
  }
  if (open?.kind === "notifs") {
    const n = templates.find((x) => x.template_key === open.key);
    return <NotifDetail n={n} back={() => setOpen(null)} say={say} footer={legalTexts.find((x) => x.text_key === "l_footer")?.body} />;
  }
  if (open?.kind === "sys" || open?.kind === "legals") {
    const m = open.kind === "sys"
      ? sysMessages.find((x) => x.message_key === open.key)
      : legalTexts.find((x) => x.text_key === open.key);
    return <TextDetail m={m} kind={open.kind} back={() => setOpen(null)} say={say} />;
  }

  return (
    <div>
      <h2 className="h2">إدارة محتوى المنصّة</h2>
      <p className="lede">مصدرٌ واحد لكل ما تعرضه البوابات من قيمٍ ونصوص. التعديل يسري على كل البوابات ويُسجَّل في التدقيق.</p>
      {noPii && <InlineAlert kind="info" title="قوالب ونصوص فقط" style={{ marginBottom: 14 }}>المحتوى هنا لا يتضمّن بيانات مشمولين — المتغيّرات بين قوسين {"{}"} تُعبّأ آلياً عند الإرسال.</InlineAlert>}

      <div className="ad-tabs">{TABS.map(([k, t]) => (
        <button key={k} className={"ad-tab" + (tab === k ? " on" : "")} onClick={() => { setTab(k); setQ(""); }}>
          {t} <span className="mono muted" style={{ fontSize: 11 }}>{counts[k]}</span>
        </button>))}
      </div>

      <div className="row" style={{ marginBottom: 16, gap: 10 }}>
        <span className="ad-search"><I name="search" size={18} color="var(--text-secondary)" />
          <input placeholder="بحث في المحتوى…" value={q} onChange={(e) => setQ(e.target.value)} /></span>
        <button className="btn btn-ghost" onClick={() => {
          const data = { lists, items: itemsByList, templates, sysMessages, legalTexts };
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
          a.download = "hemaya-content.json"; a.click();
          say("صُدّر المحتوى JSON");
        }}><I name="download" size={18} /> تصدير المحتوى</button>
      </div>

      {tab === "lists" && <ListsTab lists={lists} itemsByList={itemsByList} q={q} open={(k) => setOpen({ kind: "lists", key: k })} />}
      {tab === "notifs" && <NotifsTab templates={templates} q={q} open={(k) => setOpen({ kind: "notifs", key: k })} say={say} />}
      {tab === "sys" && <TextsTab items={sysMessages} kind="sys" q={q} open={(k) => setOpen({ kind: "sys", key: k })} />}
      {tab === "legals" && <TextsTab items={legalTexts} kind="legals" q={q} open={(k) => setOpen({ kind: "legals", key: k })} />}
    </div>
  );
}

/* ——— تبويب القوائم ——— */
function ListsTab({ lists, itemsByList, q, open }) {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      {LIST_GROUPS.map((g) => {
        const rows = lists.filter((l) => l.domain === g.id &&
          hit(q, l.title, l.legal_ref || "", l.list_key, (itemsByList[l.list_key] || []).map((x) => x.label + " " + x.item_key).join(" ")));
        if (!rows.length) return null;
        return (
          <div key={g.id}>
            <div className="ad-sec-h"><I name={g.icon} size={19} color="var(--color-primary)" /> {g.t}
              <span className="spacer" /><span className="muted" style={{ fontSize: 12 }}>{rows.length} قائمة</span></div>
            <div className="ad-grid">
              {rows.map((l) => {
                const items = itemsByList[l.list_key] || [];
                const activeN = items.filter((i) => i.active).length;
                return (
                  <button className="ad-tile" key={l.list_key} onClick={() => open(l.list_key)}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="ad-ico"><I name={l.icon || "list"} size={20} color="var(--color-primary)" fill /></span>
                        <span style={{ textAlign: "start" }}>
                          <b style={{ color: "var(--text-strong)", fontSize: 14 }}>{l.title}</b><br />
                          <span className="muted mono" style={{ fontSize: 11 }}>{l.list_key}</span>
                          {l.legal_ref && <span className="muted" style={{ fontSize: 11.5 }}> · {l.legal_ref}</span>}
                        </span>
                      </div>
                      <Tag tone="neutral" size="sm">{activeN}{activeN !== items.length ? `/${items.length}` : ""}</Tag>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      <span className="achip">{l.locked
                        ? <><I name="lock" size={12} /> ثابت نظاميّ — التعديل بالاعتماد</>
                        : <><I name="edit" size={12} /> قابل للتحرير</>}</span>
                      {(l.scope || []).length > 0 && <span className="achip"><span className="k">تُستخدم في:</span> {l.scope.length > 2 ? l.scope[0] + " +" + (l.scope.length - 1) : l.scope.join(" · ")}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListDetail({ l, items, back, say }) {
  const [rows, setRows] = useState(items);
  const [add, setAdd] = useState("");
  const [edit, setEdit] = useState(null); // {key, v}
  const [busy, setBusy] = useState(false);
  // الترتيب متسخٌ فقط إن تغيّر تسلسل المفاتيح نفسها (لا مجرّد إضافة بندٍ جديد
  // فُرِغ للخادم فوراً) — نقارن بمجموعةٍ مرتّبة تُحيّد الإضافة عن إعادة الترتيب.
  const orderDirty = useMemo(() => {
    const cur = rows.map((r) => r.item_key);
    const orig = items.map((r) => r.item_key);
    if (cur.length !== orig.length) return false; // إضافة/تحميل جديد — لا تُحسب ترتيباً
    return cur.join("|") !== orig.join("|");
  }, [rows, items]);

  // القائمة المقفلة: تحرير محلّي ثم رفعٌ للاعتماد بحمولة كاملة
  const [draft, setDraft] = useState(null); // نسخة عمل للمقفل
  const work = l.locked ? (draft ?? rows) : rows;
  const lockedDirty = l.locked && draft && JSON.stringify(draft) !== JSON.stringify(rows);

  // ترجع true عند النجاح كي يبني المتّصل عليها (تصفير المسودة، التراجع…)
  const run = async (fn, okMsg) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { say("⚠ " + r.error); return false; }
    say(okMsg + " — مُسجَّل في التدقيق");
    return true;
  };

  const editLabel = async (key, v) => {
    if (l.locked) { setDraft(work.map((x) => (x.item_key === key ? { ...x, label: v } : x))); return; }
    const prev = rows;
    setRows((rs) => rs.map((x) => (x.item_key === key ? { ...x, label: v } : x)));
    const ok = await run(() => updateItemLabel(l.list_key, key, v), "حُفظ نصّ البند");
    if (!ok) setRows(prev); // تراجع عن التفاؤل عند فشل الخادم
  };
  const moveUp = (i) => {
    const next = work.slice();
    next.splice(i - 1, 0, next.splice(i, 1)[0]);
    if (l.locked) { setDraft(next); return; }
    setRows(next);
  };
  const toggle = async (it) => {
    if (l.locked) { setDraft(work.map((x) => (x.item_key === it.item_key ? { ...x, active: !x.active } : x))); return; }
    const prev = rows;
    setRows((rs) => rs.map((x) => (x.item_key === it.item_key ? { ...x, active: !it.active } : x)));
    const ok = await run(() => setItemActive(l.list_key, it.item_key, !it.active), it.active ? "أُوقف البند" : "أُعيد تفعيل البند");
    if (!ok) setRows(prev);
  };
  const doAdd = async () => {
    const label = add.trim();
    if (!label) return;
    setAdd("");
    if (l.locked) { setDraft(work.concat({ item_key: "(مفتاح يُولَّد عند الاعتماد)", label, active: true, sort_order: work.length + 1 })); return; }
    setBusy(true);
    const r = await addItem(l.list_key, label);
    setBusy(false);
    if (!r.ok) return say("⚠ " + r.error);
    setRows((rs) => rs.concat({ item_key: r.key, label, active: true, sort_order: Math.max(0, ...rs.map((x) => x.sort_order || 0)) + 1 }));
    say(`أُضيف البند بالمفتاح ${r.key} — مُسجَّل في التدقيق`);
  };

  return (
    <div>
      <button className="ad-back" onClick={back}><I name="arrow_forward" size={18} /> عودة إلى المحتوى</button>
      <div className="row" style={{ gap: 12, marginBottom: 6 }}>
        <span className="ad-ico lg"><I name={l.icon || "list"} size={24} color="var(--color-primary)" fill /></span>
        <div><div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>{l.title}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{l.list_key} · {l.legal_ref || "تشغيليّ"} · {work.length} عنصراً</div></div>
      </div>
      <InlineAlert kind={l.locked ? "warning" : "info"} title={l.locked ? "قائمة مُسنَدة لمادة نظامية" : "المخزَّن هو مفتاح البند"} style={{ margin: "10px 0 14px" }}>
        {l.locked
          ? "التعديل لا يسري مباشرة — يُرفع طلب تعديل يعتمده رئيس المركز (content_change_requests) ويُسجَّل في التدقيق."
          : "المخزَّن في جداول الأعمال هو item_key لا النص — تحسين الصياغة لا يمسّ السجلات القائمة. الحذف ممنوع والإيقاف مسموح."}
      </InlineAlert>

      <Card className="card pad">
        <div className="ad-sec-h"><I name="list" size={18} color="var(--color-primary)" /> عناصر القائمة
          <span className="spacer" /><span className="muted mono" style={{ fontSize: 11.5 }}>item_key · label</span></div>
        <div style={{ display: "grid", gap: 8 }}>
          {work.map((it, i) => (
            <div className={"ad-item" + (it.active ? "" : " off")} key={it.item_key + i}>
              <span className="mono ad-key">{it.item_key}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{it.label}{!it.active && <Tag tone="neutral" size="sm" style={{ marginInlineStart: 8 }}>موقوف</Tag>}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="ad-ibtn" title="تحرير النصّ" onClick={() => setEdit({ key: it.item_key, v: it.label })}><I name="edit" size={17} /></button>
                <button className="ad-ibtn" title="نقل لأعلى" disabled={!i} onClick={() => moveUp(i)}><I name="arrow_upward" size={17} /></button>
                <button className="ad-ibtn" title={it.active ? "إيقاف البند (لا حذف)" : "إعادة تفعيل"} onClick={() => toggle(it)}>
                  <I name={it.active ? "visibility_off" : "visibility"} size={17} /></button>
              </span>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="ad-search" style={{ flex: 1, minWidth: 220 }}><I name="add" size={18} color="var(--text-secondary)" />
            <input placeholder="إضافة بند جديد — يُولَّد له مفتاح ثابت…" value={add} onChange={(e) => setAdd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doAdd(); }} /></span>
          <button className="btn btn-ghost" disabled={!add.trim() || busy} onClick={doAdd}>إضافة</button>
        </div>
      </Card>

      <div className="row" style={{ marginTop: 16 }}>
        {l.locked ? (
          <button className="btn btn-primary" disabled={!lockedDirty || busy}
            onClick={async () => {
              const ok = await run(() => submitChangeRequest("reference_list", l.list_key, { items: draft }, "تعديل قائمة مقفلة من بوابة الأدمن"),
                "رُفع التعديل لاعتماد رئيس المركز");
              if (ok) setDraft(null); // لا تُفرَّغ المسودة إلا بنجاح الرفع (وإلا ضاعت تعديلات الأدمن)
            }}>
            <I name="send" size={18} /> رفع التعديل للاعتماد</button>
        ) : (
          <button className="btn btn-primary" disabled={!orderDirty || busy}
            onClick={() => run(() => saveItemOrder(l.list_key, rows.map((r) => r.item_key)), "حُفظ ترتيب القائمة")}>
            <I name="save" size={18} /> حفظ الترتيب</button>
        )}
        {(orderDirty || lockedDirty) && <span className="muted" style={{ fontSize: 12.5 }}>تغييرات غير محفوظة</span>}
      </div>

      {edit && (
        <div className="ad-modal" onClick={() => setEdit(null)}>
          <Card className="card pad" onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 92vw)" }}>
            <b>تحرير نصّ البند</b>
            <div className="muted mono" style={{ fontSize: 12, margin: "8px 0" }}>item_key: {edit.key} — ثابت لا يُعدَّل</div>
            <input className="ad-input" value={edit.v} onChange={(e) => setEdit({ ...edit, v: e.target.value })} autoFocus dir="auto" />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
              <button className="btn btn-primary" disabled={!edit.v.trim()} onClick={() => { editLabel(edit.key, edit.v.trim()); setEdit(null); }}>تطبيق</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ——— تبويب الإشعارات ——— */
function NotifsTab({ templates, q, open, say }) {
  const [cat, setCat] = useState("الكل");
  // تجاوزٌ محلّي لحالة التفعيل — تغذيةٌ فوريّة مع تراجعٍ عند فشل الخادم
  const [actOverride, setActOverride] = useState({}); // {template_key: bool}
  const isActive = (n) => (n.template_key in actOverride ? actOverride[n.template_key] : n.active);
  const cats = Object.keys(NOTIF_CATS).filter((c) => templates.some((t) => t.category === c));
  const rows = templates.filter((n) => (cat === "الكل" || n.category === cat) &&
    hit(q, n.title, n.subject, n.body, n.recipient, n.legal_ref || "", n.trigger_desc));
  const [busyKey, setBusyKey] = useState(null);
  const toggle = async (n) => {
    if (busyKey === n.template_key) return; // يمنع النقر المزدوج المتسارع
    const next = !isActive(n);
    setBusyKey(n.template_key);
    setActOverride((o) => ({ ...o, [n.template_key]: next }));
    const r = await setTemplateActive(n.template_key, next);
    setBusyKey(null);
    if (!r.ok) { setActOverride((o) => ({ ...o, [n.template_key]: !next })); return say("⚠ " + r.error); }
    say((next ? "فُعّل الإشعار: " : "أُوقف الإشعار: ") + n.title + " — مُسجَّل في التدقيق");
  };
  return (
    <div>
      <div className="ad-tabs sub" style={{ marginBottom: 14 }}>
        <button className={"ad-tab" + (cat === "الكل" ? " on" : "")} onClick={() => setCat("الكل")}>الكل</button>
        {cats.map((c) => <button key={c} className={"ad-tab" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{NOTIF_CATS[c]}</button>)}
      </div>
      <div className="ad-tblwrap"><table className="ad-tbl">
        <thead><tr><th>الإشعار</th><th>المُرسَل إليه</th><th>القنوات</th><th>السند</th><th>المهلة</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          {rows.map((n) => { const act = isActive(n); return (
            <tr key={n.template_key} className={act ? "" : "off"}>
              <td><button className="ad-link" onClick={() => open(n.template_key)}>{n.title}</button>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{n.trigger_desc}</div></td>
              <td style={{ fontSize: 12.5 }}>{n.recipient}</td>
              <td><div className="row" style={{ gap: 4, flexWrap: "wrap" }}>{(n.channels || []).map((c) => <span className="achip" key={c}>{CHANNEL_AR[c] || c}</span>)}</div></td>
              <td className="mono" style={{ fontSize: 12 }}>{n.legal_ref || "—"}</td>
              <td style={{ fontSize: 12.5 }}>{n.sla || "—"}</td>
              <td><Tag tone={act ? "success" : "neutral"} size="sm">{act ? "مفعّل" : "موقوف"}</Tag></td>
              <td><button className="ad-ibtn" title={act ? "إيقاف" : "تفعيل"} disabled={busyKey === n.template_key} onClick={() => toggle(n)}>
                <I name={act ? "toggle_on" : "toggle_off"} size={26} color={act ? "var(--color-primary)" : "var(--text-disabled)"} /></button></td>
            </tr>
          ); })}
          {!rows.length && <tr><td colSpan="7" className="muted" style={{ padding: 26, textAlign: "center" }}>لا نتائج مطابقة</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function NotifDetail({ n, back, say, footer }) {
  const [subj, setSubj] = useState(n.subject);
  const [body, setBody] = useState(n.body);
  const [ch, setCh] = useState(n.channels || []);
  const dirty = subj !== n.subject || body !== n.body || ch.join("|") !== (n.channels || []).join("|");
  const preview = (s) => s.replace(/\{[^}]+\}/g, (m) => "‹" + m.slice(1, -1).replace(/_/g, " ") + "›");
  return (
    <div>
      <button className="ad-back" onClick={back}><I name="arrow_forward" size={18} /> عودة إلى المحتوى</button>
      <div className="row" style={{ gap: 12, marginBottom: 8 }}>
        <span className="ad-ico lg"><I name="notifications" size={24} color="var(--color-primary)" fill /></span>
        <div><div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>{n.title}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{n.trigger_desc} · المُرسَل إليه: {n.recipient}</div></div>
      </div>
      <div className="row" style={{ marginBottom: 14, gap: 6, flexWrap: "wrap" }}>
        <span className="achip"><span className="k">السند:</span> {n.legal_ref || "—"}</span>
        {n.sla && <span className="achip"><I name="schedule" size={12} /> {n.sla}</span>}
        <Tag tone={n.active ? "success" : "neutral"} size="sm">{n.active ? "مفعّل" : "موقوف"}</Tag>
      </div>

      <div className="ad-2col">
        <Card className="card pad">
          <div className="ad-sec-h"><I name="edit_note" size={18} color="var(--color-primary)" /> نصّ الإشعار</div>
          <label className="ad-fl">العنوان</label>
          <input className="ad-input" value={subj} onChange={(e) => setSubj(e.target.value)} dir="auto" />
          <label className="ad-fl" style={{ marginTop: 12 }}>المتن</label>
          <textarea className="ad-input" rows="7" value={body} onChange={(e) => setBody(e.target.value)} dir="auto" />
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>المتغيّرات — تُعبّأ آلياً عند الإرسال، ومتغيّرٌ بلا قيمة = خطأ إرسال لا نصّ ناقص:</div>
          <div className="row" style={{ gap: 5, marginTop: 6, flexWrap: "wrap" }}>{vars(subj + " " + body).map((v) => <span className="achip mono" key={v} style={{ fontSize: 11.5 }}>{v}</span>)}</div>
          <div className="ad-sec-h" style={{ marginTop: 20 }}><I name="send" size={18} color="var(--color-primary)" /> قنوات الإرسال</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{Object.entries(CHANNEL_AR).map(([k, t]) => {
            const on = ch.includes(k);
            return <button key={k} className={"achip" + (on ? " on" : "")} onClick={() => setCh(on ? ch.filter((x) => x !== k) : ch.concat(k))}>
              <I name={on ? "check" : "add"} size={13} /> {t}</button>;
          })}</div>
        </Card>
        <Card className="card pad">
          <div className="ad-sec-h"><I name="visibility" size={18} color="var(--color-primary)" /> معاينة كما تصل المستفيد</div>
          <div className="ad-prev">
            <div className="ad-prev-h"><I name="shield" size={18} color="var(--color-primary)" fill /> مركز حماية — النيابة العامة</div>
            <div className="ad-prev-s">{preview(subj)}</div>
            <div className="ad-prev-b">{preview(body)}</div>
            {footer && <div className="ad-prev-f">{footer}</div>}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>القنوات: {ch.map((c) => CHANNEL_AR[c] || c).join(" · ") || "لم تُحدَّد قناة"}</div>
        </Card>
      </div>

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <button className="btn btn-primary" disabled={!dirty}
          onClick={async () => { const r = await saveTemplate(n.template_key, { subject: subj, body, channels: ch }); say(r.ok ? "حُفظ نصّ الإشعار — يسري على الإرساليات الجديدة · مُسجَّل في التدقيق" : "⚠ " + r.error); }}>
          <I name="save" size={18} /> حفظ النصّ</button>
        <button className="btn btn-ghost" disabled={!dirty} onClick={() => { setSubj(n.subject); setBody(n.body); setCh(n.channels || []); }}>تراجع</button>
      </div>
    </div>
  );
}

/* ——— رسائل النظام والنصوص النظامية ——— */
function TextsTab({ items, kind, q, open }) {
  const rows = items.filter((m) => hit(q, m.title, m.body, m.screen, m.legal_ref || ""));
  return (
    <div className="ad-grid wide">
      {rows.map((m) => {
        const key = kind === "sys" ? m.message_key : m.text_key;
        const tone = kind === "sys" ? TONE[m.tone] : null;
        return (
          <button className="ad-tile" key={key} onClick={() => open(key)} style={{ display: "block", textAlign: "start" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="ad-ico"><I name={tone ? tone.icon : "gavel"} size={18} color="var(--color-primary)" fill /></span>
                <span><b style={{ color: "var(--text-strong)", fontSize: 14 }}>{m.title}</b><br />
                  <span className="muted" style={{ fontSize: 11.5 }}>{m.screen}</span></span>
              </div>
              {tone ? <Tag tone="neutral" size="sm">{tone.t}</Tag> : <span className="achip mono" style={{ fontSize: 11 }}>{m.legal_ref || "—"}</span>}
            </div>
            <div className="ad-quote">{m.body}</div>
          </button>
        );
      })}
      {!rows.length && <div className="muted">لا نتائج مطابقة</div>}
    </div>
  );
}

function TextDetail({ m, kind, back, say }) {
  const key = kind === "sys" ? m.message_key : m.text_key;
  const [text, setText] = useState(m.body);
  const [tone, setTone] = useState(m.tone);
  const [busy, setBusy] = useState(false);
  // خطّ أساسٍ محلّي: للنظامي = آخر نصٍّ رُفع (يمنع رفعاً مكرّراً مطابقاً، ويعيد
  // التفعيل عند أي تعديلٍ جديد)؛ وللنظام = ما حُفظ فعلاً (m ثابتة حتى التحديث).
  const [baseBody, setBaseBody] = useState(m.body);
  const [baseTone, setBaseTone] = useState(m.tone);
  const dirty = text !== baseBody || (kind === "sys" && tone !== baseTone);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    if (kind === "sys") {
      const r = await saveSystemMessage(key, { body: text, tone });
      setBusy(false);
      if (!r.ok) return say("⚠ " + r.error);
      setBaseBody(text); setBaseTone(tone); // ما حُفظ صار الأساس
      return say("حُفظ النصّ وسرى على كل البوابات — مُسجَّل في التدقيق");
    }
    const r = await submitChangeRequest("legal_text", key, { body: text }, "تعديل نصّ نظامي من بوابة الأدمن");
    setBusy(false);
    if (!r.ok) return say("⚠ " + r.error);
    setBaseBody(text); // آخر نصٍّ رُفع — لا يُرفع ثانيةً إلا إن عُدِّل
    say("رُفع النصّ لاعتماد رئيس المركز — مُسجَّل في التدقيق");
  };
  return (
    <div>
      <button className="ad-back" onClick={back}><I name="arrow_forward" size={18} /> عودة إلى المحتوى</button>
      <div className="row" style={{ gap: 12, marginBottom: 8 }}>
        <span className="ad-ico lg"><I name={kind === "sys" ? TONE[tone || "info"].icon : "gavel"} size={24} color="var(--color-primary)" fill /></span>
        <div><div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>{m.title}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{m.screen} · السند: {m.legal_ref || "—"}</div></div>
      </div>
      <InlineAlert kind={kind === "legals" ? "warning" : "info"}
        title={kind === "legals" ? "نصّ نظامي يُحتجّ به" : "تعديل النصّ لا يغيّر شرط المنع"} style={{ marginBottom: 14 }}>
        {kind === "legals"
          ? "النصوص النظامية والإقرارات تُعرض على المستفيدين — التعديل يُرفع لاعتماد رئيس المركز قبل السريان."
          : "رسائل المنع والتحقق تظهر داخل الشاشات وتوقف الإجراء عند المخالفة. شرط المنع نفسه في منطق التطبيق."}
      </InlineAlert>

      <Card className="card pad">
        <label className="ad-fl">النصّ المعروض</label>
        <textarea className="ad-input" rows="5" value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
        {kind === "sys" && (
          <>
            <label className="ad-fl" style={{ marginTop: 14 }}>درجة الرسالة</label>
            <div className="row" style={{ gap: 6 }}>{Object.keys(TONE).map((k) => (
              <button key={k} className={"achip" + (tone === k ? " on" : "")} onClick={() => setTone(k)}>
                <I name={TONE[k].icon} size={13} /> {TONE[k].t}</button>))}</div>
          </>
        )}
        <div className="ad-sec-h" style={{ marginTop: 20 }}><I name="visibility" size={18} color="var(--color-primary)" /> المعاينة داخل الشاشة</div>
        <InlineAlert kind={kind === "sys" ? (tone === "success" ? "success" : tone) : "info"} title={m.title}>{text}</InlineAlert>
      </Card>

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <button className="btn btn-primary" disabled={!dirty || busy} onClick={save}>
          <I name={kind === "legals" ? "send" : "save"} size={18} /> {kind === "legals" ? "رفع النصّ للاعتماد" : "حفظ النصّ"}</button>
        <button className="btn btn-ghost" disabled={!dirty} onClick={() => { setText(baseBody); setTone(baseTone); }}>تراجع</button>
      </div>
    </div>
  );
}

/* ═══════════ المستخدمون والأدوار ═══════════ */
const GRANTABLE_ROLES = Object.keys(ROLE_LABEL).filter((r) => r !== "subject");

function UsersScreen({ staff, me, say }) {
  const [rows, setRows] = useState(staff);
  const [q, setQ] = useState("");
  const [granting, setGranting] = useState(null); // {userId, role}
  const list = rows.filter((u) => hit(q, u.name, u.email, (u.roles || []).map((r) => ROLE_LABEL[r.role] || r.role).join(" ")));

  const doGrant = async () => {
    const { userId, role } = granting;
    if (!role) return;
    const r = await grantRole(userId, role);
    if (!r.ok) return say("⚠ " + r.error);
    setRows((xs) => xs.map((u) => u.user_id === userId
      ? { ...u, roles: (u.roles || []).some((x) => x.role === role) ? u.roles : [...(u.roles || []), { role, attributes: {} }] } : u));
    setGranting(null);
    say("مُنح الدور «" + (ROLE_LABEL[role] || role) + "» — مُسجَّل في التدقيق");
  };
  const doRevoke = async (userId, role) => {
    const r = await revokeRole(userId, role);
    if (!r.ok) return say("⚠ " + r.error);
    setRows((xs) => xs.map((u) => u.user_id === userId ? { ...u, roles: (u.roles || []).filter((x) => x.role !== role) } : u));
    say("سُحب الدور «" + (ROLE_LABEL[role] || role) + "» — مُسجَّل في التدقيق");
  };

  return (
    <div>
      <h2 className="h2">المستخدمون</h2>
      <p className="lede">حسابات المنسوبين وأدوارهم. طالبو الحماية لا يظهرون هنا إطلاقاً (sysadmin_no_pii)، وأدوار حسابك أنت يديرها مدير نظامٍ آخر.</p>
      <span className="ad-search" style={{ marginBottom: 14, display: "inline-flex" }}><I name="search" size={18} color="var(--text-secondary)" />
        <input placeholder="بحث بالاسم أو البريد أو الدور…" value={q} onChange={(e) => setQ(e.target.value)} /></span>
      <div className="ad-tblwrap"><table className="ad-tbl">
        <thead><tr><th>المنسوب</th><th>الأدوار</th><th>أُنشئ</th><th>آخر دخول</th><th></th></tr></thead>
        <tbody>
          {list.map((u) => {
            const self = u.user_id === me.uid;
            return (
              <tr key={u.user_id}>
                <td><b style={{ color: "var(--text-strong)" }}>{u.name}</b>{self && <Tag tone="info" size="sm" style={{ marginInlineStart: 6 }}>أنت</Tag>}
                  <div className="muted mono" style={{ fontSize: 11, direction: "ltr", textAlign: "end" }}>{u.email}</div></td>
                <td><div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                  {(u.roles || []).map((r) => (
                    <span className="achip" key={r.role}>{ROLE_LABEL[r.role] || r.role}
                      {!self && <button className="ad-ibtn" style={{ padding: 0, marginInlineStart: 2 }} title="سحب الدور"
                        onClick={() => doRevoke(u.user_id, r.role)}><I name="close" size={13} /></button>}
                    </span>))}
                </div></td>
                <td className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString("ar-SA") : "—"}</td>
                <td className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("ar-SA") : "—"}</td>
                <td>{!self && (granting?.userId === u.user_id ? (
                  <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <select className="ad-input" style={{ width: "auto", padding: "5px 8px", fontSize: 12 }} value={granting.role}
                      onChange={(e) => setGranting({ userId: u.user_id, role: e.target.value })}>
                      <option value="">اختر دوراً…</option>
                      {GRANTABLE_ROLES.filter((r) => !(u.roles || []).some((x) => x.role === r)).map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>))}
                    </select>
                    <button className="ad-ibtn" title="منح" onClick={doGrant}><I name="check" size={18} color="var(--color-primary)" /></button>
                    <button className="ad-ibtn" title="إلغاء" onClick={() => setGranting(null)}><I name="close" size={18} /></button>
                  </span>
                ) : (
                  <button className="ad-ibtn" title="منح دوراً" onClick={() => setGranting({ userId: u.user_id, role: "" })}><I name="person_add" size={18} /></button>
                ))}</td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan="5" className="muted" style={{ padding: 26, textAlign: "center" }}>لا حسابات مطابقة</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function RolesScreen({ staff }) {
  const counts = {};
  for (const u of staff) for (const r of u.roles || []) counts[r.role] = (counts[r.role] || 0) + 1;
  const portalOf = (role) => PORTALS.find((p) => p.roles.includes(role));
  return (
    <div>
      <h2 className="h2">الأدوار والصلاحيات</h2>
      <p className="lede">الأدوار المعرّفة في القاعدة (app_role) وتوزيعها على المنسوبين وبواباتها — الصلاحيات نفسها تفرضها سياسات RLS لا الواجهات.</p>
      <div className="ad-grid">
        {GRANTABLE_ROLES.map((r) => {
          const p = portalOf(r);
          return (
            <Card className="card pad" key={r}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b style={{ color: "var(--text-strong)" }}>{ROLE_LABEL[r]}</b>
                <Tag tone={counts[r] ? "success" : "neutral"} size="sm">{counts[r] || 0} منسوب</Tag>
              </div>
              <div className="muted mono" style={{ fontSize: 11, margin: "4px 0 8px", direction: "ltr", textAlign: "end" }}>{r}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                <I name="door_open" size={14} /> {p ? p.title : "بلا بوابة مباشرة (صلاحية بيانات)"}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ الجهات ووحداتها ═══════════ */
const ENTITY_AR = { prosecution: "النيابة العامة", state_security: "رئاسة أمن الدولة", moi: "وزارة الداخلية", nazaha: "هيئة الرقابة ومكافحة الفساد", moj: "وزارة العدل" };

// صفّ الوحدة — في نطاق الوحدة (لا داخل جسم الرسم) كي لا يُعاد تركيبه على كل ضغطة مفتاح
function UnitRow({ entity, u, depth, onUpdate, onAddChild }) {
  return (
    <div className={"ad-item" + (u.active ? "" : " off")} style={{ marginInlineStart: depth * 22 }}>
      <I name={u.kind === "hq" ? "account_balance" : u.kind === "region" ? "location_city" : "store"} size={17}
        color={u.kind === "hq" ? "var(--color-primary)" : "var(--text-secondary)"} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {u.name}
        {u.city && <span className="muted" style={{ fontSize: 11.5 }}> · {u.city}</span>}
        {!u.active && <Tag tone="neutral" size="sm" style={{ marginInlineStart: 6 }}>موقوفة</Tag>}
      </span>
      {u.recommendations > 0 && <span className="achip" title="توصيات مرتبطة">{u.recommendations} توصية</span>}
      <button className={"achip" + (u.is_intake_point ? " on" : "")} title="نقطة استقبال الإحالات"
        onClick={() => onUpdate(entity, u, { intake: !u.is_intake_point }, u.is_intake_point ? "أُلغيت نقطة الاستقبال" : "صارت نقطة استقبال")}>
        <I name="inbox" size={12} /> استقبال</button>
      {u.kind !== "hq" && (
        <button className="ad-ibtn" title={u.active ? "إيقاف الوحدة (لا حذف)" : "إعادة تفعيل"}
          onClick={() => onUpdate(entity, u, { active: !u.active }, u.active ? "أُوقفت الوحدة" : "أُعيد تفعيل الوحدة")}>
          <I name={u.active ? "visibility_off" : "visibility"} size={17} /></button>)}
      {u.kind === "region" && (
        <button className="ad-ibtn" title="إضافة فرع محافظة" onClick={() => onAddChild(u.id)}>
          <I name="add_business" size={17} /></button>)}
    </div>
  );
}

function EntitiesScreen({ org, say }) {
  const [data, setData] = useState(org);
  const [adding, setAdding] = useState(null); // {parentId, city}
  const patchUnit = (entity, id, changes) => setData((xs) => xs.map((e) => e.entity !== entity ? e
    : { ...e, units: e.units.map((u) => (u.id === id ? { ...u, ...changes } : u)) }));

  const doUpdate = async (entity, u, patch, okMsg) => {
    patchUnit(entity, u.id, patch.intake !== undefined ? { is_intake_point: patch.intake } : patch.active !== undefined ? { active: patch.active } : {});
    const r = await updateUnit(u.id, patch);
    if (!r.ok) { patchUnit(entity, u.id, { is_intake_point: u.is_intake_point, active: u.active }); return say("⚠ " + r.error); }
    say(okMsg + " — مُسجَّل في التدقيق");
  };
  const doAdd = async (entity, parent) => {
    const city = adding.city.trim();
    if (!city) return;
    const r = await addBranchUnit(parent.id, city);
    if (!r.ok) return say("⚠ " + r.error);
    setData((xs) => xs.map((e) => e.entity !== entity ? e
      : { ...e, units: [...e.units, { id: r.id, name: "نيابة " + city, kind: "branch", region: parent.region, city, parent_id: parent.id, is_intake_point: true, active: true, recommendations: 0 }] }));
    setAdding(null);
    say("أُضيف فرع «" + city + "» تحت " + parent.name + " — مُسجَّل في التدقيق");
  };

  const openAdd = (id) => setAdding({ parentId: id, city: "" });

  return (
    <div>
      <h2 className="h2">الجهات ووحداتها</h2>
      <p className="lede">هيكل كل جهة مختصة: نمطها التنظيمي، شجرة وحداتها، ونقاط الاستقبال. فروع المحافظات تُضاف من هنا عند ورود القائمة الرسمية — لا تُخترع بالإحالات.</p>
      <div style={{ display: "grid", gap: 16 }}>
        {data.map((e) => {
          const regions = e.units.filter((u) => u.kind !== "branch");
          const childrenOf = (id) => e.units.filter((u) => u.parent_id === id);
          return (
            <Card className="card pad" key={e.entity}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, rowGap: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="ad-ico"><I name="account_balance" size={20} color="var(--color-primary)" fill /></span>
                  <span><b style={{ color: "var(--text-strong)" }}>{ENTITY_AR[e.entity] || e.entity}</b>
                    <div className="muted" style={{ fontSize: 11.5 }}>{e.note}</div></span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Tag tone={e.mode === "central" ? "info" : "success"} size="sm">{e.mode === "central" ? "مركزية — المقرّ يستقبل" : "مناطقية — وحدات مناطق"}</Tag>
                  <Tag tone="neutral" size="sm">اعتماد بدرجة {e.approval_degrees}</Tag>
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {regions.map((u) => (
                  <React.Fragment key={u.id}>
                    <UnitRow entity={e.entity} u={u} depth={0} onUpdate={doUpdate} onAddChild={openAdd} />
                    {childrenOf(u.id).map((c) => <UnitRow key={c.id} entity={e.entity} u={c} depth={1} onUpdate={doUpdate} onAddChild={openAdd} />)}
                    {adding?.parentId === u.id && (
                      <div className="row" style={{ marginInlineStart: 22, gap: 8 }}>
                        <input className="ad-input" style={{ maxWidth: 260 }} autoFocus placeholder="اسم المحافظة/المدينة…"
                          value={adding.city} onChange={(ev) => setAdding({ parentId: u.id, city: ev.target.value })}
                          onKeyDown={(ev) => { if (ev.key === "Enter") doAdd(e.entity, u); }} dir="auto" />
                        <button className="btn btn-primary sm" disabled={!adding.city.trim()} onClick={() => doAdd(e.entity, u)}>إضافة الفرع</button>
                        <button className="btn btn-ghost sm" onClick={() => setAdding(null)}>إلغاء</button>
                      </div>)}
                  </React.Fragment>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ الإعدادات والمدد + أعلام الميزات ═══════════ */
const KNOWN_FLAGS = {
  watchdog: { t: "المراقبات الآلية (المهل والتصعيد)", d: "مراقبا الدراسة/التقييم ومهلة توصية الجهة — كل 30 دقيقة. الإيقاف يجمّد التذكير والتصعيد الآليين." },
};

function SettingsScreen({ settings, say }) {
  const [rows, setRows] = useState(settings);
  const [edit, setEdit] = useState(null); // {key, v}
  const [addK, setAddK] = useState(""); const [addV, setAddV] = useState("");
  const save = async (key, value) => {
    const r = await setSetting(key, value);
    if (!r.ok) return say("⚠ " + r.error);
    setRows((xs) => xs.some((x) => x.key === key) ? xs.map((x) => (x.key === key ? { ...x, value } : x)) : xs.concat({ key, value }));
    setEdit(null);
    say("حُفظ الإعداد «" + key + "» — مُسجَّل في التدقيق");
  };
  return (
    <div>
      <h2 className="h2">الإعدادات والمدد</h2>
      <p className="lede">مفاتيح التشغيل العامة (app_settings) — تقرؤها دوال القاعدة المحروسة، وكل تغيير مُسجَّل في التدقيق باسمك.</p>
      <InlineAlert kind="info" title="المدد النظامية ليست هنا" style={{ marginBottom: 14 }}>
        مهل المواد (5 أيام توصية الجهة، 10 أيام التظلّم، 3 أيام الإشعار…) ثوابت نظامية في مصفوفة SLA — تغييرها قرار تشريعي لا إعداد تشغيلي.
      </InlineAlert>
      <Card className="card pad">
        <div className="ad-sec-h"><I name="tune" size={18} color="var(--color-primary)" /> المفاتيح<span className="spacer" /><span className="muted mono" style={{ fontSize: 11.5 }}>key · value</span></div>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((s) => (
            <div className="ad-item" key={s.key}>
              <span className="mono ad-key">{s.key}</span>
              {edit?.key === s.key
                ? <input className="ad-input" style={{ flex: 1 }} value={edit.v} onChange={(e) => setEdit({ key: s.key, v: e.target.value })} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") save(s.key, edit.v); }} dir="auto" />
                : <span style={{ flex: 1 }} className="mono">{s.value}</span>}
              {edit?.key === s.key
                ? <span style={{ display: "flex", gap: 6 }}>
                    <button className="ad-ibtn" title="حفظ" onClick={() => save(s.key, edit.v)}><I name="check" size={18} color="var(--color-primary)" /></button>
                    <button className="ad-ibtn" title="إلغاء" onClick={() => setEdit(null)}><I name="close" size={18} /></button></span>
                : <button className="ad-ibtn" title="تحرير القيمة" onClick={() => setEdit({ key: s.key, v: s.value })}><I name="edit" size={17} /></button>}
            </div>
          ))}
          {!rows.length && <div className="muted">لا مفاتيح بعد.</div>}
        </div>
        <div className="row" style={{ marginTop: 14, gap: 8 }}>
          <input className="ad-input" style={{ maxWidth: 220, direction: "ltr" }} placeholder="key" value={addK} onChange={(e) => setAddK(e.target.value)} />
          <input className="ad-input" style={{ flex: 1 }} placeholder="القيمة" value={addV} onChange={(e) => setAddV(e.target.value)} dir="auto" />
          <button className="btn btn-ghost" disabled={!addK.trim()} onClick={() => { save(addK.trim(), addV); setAddK(""); setAddV(""); }}>إضافة</button>
        </div>
      </Card>
    </div>
  );
}

function FlagsScreen({ settings, say }) {
  const [rows, setRows] = useState(settings);
  const val = (k) => rows.find((x) => x.key === k)?.value ?? "off";
  const toggle = async (k) => {
    const next = val(k) === "on" ? "off" : "on";
    const r = await setSetting(k, next);
    if (!r.ok) return say("⚠ " + r.error);
    setRows((xs) => xs.some((x) => x.key === k) ? xs.map((x) => (x.key === k ? { ...x, value: next } : x)) : xs.concat({ key: k, value: next }));
    say((next === "on" ? "فُعّل" : "أُوقف") + " علم «" + k + "» — مُسجَّل في التدقيق");
  };
  return (
    <div>
      <h2 className="h2">أعلام الميزات</h2>
      <p className="lede">مفاتيح تشغيل/إيقاف لسلوكيات المنصّة الآلية — القيمة on/off في app_settings.</p>
      <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
        {Object.entries(KNOWN_FLAGS).map(([k, f]) => {
          const on = val(k) === "on";
          return (
            <Card className="card pad" key={k}>
              <div className="row" style={{ justifyContent: "space-between", rowGap: 10 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <b style={{ color: "var(--text-strong)" }}>{f.t}</b>
                  <div className="muted mono" style={{ fontSize: 11, margin: "2px 0 6px", direction: "ltr", textAlign: "end" }}>{k}</div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>{f.d}</div>
                </div>
                <button className="ad-ibtn" onClick={() => toggle(k)} title={on ? "إيقاف" : "تفعيل"}>
                  <I name={on ? "toggle_on" : "toggle_off"} size={40} color={on ? "var(--color-primary)" : "var(--text-disabled)"} /></button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ سجل التدقيق التقني + صحة النظام ═══════════ */
function AuditScreen({ rows }) {
  const [q, setQ] = useState("");
  const list = rows.filter((r) => hit(q, r.action, r.target || ""));
  return (
    <div>
      <h2 className="h2">سجل التدقيق التقني</h2>
      <p className="lede">أفعال المحتوى والإشعارات والإعدادات فقط — تدقيق القضايا والامتثال خارج صلاحية مدير النظام (sysadmin_no_pii).</p>
      <span className="ad-search" style={{ marginBottom: 14, display: "inline-flex" }}><I name="search" size={18} color="var(--text-secondary)" />
        <input placeholder="بحث بالفعل أو الهدف…" value={q} onChange={(e) => setQ(e.target.value)} /></span>
      <div className="ad-tblwrap"><table className="ad-tbl">
        <thead><tr><th>#</th><th>الفعل</th><th>الهدف</th><th>الفاعل</th><th>الوقت</th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td className="mono" style={{ fontSize: 11.5 }}>{r.id}</td>
              <td className="mono" style={{ fontSize: 12, direction: "ltr", textAlign: "end" }}>{r.action}</td>
              <td style={{ fontSize: 12.5, wordBreak: "break-word" }}>{r.target || "—"}</td>
              <td className="mono" style={{ fontSize: 11 }}>{r.actor_id ? r.actor_id.slice(0, 8) + "…" : "النظام"}</td>
              <td className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("ar-SA")}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan="5" className="muted" style={{ padding: 26, textAlign: "center" }}>لا سجلات مطابقة</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function HealthScreen({ health }) {
  const H = ({ icon, v, l }) => (
    <Card className="card ad-stat">
      <span className="ad-stat-ico" style={{ background: "var(--green-10)" }}><I name={icon} size={22} fill color="var(--color-primary)" /></span>
      <span><b className="ad-stat-v">{v ?? "—"}</b><span className="ad-stat-l">{l}</span></span>
    </Card>
  );
  const jobs = Array.isArray(health.cron_jobs) ? health.cron_jobs : [];
  return (
    <div>
      <h2 className="h2">صحة النظام</h2>
      <p className="lede">مؤشرات تشغيلية حيّة من القاعدة — بلا أي بيانات مشمولين.</p>
      <div className="ad-stats">
        <H icon="notifications" v={health.notifications_24h} l="إشعاراً آخر 24 ساعة" />
        <H icon="receipt_long" v={health.audit_rows} l="صفوف سجل التدقيق" />
        <H icon="group" v={health.staff_accounts} l="حساب منسوب فعّال" />
        <H icon="approval" v={health.ccr_pending} l="طلب تعديل معلّق" />
        <H icon="database" v={health.db_size} l="حجم قاعدة البيانات" />
        <H icon="flag" v={health.watchdog === "on" ? "مفعّلة" : "موقوفة"} l="المراقبات الآلية" />
      </div>
      <Card className="card pad" style={{ marginTop: 16 }}>
        <div className="ad-sec-h"><I name="schedule" size={18} color="var(--color-primary)" /> المهام المجدولة (pg_cron)</div>
        <div className="ad-tblwrap"><table className="ad-tbl">
          <thead><tr><th>المهمة</th><th>الجدولة</th><th>آخر تشغيل</th><th>آخر نتيجة</th><th>الحالة</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.name}>
                <td className="mono" style={{ fontSize: 12, direction: "ltr", textAlign: "end" }}>{j.name}</td>
                <td className="mono" style={{ fontSize: 12, direction: "ltr", textAlign: "end" }}>{j.schedule}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{j.last_run || "—"}</td>
                <td><Tag tone={j.last_status === "succeeded" ? "success" : j.last_status ? "error" : "neutral"} size="sm">{j.last_status || "لم تعمل بعد"}</Tag></td>
                <td><Tag tone={j.active ? "success" : "neutral"} size="sm">{j.active ? "مجدولة" : "معطّلة"}</Tag></td>
              </tr>
            ))}
            {!jobs.length && <tr><td colSpan="5" className="muted" style={{ padding: 20, textAlign: "center" }}>لا مهام مجدولة</td></tr>}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}

/* ——— الملف الشخصي وشاشات الدفعات التالية ——— */
function Profile({ me }) {
  return (
    <div>
      <h2 className="h2">الملف الشخصي</h2>
      <Card className="card pad" style={{ maxWidth: 520 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="ad-ico lg"><I name="settings_account_box" size={24} color="var(--color-primary)" fill /></span>
          <div><b style={{ color: "var(--text-strong)" }}>{me.name}</b>
            <div className="muted" style={{ fontSize: 12.5 }}>مدير النظام — دور sysadmin · بلا وصول لبيانات المشمولين</div></div>
        </div>
      </Card>
    </div>
  );
}

function ComingSoon({ meta }) {
  return (
    <div>
      <h2 className="h2">{meta.t}</h2>
      <Card className="card pad" style={{ textAlign: "center", padding: "48px 20px" }}>
        <I name={meta.icon} size={40} color="var(--text-disabled)" />
        <p className="muted" style={{ marginTop: 12 }}>تُبنى هذه الشاشة في الدفعة التالية من بوابة مدير النظام — البنية والصلاحيات جاهزة.</p>
      </Card>
    </div>
  );
}
