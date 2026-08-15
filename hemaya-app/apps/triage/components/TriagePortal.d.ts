// أنواع مكوّن البوابة (الملف التنفيذي .jsx) — تمنع استنتاج never[] من القيم الافتراضية.
export declare function TriagePortal(props: {
  roleKey?: string;
  me: { id: string; name: string };
  initialRows?: unknown[];
  prefs?: Record<string, unknown>;
  basePath?: string;
  initialReadKeys?: string[];
  initialMessages?: unknown[];
  /** إجمالي المطابق في القاعدة — يُعلَن حين يتجاوز المعروض */
  registerTotal?: number;
  registerTruncated?: boolean;
  /** العطل الرسمية (YYYY-MM-DD) — تُحقن في حاسبة أيام العمل */
  holidays?: string[];
}): JSX.Element;
