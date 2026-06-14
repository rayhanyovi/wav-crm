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
  it("emits DEAL_STAGE_CHANGED to the assignee when a deal has one", () => {
    const rows = buildDealNotifications(deal({ assignedToId: "adv-1" }), "PROPOSAL");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "DEAL_STAGE_CHANGED",
      recipientId: "adv-1",
      entityId: "deal-1",
    });
    expect(rows[0]?.message).toContain("PROPOSAL");
  });

  it("emits nothing when the deal is unassigned", () => {
    const rows = buildDealNotifications(deal({ assignedToId: null }), "PROPOSAL");
    expect(rows).toHaveLength(0);
  });

  it("includes the deal title in the notification message", () => {
    const rows = buildDealNotifications(deal({ assignedToId: "adv-1", title: "John Doe" }), "WON");
    expect(rows[0]?.message).toContain("John Doe");
  });
});
