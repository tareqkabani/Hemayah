// ============================================================
//  أنواع قاعدة البيانات — مجموعة مُنتقاة (الجداول المحورية).
//  للأنواع الكاملة المولّدة آلياً:
//    supabase gen types typescript --local > packages/supabase/src/types.gen.ts
//  ثم استبدل هذا الملف بالمولَّد. هذه النسخة كافية للبناء الأوّليّ.
// ============================================================

export type AppRole =
  | "prosecutor_general" | "board_chair" | "deputy_chair" | "board_member"
  | "case_officer" | "security_officer" | "security_manager" | "studier"
  | "evaluator" | "advisor" | "tech_manager" | "hotline_operator" | "ciso"
  | "sysadmin" | "competent_body" | "moi_officer" | "moh_specialist"
  | "moh_manager" | "hr_specialist" | "hr_manager" | "subject";

export type AppCategory = "reporter" | "witness" | "expert" | "victim" | "related";
export type CaseStatus =
  | "submitted" | "triage" | "referred" | "under_study" | "classified"
  | "in_decision" | "accepted" | "rejected" | "signed" | "active"
  | "under_review" | "terminating" | "closed";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type CaseSource = "local" | "foreign" | "urgent";
export type DecisionType = "accept" | "reject" | "continue" | "modify" | "terminate";
export type ReferralStatus = "new" | "assigned" | "progress" | "review" | "done";
export type ReferralAuthority = "hr" | "health" | "legal" | "security" | "moi";
export type GrievanceStatus = "filed" | "tech_review" | "pg_decision" | "upheld" | "dismissed";

type Ts = string;
interface Table<Row, Insert = Partial<Row>, Update = Partial<Row>> {
  Row: Row;
  Insert: Insert;
  Update: Update;
}

export interface UserRoleRow {
  id: string; user_id: string; role: AppRole; attributes: Record<string, unknown>; created_at: Ts;
}
export interface ProtectionCaseRow {
  id: string; ref_no: string; secret_code: string; category: AppCategory;
  status: CaseStatus; classification: RiskLevel | null; source: CaseSource;
  officer_id: string | null; case_region: string | null; branch_id: string | null;
  created_at: Ts; updated_at: Ts;
}
export interface BoardDecisionRow {
  id: string; case_id: string; type: DecisionType; votes: unknown; tie_break: boolean;
  justification: string; duration: string | null; decided_at: Ts;
}
export interface NotificationRow {
  id: string; case_id: string | null; type: string | null; channel: string | null;
  due_at: Ts | null; sent_at: Ts | null; created_at: Ts;
}
export interface ReferralRow {
  id: string; case_id: string; service: string; authority: ReferralAuthority; ref: string | null;
  status: ReferralStatus; assignee: string | null; sched: Ts | null; result: unknown; history: unknown;
  created_at: Ts; updated_at: Ts;
}
export interface GrievanceRow {
  id: string; case_id: string; against: string | null; filed_at: Ts | null;
  decision_due: Ts | null; status: GrievanceStatus; tech_opinion: string | null; outcome: string | null;
}
export interface ExecutionHandoffRow {
  id: string; case_id: string; track: string; status: string; types: string[] | null;
  board_review_due: string | null; decided_by: string | null; created_at: Ts;
}
export interface ChallengeRow {
  id: string; period: string; challenge: string; solution: string | null;
  evidence_metric: string | null; authored_by: string | null; created_at: Ts;
}

export interface Database {
  public: {
    Tables: {
      user_roles: Table<UserRoleRow>;
      protection_cases: Table<ProtectionCaseRow>;
      board_decisions: Table<BoardDecisionRow>;
      notifications: Table<NotificationRow>;
      referrals: Table<ReferralRow>;
      grievances: Table<GrievanceRow>;
      execution_handoffs: Table<ExecutionHandoffRow>;
      challenges: Table<ChallengeRow>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: { Args: { _user: string; _role: AppRole }; Returns: boolean };
      submit_protection_request: {
        Args: {
          _applicant_role: string; _category: AppCategory; _entity: string;
          _crime: string; _reason: string; _prior_submit: boolean;
          _case_no: string | null; _details: Record<string, unknown>;
        };
        Returns: { ref_no: string; secret_code: string; case_id: string }[];
      };
      triage_decide: {
        Args: {
          _case_id: string; _decision: "study" | "refer" | "close";
          _reason: string | null; _formal_check: Record<string, boolean>;
          _authority: string | null;
        };
        Returns: { status: CaseStatus }[];
      };
    };
    Enums: {
      app_role: AppRole; case_status: CaseStatus; app_category: AppCategory;
      risk_level: RiskLevel;
    };
    CompositeTypes: Record<string, never>;
  };
}
