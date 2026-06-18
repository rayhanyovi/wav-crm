import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

import {
  activateSuperAdmin,
  approveUser,
  completeOnboarding,
  fetchPendingUsers,
  fetchUserById,
  fetchUsers,
  mapUserRow,
  rejectUser,
  updateUser,
  type UserRow,
} from "./users";

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
    leads_access: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function apiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr-api",
    name: "Api User",
    email: "api@example.test",
    role: "ADVISER",
    avatar: null,
    isActive: true,
    creditBalance: 4,
    telemarketerAccess: false,
    telemarketerId: null,
    leadsAccess: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("users API service", () => {
  it("fetches and maps users", async () => {
    apiMock.get.mockResolvedValue({ data: [apiUser({ telemarketerId: "tm-1" })] });

    const users = await fetchUsers();

    expect(apiMock.get).toHaveBeenCalledWith("/api/users", { page: 1, pageSize: 200 });
    expect(users[0]).toMatchObject({
      id: "usr-api",
      role: "ADVISER",
      credit_balance: 4,
      telemarketer_id: "tm-1",
    });
  });

  it("fetches one user and defaults a null API role to TELEMARKETER", async () => {
    apiMock.get.mockResolvedValue({ data: apiUser({ role: null, avatar: "AU" }) });

    const user = await fetchUserById("usr-api");

    expect(apiMock.get).toHaveBeenCalledWith("/api/users/usr-api");
    expect(user.role).toBe("TELEMARKETER");
    expect(user.avatar).toBe("AU");
  });

  it("updates only server-managed user fields and maps the response", async () => {
    apiMock.patch.mockResolvedValue({ data: apiUser({ role: "MASTER", creditBalance: 9 }) });

    const user = await updateUser("usr-api", {
      name: "Renamed",
      email: "ignored@example.test",
      avatar: "ignored",
      role: "MASTER",
      is_active: false,
      credit_balance: 9,
      telemarketer_access: true,
      telemarketer_id: null,
      leads_access: false,
    });

    expect(apiMock.patch).toHaveBeenCalledWith("/api/users/usr-api", {
      name: "Renamed",
      role: "MASTER",
      is_active: false,
      credit_balance: 9,
      telemarketer_access: true,
      telemarketer_id: null,
      leads_access: false,
    });
    expect(user.role).toBe("MASTER");
    expect(user.credit_balance).toBe(9);
  });

  it("fetches pending users and maps API field casing", async () => {
    apiMock.get.mockResolvedValue({
      data: [
        {
          id: "pending-1",
          name: "Pending",
          email: "pending@example.test",
          requestedRole: "ADVISER",
          accountStatus: "PENDING_APPROVAL",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
    });

    const users = await fetchPendingUsers();

    expect(apiMock.get).toHaveBeenCalledWith("/api/users/pending");
    expect(users[0]).toMatchObject({
      requested_role: "ADVISER",
      account_status: "PENDING_APPROVAL",
    });
  });

  it("posts onboarding and approval commands", async () => {
    await completeOnboarding("New User", "TELEMARKETER");
    await activateSuperAdmin();
    await approveUser("pending-1", "ADVISER");
    await rejectUser("pending-2");

    expect(apiMock.post).toHaveBeenNthCalledWith(1, "/api/users/onboarding", {
      name: "New User",
      requested_role: "TELEMARKETER",
    });
    expect(apiMock.post).toHaveBeenNthCalledWith(2, "/api/users/activate-super-admin");
    expect(apiMock.post).toHaveBeenNthCalledWith(3, "/api/users/pending-1/approve", { role: "ADVISER" });
    expect(apiMock.post).toHaveBeenNthCalledWith(4, "/api/users/pending-2/reject");
  });
});
