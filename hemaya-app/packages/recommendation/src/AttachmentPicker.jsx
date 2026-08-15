"use client";
/* ============================================================
   مُرفِق المستندات — رفعٌ حقيقيّ إلى دلو intake-docs.

   قبله كان النموذج يخزّن **اسم الملف** نصّاً والملف يبقى على جهاز
   الموظف، فيظهر في الفرز والدراسة سطرٌ لا يُفتح. هنا يُرفع الملف من
   المتصفح مباشرةً إلى Storage (فلا يمرّ بخادم التطبيق ولا يُحمَّل في
   ذاكرته)، ثمّ يُقيَّد سجلُّه بدالّةٍ تحرس الدور والمسار.

   المسار: <uuid المستخدم>/<عشوائيّ>.<الامتداد> — أوّل مقطعٍ هو صاحب
   الملف، وعليه تقوم سياسة التخزين فلا يكتب موظفٌ في مجلّد زميله.
   ============================================================ */
import React, { useRef, useState } from "react";
import { I } from "./parts";

const MAX_MB = 20;
const OK_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp|heic|heif))$/i;

const extOf = (name) => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name || "");
  return m ? m[1].toLowerCase() : "bin";
};

export function AttachmentPicker({
  regNo,
  files,          // [{ id, name, path }]
  setFiles,
  client,         // عميل Supabase للمتصفح (يمرّره التطبيق — الحزمة لا تعرف إعداده)
  onRecord,       // (path, fileName, mime, size, regNo) → { ok, id } — إجراء خادميّ
  onRemove,       // (id) → { ok, path }
  label = "إرفاق المستندات (يمكن اختيار أكثر من ملف)",
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const pick = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = "";
    if (!chosen.length) return;
    if (!regNo || !String(regNo).trim()) {
      setErr("أدخل رقم القيد أوّلاً — المرفق يُربط به.");
      return;
    }
    setErr(""); setBusy(true);
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("انتهت الجلسة — أعد الدخول.");
      const added = [];
      for (const f of chosen) {
        if (f.size > MAX_MB * 1024 * 1024) { setErr(`«${f.name}» يتجاوز ${MAX_MB} ميغابايت.`); continue; }
        if (f.type && !OK_TYPES.test(f.type)) { setErr(`«${f.name}» نوعٌ غير مقبول — PDF أو صورة.`); continue; }

        const path = `${user.id}/${crypto.randomUUID()}.${extOf(f.name)}`;
        const up = await client.storage.from("intake-docs").upload(path, f, {
          contentType: f.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) { setErr(`تعذّر رفع «${f.name}»: ${up.error.message}`); continue; }

        const rec = await onRecord(path, f.name, f.type || "", f.size, String(regNo).trim());
        if (!rec?.ok) {
          // السجلّ لم يُقيَّد — لا نترك كائناً يتيماً في الدلو
          await client.storage.from("intake-docs").remove([path]);
          setErr(rec?.error || `تعذّر تقييد «${f.name}».`);
          continue;
        }
        added.push({ id: rec.id, name: f.name, path });
      }
      if (added.length) setFiles([...(files || []), ...added]);
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setBusy(false);
    }
  };

  const drop = async (fileRow) => {
    setErr(""); setBusy(true);
    try {
      const res = await onRemove(fileRow.id);
      if (!res?.ok) { setErr(res?.error || "تعذّر الحذف."); return; }
      await client.storage.from("intake-docs").remove([res.path || fileRow.path]);
      setFiles((files || []).filter((x) => x.id !== fileRow.id));
    } finally {
      setBusy(false);
    }
  };

  const has = (files || []).length > 0;
  return (
    <>
      <div className="rf-attach-grid">
        <label className="rf-attach" style={{ cursor: busy || disabled ? "not-allowed" : "pointer", alignItems: "flex-start", opacity: busy || disabled ? 0.6 : 1 }}>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple style={{ display: "none" }}
            disabled={busy || disabled} onChange={pick} />
          <I name={busy ? "progress_activity" : has ? "check_circle" : "upload_file"} size={16}
            color={has ? "var(--color-primary)" : "var(--text-secondary)"} fill={has} />
          <span>{busy ? "يُرفع…" : label}</span>
        </label>
        {(files || []).map((f) => (
          <label key={f.id} className="rf-attach" style={{ alignItems: "flex-start" }}>
            <I name="check_circle" size={16} color="var(--color-primary)" fill />
            <span>{f.name}</span>
            <button className="link" style={{ marginInlineStart: "auto", fontSize: 12 }} disabled={busy}
              onClick={(e) => { e.preventDefault(); void drop(f); }}><I name="close" size={15} /></button>
          </label>
        ))}
      </div>
      {err && <p className="muted" style={{ marginTop: 8, fontSize: 12.5, color: "var(--color-error)" }}>{err}</p>}
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        <I name="lock" size={14} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
        تُرفع إلى مخزنٍ خاصّ لا يُقرأ إلا بالدور والإسناد — PDF أو صورة، حتى {MAX_MB} ميغابايت للملف.
      </p>
    </>
  );
}
