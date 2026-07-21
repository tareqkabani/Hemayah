// شاشات الدراسة والتقييم — منقولة من المرجع المعتمد design-refs/study-eval-portal.jsx
// (تحديث 2026-07-21: الطلبات الواردة · المستندان الكاملان مطويّين · عارض المرفقات
// السرّي · طبقة هوية النيابة) وموصولة بالبيانات الحيّة تحت RLS.
import React, { useEffect, useState } from "react";
import { Card, Tag, InlineAlert, DeadlineTimer, SecretCode, I, NotifItem, fmtWhen } from "@hemaya/ui";
import { STAGE_FLOW } from "@hemaya/domain";
import { PROTECTION_TYPES, REJECT_REASONS, DURATIONS } from "./lookups";

const TRACK = {
  "عادي": ["var(--neutral-100)", "var(--text-secondary)", "schedule"],
  "عاجل": ["var(--warning-10)", "var(--warning-70)", "bolt"],
  "طارئ": ["var(--error-10)", "var(--color-error)", "e911_emergency"],
  "أجنبي": ["var(--info-10)", "var(--info-70)", "public"],
};

export function TrackPill({ track }) {
  const t = TRACK[track] || TRACK["عادي"];
  return (
    <span className="pill" style={{ background: t[0], color: t[1] }}>
      <I name={t[2]} size={12} fill /> {track}
    </span>
  );
}

// ===== الطلبات الواردة (التسمية المعتمدة — ليست «المهام المُسندة») =====
export function Tasks({ cfg, rows, open }) {
  return (
    <div>
      <h2 className="h2">الطلبات الواردة</h2>
      <p className="lede">
        طلبات {cfg.strings.output} الواردة إليك — <b>توزيع آليّ بالعبء</b>. يُستقبَل المخرَج ضمن يوم عمل في مظلّة 3
        أيام (م10).
      </p>
      <Card className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>الرمز السري</th>
                <th>الفئة</th>
                <th>المسار</th>
                <th>الميعاد</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.caseId} onClick={() => t.status === "new" && open(t)}>
                  <td>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--text-strong)" }}>{t.secret}</span>
                    {t.foreign && (
                      <span
                        className="pill"
                        style={{ background: "var(--info-10)", color: "var(--info-70)", marginInlineStart: 7 }}
                      >
                        <I name="public" size={12} fill /> أجنبي · م6
                      </span>
                    )}
                  </td>
                  <td>{t.cat}</td>
                  <td><TrackPill track={t.track} /></td>
                  <td>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: t.status === "done" ? "var(--text-secondary)" : "var(--color-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {t.due}
                    </span>
                  </td>
                  <td>
                    {t.status === "new" ? (
                      <span className="link">فتح النموذج <I name="chevron_left" size={16} /></span>
                    ) : (
                      <Tag tone="success" size="sm" iconLeft={<I name="check" size={13} />}>مكتملة</Tag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <InlineAlert kind="info" title="عزل تامّ بين الأقران" style={{ marginTop: 16 }}>
        قد يُسنَد الطلب الواحد إلى عدّة {cfg.strings.peers} في آنٍ واحد، يعمل كلٌّ منهم بمعزل عن الآخرين — لا اطّلاع
        أفقيّ على أعمالهم. تُجمَّع كل المخرجات <b>آلياً</b> وتُعرض على المجلس دون تدخّل بشريّ، ضماناً للحياد.
      </InlineAlert>
    </div>
  );
}

function Chk({ on, label, onClick, children }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "9px 12px",
        border: "1px solid " + (on ? "var(--color-primary)" : "var(--border-subtle)"),
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        background: on ? "var(--green-10)" : "var(--surface-card)",
        fontSize: 13.5,
        color: "var(--text-body)",
        userSelect: "none",
      }}
    >
      <I
        name={on ? "check_box" : "check_box_outline_blank"}
        size={20}
        color={on ? "var(--color-primary)" : "var(--text-secondary)"}
        fill={on}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {children}
    </div>
  );
}

// ===== عارض المرفقات الآمن — اطّلاع داخل الشاشة فقط (بلا تنزيل أو تداول) =====
// كل فتحٍ صفُّ تدقيق (م15/16) عبر onOpenDoc في الحاوية — العارض عرضٌ فقط:
// لا زر تنزيل، لا فتح بتبويب، لا رابط مباشر، وقائمة السياق معطّلة.
export function AttViewer({ doc, secret, viewer, onClose }) {
  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const wm = "سري للغاية · " + secret + " · مُطّلع: " + viewer + " · عرض فقط";
  const bars = [92, 100, 97, 88, 100, 95, 72, 0, 90, 100, 96, 84, 100, 68];
  return (
    <div
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,14,22,0.62)", display: "grid", placeItems: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(760px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xl)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
          <I name="description" size={20} color="var(--color-primary)" />
          <b style={{ fontSize: 14, color: "var(--text-strong)", flex: 1, minWidth: 160 }}>{doc}</b>
          <Tag tone="error" size="sm" iconLeft={<I name="visibility" size={13} />}>عرض فقط — يُمنع التنزيل والتداول</Tag>
          <button
            onClick={onClose}
            aria-label="إغلاق العارض"
            style={{ width: 34, height: 34, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}
          >
            <I name="close" size={19} />
          </button>
        </div>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-subtle)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap" }}>
          <I name="policy" size={15} color="var(--color-error)" />
          <span>فُتح المستند للاطّلاع داخل الشاشة — <b>مُسجّل في التدقيق</b> (المستخدم · المستند · الوقت) وفق مبدأ الحاجة إلى المعرفة (م15/16).</span>
        </div>
        <div style={{ overflow: "auto", padding: 20, background: "var(--surface-page)" }}>
          <div style={{ position: "relative", background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "28px 26px", minHeight: 420, overflow: "hidden", userSelect: "none" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: -60, display: "grid", gap: 64, alignContent: "center", transform: "rotate(-24deg)", pointerEvents: "none" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "rgba(3,126,122,0.10)", textAlign: "center" }}>
                  {wm}   {wm}
                </div>
              ))}
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: "2px solid var(--green-10)", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{doc}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                    مرفق معتمد — مرتبط بالرمز السري <span className="mono" style={{ fontWeight: 700 }}>{secret}</span>
                  </div>
                </div>
                <Tag tone="error" size="sm" iconLeft={<I name="lock" size={12} />}>سري</Tag>
              </div>
              <div style={{ display: "grid", gap: 11 }}>
                {bars.map((w, i) =>
                  w === 0 ? (
                    <div key={i} style={{ height: 8 }} />
                  ) : (
                    <div key={i} style={{ height: 11, width: w + "%", borderRadius: 6, background: "var(--neutral-100, #F3F4F6)" }} />
                  )
                )}
              </div>
              <p style={{ margin: "22px 0 0", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.7, textAlign: "center" }}>
                معاينة آمنة داخل المنصة — يُعرض المحتوى الفعلي هنا في النظام المنتج بعلامة مائية باسم المُطّلع، دون رابط تنزيل أو طباعة.
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)" }}>
            <I name="verified_user" size={14} color="var(--color-primary)" /> المُطّلع: {viewer} — علامة مائية باسمه على كامل المستند
          </span>
          <button className="btn btn-ghost" style={{ height: 34, fontSize: 12.5 }} onClick={onClose}>
            <I name="close" size={15} /> إغلاق الاطّلاع
          </button>
        </div>
      </div>
    </div>
  );
}

export function AttChip({ name, onOpen }) {
  return (
    <button
      onClick={onOpen}
      title="اطّلاع داخل الشاشة — بلا تنزيل"
      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", cursor: "pointer", fontFamily: "inherit" }}
    >
      <I name="description" size={15} color="var(--color-primary)" />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)" }}>{name}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>
        <I name="visibility" size={14} /> اطّلاع
      </span>
    </button>
  );
}

const R = (l, v, tone) => (
  <div className="ro-field" style={{ marginBottom: 6 }}>
    <span className="muted" style={{ fontSize: 12.5 }}>{l}</span>
    {tone ? (
      <Tag tone={tone} size="sm">{v}</Tag>
    ) : (
      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{v}</span>
    )}
  </div>
);
const Block = (l, v) => (
  <div className="fld" style={{ marginBottom: 8 }}>
    <span className="fld-label">{l}</span>
    <div className="ro-field" style={{ display: "block", lineHeight: 1.7 }}>{v}</div>
  </div>
);

// ===== طلب الحماية كما ورد من طالب الحماية (للقراءة · الهوية محجوبة) =====
// مرآة حقول نموذج بوابة طالب الحماية من protection_requests — مطويّ افتراضاً.
export function SeekerReq({ task, detail, viewer, onOpenDoc }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(null);
  const req = detail?.request || null;
  const dd = req?.details || {};
  const files = Array.isArray(dd.files) ? dd.files : [];
  const openAtt = (name) => {
    setDoc(name);
    onOpenDoc && onOpenDoc(task, name);
  };
  return (
    <Card className="card pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <b style={{ color: "var(--text-strong)" }}>
          <I name="contact_page" size={18} color="var(--color-primary)" fill style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
          طلب الحماية كما ورد من طالب الحماية
        </b>
        <span className="row" style={{ gap: 8 }}>
          <Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} fill />}>موثّق عبر نفاذ</Tag>
          <I name={open ? "expand_less" : "expand_more"} size={20} color="var(--text-secondary)" />
        </span>
      </div>
      {open && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, marginTop: 12 }}>
            <div className="ro-field">
              <span className="muted" style={{ fontSize: 12.5 }}>رقم الطلب</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text-strong)" }}>{task.refNo || "—"}</span>
            </div>
            <div className="ro-field">
              <span className="muted" style={{ fontSize: 12.5 }}>تاريخ التقديم</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{req?.submitted_at ? fmtWhen(req.submitted_at) : "—"}</span>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            {R("صفة مقدّم الطلب", dd.role || "أصيل — عن نفسه")}
            {R("دور طالب الحماية في القضية", task.cat, "info")}
            {R("نوع الجريمة محل القضية", dd.crime || dd.waqia || "—")}
            {R("هل سبق التقديم للجهة المختصة؟", dd.prior_submit ? "نعم — " + (dd.prior_entity || "الجهة المختصة") : "لا")}
            {R("جهة اتصال الطوارئ", "مُسجّلة (محجوبة — تُكشف للتنفيذ فقط)")}
          </div>
          <div className="fld" style={{ marginTop: 8, marginBottom: 8 }}>
            <span className="fld-label">مسوّغات طلب الحماية — بنصّ مقدّمه</span>
            <div className="ro-field" style={{ display: "block", lineHeight: 1.7 }}>{dd.reason || "—"}</div>
          </div>
          {files.length > 0 && (
            <div className="fld" style={{ marginBottom: 8 }}>
              <span className="fld-label">
                مرفقات الطلب <span className="muted" style={{ fontWeight: 400 }}>· اطّلاع داخل الشاشة فقط</span>
              </span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {files.map((a, i) => (
                  <AttChip key={i} name={a} onOpen={() => openAtt(a)} />
                ))}
              </div>
            </div>
          )}
          <div className="ro-field">
            <span className="row" style={{ gap: 8 }}>
              <I name="fact_check" size={17} color="var(--color-success)" fill />
              <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>الإقراران مستوفيان — صحّة البيانات والموافقة على المعالجة</span>
            </span>
            <Tag tone="neutral" size="sm" iconLeft={<I name="lock_clock" size={13} />}>ختم زمني موثّق</Tag>
          </div>
        </div>
      )}
      {doc && <AttViewer doc={doc} secret={task.secret} viewer={viewer} onClose={() => setDoc(null)} />}
    </Card>
  );
}

// ===== التوصية الكاملة من الجهة المختصة (للقراءة · الهوية محجوبة) =====
// 8 أقسام تبدأ بـ«الجهة صاحبة التوصية» وتنتهي بالمرفقات — مطوية افتراضاً،
// أرقام الأقسام برونزية (.grp-n من طبقة هوية النيابة).
export function AuthRec({ task, detail, viewer, onOpenDoc }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(null);
  const rec = detail?.recommendation || null;
  const rd = rec?.details || {};
  const dd = detail?.request?.details || {};
  const secret = task.secret;
  const types = Array.isArray(rec?.proposed_type) ? rec.proposed_type.join(" · ") : null;
  const atts = Array.isArray(rd.attachments) ? rd.attachments : [];
  const factors = rec?.factors9 && typeof rec.factors9 === "object" ? Object.entries(rec.factors9) : [];
  const openAtt = (name) => {
    setDoc(name);
    onOpenDoc && onOpenDoc(task, name);
  };
  const Grp = ({ n, title, children }) => (
    <div style={{ marginTop: 16 }}>
      <div className="row" style={{ gap: 8, marginBottom: 9 }}>
        <span className="grp-n">{n}</span>
        <b style={{ fontSize: 13.5, color: "var(--text-strong)" }}>{title}</b>
      </div>
      {children}
    </div>
  );
  return (
    <Card className="card pad" style={{ marginBottom: 16, borderColor: "var(--green-20)" }}>
      <div className="row" style={{ justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <b style={{ color: "var(--text-strong)" }}>
          <I name="assignment_turned_in" size={18} color="var(--color-primary)" fill style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
          التوصية الكاملة من الجهة المختصة
        </b>
        <span className="row" style={{ gap: 8 }}>
          <Tag tone="success" size="sm" iconLeft={<I name="verified" size={13} fill />}>معتمدة ومرفوعة</Tag>
          <I name={open ? "expand_less" : "expand_more"} size={20} color="var(--text-secondary)" />
        </span>
      </div>
      {open && (
        <div>
          <InlineAlert kind="warning" title="الهوية محجوبة" style={{ marginTop: 12 }}>
            هوية الشخص وبياناته الشخصية <b>محجوبة</b> ويُشار إليه بالرمز السري{" "}
            <span className="mono" style={{ fontWeight: 700 }}>{secret}</span> — تطّلع على مضمون التوصية دون التعرّف
            على الهوية (عزل وسرية).
          </InlineAlert>

          <Grp n="١" title="الجهة صاحبة التوصية">
            {R("الجهة المختصة", rec?.source_body || "—")}
            {R("ضابط الاتصال المعتمد", rd.officer || "—")}
            {R("مرجع التوصية", rd.rec_ref || "—")}
            {R("تاريخ الرفع", rec?.received_at ? fmtWhen(rec.received_at) + " — ضمن مهلة 5 أيام العمل" : "—", "success")}
            {R("اعتمدها", rd.approved_by || "رئيس الفرع المباشر")}
          </Grp>

          <Grp n="٢" title="بيانات مقدّم الطلب (محجوبة الهوية)">
            {R("صفة مقدّم الطلب", task.cat)}
            {R("الحالة الصحية", rd.health || "سليم")}
            {R("التاريخ الجنائي", rd.criminal || "لا يوجد")}
            {R("التاريخ النفسي", rd.psych || "لا توجد ملحوظات")}
            {R("رغبة الكشف عن الهوية", rd.reveal || "لا يرغب", "warning")}
          </Grp>

          <Grp n="٣" title="تفاصيل وأسباب طلب الحماية">
            {Block("التفاصيل والأسباب", rd.req_details || dd.reason || "—")}
          </Grp>

          <Grp n="٤" title="ملخّص القضية ودور مقدّم الطلب">
            {R("رقم القضية", dd.case_no || "—")}
            {R("المرحلة الحالية", rd.stage || "التحقيق")}
            {Block("ملخّص القضية", rd.case_summary || "—")}
            {Block("دور مقدّم الطلب وأهمية معلوماته", rd.role_desc || "—")}
          </Grp>

          <Grp n="٥" title="مسوّغات توفير الحماية">
            {R("هل تم التواصل مع مقدّم الطلب؟", rd.contacted || "نعم")}
            {R("نوع الجريمة", "كبيرة موجبة للتوقيف", "error")}
            {dd.waqia && R("الواقعة", dd.waqia)}
            {Block("الوصف الإجرامي", rd.crime_desc || dd.crime || "—")}
            {R("إخفاء البيانات (م2 من النظام)", "نعم")}
            {R("وجود خطر يهدّد طالب الحماية", "يوجد", "error")}
            {rd.threat_type && R("نوع الخطر", rd.threat_type)}
            {R("مستوى الخطر", dd.threat === "مرتفع" ? "شديد" : dd.threat || "شديد", "error")}
            {rd.harm_type && R("نوع الضرر", rd.harm_type)}
            {R("امتداد الخطر إلى الغير (م5/4)", rd.extends_who && rd.extends_who !== "لا يمتدّ" ? "نعم" : "لا", rd.extends_who && rd.extends_who !== "لا يمتدّ" ? "error" : undefined)}
            {rd.extends_who && rd.extends_who !== "لا يمتدّ" && R("إلى من يمتدّ", rd.extends_who)}
            {factors.map(([k, v]) => (
              <React.Fragment key={k}>{R(k, String(v))}</React.Fragment>
            ))}
            {R("توصية الجهة", rec?.decision === "توفير" ? "توفير الحماية" : rec?.decision || "—", "success")}
            {Block("أسباب التوصية", rec?.notes || "—")}
          </Grp>

          <Grp n="٦" title="أنواع الحماية المقترحة من الجهة">
            {Block("الأنواع المقترحة", types || "—")}
            {R("الحلول البديلة", rd.alt_solutions || "لا توجد")}
          </Grp>

          <Grp n="٧" title="مدة الحماية المقترحة">
            {R("المدة", rec?.proposed_duration ? "ثلاثون يوماً" : "إلى حين انتهاء القضية")}
          </Grp>

          <Grp n="٨" title="مرفقات التوصية">
            <p className="muted" style={{ margin: "0 0 8px", fontSize: 11.5 }}>
              <I name="visibility" size={13} style={{ verticalAlign: "middle", marginInlineEnd: 3 }} />
              مستندات حسّاسة — تُفتح للاطّلاع داخل الشاشة فقط، بلا تنزيل أو تداول، وكل فتح مُسجّل في التدقيق.
            </p>
            {atts.length > 0 ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {atts.map((a, i) => (
                  <AttChip key={i} name={a} onOpen={() => openAtt(a)} />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>لا مرفقات مسجّلة على التوصية.</p>
            )}
          </Grp>

          <div className="ro-field" style={{ marginTop: 16 }}>
            <span className="row" style={{ gap: 8 }}>
              <I name="account_balance" size={17} color="var(--color-primary)" />
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{rec?.source_body || "—"}</span>
              <span className="muted">· اعتمدها {rd.approved_by || "رئيس الفرع المباشر"}</span>
            </span>
            <Tag tone="neutral" size="sm" iconLeft={<I name="lock_clock" size={13} />}>موقّعة رقمياً</Tag>
          </div>
        </div>
      )}
      {doc && <AttViewer doc={doc} secret={secret} viewer={viewer} onClose={() => setDoc(null)} />}
    </Card>
  );
}

// ===== شاشة الطلب — النموذج (دراسة أو تقييم حسب الدور) =====
export function UnifiedForm({ cfg, me, task, detail, back, onSubmit, onReveal, onOpenDoc, busy }) {
  const [f, setF] = useState({
    recExists: "", reqExists: "",
    kama: "", rec: "", partial: "", rej: {}, rejNote: {}, dur: "", durText: "",
    types: {}, subdur: {}, otherText: "",
  });
  const [revealed, setRevealed] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (grp, k) => setF((s) => ({ ...s, [grp]: { ...s[grp], [k]: !s[grp][k] } }));
  const Seg = (label, key, opts) => (
    <div className="fld">
      <span className="fld-label">{label}</span>
      <div className="chips">
        {opts.map((o) => (
          <button key={o} className={"chip sm" + (f[key] === o ? " on" : "")} onClick={() => set(key, o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
  const accept = f.rec === "قبول كلي" || f.rec === "قبول جزئي";
  const dd = detail?.request?.details || {};
  const rd = detail?.recommendation?.details || {};
  const fmtDate = (ts) => (ts ? fmtWhen(ts).split(" ")[0] : "—");
  // بيانات الورود والإحالة — بلا تكرار مع المستندين المطويين أدناه
  const CASE = [
    ["الرمز السري", task.secret, "tag"],
    ["رقم الوارد", dd.incoming_no || "—"],
    ["تاريخ الوارد", fmtDate(detail?.request?.submitted_at)],
    ["قناة الورود", "إحالة من الفرز المبدئي"],
    ["مرحلة القضية", rd.stage || "التحقيق"],
    ["تصنيف الخطر المبدئي (من الفرز)", dd.threat || "مرتفع", "risk"],
  ];
  return (
    <div>
      <button className="link" onClick={back} style={{ marginBottom: 12 }}>
        <I name="arrow_forward" size={16} /> رجوع للمهام
      </button>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="row">
          <SecretCode code={task.secret} canReveal={true} onReveal={() => { setRevealed(true); onReveal(task); }} />
          <Tag tone="info" size="sm">{task.cat}</Tag>
          <Tag tone={cfg.strings.short === "دارس" ? "info" : "warning"} size="sm">{cfg.strings.kind}</Tag>
          <TrackPill track={task.track} />
          {task.foreign && (
            <Tag tone="info" size="sm" iconLeft={<I name="public" size={13} fill />}>أجنبي · م6</Tag>
          )}
        </div>
        <DeadlineTimer
          label="استقبال المخرَج"
          totalDays={task.timer.total}
          daysElapsed={task.timer.elapsed}
          articleRef={task.timer.ref}
        />
      </div>
      {revealed && (
        <InlineAlert kind="info" title="كشف الهوية مُسجَّل في التدقيق" style={{ marginBottom: 12 }}>
          كُشِفت هوية طالب الحماية بواسطة {me.name} — سُجِّل حدث الكشف (المستخدم، الطلب، الوقت) في سجلّ التدقيق وفق
          مبدأ الحاجة إلى المعرفة.
        </InlineAlert>
      )}

      {task.foreign && (
        <Card className="card pad" style={{ marginTop: 16, borderColor: "var(--color-info)", background: "var(--info-10)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <b style={{ color: "var(--text-strong)" }}>
              <I name="public" size={18} color="var(--color-info)" fill style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
              المسار الأجنبي — طلب مساعدة قانونية (المادة السادسة)
            </b>
            <Tag tone="neutral" size="sm" iconLeft={<I name="handshake" size={13} />}>معاملة بالمثل</Tag>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            <div className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>الدولة الطالبة</span><span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{task.foreign.country}</span></div>
            <div className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>السلطة الأجنبية</span><span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{task.foreign.authority}</span></div>
            <div className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>المرجع الأجنبي</span><span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text-strong)" }}>{task.foreign.foreign_ref}</span></div>
            <div className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>أساس المعاملة بالمثل</span><span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{task.foreign.basis}</span></div>
            <div className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>الموقع في المملكة</span><span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{task.foreign.city}</span></div>
            <div className="ro-field"><span className="muted" style={{ fontSize: 12.5 }}>أُحيل عبر</span><span style={{ fontWeight: 600, fontSize: 12, color: "var(--text-strong)" }}>اللجنة الدائمة لطلبات المساعدة القانونية — وزارة الداخلية</span></div>
          </div>
          <p className="muted" style={{ margin: "12px 0 0", lineHeight: 1.65 }}>
            <I name="info" size={14} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
            يُدرَس ويُقيَّم ويُصوّت عليه كأيّ طلب (الأغلبية وترجيح الرئيس)، ثمّ يبتّ فيه النائب العام بناءً على توصية
            المركز ومبدأ المعاملة بالمثل.
          </p>
        </Card>
      )}

      {/* ① بيانات الورود والإحالة — مجلوبة آلياً (للقراءة) */}
      <Card className="card pad" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <b style={{ color: "var(--text-strong)" }}>
            <I name="folder_shared" size={18} color="var(--color-primary)" style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            بيانات الورود والإحالة
          </b>
          <Tag tone="neutral" size="sm" iconLeft={<I name="sync" size={13} />}>مجلوبة آلياً · للقراءة</Tag>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
          {CASE.map(([l, v, kind], i) => (
            <div key={i} className="ro-field">
              <span className="muted" style={{ fontSize: 12.5 }}>{l}</span>
              {kind === "tag" ? (
                <span className="mono" style={{ fontWeight: 700, color: "var(--text-strong)", fontSize: 13 }}>{v}</span>
              ) : kind === "risk" ? (
                <Tag tone="error" size="sm">{v}</Tag>
              ) : (
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>{v}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ② المستندان الكاملان — مطويّان افتراضاً (هوية محجوبة) */}
      {!task.foreign && <SeekerReq task={task} detail={detail} viewer={me.name} onOpenDoc={onOpenDoc} />}
      {!task.foreign && <AuthRec task={task} detail={detail} viewer={me.name} onOpenDoc={onOpenDoc} />}
      {task.foreign && (
        <InlineAlert kind="info" title="لا طلب مباشر من الشخص" style={{ marginBottom: 16 }}>
          المسار الأجنبي (م6) يرد عبر القناة الرسمية — لا طلب مباشر من طالب الحماية ولا توصية جهة محلّية؛ مستند
          الدراسة هو الطلب الأجنبي المترجم أعلاه.
        </InlineAlert>
      )}

      {/* ③ الدراسة/التقييم والرأي — إدخال الدارس/المقيّم */}
      <Card className="card pad">
        <b style={{ color: "var(--text-strong)", display: "block", marginBottom: 14 }}>
          <I name={cfg.strings.formIcon} size={18} color="var(--color-primary)" style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
          {cfg.strings.formTitle}
        </b>

        <div className="fld">
          <span className="fld-label">بالاطّلاع على الطلب المرافق تبيّن الآتي</span>
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {[["recExists", "توصية من الجهة المختصة", "assignment_turned_in"], ["reqExists", "طلب مسبّب من طالب الحماية", "contact_page"]].map(([key, label, icon], i) => {
              const v = f[key];
              return (
                <div
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none", background: "var(--surface-card)", flexWrap: "wrap" }}
                >
                  <I name={icon} size={18} color="var(--color-primary)" />
                  <span style={{ flex: 1, minWidth: 180, fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span>
                  <div style={{ display: "flex", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    {["يوجد", "لا يوجد"].map((o) => {
                      const on = v === o;
                      return (
                        <button
                          key={o}
                          onClick={() => set(key, o)}
                          style={{
                            padding: "7px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                            fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5,
                            background: on ? (o === "يوجد" ? "var(--color-primary)" : "var(--text-secondary)") : "var(--surface-card)",
                            color: on ? "#fff" : "var(--text-secondary)",
                            borderInlineStart: o === "لا يوجد" ? "1px solid var(--border-default)" : "none",
                          }}
                        >
                          {on && <I name={o === "يوجد" ? "check" : "close"} size={14} />}
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="fld">
          <span className="fld-label">ملاحظات {cfg.label} بعد الاطّلاع</span>
          <textarea
            value={f.kama}
            onChange={(e) => set("kama", e.target.value)}
            placeholder={"ملاحظات " + cfg.label + " بعد الاطّلاع…"}
            dir="auto"
          />
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 0 16px" }} />
        {Seg(cfg.strings.recLabel, "rec", ["قبول كلي", "قبول جزئي", "رفض الحماية"])}

        {f.rec === "قبول جزئي" && (
          <div className="fld">
            <span className="fld-label">أسباب القبول الجزئي</span>
            <textarea
              value={f.partial}
              onChange={(e) => set("partial", e.target.value)}
              placeholder="حدّد ما يُقبل وما يُستثنى ومسوّغاته…"
              dir="auto"
            />
          </div>
        )}

        {f.rec === "رفض الحماية" && (
          <div className="fld">
            <span className="fld-label">أسباب رفض الحماية</span>
            <div style={{ display: "grid", gap: 8 }}>
              {REJECT_REASONS.map((r) => (
                <div key={r.k}>
                  <Chk on={!!f.rej[r.k]} label={r.t} onClick={() => toggle("rej", r.k)} />
                  {r.note && f.rej[r.k] && (
                    <input
                      value={f.rejNote[r.k] || ""}
                      onChange={(e) => setF((s) => ({ ...s, rejNote: { ...s.rejNote, [r.k]: e.target.value } }))}
                      placeholder="تفصيل…"
                      dir="auto"
                      style={{ marginTop: 6 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {accept && (
          <>
            {Seg("مدة الحماية المقترحة", "dur", DURATIONS)}
            {f.dur === "مدة محدّدة" && (
              <div className="fld" style={{ marginTop: -8 }}>
                <input value={f.durText} onChange={(e) => set("durText", e.target.value)} placeholder="حدّد المدة…" dir="auto" />
              </div>
            )}

            <div className="fld">
              <span className="fld-label">
                نوع الحماية المقترحة{" "}
                <span className="muted" style={{ fontWeight: 400 }}>· المادة 14 (اختيار متعدّد · مقترح للمجلس)</span>
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8 }}>
                {PROTECTION_TYPES.map((p, i) => (
                  <Chk key={i} on={!!f.types["t" + i]} label={p.t} onClick={() => toggle("types", "t" + i)}>
                    {p.dur && f.types["t" + i] && (
                      <span className="chips" onClick={(e) => e.stopPropagation()}>
                        {["مؤقت", "دائم"].map((dur) => (
                          <button
                            key={dur}
                            className={"chip sm" + (f.subdur["t" + i] === dur ? " on" : "")}
                            onClick={() => set("subdur", { ...f.subdur, ["t" + i]: dur })}
                          >
                            {dur}
                          </button>
                        ))}
                      </span>
                    )}
                  </Chk>
                ))}
                <Chk on={!!f.types.other} label="أخرى" onClick={() => toggle("types", "other")} />
              </div>
              {f.types.other && (
                <input
                  value={f.otherText}
                  onChange={(e) => set("otherText", e.target.value)}
                  placeholder="نوع حماية آخر…"
                  dir="auto"
                  style={{ marginTop: 8 }}
                />
              )}
              <p className="muted" style={{ margin: "8px 2px 0" }}>
                <I name="info" size={13} style={{ verticalAlign: "middle", marginInlineEnd: 3 }} />
                هذه أنواع <b>مقترحة</b> فقط؛ القرار النهائي بأنواع الحماية للمجلس.
              </p>
            </div>
          </>
        )}

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 0 14px" }} />
        <div className="pp-strip">
          <span className="row" style={{ gap: 8 }}>
            <I name="verified_user" size={18} color="var(--pp-bronze-deep)" fill />
            <span>
              <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-strong)" }}>
                {cfg.strings.signer}: {me.name} — يُوثّق آلياً عبر نفاذ
              </span>
              <span className="muted" style={{ display: "block", fontSize: 12 }}>توقيع إلكتروني + ختم زمني في سجل التدقيق</span>
            </span>
          </span>
          <Tag tone="success" size="sm" iconLeft={<I name="lock_clock" size={13} />}>موقّع رقمياً</Tag>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16, gap: 10 }}>
          <button className="btn btn-ghost" onClick={back}>حفظ مسودة</button>
          <button className="btn btn-primary" disabled={!f.rec || busy} onClick={() => onSubmit(task, f)}>
            اعتماد وإرسال <I name="send" size={17} />
          </button>
        </div>
      </Card>
    </div>
  );
}

// ===== لوحة المعلومات =====
export function Dashboard({ cfg, rows, openTask, go, notifs, onOpenNotif }) {
  const n = (fn) => rows.filter(fn).length;
  const prio = { "طارئ": 0, "عاجل": 1, "أجنبي": 2, "عادي": 3 };
  const actionable = rows
    .map((r) => ({ r, act: cfg.nextAction({ status: r.status }) }))
    .filter((x) => x.act)
    .sort((a, b) => (prio[a.r.track] ?? 9) - (prio[b.r.track] ?? 9));
  const hero = actionable[0];
  const slas = rows.filter((r) => r.status === "new");
  const updates = notifs.slice(0, 4);
  const stats = [
    { v: actionable.length, l: "يتطلّب إجراءً منك", icon: "bolt", tone: ["var(--error-10)", "var(--color-error)"] },
    { v: n((r) => r.status === "new"), l: "بانتظار " + cfg.strings.output, icon: "pending_actions", tone: ["var(--warning-10)", "var(--color-warning)"] },
    { v: n((r) => r.status === "done"), l: "مكتملة", icon: "task_alt", tone: ["var(--green-10)", "var(--color-primary)"] },
    { v: n((r) => r.foreign), l: "أجنبي · م6", icon: "public", tone: ["var(--info-10)", "var(--color-info)"] },
  ];
  return (
    <div>
      <h2 className="h2">لوحة المعلومات</h2>
      <p className="lede">مهامّك أنت فقط. مبدأ الحاجة إلى المعرفة — لا اطّلاع على أعمال أقرانك، والتوزيع آليّ بالعبء.</p>
      {hero ? (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="pill" style={{ background: "var(--error-10)", color: "var(--color-error)" }}>
                <I name="bolt" size={13} fill /> يتطلّب إجراء
              </span>
              <span className="mono" style={{ fontWeight: 800, color: "var(--text-strong)" }}>{hero.r.secret}</span>
              <Tag tone="info" size="sm">{hero.r.cat}</Tag>
              <TrackPill track={hero.r.track} />
              {hero.r.foreign && (
                <Tag tone="info" size="sm" iconLeft={<I name="public" size={13} fill />}>أجنبي · م6</Tag>
              )}
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{hero.r.due}</span>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>
            الإجراء المطلوب منك: {hero.act.t}
          </p>
          <div className="stp">
            {STAGE_FLOW.map((s, i) => (
              <span key={i} className={i < cfg.stage.index ? "on" : ""} title={s} />
            ))}
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              المرحلة {cfg.stage.index} من {cfg.stage.total} — {STAGE_FLOW[cfg.stage.index - 1]}
            </span>
            <button className="btn btn-primary" onClick={() => openTask(hero.r)}>
              <I name={hero.act.icon} size={18} /> اتّخذ الإجراء
            </button>
          </div>
        </div>
      ) : (
        <div className="card pad" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <I name="check_circle" size={22} color="var(--color-success)" fill />
          <span style={{ fontSize: 14, color: "var(--text-body)" }}>
            لا إجراءات معلّقة عليك الآن — كل مخرجاتك مُرسلة للتجميع الآلي.
          </span>
        </div>
      )}
      <div className="stats">
        {stats.map((s, i) => (
          <button key={i} className="card stat" onClick={() => go("tasks")} title="فتح الطلبات الواردة">
            <div className="stat-ico" style={{ background: s.tone[0], color: s.tone[1] }}>
              <I name={s.icon} size={22} />
            </div>
            <div>
              <div className="stat-v">{s.v}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="dash-cols">
        <div className="card pad">
          <b style={{ color: "var(--text-strong)", display: "block", marginBottom: 12 }}>
            <I name="timer" size={18} color="var(--color-primary)" style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            المهلة النظامية الجارية
          </b>
          {slas.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>لا مُهل جارية الآن.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {slas.map((r) => (
                <div key={r.caseId}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text-strong)" }}>{r.secret}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{r.due}</span>
                  </div>
                  <DeadlineTimer
                    label={"استقبال مخرَج " + cfg.strings.output}
                    totalDays={r.timer.total}
                    daysElapsed={r.timer.elapsed}
                    articleRef={r.timer.ref}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ margin: "12px 0 0", lineHeight: 1.7, fontSize: 12 }}>
            يُستقبَل مخرَج {cfg.strings.output} خلال <b>يوم عمل</b> من الإسناد، ضمن المظلّة النظامية <b>3 أيام</b>{" "}
            لاكتمال الدراسة والتقييم (المادة العاشرة).
          </p>
        </div>
        <div className="card" style={{ padding: "16px 10px 10px" }}>
          <b style={{ color: "var(--text-strong)", display: "block", margin: "0 8px 8px" }}>
            <I name="update" size={18} color="var(--color-primary)" style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            آخر التحديثات
          </b>
          {updates.map((u) => (
            <NotifItem key={u.id} config={cfg} n={u} dense onOpen={onOpenNotif} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== الملف الشخصي =====
export function Profile({ cfg, me }) {
  const rows = [
    ["الاسم", me.name],
    ["الرقم الوظيفي", me.emp || "—"],
    ["الدور", cfg.label],
    ["الإدارة", "إدارة البرنامج — الدراسة والتقييم"],
    ["نطاق العمل", cfg.strings.output + " الطلبات المُسندة إليّ"],
    ["المصادقة الثنائية (MFA)", "مُفعّلة"],
  ];
  const perms = [
    "استقبال الطلبات المُسندة إليّ آلياً بالعبء",
    "الاطّلاع على معلومات الحالة وتوصية الجهة (هوية محجوبة)",
    "إعداد " + cfg.strings.output + " وإبداء الرأي (قبول/رفض) واقتراح الأنواع",
    "اعتماد المخرَج وإرساله موقّعاً عبر نفاذ",
    "عرض الرمز السري وكشفه عند الحاجة (مُسجّل)",
  ];
  const denied = [
    cfg.strings.short === "دارس" ? "الاطّلاع على دراسات الدارسين الآخرين" : "الاطّلاع على تقييمات المقيّمين الآخرين",
    cfg.strings.short === "دارس" ? "الاطّلاع على أيّ تقييم" : "الاطّلاع على أيّ دراسة",
    "كشف هوية طالب الحماية",
    "تعديل مخرَج بعد اعتماده",
  ];
  return (
    <div>
      <h2 className="h2">الملف الشخصي</h2>
      <p className="lede">البيانات والصلاحيات ونطاق العمل. الوصول مقيّد بالدور ومُسجّل في التدقيق.</p>
      <Card className="card pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {rows.map(([l, v], i) => (
            <div className="ro-field" key={i}>
              <span className="muted" style={{ fontSize: 12.5 }}>{l}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="card pad" style={{ marginBottom: 16 }}>
        <b style={{ color: "var(--text-strong)", display: "block", marginBottom: 10 }}>
          <I name="key" size={18} color="var(--color-primary)" style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
          الصلاحيات
        </b>
        <div style={{ display: "grid", gap: 8 }}>
          {perms.map((p, i) => (
            <div className="row" key={i} style={{ gap: 8 }}>
              <I name="check_circle" size={18} color="var(--color-success)" fill />
              <span style={{ fontSize: 13.5 }}>{p}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="card pad">
        <b style={{ color: "var(--text-strong)", display: "block", marginBottom: 10 }}>
          <I name="block" size={18} color="var(--color-error)" style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
          خارج الصلاحية (عزل تامّ)
        </b>
        <div style={{ display: "grid", gap: 8 }}>
          {denied.map((p, i) => (
            <div className="row" key={i} style={{ gap: 8 }}>
              <I name="do_not_disturb_on" size={18} color="var(--color-error)" fill />
              <span style={{ fontSize: 13.5 }}>{p}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
