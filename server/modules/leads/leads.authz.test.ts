import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import {
  canClaimAppointmentLead,
  canClaimForCall,
  canConvertLead,
  canCreateLead,
  canDeleteLead,
  canListLeads,
  canUpdateLead,
  canViewLead,
} from "./leads.authz.js";

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

describe("leads.authz", () => {
  describe("canListLeads / canUpdateLead (row access)", () => {
    it("allows MASTER and TELEMARKETER", () => {
      expect(canListLeads(actor({ role: "MASTER" }))).toBe(true);
      expect(canListLeads(actor({ role: "TELEMARKETER" }))).toBe(true);
      expect(canUpdateLead(actor({ role: "MASTER" }), {
        assignedToId: null,
        telemarketerOwnerId: null,
        adviserOwnerId: null,
      })).toBe(true);
    });

    it("allows ADVISER to list, with rows filtered in service", () => {
      expect(canListLeads(actor({ role: "ADVISER", telemarketerAccess: false }))).toBe(true);
    });

    it("allows TELEMARKETER to update only their own row", () => {
      expect(canUpdateLead(actor({ role: "TELEMARKETER", id: "tm" }), {
        assignedToId: "tm",
        telemarketerOwnerId: "tm",
        adviserOwnerId: null,
      })).toBe(true);
      expect(canUpdateLead(actor({ role: "TELEMARKETER", id: "tm" }), {
        assignedToId: null,
        telemarketerOwnerId: null,
        adviserOwnerId: null,
      })).toBe(false);
    });

    it("allows TELEMARKETER to update rows owned by an adviser who shared access", () => {
      expect(canUpdateLead(actor({ role: "TELEMARKETER", id: "tm" }), {
        assignedToId: "adv-1",
        telemarketerOwnerId: null,
        adviserOwnerId: null,
      }, ["adv-1"])).toBe(true);
    });

    it("allows ADVISER with leads access to update any row; otherwise only owned rows", () => {
      const open = { assignedToId: null, telemarketerOwnerId: null, adviserOwnerId: null };
      // leads access → any row
      expect(canUpdateLead(actor({ role: "ADVISER", leadsAccess: true, id: "adv" }), open)).toBe(true);
      // no leads access → only rows they're assigned to or own
      expect(canUpdateLead(actor({ role: "ADVISER", leadsAccess: false, id: "adv" }), {
        assignedToId: "adv", telemarketerOwnerId: null, adviserOwnerId: null,
      })).toBe(true);
      expect(canUpdateLead(actor({ role: "ADVISER", leadsAccess: false, id: "adv" }), {
        assignedToId: null, telemarketerOwnerId: null, adviserOwnerId: "adv",
      })).toBe(true);
      expect(canUpdateLead(actor({ role: "ADVISER", leadsAccess: false, id: "adv" }), open)).toBe(false);
    });

    it("denies view/update for an unrecognised role (deny by default)", () => {
      const open = { assignedToId: null, telemarketerOwnerId: null, adviserOwnerId: null };
      expect(canUpdateLead(actor({ role: "GUEST" as never }), open)).toBe(false);
      expect(canViewLead(actor({ role: "GUEST" as never }), open)).toBe(false);
    });
  });

  describe("canViewLead", () => {
    const openLead = { assignedToId: null, telemarketerOwnerId: null, adviserOwnerId: null };

    it("lets MASTER view anything and TELEMARKETER view open pool leads", () => {
      expect(canViewLead(actor({ role: "MASTER" }), openLead)).toBe(true);
      expect(canViewLead(actor({ role: "TELEMARKETER" }), openLead)).toBe(true);
    });

    it("lets TELEMARKETER view their own row or shared adviser rows", () => {
      const tm = actor({ role: "TELEMARKETER", id: "tm" });
      expect(canViewLead(tm, { assignedToId: null, telemarketerOwnerId: "tm", adviserOwnerId: null })).toBe(true);
      expect(canViewLead(tm, { assignedToId: "adv-1", telemarketerOwnerId: "other", adviserOwnerId: null }, ["adv-1"])).toBe(true);
      expect(canViewLead(tm, { assignedToId: null, telemarketerOwnerId: "other", adviserOwnerId: "adv-2" }, ["adv-2"])).toBe(true);
      expect(canViewLead(tm, { assignedToId: "adv-x", telemarketerOwnerId: "other", adviserOwnerId: null }, ["adv-1"])).toBe(false);
    });

    it("scopes ADVISER view by leads access or ownership", () => {
      expect(canViewLead(actor({ role: "ADVISER", leadsAccess: true, id: "adv" }), openLead)).toBe(true);
      expect(canViewLead(actor({ role: "ADVISER", leadsAccess: false, id: "adv" }), {
        assignedToId: "adv",
        telemarketerOwnerId: null,
        adviserOwnerId: null,
      })).toBe(true);
      expect(canViewLead(actor({ role: "ADVISER", leadsAccess: false, id: "adv" }), {
        assignedToId: null,
        telemarketerOwnerId: null,
        adviserOwnerId: "adv",
      })).toBe(true);
      expect(canViewLead(actor({ role: "ADVISER", leadsAccess: false, id: "adv" }), openLead)).toBe(false);
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

    it("the telemarketer owner can delete leads in their own queue", () => {
      const tmLead = { assignedToId: null, adviserOwnerId: null, telemarketerOwnerId: "tm" };
      expect(canDeleteLead(actor({ role: "TELEMARKETER", id: "tm" }), tmLead)).toBe(true);
      expect(canDeleteLead(actor({ role: "TELEMARKETER", id: "other" }), tmLead)).toBe(false);
    });
  });

  describe("claim/convert permissions", () => {
    it("allows appointment claims for MASTER and ADVISER only", () => {
      expect(canClaimAppointmentLead(actor({ role: "MASTER" }))).toBe(true);
      expect(canClaimAppointmentLead(actor({ role: "ADVISER" }))).toBe(true);
      expect(canClaimAppointmentLead(actor({ role: "TELEMARKETER" }))).toBe(false);
    });

    it("allows call claims for cold-call capable users", () => {
      expect(canClaimForCall(actor({ role: "MASTER" }))).toBe(true);
      expect(canClaimForCall(actor({ role: "TELEMARKETER" }))).toBe(true);
      expect(canClaimForCall(actor({ role: "ADVISER", telemarketerAccess: true, leadsAccess: false }))).toBe(true);
      expect(canClaimForCall(actor({ role: "ADVISER", telemarketerAccess: false, leadsAccess: true }))).toBe(true);
      expect(canClaimForCall(actor({ role: "ADVISER", telemarketerAccess: false, leadsAccess: false }))).toBe(false);
    });

    it("allows conversion for cold-call capable users", () => {
      expect(canConvertLead(actor({ role: "MASTER" }))).toBe(true);
      expect(canConvertLead(actor({ role: "TELEMARKETER" }))).toBe(true);
      expect(canConvertLead(actor({ role: "ADVISER", telemarketerAccess: true, leadsAccess: false }))).toBe(true);
      expect(canConvertLead(actor({ role: "ADVISER", telemarketerAccess: false, leadsAccess: true }))).toBe(true);
      expect(canConvertLead(actor({ role: "ADVISER", telemarketerAccess: false, leadsAccess: false }))).toBe(false);
    });
  });
});
