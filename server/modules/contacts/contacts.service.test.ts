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
  crmUser: { findMany: vi.fn() },
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
    delegatedAdviserIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.crmUser.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe("listContacts", () => {
  it("scopes TELEMARKETER contacts to themselves and shared advisers", async () => {
    db.crmUser.findMany.mockResolvedValue([{ id: "adv-1" }]);
    db.contact.findMany.mockResolvedValue([{ id: "c1" }]);
    db.contact.count.mockResolvedValue(1);

    await listContacts(actor({ role: "TELEMARKETER", id: "tm-1" }), { page: 1, pageSize: 25 } as never);

    expect(db.contact.findMany.mock.calls[0]![0].where).toMatchObject({
      deletedAt: null,
      createdBy: { in: ["tm-1", "adv-1"] },
    });
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

  it("throws FORBIDDEN for TELEMARKETER on an unrelated contact", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1", createdBy: "other" });
    await expect(getContact(actor({ role: "TELEMARKETER", id: "tm-1" }), "c1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows TELEMARKETER to view contacts from a shared adviser", async () => {
    db.crmUser.findMany.mockResolvedValue([{ id: "adv-1" }]);
    db.contact.findFirst.mockResolvedValue({ id: "c1", createdBy: "adv-1" });

    const contact = await getContact(actor({ role: "TELEMARKETER", id: "tm-1" }), "c1");

    expect(contact.id).toBe("c1");
  });
});

describe("createContact", () => {
  it("allows TELEMARKETER to create contacts from calling workflow", async () => {
    db.contact.create.mockResolvedValue({ id: "c1", firstName: "X", createdBy: "tm-1" });
    db.auditLog.create.mockResolvedValue({});

    const contact = await createContact(
      actor({ role: "TELEMARKETER", id: "tm-1" }),
      { first_name: "X", last_name: "Y", source: "OTHERS" } as never,
    );

    expect(contact.id).toBe("c1");
    expect(db.contact.create.mock.calls[0]![0].data.createdBy).toBe("tm-1");
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
