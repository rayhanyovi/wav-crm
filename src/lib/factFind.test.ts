import { describe, expect, it } from "vitest";
import { hasFactFind, pickFactFind } from "@/lib/factFind";

describe("hasFactFind", () => {
  it("is false for null/undefined/empty records", () => {
    expect(hasFactFind(null)).toBe(false);
    expect(hasFactFind(undefined)).toBe(false);
    expect(hasFactFind({})).toBe(false);
    expect(hasFactFind({ fact_find_notes: "" })).toBe(false);
  });

  it("is true when any field has a value (including zero)", () => {
    expect(hasFactFind({ financial_goal: "RETIREMENT" })).toBe(true);
    expect(hasFactFind({ monthly_investable: 0 })).toBe(true);
  });
});

describe("pickFactFind", () => {
  it("returns an empty object for null", () => {
    expect(pickFactFind(null)).toEqual({});
  });

  it("copies only fields that have a value, dropping empty strings", () => {
    expect(
      pickFactFind({ financial_goal: "RETIREMENT", fact_find_notes: "", risk_tolerance: "MODERATE" }),
    ).toEqual({ financial_goal: "RETIREMENT", risk_tolerance: "MODERATE" });
  });
});
