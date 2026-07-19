// أنواع مكوّن البوابة (الملف التنفيذي .jsx) — تمنع استنتاج never[] من القيم الافتراضية.
export declare function TechOfficePortal(props: {
  roleKey?: string;
  me: { id: string; name: string };
  mySpec?: string;
  initialRows?: unknown[];
  prefs?: Record<string, unknown>;
  basePath?: string;
  initialNotifs?: unknown[];
  initialReadKeys?: string[];
  initialOfficeMsgs?: unknown[];
  initialCaseMsgs?: unknown[];
  advisors?: { user_id: string; name: string; spec: string; open_load: number; decided: number }[];
}): JSX.Element;
