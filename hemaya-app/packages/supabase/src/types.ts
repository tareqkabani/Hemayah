// ============================================================
//  أنواع قاعدة البيانات — مشتقّة من الأنواع المولّدة آلياً.
//  لإعادة التوليد بعد أي هجرة (من جذر المستودع):
//    npx supabase gen types typescript --local > hemaya-app/packages/supabase/src/types.gen.ts
// ============================================================

import type { Database } from "./types.gen";

export type { Database, Json } from "./types.gen";

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<E extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][E];

export type AppRole = Enums<"app_role">;
export type AppCategory = Enums<"app_category">;
export type CaseStatus = Enums<"case_status">;
export type RiskLevel = Enums<"risk_level">;
export type CaseSource = Enums<"case_source">;
export type DecisionType = Enums<"decision_type">;
export type ReferralStatus = Enums<"referral_status">;
export type ReferralAuthority = Enums<"referral_authority">;
export type GrievanceStatus = Enums<"grievance_status">;

export type UserRoleRow = Tables<"user_roles">;
export type ProtectionCaseRow = Tables<"protection_cases">;
export type BoardDecisionRow = Tables<"board_decisions">;
export type NotificationRow = Tables<"notifications">;
export type ReferralRow = Tables<"referrals">;
export type GrievanceRow = Tables<"grievances">;
export type ExecutionHandoffRow = Tables<"execution_handoffs">;
export type ChallengeRow = Tables<"challenges">;
