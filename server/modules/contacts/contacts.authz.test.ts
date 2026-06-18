import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import {
  canCreateContact,
  canDeleteContact,
  canListContacts,
  canUpdateContact,
  canViewContact,
} from "./contacts.authz.js";

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

describe("contacts authz", () => {
  it("MASTER and ADVISER can list, view, create, update", () => {
    for (const role of ["MASTER", "ADVISER"] as const) {
      const a = actor({ role });
      expect(canListContacts(a)).toBe(true);
      expect(canViewContact(a, { createdBy: "other" })).toBe(true);
      expect(canCreateContact(a)).toBe(true);
      expect(canUpdateContact(a, { createdBy: "other" })).toBe(true);
    }
  });

  it("TELEMARKETER can list/create, with view/update scoped by creator", () => {
    const a = actor({ role: "TELEMARKETER", id: "tm-1" });
    expect(canListContacts(a)).toBe(true);
    expect(canCreateContact(a)).toBe(true);
    expect(canViewContact(a, { createdBy: "tm-1" })).toBe(true);
    expect(canUpdateContact(a, { createdBy: "tm-1" })).toBe(true);
    expect(canViewContact(a, { createdBy: "other" })).toBe(false);
    expect(canUpdateContact(a, { createdBy: "other" })).toBe(false);
  });

  it("TELEMARKETER can view/update contacts from shared advisers", () => {
    const a = actor({ role: "TELEMARKETER", id: "tm-1" });
    expect(canViewContact(a, { createdBy: "adv-1" }, ["adv-1"])).toBe(true);
    expect(canUpdateContact(a, { createdBy: "adv-1" }, ["adv-1"])).toBe(true);
  });

  it("only MASTER can delete", () => {
    expect(canDeleteContact(actor({ role: "MASTER" }))).toBe(true);
    expect(canDeleteContact(actor({ role: "ADVISER" }))).toBe(false);
    expect(canDeleteContact(actor({ role: "TELEMARKETER" }))).toBe(false);
  });

  it("canViewContact / canUpdateContact deny an unrecognised role", () => {
    expect(canViewContact(actor({ role: "GUEST" as never }), { createdBy: "x" })).toBe(false);
    expect(canUpdateContact(actor({ role: "GUEST" as never }), { createdBy: "x" })).toBe(false);
  });
});
