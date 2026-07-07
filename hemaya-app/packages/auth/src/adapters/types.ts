export type IntgMode = "mock" | "live";

export interface NafathIdentity { nationalId: string; name: string; dob?: string; nationality?: string; }
export interface NationalAddress { city: string; district: string; postalCode: string; buildingNo: string; }
export interface Employment { employer: string; jobTitle: string; }

export interface NafathAdapter {
  readonly mode: IntgMode;
  login(nationalId: string): Promise<{ sessionId: string; verificationNumber: number }>;
  poll(sessionId: string): Promise<NafathIdentity | null>;
  verifyForSignature(sessionId: string): Promise<boolean>;
}
export interface SplAdapter { readonly mode: IntgMode; getNationalAddress(nationalId: string): Promise<NationalAddress | null>; }
export interface HrdfAdapter { readonly mode: IntgMode; getEmployment(nationalId: string): Promise<Employment | null>; }
