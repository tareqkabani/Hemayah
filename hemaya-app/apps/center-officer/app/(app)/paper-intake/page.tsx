import Link from "next/link";
import { requireRole } from "@hemaya/auth";
import { PaperIntakePortal } from "@/components/PaperIntakePortal";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireRole(["case_officer", "hotline_operator"] as any, { loginPath: "/login", denyPath: "/403" });
  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "12px 22px", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="link" style={{ color: "var(--text-link)", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span> بوابة موظف المركز
          </Link>
        </div>
      </div>
      <PaperIntakePortal />
    </div>
  );
}
