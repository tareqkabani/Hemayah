// أنواع مكوّن البوابة (الملف التنفيذي .jsx) — تمنع استنتاج never[] من القيم الافتراضية.
export declare function TriagePortal(props: {
  roleKey?: string;
  me: { id: string; name: string };
  initialRows?: unknown[];
  prefs?: Record<string, unknown>;
  basePath?: string;
  initialReadKeys?: string[];
  initialMessages?: unknown[];
}): JSX.Element;
