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
    leadStatusHistory: { create: vi.fn() },
    leadNote: { findMany: vi.fn(), create: vi.fn() },
    contact: { create: vi.fn() },
    deal: { create: vi.fn() },
    crmUser: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    notification: { createMany: vi.fn() },
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

  it("forbids a TELEMARKETER from claiming", async () => {
    await expect(claimLead(tmActor(), "lead-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
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

  it("assigns deal to the adviser when actor is ADVISER with telemarketer access", async () => {
    const lead = { ...appointmentLead(), status: "KIV" as const };
    db.lead.findFirst.mockResolvedValue(lead);
    db.contact.create.mockResolvedValue({ id: "c1" });
    db.deal.create.mockResolvedValue({ id: "d1" });
    db.lead.update.mockResolvedValue({ ...lead, status: "APPOINTMENT" });

    await convertLead(actor({ telemarketerAccess: true }), "lead-1", { appointment_date: "2026-07-01" });

    const dealData = db.deal.create.mock.calls[0]![0].data;
    expect(dealData.assignedToId).toBe("u1");
    expect(dealData.telemarketerId).toBeUndefined();
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

  it("returns empty array when no leads are available", async () => {
    db.lead.findMany.mockResolvedValueOnce([]);

    const leads = await claimForCall(tmActor(), { count: 15 });

    expect(leads).toEqual([]);
    expect(db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("forbids an adviser without telemarketer access", async () => {
    await expect(
      claimForCall(actor({ role: "ADVISER", telemarketerAccess: false }), { count: 5 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
