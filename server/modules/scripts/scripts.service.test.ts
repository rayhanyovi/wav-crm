import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  script: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listScripts, getScript, createScript, updateScript, deleteScript } = await import(
  "./scripts.service.js"
);

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

beforeEach(() => vi.clearAllMocks());

describe("scripts.service reads", () => {
  it("listScripts returns non-deleted scripts for any role", async () => {
    db.script.findMany.mockResolvedValue([{ id: "s1" }]);
    const res = await listScripts(actor({ role: "TELEMARKETER" }));
    expect(res).toHaveLength(1);
    expect(db.script.findMany.mock.calls[0]![0].where).toMatchObject({ deletedAt: null });
  });

  it("getScript returns a script", async () => {
    db.script.findFirst.mockResolvedValue({ id: "s1" });
    expect((await getScript(actor({ role: "ADVISER" }), "s1")).id).toBe("s1");
  });

  it("getScript throws NOT_FOUND when missing", async () => {
    db.script.findFirst.mockResolvedValue(null);
    await expect(getScript(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("scripts.service writes (MASTER only)", () => {
  it("createScript forbids non-MASTER", async () => {
    await expect(createScript(actor({ role: "ADVISER" }), { title: "T", content: "C" } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("createScript stamps createdBy", async () => {
    db.script.create.mockResolvedValue({ id: "s1" });
    await createScript(actor({ id: "u1" }), { title: "T", content: "C" } as never);
    expect(db.script.create.mock.calls[0]![0].data).toMatchObject({ title: "T", content: "C", createdBy: "u1" });
  });

  it("updateScript forbids non-MASTER", async () => {
    await expect(updateScript(actor({ role: "TELEMARKETER" }), "s1", { title: "X" } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("updateScript throws NOT_FOUND when missing", async () => {
    db.script.findFirst.mockResolvedValue(null);
    await expect(updateScript(actor(), "x", { title: "X" } as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateScript patches fields and stamps updatedAt", async () => {
    db.script.findFirst.mockResolvedValue({ id: "s1" });
    db.script.update.mockResolvedValue({ id: "s1" });
    await updateScript(actor(), "s1", { title: "New" } as never);
    const data = db.script.update.mock.calls[0]![0].data;
    expect(data.title).toBe("New");
    expect(data.updatedAt).toBeInstanceOf(Date);
  });

  it("deleteScript forbids non-MASTER", async () => {
    await expect(deleteScript(actor({ role: "ADVISER" }), "s1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deleteScript throws NOT_FOUND when missing", async () => {
    db.script.findFirst.mockResolvedValue(null);
    await expect(deleteScript(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteScript soft-deletes by setting deletedAt", async () => {
    db.script.findFirst.mockResolvedValue({ id: "s1" });
    db.script.update.mockResolvedValue({});
    await deleteScript(actor(), "s1");
    expect(db.script.update.mock.calls[0]![0].data.deletedAt).toBeInstanceOf(Date);
  });
});
