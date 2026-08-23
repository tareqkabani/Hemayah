import Link from "next/link";
import { Card, CardBody, Tag, InlineAlert } from "@hemaya/ui";
import { PAPER_INTAKE_LABEL } from "@hemaya/domain";

const SECTIONS: { t: string; href?: string; external?: boolean }[] = [
  // الفرز المبدئي انتقل لبوابته الموحّدة (منطقة /triage) — رابط خام يعبر المناطق
  { t: "الفرز المبدئي — بوابة الفرز الموحّدة", href: "/triage", external: true },
  // الدراسة والتقييم انتقلا إلى @hemaya/study-eval بقشرتَي الدارس والمقيّم
  // (منطقتا /studier و/evaluator) — روابط خام تعبر المناطق، كنظيرَيها أدناه.
  { t: "الدراسة — بوابة الدارس", href: "/studier", external: true },
  { t: "التقييم — بوابة المقيّم", href: "/evaluator", external: true },
  // مرحلة القرار انتقلت لبوابة القرار الموحّدة (منطقة /decision) — رابط خام يعبر المناطق
  { t: "القرار والإشعار — بوابة القرار الموحّدة", href: "/decision", external: true },
  { t: "التنفيذ والتجديد — دورة حياة المشمولين", href: "/execution" },
  { t: "قيادة المركز — رئيس المركز (إشراف)", href: "/oversight" },
  { t: "قيادة المركز — نائب رئيس المركز", href: "/oversight-deputy" },
  // «وحدة مؤقّتة» أُسقطت من كل الواجهات بقرار المستخدم (تسليم 13 أغسطس 2026):
  // الوحدة تبقى قابلةً للعزل، لكنها لم تعد مؤقّتة في التسمية.
  { t: PAPER_INTAKE_LABEL, href: "/paper-intake" },
];

export default function Page() {
  return (
    <div className="hub">
      <div className="page-head">
        <h1>بوابة موظف المركز</h1>
        <p>أقسام البوابة أدناه. القاعدة والصلاحيات والتصميم مربوطة.</p>
      </div>
      <InlineAlert kind="info" title="حالة البوابة">
        المُفعَّل هنا: الإدخال اليدوي للطلبات · التنفيذ والتجديد · قيادة المركز. أمّا الفرز المبدئي والدراسة والتقييم والقرار فلكلٍّ منها بوابته الموحّدة، وروابطها أدناه تنقلك إليها مباشرةً.
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
          if (s.external) return <a key={i} href={s.href} style={{ textDecoration: "none" }}>{inner}</a>;
          return s.href ? <Link key={i} href={s.href} style={{ textDecoration: "none" }}>{inner}</Link> : <div key={i}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
