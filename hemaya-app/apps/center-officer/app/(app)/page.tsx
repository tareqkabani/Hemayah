import Link from "next/link";
import { Card, CardBody, Tag, InlineAlert } from "@hemaya/ui";

const SECTIONS = [
  { t: "الفرز المبدئيّ — قائمة واردة مشتركة", href: "/triage" },
  { t: "الدراسة — بوابة الدارس", href: "/study" },
  { t: "التقييم — بوابة المقيّم", href: "/assessment" },
  { t: "القرار — معدّ قرار المركز", href: "/decision" },
  { t: "القرار — أعضاء المجلس (تصويت)", href: "/decision-vote" },
  { t: "القرار — قيادة المجلس (اعتماد/إصدار)", href: "/decision-lead" },
  { t: "التنفيذ والتجديد — دورة حياة المشمولين", href: "/execution" },
  { t: "قيادة المركز — رئيس المركز (إشراف)", href: "/oversight" },
  { t: "قيادة المركز — نائب رئيس المركز", href: "/oversight-deputy" },
  { t: "الاستقبال الورقيّ (وحدة مؤقّتة)", href: "/paper-intake" },
];

export default function Page() {
  return (
    <div className="hub">
      <div className="page-head">
        <h1>بوابة موظف المركز</h1>
        <p>أقسام البوابة أدناه. القاعدة والصلاحيات والتصميم مربوطة.</p>
      </div>
      <InlineAlert kind="info" title="حالة البوابة">
        الفرز المبدئي والدراسة والتقييم والقرار والاستقبال الورقيّ مُفعَّلة. ربط القرار بـ Supabase (بدل المخزن المحلّي) يتبع خطة البناء.
      </InlineAlert>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 18 }}>
        {SECTIONS.map((s, i) => {
          const inner = (
            <Card><CardBody>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong style={{ fontSize: 15 }}>{s.t}</strong>
                <Tag tone={s.href ? "success" : "neutral"}>{s.href ? "متاح" : "مُخطّط"}</Tag>
              </div>
            </CardBody></Card>
          );
          return s.href ? <Link key={i} href={s.href} style={{ textDecoration: "none" }}>{inner}</Link> : <div key={i}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
