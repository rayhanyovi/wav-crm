import { describe, it, expect } from "vitest";
import { mapUserRow, type UserRow } from "./users";

function row(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr-1",
    name: "Alice",
    email: "alice@sg-alliance.com",
    role: "ADVISER",
    avatar: null,
    is_active: true,
    credit_balance: null,
    telemarketer_access: null,
    telemarketer_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapUserRow", () => {
  it("passes through core fields", () => {
    const u = mapUserRow(row());
    expect(u.id).toBe("usr-1");
    expect(u.name).toBe("Alice");
    expect(u.email).toBe("alice@sg-alliance.com");
    expect(u.role).toBe("ADVISER");
    expect(u.is_active).toBe(true);
  });

  it("normalizes nullable fields to safe defaults", () => {
    const u = mapUserRow(row());
    expect(u.avatar).toBeUndefined();
    expect(u.credit_balance).toBe(0);
    expect(u.telemarketer_access).toBe(false);
    expect(u.telemarketer_id).toBeUndefined();
  });

  it("preserves provided optional values", () => {
    const u = mapUserRow(
      row({
        avatar: "AL",
        credit_balance: 7,
        telemarketer_access: true,
        telemarketer_id: "usr-tele",
      }),
    );
    expect(u.avatar).toBe("AL");
    expect(u.credit_balance).toBe(7);
    expect(u.telemarketer_access).toBe(true);
    expect(u.telemarketer_id).toBe("usr-tele");
  });
});
