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
    ...overrides,
  };
}

describe("contacts authz", () => {
  it("MASTER and ADVISER can list, view, create, update", () => {
    for (const role of ["MASTER", "ADVISER"] as const) {
      const a = actor({ role });
      expect(canListContacts(a)).toBe(true);
      expect(canViewContact(a)).toBe(true);
      expect(canCreateContact(a)).toBe(true);
      expect(canUpdateContact(a)).toBe(true);
    }
  });

  it("TELEMARKETER cannot list, view, create, or update", () => {
    const a = actor({ role: "TELEMARKETER" });
    expect(canListContacts(a)).toBe(false);
    expect(canViewContact(a)).toBe(false);
    expect(canCreateContact(a)).toBe(false);
    expect(canUpdateContact(a)).toBe(false);
  });

  it("only MASTER can delete", () => {
    expect(canDeleteContact(actor({ role: "MASTER" }))).toBe(true);
    expect(canDeleteContact(actor({ role: "ADVISER" }))).toBe(false);
    expect(canDeleteContact(actor({ role: "TELEMARKETER" }))).toBe(false);
  });
});
