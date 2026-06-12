import { describe, it, expect } from "vitest";
import { mapAuthProfile } from "./useAuthStore";

describe("mapAuthProfile", () => {
  const base = {
    id: "usr-1",
    name: "Alice",
    email: "alice@sg-alliance.com",
    role: "MASTER" as const,
    avatar: null,
    is_active: true,
    credit_balance: null,
    telemarketer_access: null,
    telemarketer_id: null,
    leads_access: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("maps an active profile and defaults nullable fields", () => {
    const u = mapAuthProfile(base);
    expect(u.id).toBe("usr-1");
    expect(u.role).toBe("MASTER");
    expect(u.avatar).toBeUndefined();
    expect(u.credit_balance).toBe(0);
    expect(u.telemarketer_access).toBe(false);
    expect(u.telemarketer_id).toBeUndefined();
  });

  it("keeps populated optional values", () => {
    const u = mapAuthProfile({
      ...base,
      avatar: "AL",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: "usr-tele",
    });
    expect(u.avatar).toBe("AL");
    expect(u.credit_balance).toBe(3);
    expect(u.telemarketer_access).toBe(true);
    expect(u.telemarketer_id).toBe("usr-tele");
  });
});
