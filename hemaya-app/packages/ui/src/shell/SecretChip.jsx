// SecretChip — الرمز السري مقنّعاً (••••) في الشريط العلوي عند فتح سياق طلب.
// الكشف مؤقّت (revealSeconds من إعداد البوابة) ويُخفى آلياً، وكل كشفٍ حدثُ
// تدقيقٍ يُسجَّل عبر onReveal (audit: secret_reveal).
import React, { useEffect, useState } from "react";
import { I } from "./util";

export function SecretChip({ code, revealSeconds = 6, onReveal }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return undefined;
    const tm = setTimeout(() => setShow(false), revealSeconds * 1000);
    return () => clearTimeout(tm);
  }, [show, revealSeconds]);
  useEffect(() => setShow(false), [code]);
  const toggle = () => {
    if (!show && onReveal) onReveal(code);
    setShow((s) => !s);
  };
  return (
    <span
      className="sec-chip"
      title="الرمز السري للطلب المفتوح — يحلّ محل الاسم، والكشف مُسجّل في التدقيق ويُخفى آلياً بعد ثوانٍ."
    >
      <I name="lock" size={13} color="var(--color-error)" />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-error)" }}>سري</span>
      <span
        className="mono"
        style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)", minWidth: 86, textAlign: "center" }}
        dir="ltr"
      >
        {show ? code : "••••••••••"}
      </span>
      <button className="sec-eye" onClick={toggle} aria-label={show ? "إخفاء الرمز" : "كشف الرمز مؤقتاً"}>
        <I name={show ? "visibility_off" : "visibility"} size={16} />
      </button>
    </span>
  );
}
