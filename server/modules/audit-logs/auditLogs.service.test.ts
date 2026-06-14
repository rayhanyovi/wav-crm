import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  auditLog: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listAuditLogs } = await import("./auditLogs.service.js");

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

beforeEach(() => vi.clearAllMocks());

describe("listAuditLogs", () => {
  it("forbids non-MASTER", async () => {
    await expect(listAuditLogs(actor({ role: "ADVISER" }), { page: 1, pageSize: 25 } as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("MASTER can list with entity_type filter", async () => {
    db.auditLog.findMany.mockResolvedValue([{ id: "log-1" }]);
    db.auditLog.count.mockResolvedValue(1);

    const res = await listAuditLogs(actor(), { page: 1, pageSize: 25, entity_type: "leads" } as never);

    expect(res.total).toBe(1);
    const where = db.auditLog.findMany.mock.calls[0]![0].where;
    expect(where.entityType).toBe("leads");
  });
});
