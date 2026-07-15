// أدوات القشرة الموحّدة — أيقونة الرموز + صياغة الأزمنة الفعلية
// (تحلّ محلّ خريطة REL_DATE الثابتة في نموذج التصميم).
import React from "react";

export const I = ({ name, size = 20, fill = false, color = "currentColor", style }) => (
  <span
    className="material-symbols-rounded"
    style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}
  >
    {name}
  </span>
);

// درجات ألوان الإشعارات حسب الفئة
export const NOTIF_TONES = {
  primary: ["var(--green-10)", "var(--color-primary)"],
  warning: ["var(--warning-10)", "var(--color-warning)"],
  info: ["var(--info-10)", "var(--color-info)"],
  error: ["var(--error-10)", "var(--color-error)"],
};

const pad2 = (n) => String(n).padStart(2, "0");
const dayStart = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** فرق الأيام التقويمية بين زمنٍ والآن (0 = اليوم). */
export function daysAgo(ts, now = new Date()) {
  return Math.round((dayStart(now) - dayStart(new Date(ts))) / 86400000);
}

/** تجميع زمني: اليوم · أمس · الأقدم. */
export function groupOf(ts, now = new Date()) {
  const d = daysAgo(ts, now);
  if (d <= 0) return "اليوم";
  if (d === 1) return "أمس";
  return "الأقدم";
}

function relLabel(d) {
  if (d <= 0) return "اليوم";
  if (d === 1) return "أمس";
  if (d === 2) return "قبل يومين";
  if (d <= 6) return `قبل ${d} أيام`;
  if (d <= 13) return "قبل أسبوع";
  return null;
}

/** «2026/07/15 08:30 (اليوم)» — تاريخ فعلي مع وسمٍ نسبي عند القرب. */
export function fmtWhen(ts, now = new Date()) {
  const t = new Date(ts);
  const date = `${t.getFullYear()}/${pad2(t.getMonth() + 1)}/${pad2(t.getDate())}`;
  const time = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  const rel = relLabel(daysAgo(ts, now));
  return `${date} ${time}${rel ? ` (${rel})` : ""}`;
}
