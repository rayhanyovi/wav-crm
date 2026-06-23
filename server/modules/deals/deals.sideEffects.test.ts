import { describe, expect, it } from "vitest";
import type { Deal } from "../../../prisma/generated/client/index.js";
import { buildDealNotifications } from "./deals.sideEffects.js";

function deal(overrides: Partial<Deal> = {}): Pick<Deal, "id" | "title" | "assignedToId"> {
  return {
    id: "deal-1",
    title: "Ada Lovelace",
    assignedToId: null,
    ...overrides,
  };
}

describe("buildDealNotifications", () => {
  it("does not emit DEAL_STAGE_CHANGED when a deal has an assignee", () => {
    const rows = buildDealNotifications(deal({ assignedToId: "adv-1" }), "PROPOSAL");
    expect(rows).toEqual([]);
  });

  it("emits nothing when the deal is unassigned", () => {
    const rows = buildDealNotifications(deal({ assignedToId: null }), "PROPOSAL");
    expect(rows).toEqual([]);
  });
});
