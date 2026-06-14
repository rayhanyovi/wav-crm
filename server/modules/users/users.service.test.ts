import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  crmUser: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listUsers, getUser, updateUser } = await import("./users.service.js");

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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe("listUsers", () => {
  it("forbids non-MASTER", async () => {
    await expect(listUsers(actor({ role: "ADVISER" }), { page: 1, pageSize: 25 } as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
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
});
