import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "مرحلة القرار والإشعار (المسار الجديد) — منصّة حماية",
  description: "المسار المبسّط لإصدار قرار الحماية — النيابة العامة",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ar" dir="rtl"><body>{children}</body></html>);
}
