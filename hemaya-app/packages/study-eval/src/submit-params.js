// بناء معاملات RPC الاعتماد (submit_study / submit_assessment) من حالة النموذج —
// دالة نقيّة: أسباب الرفض بمسمّياتها، أنواع م14 مع النطاق الزمني، المدة،
// الملاحظات المجمّعة، وبندا الاطّلاع (يوجد/لا يوجد → true/false، والفراغ null).
import { PROTECTION_TYPES, REJECT_REASONS } from "./lookups";

export function buildSubmitParams(role, task, f) {
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
  // interval لا يعبّر عن «إلى حين انتهاء القضية» — تُسجَّل صراحةً في الملاحظات
  // (وإلا ضاعت بصمت: null لا يُميَّز عن عدم الاختيار وحزمة المجلس تخفيها)
  const notes = [
    f.dur === "مدة محدّدة" && f.durText ? `المدة المقترحة: ${f.durText}` : null,
    f.dur === "إلى حين انتهاء القضية" ? "المدة المقترحة: إلى حين انتهاء القضية" : null,
    f.kama || null,
  ]
    .filter(Boolean)
    .join(" — ");
  return {
    fn: role === "studier" ? "submit_study" : "submit_assessment",
    params: {
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
    },
  };
}
