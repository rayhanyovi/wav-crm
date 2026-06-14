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
    crmUser: {
      findMany: vi.fn(),
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
    delegatedAdviserIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.crmUser.findMany.mockResolvedValue([]);
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

  it("does not scope adviser leads when Lead Access is enabled", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l1" }]);
    db.lead.count.mockResolvedValue(1);

    await listLeads(actor({ role: "ADVISER", id: "adv-1", leadsAccess: true }), {
      page: 1,
      pageSize: 25,
    } as never);

    expect(db.lead.findMany.mock.calls[0]![0].where).toMatchObject({
      deletedAt: null,
      isAbandoned: false,
    });
    expect(db.lead.findMany.mock.calls[0]![0].where.OR).toBeUndefined();
  });

  it("filters adviser leads to assigned/adviser-owned rows without Lead Access", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l1" }]);
    db.lead.count.mockResolvedValue(1);

    await listLeads(actor({ role: "ADVISER", id: "adv-1", leadsAccess: false }), {
      page: 1,
      pageSize: 25,
    } as never);

    expect(db.lead.findMany.mock.calls.at(-1)![0].where).toMatchObject({
      OR: [{ assignedToId: "adv-1" }, { adviserOwnerId: "adv-1" }],
    });
  });

  it("includes leads owned by advisers who assigned this telemarketer", async () => {
    db.crmUser.findMany.mockResolvedValue([{ id: "adv-1" }]);
    db.lead.findMany.mockResolvedValue([{ id: "l1" }]);
    db.lead.count.mockResolvedValue(1);

    await listLeads(actor({ role: "TELEMARKETER", id: "tm-1" }), {
      page: 1,
      pageSize: 25,
    } as never);

    expect(db.crmUser.findMany).toHaveBeenCalledWith({
      where: {
        role: "ADVISER",
        isActive: true,
        telemarketerAccess: true,
        telemarketerId: "tm-1",
      },
      select: { id: true },
    });
    expect(db.lead.findMany.mock.calls[0]![0].where.OR).toEqual([
      { telemarketerOwnerId: "tm-1" },
      { telemarketerOwnerId: null },
      { assignedToId: { in: ["adv-1"] } },
      { adviserOwnerId: { in: ["adv-1"] } },
    ]);
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
    const prev = { id: "l1", status: "NA", firstName: "A", lastName: "B", assignedToId: "u1", telemarketerOwnerId: "u1", adviserOwnerId: null, bounceCount: 0 };
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

  it("clears abandonment when moving AVOID back to NA", async () => {
    const prev = { id: "l1", status: "AVOID", firstName: "A", lastName: "B", assignedToId: "u1", telemarketerOwnerId: "u1", adviserOwnerId: null, bounceCount: 0 };
    db.lead.findFirst.mockResolvedValue(prev);
    db.lead.update.mockResolvedValue({ ...prev, status: "NA", isAbandoned: false, abandonedAt: null });

    await updateLead(actor(), "l1", { status: "NA" } as never);

    const updateArg = db.lead.update.mock.calls.at(-1)![0];
    expect(updateArg.data).toMatchObject({ status: "NA", isAbandoned: false, abandonedAt: null });
  });

  it("does not write status history when status is unchanged", async () => {
    const prev = { id: "l1", status: "NA", firstName: "A", lastName: "B", assignedToId: "u1", telemarketerOwnerId: "u1", adviserOwnerId: null, bounceCount: 0 };
    db.lead.findFirst.mockResolvedValue(prev);
    db.lead.update.mockResolvedValue({ ...prev, notes: "hi" });

    await updateLead(actor(), "l1", { notes: "hi" } as never);

    expect(db.leadStatusHistory.create).not.toHaveBeenCalled();
  });

  it("allows an assigned telemarketer to update an adviser's lead", async () => {
    const prev = { id: "l1", status: "NA", firstName: "A", lastName: "B", assignedToId: "adv-1", telemarketerOwnerId: null, adviserOwnerId: null, bounceCount: 0 };
    db.crmUser.findMany.mockResolvedValue([{ id: "adv-1" }]);
    db.lead.findFirst.mockResolvedValue(prev);
    db.lead.update.mockResolvedValue({ ...prev, status: "KIV" });

    await updateLead(actor({ role: "TELEMARKETER", id: "tm-1" }), "l1", { status: "KIV" } as never);

    expect(db.lead.update.mock.calls[0]![0].data.status).toBe("KIV");
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
