"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@hemaya/ui";
import { startLogin, confirmLogin } from "@/lib/actions";

export default function Login() {
  const router = useRouter();
  const [phase, setPhase] = useState<"id" | "challenge">("id");
  const [nid, setNid] = useState("");
  const [sid, setSid] = useState("");
  const [verify, setVerify] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const valid = /^\d{10}$/.test(nid);

  const begin = () => start(async () => {
    setError("");
    const r = await startLogin(nid);
    if (!r.ok) return setError(r.error);
    setSid(r.sessionId); setVerify(r.verificationNumber); setPhase("challenge");
  });
  const confirm = () => start(async () => {
    setError("");
    const r = await confirmLogin(nid, sid);
    if (!r.ok) return setError(r.error);
    router.replace("/"); router.refresh();
  });

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24,
      background: "radial-gradient(1200px 500px at 50% -10%, var(--green-10), transparent 70%), var(--surface-page)" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)", padding: "36px 28px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto 14px", borderRadius: "var(--radius-md)",
          background: "linear-gradient(135deg,var(--green-60),var(--green-80))", display: "grid", placeItems: "center" }}>
          <span className="material-symbols-rounded" style={{ color: "#fff", fontSize: 26 }}>verified_user</span>
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>بوابة طالب الحماية</h1>
        <p className="muted" style={{ fontSize: 14, margin: "0 0 24px" }}>الدخول عبر «نفاذ» الوطنيّ الموحّد للأفراد.</p>

        {phase === "id" ? (
          <div style={{ display: "grid", gap: 14, textAlign: "start" }}>
            <label style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>رقم الهوية الوطنية أو الإقامة</label>
            <input inputMode="numeric" maxLength={10} placeholder="١٠ أرقام — للمواطن أو المقيم" value={nid}
              onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => e.key === "Enter" && valid && begin()}
              className="mono" style={{ height: 52, padding: "0 14px", fontSize: 20, letterSpacing: ".12em", textAlign: "center",
                border: "1.5px solid var(--field-border)", borderRadius: "var(--radius-md)", background: "var(--field-bg)", color: "var(--text-strong)" }} />
            <button className="pp-btn" style={{ height: 52 }} disabled={!valid || pending} onClick={begin}>
              {pending ? "جارٍ الاتصال بنفاذ…" : "المتابعة عبر نفاذ"}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ fontSize: 14, margin: 0 }}>افتح تطبيق «نفاذ» واختر الرقم المطابق:</p>
            <div style={{ display: "grid", placeItems: "center", padding: 20, border: "1.5px dashed var(--green-40)",
              borderRadius: "var(--radius-lg)", background: "var(--color-primary-subtle)" }}>
              <span className="mono" style={{ fontSize: 48, fontWeight: 700, color: "var(--color-primary)" }}>{verify}</span>
            </div>
            <button className="pp-btn" style={{ height: 52 }} disabled={pending} onClick={confirm}>
              {pending ? "جارٍ التحقّق…" : "لقد طابقتُ الرقم في نفاذ"}
            </button>
            <button className="pp-btn pp-btn--ghost" disabled={pending} onClick={() => { setPhase("id"); setVerify(null); setError(""); }}>
              تغيير رقم الهوية
            </button>
          </div>
        )}
        {error && <p style={{ marginTop: 14, padding: "8px 12px", fontSize: 13.5, color: "var(--color-error)",
          background: "var(--color-error-subtle)", borderRadius: "var(--radius-sm)" }}>{error}</p>}
        <p className="muted" style={{ marginTop: 22, fontSize: 12, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
          <Icon name="info" size={14} /> وضع تطويريّ (mock نفاذ) — الأفراد بدور «مستفيد».
        </p>
      </div>
    </main>
  );
}
