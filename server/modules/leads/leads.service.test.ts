import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

// ── Mock the Prisma singleton. `$transaction(cb)` just runs cb with the same db. ──
const db = vi.hoisted(() => {
  const m = {
    lead: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leadStatusHistory: { create: vi.fn() },
    notification: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return m;
});

vi.mock("../../lib/prisma.js", () => ({
  prisma: db,
  // Tx type isn't needed at runtime.
}));

const { createLead, getLead, listLeads, updateLead } = await import("./leads.service.js");

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "TELEMARKETER",
    isActive: true,
    creditBalance: 0,
    telemarketerAccess: false,
    telemarketerId: null,
    leadsAccess: true,
    ...overrides,
  };
}

beforeEach(() => {
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe("listLeads", () => {
  it("excludes abandoned by default and paginates", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l1" }]);
    db.lead.count.mockResolvedValue(1);

    const res = await listLeads(actor(), {
      includeAbandoned: false,
      page: 2,
      pageSize: 10,
    } as never);

    expect(res).toEqual({ data: [{ id: "l1" }], total: 1, page: 2, pageSize: 10 });
    const where = db.lead.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ deletedAt: null, isAbandoned: false });
    expect(db.lead.findMany.mock.calls[0]![0]).toMatchObject({ skip: 10, take: 10 });
  });

  it("forbids an adviser without telemarketer access", async () => {
    await expect(
      listLeads(actor({ role: "ADVISER", telemarketerAccess: false }), { page: 1, pageSize: 25 } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("getLead", () => {
  it("throws NOT_FOUND when missing", async () => {
    db.lead.findFirst.mockResolvedValue(null);
    await expect(getLead(actor(), "missing")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("updateLead side-effects", () => {
  it("sets abandonment + records status history + audits on NA→AVOID", async () => {
    const prev = { id: "l1", status: "NA", firstName: "A", lastName: "B", assignedToId: null, telemarketerOwnerId: null, bounceCount: 0 };
    db.lead.findFirst.mockResolvedValue(prev);
    db.lead.update.mockResolvedValue({ ...prev, status: "AVOID", isAbandoned: true });

    await updateLead(actor(), "l1", { status: "AVOID" } as never);

    const updateArg = db.lead.update.mock.calls[0]![0];
    expect(updateArg.data.status).toBe("AVOID");
    expect(updateArg.data.isAbandoned).toBe(true);
    expect(db.leadStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "AVOID", changedBy: "u1" }) }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "UPDATE", entityType: "leads" }) }),
    );
  });

  it("does not write status history when status is unchanged", async () => {
    const prev = { id: "l1", status: "NA", firstName: "A", lastName: "B", assignedToId: null, telemarketerOwnerId: null, bounceCount: 0 };
    db.lead.findFirst.mockResolvedValue(prev);
    db.lead.update.mockResolvedValue({ ...prev, notes: "hi" });

    await updateLead(actor(), "l1", { notes: "hi" } as never);

    expect(db.leadStatusHistory.create).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the lead doesn't exist", async () => {
    db.lead.findFirst.mockResolvedValue(null);
    await expect(updateLead(actor(), "nope", { notes: "x" } as never)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("createLead", () => {
  it("stamps created_by from the actor and audits CREATE", async () => {
    db.lead.create.mockResolvedValue({ id: "new", firstName: "A", lastName: "B", assignedToId: null, telemarketerOwnerId: null, status: "NA", bounceCount: 0 });

    await createLead(actor(), { first_name: "A", last_name: "B", source: "OTHERS", status: "NA" } as never);

    expect(db.lead.create.mock.calls[0]![0].data).toMatchObject({ createdBy: "u1", firstName: "A" });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "CREATE" }) }),
    );
  });
});
