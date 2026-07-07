"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, InlineAlert, Icon } from "@hemaya/ui";
import { PROTECTION_MEASURES } from "@hemaya/domain";
import { submitStudy, submitAssessment, type AuthorInput } from "@/lib/study-actions";

const RECS = ["قبول كليّ", "قبول جزئيّ", "رفض الحماية"];
const REJECT_REASONS = [
  "عدم ثبوت جريمةٍ كبيرة مشمولة",
  "عدم وجود خطرٍ حقيقيّ يستوجب الحماية",
  "عدم اختصاص المركز",
  "نقص البيانات أو المسوّغات",
];

export function AuthorForm({ caseId, track, existing }: {
  caseId: string; track: "study" | "assessment";
  existing: { recommendation?: string; reject_reasons?: string[]; proposed_type?: string[]; notes?: string; proposed_duration?: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const [rec, setRec] = useState(existing?.recommendation ?? "");
  const [rejects, setRejects] = useState<string[]>(existing?.reject_reasons ?? []);
  const [measures, setMeasures] = useState<string[]>(existing?.proposed_type ?? []);
  const [days, setDays] = useState<string>("");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const isReject = rec === "رفض الحماية";
  const isAccept = rec === "قبول كليّ" || rec === "قبول جزئيّ";
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = () => start(async () => {
    setError("");
    if (!rec) return setError("اختر التوصية.");
    const input: AuthorInput = {
      recommendation: rec, rejectReasons: isReject || rec === "قبول جزئيّ" ? rejects : [],
      proposedType: isAccept ? measures : [], durationDays: isAccept && days ? Number(days) : null, notes,
    };
    const r = track === "study" ? await submitStudy(caseId, input) : await submitAssessment(caseId, input);
    if (!r.ok) return setError(r.error);
    router.push(track === "study" ? "/study" : "/assessment"); router.refresh();
  });

  return (
    <Card>
      <CardBody>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{track === "study" ? "مخرَج الدراسة" : "مخرَج التقييم"}</h3>
          {existing?.recommendation && <span className="muted" style={{ fontSize: 12 }}><Icon name="history" size={13} /> مُقدَّم — يمكن التعديل</span>}
        </div>

        <InlineAlert kind="info" title="عزلٌ صفّيّ">مخرَجك مستقلّ ولا يطّلع عليه الأقران؛ يجمعه المجلس للتصويت فقط.</InlineAlert>

        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>التوصية</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {RECS.map((r) => (
                <button key={r} onClick={() => setRec(r)} className={"pp-btn " + (rec === r ? "" : "pp-btn--ghost")}
                  style={{ height: 38 }}>{r}</button>
              ))}
            </div>
          </div>

          {(isReject || rec === "قبول جزئيّ") && (
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>أسباب الرفض{rec === "قبول جزئيّ" ? " الجزئيّ" : ""}</div>
              <div style={{ display: "grid", gap: 4 }}>
                {REJECT_REASONS.map((r) => (
                  <label key={r} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, padding: "6px 2px", cursor: "pointer" }}>
                    <input type="checkbox" checked={rejects.includes(r)} onChange={() => toggle(rejects, setRejects, r)}
                      style={{ width: 17, height: 17, accentColor: "var(--color-primary)" }} /> {r}
                  </label>
                ))}
              </div>
            </div>
          )}

          {isAccept && (
            <>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>أنواع الحماية المقترحة (م14) — اقتراحٌ للمجلس</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {PROTECTION_MEASURES.map((m) => (
                    <label key={m.ref} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, padding: "6px 2px", cursor: "pointer" }}>
                      <input type="checkbox" checked={measures.includes(m.ref)} onChange={() => toggle(measures, setMeasures, m.ref)}
                        style={{ width: 17, height: 17, accentColor: "var(--color-primary)" }} />
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-link)" }}>{m.ref}</span> {m.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ maxWidth: 220 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>المدّة المقترحة (أيام)</div>
                <input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder="مثال: 180" dir="auto"
                  style={{ width: "100%", height: 44, padding: "0 12px", border: "1px solid var(--field-border)", borderRadius: 8, fontFamily: "var(--font-sans)", fontSize: 14 }} />
              </div>
            </>
          )}

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>ملاحظات / تسبيب</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تسبيب التوصية وعوامل المادة (9)…" dir="auto"
              style={{ width: "100%", minHeight: 80, padding: "10px 12px", border: "1px solid var(--field-border)", borderRadius: 8, fontFamily: "var(--font-sans)", fontSize: 14, resize: "vertical" }} />
          </div>

          {error && <p style={{ padding: "8px 12px", fontSize: 13.5, color: "var(--color-error)", background: "var(--color-error-subtle)", borderRadius: 6 }}>{error}</p>}

          <div>
            <button className="pp-btn" disabled={pending || !rec} onClick={submit}>
              <Icon name="task_alt" size={18} /> {existing?.recommendation ? "تحديث المخرَج" : "اعتماد وإرسال"}
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
