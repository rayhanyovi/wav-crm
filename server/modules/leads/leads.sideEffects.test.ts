import { describe, expect, it, vi } from "vitest";
import type { Lead } from "../../../prisma/generated/client/index.js";
import { buildLeadNotifications, deriveStatusColumns, recordStatusNote } from "./leads.sideEffects.js";

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

  it("clears abandoned when transitioning out of AVOID", () => {
    expect(deriveStatusColumns("AVOID", "NA")).toEqual({
      isAbandoned: false,
      abandonedAt: null,
    });
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

  it("falls back to a generic name and omits the date when both are missing", () => {
    const prev = lead({ status: "NA", assignedToId: "adv-1", firstName: " ", lastName: " " });
    const next = lead({ status: "APPOINTMENT", assignedToId: "adv-1", firstName: " ", lastName: " ", appointmentDate: null });
    const rows = buildLeadNotifications(prev, next);
    expect(rows[0]?.message).toContain("A lead");
    expect(rows[0]?.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("does not emit LEAD_BOUNCED when there is no previous TM owner", () => {
    const rows = buildLeadNotifications(
      lead({ telemarketerOwnerId: null, bounceCount: 0 }),
      lead({ telemarketerOwnerId: null, bounceCount: 1 }),
    );
    expect(rows.find((r) => r.type === "LEAD_BOUNCED")).toBeUndefined();
  });

  it("emits nothing for an inert update", () => {
    expect(buildLeadNotifications(lead(), lead())).toEqual([]);
  });
});

describe("recordStatusNote", () => {
  it("writes a human-readable note for a status change", async () => {
    const create = vi.fn();
    await recordStatusNote({ leadNote: { create } } as never, {
      leadId: "l1", prevStatus: "NA", nextStatus: "KIV", changedBy: "u1",
    });
    const data = create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ leadId: "l1", createdBy: "u1" });
    expect(data.content).toContain("NA");
    expect(data.content).toContain("KIV");
  });

  it("skips writing a note when the status is unchanged", async () => {
    const create = vi.fn();
    await recordStatusNote({ leadNote: { create } } as never, {
      leadId: "l1", prevStatus: "NA", nextStatus: "NA", changedBy: "u1",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to the raw status codes for unmapped statuses (both sides)", async () => {
    const create = vi.fn();
    await recordStatusNote({ leadNote: { create } } as never, {
      leadId: "l1", prevStatus: "WEIRD_FROM" as never, nextStatus: "WEIRD_TO" as never, changedBy: "u1",
    });
    const content = create.mock.calls[0]![0].data.content;
    expect(content).toContain("WEIRD_FROM");
    expect(content).toContain("WEIRD_TO");
  });
});
