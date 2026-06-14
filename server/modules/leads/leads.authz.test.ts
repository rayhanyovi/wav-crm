import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import { canCreateLead, canDeleteLead, canListLeads, canUpdateLead } from "./leads.authz.js";

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

describe("leads.authz", () => {
  describe("canListLeads / canUpdateLead (pool access)", () => {
    it("allows MASTER and TELEMARKETER", () => {
      expect(canListLeads(actor({ role: "MASTER" }))).toBe(true);
      expect(canListLeads(actor({ role: "TELEMARKETER" }))).toBe(true);
      expect(canUpdateLead(actor({ role: "MASTER" }))).toBe(true);
    });

    it("allows ADVISER only with telemarketer access (mirrors RLS)", () => {
      expect(canListLeads(actor({ role: "ADVISER", telemarketerAccess: true }))).toBe(true);
      expect(canListLeads(actor({ role: "ADVISER", telemarketerAccess: false }))).toBe(false);
    });
  });

  describe("canCreateLead", () => {
    it("allows every authenticated role", () => {
      for (const role of ["MASTER", "ADVISER", "TELEMARKETER"] as const) {
        expect(canCreateLead(actor({ role }))).toBe(true);
      }
    });
  });

  describe("canDeleteLead", () => {
    const lead = { assignedToId: "owner", adviserOwnerId: "adviser" };

    it("MASTER can delete anything", () => {
      expect(canDeleteLead(actor({ role: "MASTER", id: "x" }), lead)).toBe(true);
    });

    it("assigned or adviser owner can delete", () => {
      expect(canDeleteLead(actor({ id: "owner" }), lead)).toBe(true);
      expect(canDeleteLead(actor({ id: "adviser" }), lead)).toBe(true);
    });

    it("a non-owner adviser cannot delete", () => {
      expect(canDeleteLead(actor({ role: "ADVISER", id: "stranger" }), lead)).toBe(false);
    });
  });
});
