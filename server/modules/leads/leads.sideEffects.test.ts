import { describe, expect, it } from "vitest";
import type { Lead } from "../../../prisma/generated/client/index.js";
import { buildLeadNotifications, deriveStatusColumns } from "./leads.sideEffects.js";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    firstName: "Ada",
    lastName: "Lovelace",
    status: "NA",
    source: "OTHERS",
    assignedToId: null,
    telemarketerOwnerId: null,
    adviserOwnerId: null,
    appointmentDate: null,
    bounceCount: 0,
    isAbandoned: false,
    abandonedAt: null,
    // remaining columns are irrelevant to these pure functions
    ...overrides,
  } as unknown as Lead;
}

describe("deriveStatusColumns", () => {
  it("marks abandoned when transitioning into AVOID", () => {
    const cols = deriveStatusColumns("NA", "AVOID");
    expect(cols.isAbandoned).toBe(true);
    expect(cols.abandonedAt).toBeInstanceOf(Date);
  });

  it("does nothing when already AVOID", () => {
    expect(deriveStatusColumns("AVOID", "AVOID")).toEqual({});
  });

  it("does nothing for non-AVOID transitions", () => {
    expect(deriveStatusColumns("NA", "KIV")).toEqual({});
  });
});

describe("buildLeadNotifications", () => {
  it("emits APPOINTMENT_SET when status becomes APPOINTMENT with an assignee", () => {
    const prev = lead({ status: "NA", assignedToId: "adv-1" });
    const next = lead({ status: "APPOINTMENT", assignedToId: "adv-1", appointmentDate: "2026-07-01" });
    const rows = buildLeadNotifications(prev, next);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "APPOINTMENT_SET", recipientId: "adv-1", entityId: "lead-1" });
    expect(rows[0]?.message).toContain("2026-07-01");
  });

  it("emits LEAD_ASSIGNED when the assignee changes", () => {
    const rows = buildLeadNotifications(lead({ assignedToId: null }), lead({ assignedToId: "adv-2" }));
    expect(rows).toEqual([expect.objectContaining({ type: "LEAD_ASSIGNED", recipientId: "adv-2" })]);
  });

  it("emits LEAD_BOUNCED to the previous TM owner on a bounce", () => {
    const prev = lead({ telemarketerOwnerId: "tm-1", bounceCount: 0 });
    const next = lead({ telemarketerOwnerId: "tm-1", bounceCount: 1 });
    const rows = buildLeadNotifications(prev, next);
    expect(rows).toEqual([expect.objectContaining({ type: "LEAD_BOUNCED", recipientId: "tm-1" })]);
  });

  it("emits nothing for an inert update", () => {
    expect(buildLeadNotifications(lead(), lead())).toEqual([]);
  });
});
