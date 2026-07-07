"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { startNafath, confirmNafath } from "./actions";
import styles from "./login.module.css";

type Phase = "id" | "challenge";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/seeker";

  const [phase, setPhase] = useState<Phase>("id");
  const [nationalId, setNationalId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [verify, setVerify] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const valid = /^\d{10}$/.test(nationalId);

  function begin() {
    setError("");
    start(async () => {
      const r = await startNafath(nationalId);
      if (!r.ok) return setError(r.error);
      setSessionId(r.sessionId);
      setVerify(r.verificationNumber);
      setPhase("challenge");
    });
  }

  function confirm() {
    setError("");
    start(async () => {
      const r = await confirmNafath(nationalId, sessionId);
      if (!r.ok) return setError(r.error);
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <Image
          src="/brand/logo-center.png"
          alt="مركز حماية الشهود والمبلّغين والخبراء والضحايا"
          width={256}
          height={100}
          priority
          style={{ height: 56, width: "auto" }}
          className={styles.logo}
        />
        <h1 className={styles.title}>الدخول إلى بوابة طالب الحماية</h1>
        <p className={styles.lede}>
          الدخول عبر «نفاذ» — الهوية الوطنية الموحّدة. لا يُقبل الدخول بغيرها.
        </p>

        {phase === "id" && (
          <div className={styles.form}>
            <label className={styles.label} htmlFor="nid">
              رقم الهوية الوطنية / الإقامة
            </label>
            <input
              id="nid"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="1XXXXXXXXX"
              className={`${styles.input} mono`}
              value={nationalId}
              onChange={(e) =>
                setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              onKeyDown={(e) => e.key === "Enter" && valid && begin()}
            />
            <button
              className={styles.btn}
              disabled={!valid || pending}
              onClick={begin}
            >
              {pending ? "جارٍ الاتصال بنفاذ…" : "المتابعة عبر نفاذ"}
            </button>
          </div>
        )}

        {phase === "challenge" && (
          <div className={styles.form}>
            <p className={styles.challengeHint}>
              افتح تطبيق «نفاذ» على جوّالك واختر الرقم المطابق:
            </p>
            <div className={styles.verifyBox}>
              <span className={`${styles.verifyNum} mono`}>{verify}</span>
            </div>
            <button
              className={styles.btn}
              disabled={pending}
              onClick={confirm}
            >
              {pending ? "جارٍ التحقّق…" : "لقد طابقتُ الرقم في نفاذ"}
            </button>
            <button
              className={styles.btnGhost}
              disabled={pending}
              onClick={() => {
                setPhase("id");
                setVerify(null);
                setError("");
              }}
            >
              تغيير رقم الهوية
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.devnote}>
          وضع تطويريّ: محاكاة نفاذ (mock) — أدخل أي رقم من 10 خانات، وستُوافَق
          المطابقة فوراً.
        </p>
      </div>
    </main>
  );
}
