import { api, type Envelope, type Page } from "@/lib/api";
import type { User } from "@/data/types";

// ─── Types (kept for backward compat) ────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  avatar: string | null;
  is_active: boolean;
  credit_balance: number | null;
  telemarketer_access: boolean | null;
  telemarketer_id: string | null;
  leads_access: boolean | null;
  created_at: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: User["role"];
  avatar?: string | null;
  is_active?: boolean;
  credit_balance?: number;
  telemarketer_access?: boolean;
  telemarketer_id?: string | null;
  leads_access?: boolean;
}

// ─── API response shape ───────────────────────────────────────────────────────

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatar: string | null;
  isActive: boolean;
  creditBalance: number;
  telemarketerAccess: boolean;
  telemarketerId: string | null;
  leadsAccess: boolean;
  createdAt: string;
}

function mapApiUser(r: ApiUser): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: (r.role as User["role"]) ?? "TELEMARKETER",
    avatar: r.avatar ?? undefined,
    is_active: r.isActive,
    credit_balance: r.creditBalance,
    telemarketer_access: r.telemarketerAccess,
    telemarketer_id: r.telemarketerId ?? undefined,
    leads_access: r.leadsAccess,
    created_at: r.createdAt,
  };
}

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar ?? undefined,
    is_active: row.is_active,
    credit_balance: row.credit_balance ?? 0,
    telemarketer_access: row.telemarketer_access ?? false,
    telemarketer_id: row.telemarketer_id ?? undefined,
    leads_access: row.leads_access ?? true,
    created_at: row.created_at,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<User[]> {
  const res = await api.get<Page<ApiUser>>("/api/users", { page: 1, pageSize: 200 });
  return res.data.map(mapApiUser);
}

export async function fetchUserById(id: string): Promise<User> {
  const res = await api.get<Envelope<ApiUser>>(`/api/users/${id}`);
  return mapApiUser(res.data);
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const res = await api.patch<Envelope<ApiUser>>(`/api/users/${id}`, {
    name: payload.name,
    role: payload.role,
    is_active: payload.is_active,
    credit_balance: payload.credit_balance,
    telemarketer_access: payload.telemarketer_access,
    telemarketer_id: payload.telemarketer_id,
    leads_access: payload.leads_access,
  });
  return mapApiUser(res.data);
}

// ─── Onboarding / approval (backend API) ─────────────────────────────────────

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  requested_role: string | null;
  account_status: string;
  created_at: string;
}

interface ApiPendingUser {
  id: string;
  name: string;
  email: string;
  requestedRole: string | null;
  accountStatus: string;
  createdAt: string;
}

function mapPendingUser(r: ApiPendingUser): PendingUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    requested_role: r.requestedRole,
    account_status: r.accountStatus,
    created_at: r.createdAt,
  };
}

export async function fetchPendingUsers(): Promise<PendingUser[]> {
  const res = await api.get<Envelope<ApiPendingUser[]>>("/api/users/pending");
  return res.data.map(mapPendingUser);
}

export async function completeOnboarding(
  name: string,
  requestedRole: "ADVISER" | "TELEMARKETER",
): Promise<void> {
  await api.post("/api/users/onboarding", { name, requested_role: requestedRole });
}

export async function activateSuperAdmin(): Promise<void> {
  await api.post("/api/users/activate-super-admin");
}

export async function approveUser(id: string, role: User["role"]): Promise<void> {
  await api.post(`/api/users/${id}/approve`, { role });
}

export async function rejectUser(id: string): Promise<void> {
  await api.post(`/api/users/${id}/reject`);
}
