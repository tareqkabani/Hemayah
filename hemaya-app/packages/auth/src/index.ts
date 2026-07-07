// @hemaya/auth — المصادقة والصلاحيات ومحوّلات التكامل الوطنيّ.
export { getUserRoles, hasRole, hasAnyRole, getRoleAttributes } from "./roles";
export { requireUser, requireRole } from "./guard";
export { fieldSource } from "./intg";
export type { IntgCtx, FieldSourceState } from "./intg";
export { getNafath, getSpl, getHrdf, integrationModes } from "./adapters";
export type {
  NafathAdapter, SplAdapter, HrdfAdapter,
  NafathIdentity, NationalAddress, Employment, IntgMode,
} from "./adapters/types";
