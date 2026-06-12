import type { FactFindFields } from "@/data/types";

const FACT_FIND_KEYS: (keyof FactFindFields)[] = [
  "financial_goal",
  "risk_tolerance",
  "investment_horizon",
  "monthly_investable",
  "existing_investments",
  "fact_find_notes",
  "fact_find_done",
];

/** Whether any fact-find field has been filled in on this record. */
export function hasFactFind(source: FactFindFields | undefined | null): boolean {
  if (!source) return false;
  return FACT_FIND_KEYS.some((k) => source[k] !== undefined && source[k] !== null && source[k] !== "");
}

/**
 * Pull the fact-find fields off a record (Lead/Contact/Deal) so they can be
 * copied onto another one — e.g. Lead -> Contact on conversion, or
 * Lead/Contact -> Deal when a deal is first created.
 */
export function pickFactFind(source: FactFindFields | undefined | null): FactFindFields {
  if (!source) return {};
  const result: FactFindFields = {};
  for (const key of FACT_FIND_KEYS) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = value;
    }
  }
  return result;
}
