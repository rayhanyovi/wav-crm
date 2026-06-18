import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  crmUser: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const {
  listUsers,
  getUser,
  updateUser,
  listPendingUsers,
  approveUser,
  rejectUser,
  completeOnboarding,
  activateSuperAdmin,
} = await import("./users.service.js");

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "MASTER",
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
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe("listUsers", () => {
  it("allows non-MASTER to list active users for CRM attribution", async () => {
    db.crmUser.findMany.mockResolvedValue([{ id: "u1", isActive: true }]);
    db.crmUser.count.mockResolvedValue(1);

    const res = await listUsers(actor({ role: "TELEMARKETER" }), { page: 1, pageSize: 25 } as never);

    expect(res.total).toBe(1);
    expect(db.crmUser.findMany.mock.calls[0]![0].where).toMatchObject({ isActive: true });
  });

  it("MASTER can list with pagination", async () => {
    db.crmUser.findMany.mockResolvedValue([{ id: "u1" }]);
    db.crmUser.count.mockResolvedValue(1);
    const res = await listUsers(actor(), { page: 1, pageSize: 25 } as never);
    expect(res.total).toBe(1);
  });
});

describe("getUser", () => {
  it("throws NOT_FOUND for unknown id", async () => {
    db.crmUser.findUnique.mockResolvedValue(null);
    await expect(getUser(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("non-MASTER can view their own profile", async () => {
    db.crmUser.findUnique.mockResolvedValue({ id: "u2" });
    const user = await getUser(actor({ role: "ADVISER", id: "u2" }), "u2");
    expect(user.id).toBe("u2");
  });

  it("non-MASTER cannot view another user's profile", async () => {
    await expect(getUser(actor({ role: "ADVISER", id: "u1" }), "u2")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("updateUser", () => {
  it("forbids non-MASTER", async () => {
    await expect(updateUser(actor({ role: "ADVISER" }), "u2", { name: "X" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("MASTER can update credit_balance", async () => {
    db.crmUser.findUnique.mockResolvedValue({ id: "u2", creditBalance: 0 });
    db.crmUser.update.mockResolvedValue({ id: "u2", creditBalance: 5 });
    db.auditLog.create.mockResolvedValue({});

    const result = await updateUser(actor(), "u2", { credit_balance: 5 });
    expect(db.crmUser.update.mock.calls[0]![0].data.creditBalance).toBe(5);
    expect(result.creditBalance).toBe(5);
  });

  it("throws NOT_FOUND when the user is missing", async () => {
    db.crmUser.findUnique.mockResolvedValue(null);
    await expect(updateUser(actor(), "x", { name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps every editable field", async () => {
    db.crmUser.findUnique.mockResolvedValue({ id: "u2" });
    db.crmUser.update.mockResolvedValue({ id: "u2" });
    db.auditLog.create.mockResolvedValue({});

    await updateUser(actor(), "u2", {
      name: "N", role: "ADVISER", is_active: false, credit_balance: 2,
      telemarketer_access: true, telemarketer_id: "tm-1", leads_access: false,
    });

    expect(db.crmUser.update.mock.calls[0]![0].data).toMatchObject({
      name: "N", role: "ADVISER", isActive: false, creditBalance: 2,
      telemarketerAccess: true, telemarketerId: "tm-1", leadsAccess: false,
    });
  });

  it("nulls telemarketer_id when explicitly cleared", async () => {
    db.crmUser.findUnique.mockResolvedValue({ id: "u2" });
    db.crmUser.update.mockResolvedValue({ id: "u2" });
    db.auditLog.create.mockResolvedValue({});

    await updateUser(actor(), "u2", { telemarketer_id: null } as never);
    expect(db.crmUser.update.mock.calls[0]![0].data.telemarketerId).toBeNull();
  });
});

describe("listUsers search", () => {
  it("applies name/email search and role filter", async () => {
    db.crmUser.findMany.mockResolvedValue([]);
    db.crmUser.count.mockResolvedValue(0);

    await listUsers(actor(), { page: 1, pageSize: 25, search: "ann", role: "ADVISER" } as never);

    const where = db.crmUser.findMany.mock.calls[0]![0].where;
    expect(where.OR).toBeDefined();
    expect(where.role).toBe("ADVISER");
  });
});

describe("pending / approval flow", () => {
  it("listPendingUsers forbids non-MASTER", async () => {
    await expect(listPendingUsers(actor({ role: "ADVISER" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("listPendingUsers returns pending accounts for MASTER", async () => {
    db.crmUser.findMany.mockResolvedValue([{ id: "p1" }]);
    const res = await listPendingUsers(actor());
    expect(res).toHaveLength(1);
    expect(db.crmUser.findMany.mock.calls[0]![0].where).toMatchObject({
      accountStatus: { in: ["PENDING_APPROVAL", "PENDING_PROFILE"] },
    });
  });

  it("approveUser forbids non-MASTER", async () => {
    await expect(approveUser(actor({ role: "ADVISER" }), "u2", "ADVISER")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("approveUser throws NOT_FOUND when the user is missing", async () => {
    db.crmUser.findUnique.mockResolvedValue(null);
    await expect(approveUser(actor(), "x", "ADVISER")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("approveUser activates, assigns role, clears requestedRole", async () => {
    db.crmUser.findUnique.mockResolvedValue({ id: "u2" });
    db.crmUser.update.mockResolvedValue({ id: "u2", role: "ADVISER" });
    db.auditLog.create.mockResolvedValue({});

    await approveUser(actor(), "u2", "ADVISER");
    expect(db.crmUser.update.mock.calls[0]![0].data).toMatchObject({
      role: "ADVISER", isActive: true, accountStatus: "ACTIVE", requestedRole: null,
    });
  });

  it("rejectUser deactivates and sets REJECTED", async () => {
    db.crmUser.findUnique.mockResolvedValue({ id: "u2" });
    db.crmUser.update.mockResolvedValue({ id: "u2" });
    db.auditLog.create.mockResolvedValue({});

    await rejectUser(actor(), "u2");
    expect(db.crmUser.update.mock.calls[0]![0].data).toMatchObject({ isActive: false, accountStatus: "REJECTED" });
  });

  it("rejectUser throws NOT_FOUND when the user is missing", async () => {
    db.crmUser.findUnique.mockResolvedValue(null);
    await expect(rejectUser(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("completeOnboarding records name + requested role and queues for approval", async () => {
    db.crmUser.update.mockResolvedValue({ id: "u1" });
    await completeOnboarding(actor({ id: "u1" }), "Me", "ADVISER");
    expect(db.crmUser.update.mock.calls[0]![0]).toMatchObject({
      where: { id: "u1" },
      data: { name: "Me", requestedRole: "ADVISER", accountStatus: "PENDING_APPROVAL" },
    });
  });

  it("activateSuperAdmin promotes the caller when no active master exists", async () => {
    db.crmUser.findFirst.mockResolvedValue(null);
    db.crmUser.update.mockResolvedValue({ id: "u1", role: "MASTER" });

    const res = await activateSuperAdmin(actor({ id: "u1", role: "TELEMARKETER" }));
    expect(db.crmUser.update.mock.calls[0]![0].data).toMatchObject({
      role: "MASTER", isActive: true, accountStatus: "ACTIVE",
    });
    expect(res.role).toBe("MASTER");
  });

  it("activateSuperAdmin refuses when a master already exists", async () => {
    db.crmUser.findFirst.mockResolvedValue({ id: "existing", role: "MASTER" });
    await expect(activateSuperAdmin(actor({ id: "u1" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
