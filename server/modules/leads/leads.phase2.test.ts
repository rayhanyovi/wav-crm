import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

// ── Mocked Prisma (same pattern as leads.service.test.ts) ───────────────────
const db = vi.hoisted(() => {
  const m = {
    lead: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    leadStatusHistory: { create: vi.fn(), updateMany: vi.fn() },
    leadNote: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    contact: { create: vi.fn() },
    deal: { create: vi.fn(), updateMany: vi.fn() },
    activity: { updateMany: vi.fn() },
    crmUser: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn(), updateMany: vi.fn() },
    notification: { createMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return m;
});

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const {
  claimLead,
  returnLead,
  convertLead,
  claimForCall,
  mergeDuplicateLeads,
  getLeadNotes,
  addLeadNote,
  getLeadStatusHistory,
} = await import("./leads.service.js");

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
    delegatedAdviserIds: [],
    ...overrides,
  };
}

function tmActor(overrides: Partial<Actor> = {}): Actor {
  return actor({ role: "TELEMARKETER", creditBalance: 0, ...overrides });
}

function appointmentLead(overrides: object = {}) {
  return {
    id: "lead-1",
    firstName: "Aaron",
    lastName: "Lim",
    status: "APPOINTMENT" as const,
    adviserOwnerId: null,
    assignedToId: null,
    telemarketerOwnerId: null,
    bounceCount: 0,
    source: "OTHERS",
    isAbandoned: false,
    convertedContactId: null,
    financialGoal: null,
    riskTolerance: null,
    investmentHorizon: null,
    monthlyInvestable: null,
    existingInvestments: null,
    factFindNotes: null,
    factFindDone: null,
    notes: null,
    email: null,
    phone: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.crmUser.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

// ─── claimLead ──────────────────────────────────────────────────────────────

describe("claimLead", () => {
  it("claims an APPOINTMENT lead and deducts 1 credit from the adviser", async () => {
    const lead = appointmentLead();
    const claimedLead = { ...lead, adviserOwnerId: "u1", assignedToId: "u1" };
    db.lead.findFirst.mockResolvedValue(lead);
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "u1", creditBalance: 3 });
    db.lead.update.mockResolvedValue(claimedLead);
    db.crmUser.update.mockResolvedValue({ id: "u1", creditBalance: 2 });

    const result = await claimLead(actor(), "lead-1");

    expect(result.adviserOwnerId).toBe("u1");
    expect(db.crmUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalance: { decrement: 1 } } }),
    );
    expect(db.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CLAIM", balanceBefore: 3, balanceAfter: 2 }),
      }),
    );
  });

  it("returns 409 CONFLICT when the adviser has no credits", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead());
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "u1", creditBalance: 0 });

    await expect(claimLead(actor({ creditBalance: 0 }), "lead-1")).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
    expect(db.lead.update).not.toHaveBeenCalled();
  });

  it("returns 409 CONFLICT when lead is already claimed by another adviser", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead({ adviserOwnerId: "other-adviser" }));

    await expect(claimLead(actor(), "lead-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("is idempotent — returns current lead when actor already owns it", async () => {
    const lead = appointmentLead({ adviserOwnerId: "u1" });
    db.lead.findFirst.mockResolvedValue(lead);

    const result = await claimLead(actor(), "lead-1");

    expect(result).toEqual(lead);
    expect(db.lead.update).not.toHaveBeenCalled();
    expect(db.creditTransaction.create).not.toHaveBeenCalled();
  });

  it("lets a TELEMARKETER claim an unclaimed calling-pool lead", async () => {
    const lead = appointmentLead({ status: "NA" });
    const claimedLead = { ...lead, telemarketerOwnerId: "u1", assignedToId: "u1" };
    db.lead.findFirst.mockResolvedValue(lead);
    db.lead.update.mockResolvedValue(claimedLead);

    const result = await claimLead(tmActor(), "lead-1");

    expect(result.telemarketerOwnerId).toBe("u1");
    expect(db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { telemarketerOwnerId: "u1", assignedToId: "u1" },
      }),
    );
    expect(db.creditTransaction.create).not.toHaveBeenCalled();
  });

  it("returns 409 when a TELEMARKETER claims a non-pool lead", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead());

    await expect(claimLead(tmActor(), "lead-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns 409 when lead is not at APPOINTMENT status", async () => {
    db.lead.findFirst.mockResolvedValue({ ...appointmentLead(), status: "NA" });

    await expect(claimLead(actor(), "lead-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

// ─── returnLead ─────────────────────────────────────────────────────────────

describe("returnLead", () => {
  it("unsets the adviser owner and refunds 1 credit", async () => {
    const lead = appointmentLead({ adviserOwnerId: "u1", assignedToId: "u1" });
    const returned = { ...lead, adviserOwnerId: null, assignedToId: null };
    db.lead.findFirst.mockResolvedValue(lead);
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "u1", creditBalance: 2 });
    db.lead.update.mockResolvedValue(returned);
    db.crmUser.update.mockResolvedValue({ id: "u1", creditBalance: 3 });

    const result = await returnLead(actor(), "lead-1");

    expect(result.adviserOwnerId).toBeNull();
    expect(db.crmUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalance: { increment: 1 } } }),
    );
    expect(db.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "RETURN", balanceBefore: 2, balanceAfter: 3 }),
      }),
    );
  });

  it("forbids returning a lead owned by someone else", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead({ adviserOwnerId: "other" }));

    await expect(returnLead(actor(), "lead-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("MASTER can return any claimed lead", async () => {
    const lead = appointmentLead({ adviserOwnerId: "other-adviser", assignedToId: "other-adviser" });
    db.lead.findFirst.mockResolvedValue(lead);
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "other-adviser", creditBalance: 1 });
    db.lead.update.mockResolvedValue({ ...lead, adviserOwnerId: null, assignedToId: null });
    db.crmUser.update.mockResolvedValue({ id: "other-adviser", creditBalance: 2 });

    await expect(returnLead(actor({ role: "MASTER", id: "master-1" }), "lead-1")).resolves.toBeTruthy();
  });
});

// ─── convertLead ────────────────────────────────────────────────────────────

describe("convertLead", () => {
  it("converts lead to APPOINTMENT, creates contact and deal", async () => {
    const lead = {
      ...appointmentLead(),
      status: "NA" as const,
      firstName: "John",
      lastName: "Tan",
    };
    db.lead.findFirst.mockResolvedValue(lead);
    db.contact.create.mockResolvedValue({ id: "contact-1" });
    db.deal.create.mockResolvedValue({ id: "deal-1" });
    db.lead.update.mockResolvedValue({ ...lead, status: "APPOINTMENT" });

    const result = await convertLead(tmActor(), "lead-1", {
      appointment_date: "2026-07-01",
      appointment_time: "14:00",
    });

    expect(result.contactId).toBe("contact-1");
    expect(result.dealId).toBe("deal-1");
    expect(db.lead.update.mock.calls[0]![0].data.status).toBe("APPOINTMENT");
    expect(db.leadStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPOINTMENT" }) }),
    );
  });

  it("reuses an existing contact when contact_id is provided", async () => {
    const lead = { ...appointmentLead(), status: "KIV" as const };
    db.lead.findFirst.mockResolvedValue(lead);
    db.deal.create.mockResolvedValue({ id: "deal-2" });
    db.lead.update.mockResolvedValue({ ...lead, status: "APPOINTMENT" });

    const result = await convertLead(tmActor(), "lead-1", {
      appointment_date: "2026-07-02",
      contact_id: "existing-contact",
    });

    expect(result.contactId).toBe("existing-contact");
    expect(db.contact.create).not.toHaveBeenCalled();
  });

  it("returns 409 when lead is already APPOINTMENT", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead());

    await expect(
      convertLead(tmActor(), "lead-1", { appointment_date: "2026-07-01" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("always creates the deal unassigned — an adviser claims it later (spending a credit)", async () => {
    const lead = { ...appointmentLead(), status: "KIV" as const };
    db.lead.findFirst.mockResolvedValue(lead);
    db.contact.create.mockResolvedValue({ id: "c1" });
    db.deal.create.mockResolvedValue({ id: "d1" });
    db.lead.update.mockResolvedValue({ ...lead, status: "APPOINTMENT" });

    await convertLead(actor({ telemarketerAccess: true }), "lead-1", { appointment_date: "2026-07-01" });

    const dealData = db.deal.create.mock.calls[0]![0].data;
    expect(dealData.assignedToId).toBeUndefined();
    expect(dealData.telemarketerId).toBeUndefined();
  });

  it("assigns to a chosen adviser and spends their credit when a delegated TM books", async () => {
    const lead = { ...appointmentLead(), status: "NA" as const };
    db.lead.findFirst.mockResolvedValue(lead);
    db.contact.create.mockResolvedValue({ id: "c1" });
    db.deal.create.mockResolvedValue({ id: "d1" });
    db.lead.update.mockResolvedValue({ ...lead, status: "APPOINTMENT" });
    // adviser lookup: availability check + credit deduction read
    db.crmUser.findUnique.mockResolvedValue({ id: "adv-1", role: "ADVISER", isActive: true, creditBalance: 3 });
    db.crmUser.findUniqueOrThrow.mockResolvedValue({ id: "adv-1", role: "ADVISER", creditBalance: 3 });

    const tm = tmActor({ id: "tm-1", delegatedAdviserIds: ["adv-1"] });
    await convertLead(tm, "lead-1", { appointment_date: "2026-07-01", assigned_adviser_id: "adv-1" });

    const dealData = db.deal.create.mock.calls[0]![0].data;
    expect(dealData.assignedToId).toBe("adv-1");
    expect(dealData.telemarketerId).toBe("tm-1");
    expect(db.crmUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalance: { decrement: 1 } } }),
    );
    expect(db.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CLAIM", balanceBefore: 3, balanceAfter: 2 }),
      }),
    );
  });

  it("forbids assigning to an adviser who did not delegate to the TM", async () => {
    const lead = { ...appointmentLead(), status: "NA" as const };
    db.lead.findFirst.mockResolvedValue(lead);
    db.contact.create.mockResolvedValue({ id: "c1" });

    const tm = tmActor({ id: "tm-1", delegatedAdviserIds: ["adv-1"] });
    await expect(
      convertLead(tm, "lead-1", { appointment_date: "2026-07-01", assigned_adviser_id: "adv-x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("falls back to unassigned when the chosen adviser has no credit", async () => {
    const lead = { ...appointmentLead(), status: "NA" as const };
    db.lead.findFirst.mockResolvedValue(lead);
    db.contact.create.mockResolvedValue({ id: "c1" });
    db.deal.create.mockResolvedValue({ id: "d1" });
    db.lead.update.mockResolvedValue({ ...lead, status: "APPOINTMENT" });
    db.crmUser.findUnique.mockResolvedValue({ id: "adv-1", role: "ADVISER", isActive: true, creditBalance: 0 });

    const tm = tmActor({ id: "tm-1", delegatedAdviserIds: ["adv-1"] });
    await convertLead(tm, "lead-1", { appointment_date: "2026-07-01", assigned_adviser_id: "adv-1" });

    const dealData = db.deal.create.mock.calls[0]![0].data;
    expect(dealData.assignedToId).toBeUndefined();
    expect(db.creditTransaction.create).not.toHaveBeenCalled();
  });
});

// ─── claimForCall ───────────────────────────────────────────────────────────

describe("claimForCall", () => {
  it("batch-claims up to `count` unclaimed NA/COOLDOWN leads", async () => {
    const pool = [{ id: "a" }, { id: "b" }];
    db.lead.findMany
      .mockResolvedValueOnce(pool) // pool query
      .mockResolvedValue(pool); // refetch after update
    db.lead.updateMany.mockResolvedValue({ count: 2 });
    db.$transaction.mockImplementation(async (ops: unknown[]) => ops);

    const leads = await claimForCall(tmActor(), { count: 15 });

    expect(leads).toHaveLength(2);
    expect(db.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["a", "b"] } }),
        data: { telemarketerOwnerId: "u1" },
      }),
    );
  });

  it("allows targeted sessions to include leads already owned by the caller", async () => {
    const pool = [{ id: "mine" }, { id: "open" }];
    db.lead.findMany
      .mockResolvedValueOnce(pool)
      .mockResolvedValue(pool);
    db.lead.updateMany.mockResolvedValue({ count: 2 });
    db.$transaction.mockImplementation(async (ops: unknown[]) => ops);

    const leads = await claimForCall(tmActor(), { count: 15, leadIds: ["mine", "open", "other"] });

    expect(leads).toHaveLength(2);
    const where = db.lead.findMany.mock.calls[0]![0].where;
    expect(where).toEqual(expect.objectContaining({ id: { in: ["mine", "open", "other"] } }));
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([{ telemarketerOwnerId: null }, { telemarketerOwnerId: "u1" }]),
        }),
      ]),
    );
    expect(db.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["mine", "open"] } }),
        data: { telemarketerOwnerId: "u1" },
      }),
    );
  });

  it("returns empty array when no leads are available", async () => {
    db.lead.findMany.mockResolvedValueOnce([]);

    const leads = await claimForCall(tmActor(), { count: 15 });

    expect(leads).toEqual([]);
    expect(db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("forbids an adviser with neither telemarketer nor leads access", async () => {
    await expect(
      claimForCall(
        actor({ role: "ADVISER", telemarketerAccess: false, leadsAccess: false }),
        { count: 5 },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an adviser who has leads access to claim a calling pool", async () => {
    db.lead.findMany.mockResolvedValue([]);
    const result = await claimForCall(
      actor({ role: "ADVISER", telemarketerAccess: false, leadsAccess: true }),
      { count: 5 },
    );
    expect(result).toEqual([]);
  });
});

// ─── mergeDuplicateLeads ───────────────────────────────────────────────────

describe("mergeDuplicateLeads", () => {
  beforeEach(() => {
    db.leadNote.updateMany.mockResolvedValue({ count: 0 });
    db.leadStatusHistory.updateMany.mockResolvedValue({ count: 0 });
    db.activity.updateMany.mockResolvedValue({ count: 0 });
    db.deal.updateMany.mockResolvedValue({ count: 0 });
    db.creditTransaction.updateMany.mockResolvedValue({ count: 0 });
    db.notification.updateMany.mockResolvedValue({ count: 0 });
    db.lead.updateMany.mockResolvedValue({ count: 1 });
    db.leadNote.create.mockResolvedValue({ id: "merge-note" });
  });

  it("moves dependent records into the kept lead and soft-deletes duplicates", async () => {
    const target = appointmentLead({
      id: "keep",
      phone: "+65 5555 0000",
      email: null,
      notes: null,
      status: "NA" as const,
    });
    const source = appointmentLead({
      id: "dupe",
      phone: "65 5555 0000",
      email: "dupe@example.com",
      notes: "Customer prefers afternoons",
      status: "KIV" as const,
    });
    db.lead.findMany.mockResolvedValue([target, source]);
    db.lead.update.mockResolvedValue({
      ...target,
      email: "dupe@example.com",
      notes: "Merged from duplicate Aaron Lim: Customer prefers afternoons",
    });
    db.leadNote.updateMany.mockResolvedValue({ count: 2 });
    db.leadStatusHistory.updateMany.mockResolvedValue({ count: 1 });
    db.activity.updateMany.mockResolvedValue({ count: 3 });
    db.deal.updateMany.mockResolvedValue({ count: 1 });
    db.creditTransaction.updateMany.mockResolvedValue({ count: 1 });
    db.notification.updateMany.mockResolvedValue({ count: 1 });

    const result = await mergeDuplicateLeads(actor({ role: "MASTER" }), "keep", { source_ids: ["dupe"] });

    expect(result.mergedSourceIds).toEqual(["dupe"]);
    expect(result.moved).toMatchObject({
      notes: 2,
      statusHistory: 1,
      activities: 3,
      deals: 1,
      creditTransactions: 1,
      notifications: 1,
    });
    expect(db.lead.update.mock.calls[0]![0]).toMatchObject({
      where: { id: "keep" },
      data: expect.objectContaining({ email: "dupe@example.com" }),
    });
    expect(db.leadNote.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ["dupe"] } },
      data: { leadId: "keep" },
    });
    expect(db.deal.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ["dupe"] } },
      data: { leadId: "keep" },
    });
    expect(db.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["dupe"] } },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it("refuses to merge rows with different phone keys", async () => {
    db.lead.findMany.mockResolvedValue([
      appointmentLead({ id: "keep", phone: "11111111", status: "NA" as const }),
      appointmentLead({ id: "dupe", phone: "22222222", status: "NA" as const }),
    ]);

    await expect(
      mergeDuplicateLeads(actor({ role: "MASTER" }), "keep", { source_ids: ["dupe"] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.lead.updateMany).not.toHaveBeenCalled();
    expect(db.leadNote.updateMany).not.toHaveBeenCalled();
  });
});

// ─── lead notes ─────────────────────────────────────────────────────────────

describe("getLeadNotes / addLeadNote", () => {
  it("returns notes for an existing lead", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead());
    db.leadNote.findMany.mockResolvedValue([{ id: "n1", content: "Called" }]);

    const notes = await getLeadNotes(tmActor(), "lead-1");

    expect(notes).toHaveLength(1);
  });

  it("throws NOT_FOUND for missing lead", async () => {
    db.lead.findFirst.mockResolvedValue(null);

    await expect(getLeadNotes(tmActor(), "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates a note and stamps created_by", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead());
    db.leadNote.create.mockResolvedValue({ id: "n2", content: "test", createdBy: "u1" });

    const note = await addLeadNote(tmActor(), "lead-1", { content: "test" });

    expect(note.createdBy).toBe("u1");
    expect(db.leadNote.create.mock.calls[0]![0].data).toMatchObject({
      leadId: "lead-1",
      content: "test",
      createdBy: "u1",
    });
  });
});

// ─── status history ──────────────────────────────────────────────────────────

describe("getLeadStatusHistory", () => {
  it("returns history for an existing lead", async () => {
    db.lead.findFirst.mockResolvedValue(appointmentLead());
    const history = [{ id: "h1", status: "NA" }, { id: "h2", status: "APPOINTMENT" }];
    (db as unknown as Record<string, { findMany: ReturnType<typeof vi.fn> }>).leadStatusHistory = {
      findMany: vi.fn().mockResolvedValue(history),
    };

    const result = await getLeadStatusHistory(tmActor(), "lead-1");

    expect(result).toHaveLength(2);
  });
});
