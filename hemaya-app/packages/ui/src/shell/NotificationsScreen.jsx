// شاشة الإشعارات الموحّدة — فلاتر بعدّادات، تجميع زمني (اليوم/أمس/الأقدم
// بتواريخ فعلية)، فئة «عاجل» حمراء مثبّتة أعلى القائمة بمؤقّتها، وكل إشعارٍ
// زرٌّ كامل يفتح وجهته ويثبت قراءته في القاعدة (لا حالة واجهةٍ فقط).
import React, { useState } from "react";
import { I, NOTIF_TONES, fmtWhen, groupOf } from "./util";
import { DeadlineTimer } from "../patterns";

// مظهر الفئات الشائعة — يجوز لإدخال config.notifCategories تجاوزه بحقلي icon/tone
const CAT_STYLE = {
  assign: { icon: "assignment_ind", tone: "primary" },
  deadline: { icon: "hourglass_top", tone: "error" },
  output: { icon: "task_alt", tone: "info" },
  msg: { icon: "chat", tone: "info" },
  decision: { icon: "gavel", tone: "primary" },
};

export function catStyle(config, cat) {
  const entry = config.notifCategories.find((c) => c.id === cat);
  const base = CAT_STYLE[cat] || { icon: "notifications", tone: "info" };
  return { icon: entry?.icon || base.icon, tone: entry?.tone || base.tone };
}

export function NotifItem({ config, n, onOpen, dense = false, now }) {
  const { icon, tone } = catStyle(config, n.cat);
  const [bg, fg] = NOTIF_TONES[tone] || NOTIF_TONES.info;
  if (dense) {
    return (
      <button className="dash-ntf" onClick={() => onOpen(n)}>
        <div className="ntf-ico" style={{ width: 32, height: 32, background: bg, color: fg }}>
          <I name={icon} size={17} fill />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{n.title}</div>
          <div
            className="muted"
            style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {n.body}
          </div>
        </div>
        {!n.read && <span className="dot-unread" style={{ marginTop: 0 }} />}
      </button>
    );
  }
  return (
    <button className={"ntf" + (!n.read ? " unread" : "") + (n.crit ? " crit" : "")} onClick={() => onOpen(n)}>
      <div
        className="ntf-ico"
        style={{
          background: n.crit ? "var(--error-10)" : bg,
          color: n.crit ? "var(--color-error)" : fg,
        }}
      >
        <I name={icon} size={20} fill />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="ntf-t">{n.title}</span>
          {n.crit && (
            <span className="pill" style={{ background: "var(--color-error)", color: "#fff" }}>
              <I name="priority_high" size={12} fill /> عاجل
            </span>
          )}
        </div>
        <div className="ntf-d">{n.body}</div>
        {n.deadline && (
          <div style={{ marginTop: 10, maxWidth: 420 }}>
            <DeadlineTimer
              label={n.deadline.label}
              totalDays={n.deadline.total}
              daysElapsed={n.deadline.elapsed}
              articleRef={n.deadline.ref}
            />
          </div>
        )}
        <div className="row" style={{ gap: 10, marginTop: 6 }}>
          <span className="ntf-time">{fmtWhen(n.created_at, now)}</span>
          <span className="link" style={{ fontSize: 12 }}>
            فتح الوجهة <I name="arrow_back" size={13} />
          </span>
        </div>
      </div>
      {!n.read && <span className="dot-unread" />}
    </button>
  );
}

export function NotificationsScreen({ config, items, onOpen, onMarkAllRead, now = new Date() }) {
  const [flt, setFlt] = useState("all");
  const filters = [
    { id: "all", t: "الكل" },
    { id: "unread", t: "غير المقروء" },
    ...config.notifCategories.map((c) => ({ id: c.id, t: c.label })),
  ];
  const countOf = (f) =>
    f === "all" ? items.length : f === "unread" ? items.filter((n) => !n.read).length : items.filter((n) => n.cat === f).length;
  const shown = items.filter((n) => (flt === "all" ? true : flt === "unread" ? !n.read : n.cat === flt));
  const crit = shown.filter((n) => n.crit);
  const rest = shown.filter((n) => !n.crit);
  const groups = ["اليوم", "أمس", "الأقدم"];

  return (
    <div>
      <h2 className="h2">الإشعارات</h2>
      <p className="lede">
        تنبيهات الإسناد واقتراب المواعيد واستقبال مخرجاتك — النقر على الإشعار يفتح وجهته ويعلّمه مقروءاً. تحفظ السرية
        بالرمز السري.
      </p>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          {filters.map((f) => (
            <button key={f.id} className={"flt" + (flt === f.id ? " on" : "")} onClick={() => setFlt(f.id)}>
              {f.t}
              <span className="flt-n">{countOf(f.id)}</span>
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost"
          style={{ height: 36, fontSize: 13 }}
          onClick={onMarkAllRead}
          disabled={!items.some((n) => !n.read)}
        >
          <I name="done_all" size={16} /> تعليم الكل كمقروء
        </button>
      </div>
      {shown.length === 0 && (
        <div className="ntf-empty">
          <I name="notifications_off" size={34} color="var(--text-disabled)" />
          <span>لا إشعارات ضمن هذا التصنيف.</span>
        </div>
      )}
      {crit.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 4 }}>
          {crit.map((n) => (
            <NotifItem config={config} n={n} key={n.id} onOpen={onOpen} now={now} />
          ))}
        </div>
      )}
      {groups.map((g) => {
        const list = rest.filter((n) => groupOf(n.created_at, now) === g);
        if (list.length === 0) return null;
        return (
          <div key={g}>
            <div className="ntf-group">{g}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {list.map((n) => (
                <NotifItem config={config} n={n} key={n.id} onOpen={onOpen} now={now} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
