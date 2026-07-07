import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/*
 * الخطوط تُحمَّل عبر next/font — تُنزَّل وقت البناء وتُخدَم من أصل التطبيق نفسه
 * (لا CDN وقت التشغيل). للإنتاج السياديّ: ثبّت ملفات الخطوط داخلياً عبر next/font/local.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "منصّة «حماية» — بوابة طالب الحماية",
  description:
    "منصّة مركز حماية الشهود والمبلّغين والخبراء والضحايا — النيابة العامة",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${plexMono.variable}`}
    >
      <head>
        {/* أيقونات Material Symbols — تطابق البروتوتايب. TODO(سيادي): ثبّتها محلياً بدل CDN للإنتاج. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
