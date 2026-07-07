import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "بوابة طالب الحماية — منصّة «حماية»",
  description: "مركز حماية الشهود والمبلّغين والخبراء والضحايا — النيابة العامة",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ar" dir="rtl"><body>{children}</body></html>);
}
