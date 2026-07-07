import type { IntgMode } from "./types";
import { createMockNafath } from "./nafath";
import { createMockSpl } from "./spl";
import { createMockHrdf } from "./hrdf";

const mode = (): IntgMode => (process.env.INTG_MODE as IntgMode) ?? "mock";
export function getNafath() { return createMockNafath(); }
export function getSpl() { return createMockSpl(); }
export function getHrdf() { return createMockHrdf(); }
export function integrationModes(): { nafath: IntgMode; spl: IntgMode; hrdf: IntgMode } {
  const m = mode();
  return { nafath: "mock", spl: m, hrdf: m };
}
