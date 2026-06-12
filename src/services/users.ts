import { supabase } from "@/lib/supabase";
import type { User } from "@/data/types";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Mapper ───────────────────────────────────────────────────────────────────

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

const SELECT_COLS =
  "id,name,email,role,avatar,is_active,credit_balance,telemarketer_access,telemarketer_id,leads_access,created_at";

// ─── Service functions ────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("crm_users")
    .select(SELECT_COLS)
    .order("name");

  if (error) throw new Error(error.message);
  return (data as UserRow[]).map(mapUserRow);
}

export async function fetchUserById(id: string): Promise<User> {
  const { data, error } = await supabase
    .from("crm_users")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapUserRow(data as UserRow);
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const { data, error } = await supabase
    .from("crm_users")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return mapUserRow(data as UserRow);
}

// ─── Registration / onboarding / approval ──────────────────────────────────────

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  requested_role: string | null;
  account_status: string;
  created_at: string;
}

/** MASTER-only: users awaiting approval (RLS lets MASTER read all rows). */
export async function fetchPendingUsers(): Promise<PendingUser[]> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("id,name,email,requested_role,account_status,created_at")
    .in("account_status", ["PENDING_APPROVAL", "PENDING_PROFILE"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as PendingUser[]) ?? [];
}

/** Called by a PENDING_PROFILE user to submit name + requested role. */
export async function completeOnboarding(
  name: string,
  requestedRole: "ADVISER" | "TELEMARKETER",
): Promise<void> {
  const { error } = await supabase.rpc("complete_onboarding", {
    p_name: name,
    p_requested_role: requestedRole,
  });
  if (error) throw new Error(error.message);
}

/**
 * Called by the super admin (tech@wav.sg) after setting their password.
 * Skips the approval queue — activates the account immediately.
 */
export async function activateSuperAdmin(): Promise<void> {
  const { error } = await supabase.rpc("activate_super_admin");
  if (error) throw new Error(error.message);
}

/** MASTER-only: assign a role + activate a pending account. */
export async function approveUser(
  id: string,
  role: User["role"],
): Promise<void> {
  const { error } = await supabase.rpc("approve_user", {
    p_user_id: id,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

/** MASTER-only: reject a pending account. */
export async function rejectUser(id: string): Promise<void> {
  const { error } = await supabase.rpc("reject_user", { p_user_id: id });
  if (error) throw new Error(error.message);
}
