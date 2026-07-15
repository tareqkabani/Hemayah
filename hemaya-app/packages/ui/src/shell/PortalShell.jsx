// PortalShell — القشرة الموحّدة: جانبية قابلة للطي + شريط علوي + مودال خروج.
// القشرة غبية: كل الفروق (الشاشات، الطوارئ، وسم الهوية…) من PortalConfig
// الممرَّر إليها — لا تفرّع بين الأدوار هنا.
import React, { useState } from "react";
import { I } from "./util";
import { SecretChip } from "./SecretChip";
import { Tag } from "../components";

// عناوين الشاشات القياسية وأيقوناتها — الترتيب من config.screens
const SCREEN_META = {
  dashboard: { t: "لوحة المعلومات", icon: "dashboard" },
  tasks: { t: "المهام المُسندة", icon: "assignment_ind" },
  messages: { t: "المراسلات", icon: "forum" },
  notifications: { t: "الإشعارات", icon: "notifications" },
  profile: { t: "الملف الشخصي", icon: "account_circle" },
};

export function PortalShell({
  config,
  brand, // { logoSrc, portalTitle, markIcon }
  user, // { name, verified?: bool }
  active,
  onNavigate,
  counters = {}, // { [screenId]: number } — أعدادٌ حيّة من الاستعلام الفعلي
  secret = null, // الرمز السري للسياق المفتوح (أو null)
  onRevealSecret,
  roleTag = "سري للغاية",
  collapsed = false,
  onToggleCollapsed,
  onLogout,
  toast = "",
  children,
}) {
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const go = (id) => {
    setOpen(false);
    onNavigate(id);
  };
  const nav = config.screens.map((id) => ({ id, ...SCREEN_META[id], badge: counters[id] || null }));

  return (
    <div className="shell">
      <aside className={"side" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
        <div className="brand">
          <div className="brand-mark">
            <I name={brand.markIcon || "shield_person"} size={22} fill color="#fff" />
          </div>
          <div className="brand-txt brand-logos">
            <img src={brand.logoSrc} alt="مركز حماية الشهود والمبلّغين والخبراء والضحايا — النيابة العامة" />
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>
              {brand.portalTitle}
            </div>
          </div>
          <button
            className="collapse-btn"
            onClick={onToggleCollapsed}
            title={collapsed ? "توسيع القائمة" : "طيّ القائمة"}
            aria-label={collapsed ? "توسيع القائمة" : "طيّ القائمة"}
          >
            <I name={collapsed ? "left_panel_open" : "left_panel_close"} size={20} />
          </button>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <button
              key={n.id}
              className={"nav-item" + (active === n.id ? " on" : "")}
              title={collapsed ? n.t : undefined}
              onClick={() => go(n.id)}
            >
              <I name={n.icon} size={20} /> <span className="nav-lbl">{n.t}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-user">
            <div className="su-av">
              <I name="person" size={18} />
            </div>
            <div className="nav-lbl" style={{ minWidth: 0 }}>
              <div className="su-name">{user.name}</div>
              {user.verified !== false && (
                <div className="su-badge">
                  <I name="verified_user" size={12} fill /> موثّق عبر نفاذ
                </div>
              )}
            </div>
          </div>
          <button className="logout-btn" onClick={() => setConfirmOut(true)} title="تسجيل الخروج">
            <I name="logout" size={18} />
            <span className="nav-lbl">تسجيل الخروج</span>
          </button>
          <div className="side-copy nav-lbl">© 2026 النيابة العامة</div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}>
            <I name="menu" size={22} />
          </button>
          {config.identityMode === "secret-code" && secret && (
            <SecretChip code={secret} revealSeconds={config.identityRevealSeconds} onReveal={onRevealSecret} />
          )}
          <span className="who">
            {config.screens.includes("messages") && (
              <button className="qa-btn" title="المراسلات" onClick={() => go("messages")}>
                <I name="forum" size={20} />
                {counters.messages > 0 && <span className="qa-badge">{counters.messages}</span>}
              </button>
            )}
            {config.screens.includes("notifications") && (
              <button className="qa-btn" title="الإشعارات" onClick={() => go("notifications")}>
                <I name="notifications" size={20} />
                {counters.notifications > 0 && <span className="qa-badge">{counters.notifications}</span>}
              </button>
            )}
            {config.identityMode !== "no-pii" && (
              <Tag tone="error" size="sm" iconLeft={<I name="lock" size={13} />}>
                {roleTag}
              </Tag>
            )}
            <div className="avatar">
              <I name="person" size={20} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{config.label}</span>
          </span>
        </header>
        <main className="content">{children}</main>
      </div>
      {confirmOut && (
        <div className="nf-scrim" onClick={() => setConfirmOut(false)}>
          <div className="nf-modal" onClick={(e) => e.stopPropagation()}>
            <I name="logout" size={36} color="var(--color-error)" />
            <h3 style={{ margin: "10px 0 6px", fontSize: 17, color: "var(--text-strong)" }}>تأكيد تسجيل الخروج</h3>
            <p className="muted" style={{ margin: "0 0 18px", lineHeight: 1.7 }}>
              ستُقفل الجلسة ويُسجَّل الخروج في التدقيق، وأي عمل غير محفوظ سيُفقد.
            </p>
            <div className="row" style={{ justifyContent: "center", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmOut(false)}>
                إلغاء
              </button>
              <button
                className="btn"
                style={{ background: "var(--color-error)", color: "#fff" }}
                onClick={() => {
                  setConfirmOut(false);
                  onLogout();
                }}
              >
                <I name="logout" size={18} /> تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          style={{
            position: "fixed",
            insetInlineStart: 24,
            bottom: 24,
            zIndex: 60,
            background: "var(--text-strong)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <I name="check_circle" size={18} color="var(--green-40)" fill /> {toast}
        </div>
      )}
    </div>
  );
}
