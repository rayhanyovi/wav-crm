import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  contact: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  contactNote: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listContacts, getContact, createContact, softDeleteContact } = await import(
  "./contacts.service.js"
);

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "ADVISER",
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

describe("listContacts", () => {
  it("forbids TELEMARKETER", async () => {
    await expect(
      listContacts(actor({ role: "TELEMARKETER" }), { page: 1, pageSize: 25 } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("paginates and returns data+total", async () => {
    db.contact.findMany.mockResolvedValue([{ id: "c1" }]);
    db.contact.count.mockResolvedValue(1);

    const res = await listContacts(actor(), { page: 1, pageSize: 25 } as never);
    expect(res).toMatchObject({ total: 1, page: 1 });
  });
});

describe("getContact", () => {
  it("throws NOT_FOUND when missing", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    await expect(getContact(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN for TELEMARKETER", async () => {
    await expect(getContact(actor({ role: "TELEMARKETER" }), "c1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("createContact", () => {
  it("forbids TELEMARKETER", async () => {
    await expect(
      createContact(actor({ role: "TELEMARKETER" }), { first_name: "X" } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sets createdBy from actor", async () => {
    const created = { id: "c1", firstName: "Ada" };
    db.contact.create.mockResolvedValue(created);
    db.auditLog.create.mockResolvedValue({});

    await createContact(actor({ id: "u1" }), { first_name: "Ada", last_name: "-", source: "OTHERS" } as never);
    expect(db.contact.create.mock.calls[0]![0].data.createdBy).toBe("u1");
  });
});

describe("softDeleteContact", () => {
  it("forbids non-MASTER", async () => {
    await expect(softDeleteContact(actor({ role: "ADVISER" }), "c1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("sets deletedAt", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1" });
    db.contact.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await softDeleteContact(actor({ role: "MASTER" }), "c1");
    expect(db.contact.update.mock.calls[0]![0].data.deletedAt).toBeInstanceOf(Date);
  });
});
