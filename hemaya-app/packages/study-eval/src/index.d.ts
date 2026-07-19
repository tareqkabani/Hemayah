import type { FC } from "react";

export interface StudyEvalMe {
  id: string;
  name: string;
  emp: string | null;
}

export interface StudyEvalInitial {
  tasks: unknown[];
  notifications: unknown[];
  threads: unknown[];
  prefs: Record<string, unknown>;
  details: Record<string, unknown>;
}

export const StudyEvalPortal: FC<{
  role: "studier" | "evaluator";
  me: StudyEvalMe;
  initial: StudyEvalInitial;
  basePath: string;
}>;
