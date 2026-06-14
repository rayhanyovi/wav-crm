import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
const db = vi.hoisted(() => {
  const m = {
    deal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealProposal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealProposalLine: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    stageHistory: { create: vi.fn() },
    notification: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    crmUser: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return m;
});

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const {
  listDeals,
  getDeal,
  createDeal,
  updateDeal,
  softDeleteDeal,
  advanceStage,
  claimDeal,
  releaseDeal,
} = await import("./deals.service.js");

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "ADVISER",
    isActive: true,
    creditBalance: 3,
    telemarketerAccess: false,
    telemarketerId: null,
    leadsAccess: true,
    ...overrides,
  };
}

function deal(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal-1",
    title: "Test Deal",
    stage: "APPOINTMENT",
    assignedToId: "u1",
    telemarketerId: null,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

// ─── listDeals ────────────────────────────────────────────────────────────────

describe("listDeals", () => {
  it("MASTER gets all deals with no extra filter", async () => {
    db.deal.findMany.mockResolvedValue([]);
    db.deal.count.mockResolvedValue(0);

    await listDeals(actor({ role: "MASTER" }), { page: 1, pageSize: 25 } as never);

    const where = db.deal.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ deletedAt: null });
    expect(where.telemarketerId).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it("ADVISER gets own + open deals", async () => {
    db.deal.findMany.mockResolvedValue([]);
    db.deal.count.mockResolvedValue(0);

    await listDeals(actor({ id: "u1" }), { page: 1, pageSize: 25 } as never);

    const where = db.deal.findMany.mock.calls[0]![0].where;
    expect(where.OR).toEqual([{ assignedToId: "u1" }, { assignedToId: null }]);
  });

  it("TELEMARKETER gets only linked deals", async () => {
    db.deal.findMany.mockResolvedValue([]);
    db.deal.count.mockResolvedValue(0);

    await listDeals(actor({ role: "TELEMARKETER", id: "tm-1" }), { page: 1, pageSize: 25 } as never);

    const where = db.deal.findMany.mock.calls[0]![0].where;
    expect(where.telemarketerId).toBe("tm-1");
  });

  it("paginates correctly", async () => {
    db.deal.findMany.mockResolvedValue([{ id: "d1" }]);
    db.deal.count.mockResolvedValue(50);

    const res = await listDeals(actor({ role: "MASTER" }), { page: 3, pageSize: 10 } as never);

    expect(res).toMatchObject({ total: 50, page: 3, pageSize: 10 });
    expect(db.deal.findMany.mock.calls[0]![0]).toMatchObject({ skip: 20, take: 10 });
  });
});

// ─── getDeal ──────────────────────────────────────────────────────────────────

describe("getDeal", () => {
  it("throws NOT_FOUND when missing", async () => {
    db.deal.findFirst.mockResolvedValue(null);
    await expect(getDeal(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("throws FORBIDDEN when TELEMARKETER tries to view unrelated deal", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ telemarketerId: "other-tm" }));
    await expect(getDeal(actor({ role: "TELEMARKETER", id: "tm-1" }), "deal-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ─── createDeal ───────────────────────────────────────────────────────────────

describe("createDeal", () => {
  it("TELEMARKETER cannot create deals", async () => {
    await expect(
      createDeal(actor({ role: "TELEMARKETER" }), { title: "X", contact_id: "c1" } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ADVISER creates a deal assigned to themselves by default", async () => {
    const created = deal({ assignedToId: "u1" });
    db.deal.create.mockResolvedValue(created);
    db.auditLog.create.mockResolvedValue({});

    const result = await createDeal(actor({ id: "u1" }), { title: "New Deal", contact_id: "c1" } as never);

    expect(result.assignedToId).toBe("u1");
    const createData = db.deal.create.mock.calls[0]![0].data;
    expect(createData.assignedToId).toBe("u1");
    expect(createData.createdBy).toBe("u1");
  });
});

// ─── updateDeal ───────────────────────────────────────────────────────────────

describe("updateDeal", () => {
  it("ADVISER cannot update a deal they don't own", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ assignedToId: "other" }));
    await expect(
      updateDeal(actor({ id: "u1" }), "deal-1", { title: "X" } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("MASTER can update any deal", async () => {
    const prev = deal({ assignedToId: "someone-else" });
    const updated = { ...prev, title: "Updated" };
    db.deal.findFirst.mockResolvedValue(prev);
    db.deal.update.mockResolvedValue(updated);
    db.auditLog.create.mockResolvedValue({});

    const result = await updateDeal(actor({ role: "MASTER" }), "deal-1", { title: "Updated" } as never);
    expect(result.title).toBe("Updated");
  });
});

// ─── softDeleteDeal ───────────────────────────────────────────────────────────

describe("softDeleteDeal", () => {
  it("non-MASTER cannot delete", async () => {
    await expect(softDeleteDeal(actor({ role: "ADVISER" }), "deal-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("MASTER soft-deletes by setting deletedAt", async () => {
    db.deal.findFirst.mockResolvedValue(deal());
    db.deal.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await softDeleteDeal(actor({ role: "MASTER" }), "deal-1");

    expect(db.deal.update.mock.calls[0]![0].data.deletedAt).toBeInstanceOf(Date);
  });
});

// ─── advanceStage ─────────────────────────────────────────────────────────────

describe("advanceStage", () => {
  it("rejects invalid transition (SUBMITTED → PROPOSAL)", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "SUBMITTED", assignedToId: "u1" }));
    await expect(
      advanceStage(actor(), "deal-1", { to_stage: "PROPOSAL" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires lost_reason when moving to LOST", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "APPOINTMENT", assignedToId: "u1" }));
    await expect(
      advanceStage(actor(), "deal-1", { to_stage: "LOST" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires insurer + insurer_ref when moving to SUBMITTED", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "PROPOSAL", assignedToId: "u1" }));
    await expect(
      advanceStage(actor(), "deal-1", { to_stage: "SUBMITTED" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires policy_number when moving to WON", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "SUBMITTED", assignedToId: "u1" }));
    await expect(
      advanceStage(actor(), "deal-1", { to_stage: "WON" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("sets closedAt when moving to LOST", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "APPOINTMENT", assignedToId: "u1" }));
    const updated = deal({ stage: "LOST", assignedToId: "u1", closedAt: new Date() });
    db.deal.update.mockResolvedValue(updated);
    db.stageHistory.create.mockResolvedValue({});
    db.notification.createMany.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    const result = await advanceStage(actor(), "deal-1", {
      to_stage: "LOST",
      lost_reason: "Not interested",
    } as never);

    const updateData = db.deal.update.mock.calls[0]![0].data;
    expect(updateData.lostReason).toBe("Not interested");
    expect(updateData.closedAt).toBeInstanceOf(Date);
    expect(result.stage).toBe("LOST");
  });

  it("ADVISER cannot advance a deal they don't own", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "APPOINTMENT", assignedToId: "other" }));
    await expect(
      advanceStage(actor({ id: "u1" }), "deal-1", { to_stage: "PROPOSAL" } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── claimDeal ────────────────────────────────────────────────────────────────

describe("claimDeal", () => {
  it("TELEMARKETER cannot claim", async () => {
    await expect(claimDeal(actor({ role: "TELEMARKETER" }), "deal-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws CONFLICT if not APPOINTMENT stage", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "PROPOSAL", assignedToId: null }));
    await expect(claimDeal(actor(), "deal-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws CONFLICT if already claimed by another", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "APPOINTMENT", assignedToId: "other" }));
    await expect(claimDeal(actor({ id: "u1" }), "deal-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws CONFLICT if ADVISER has no credits", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "APPOINTMENT", assignedToId: null }));
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "u1", creditBalance: 0, role: "ADVISER" });
    await expect(claimDeal(actor({ creditBalance: 0 }), "deal-1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("deducts 1 credit from ADVISER on successful claim", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ stage: "APPOINTMENT", assignedToId: null }));
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "u1", creditBalance: 3, role: "ADVISER" });
    db.deal.update.mockResolvedValue(deal({ assignedToId: "u1" }));
    db.crmUser.update.mockResolvedValue({});
    db.creditTransaction.create.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await claimDeal(actor({ id: "u1", creditBalance: 3 }), "deal-1");

    expect(db.crmUser.update.mock.calls[0]![0].data).toMatchObject({
      creditBalance: { decrement: 1 },
    });
    expect(db.creditTransaction.create.mock.calls[0]![0].data).toMatchObject({
      action: "CLAIM",
      balanceBefore: 3,
      balanceAfter: 2,
    });
  });

  it("is idempotent when actor already owns the deal", async () => {
    const ownedDeal = deal({ stage: "APPOINTMENT", assignedToId: "u1" });
    db.deal.findFirst.mockResolvedValue(ownedDeal);

    const result = await claimDeal(actor({ id: "u1" }), "deal-1");
    expect(result).toBe(ownedDeal);
    expect(db.deal.update).not.toHaveBeenCalled();
  });
});

// ─── releaseDeal ──────────────────────────────────────────────────────────────

describe("releaseDeal", () => {
  it("throws FORBIDDEN if not owner and not MASTER", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ assignedToId: "other" }));
    await expect(releaseDeal(actor({ id: "u1" }), "deal-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refunds 1 credit to the previous ADVISER owner", async () => {
    db.deal.findFirst.mockResolvedValue(deal({ assignedToId: "adv-2" }));
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "adv-2", creditBalance: 2, role: "ADVISER" });
    db.deal.update.mockResolvedValue(deal({ assignedToId: null }));
    db.crmUser.update.mockResolvedValue({});
    db.creditTransaction.create.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await releaseDeal(actor({ role: "MASTER" }), "deal-1");

    expect(db.crmUser.update.mock.calls[0]![0].data).toMatchObject({
      creditBalance: { increment: 1 },
    });
    expect(db.creditTransaction.create.mock.calls[0]![0].data).toMatchObject({
      action: "RETURN",
      balanceBefore: 2,
      balanceAfter: 3,
    });
  });

  it("is idempotent when already unassigned", async () => {
    const unassigned = deal({ assignedToId: null });
    db.deal.findFirst.mockResolvedValue(unassigned);

    const result = await releaseDeal(actor({ role: "MASTER" }), "deal-1");
    expect(result).toBe(unassigned);
    expect(db.deal.update).not.toHaveBeenCalled();
  });
});
