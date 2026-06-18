import type { User } from "@/data/types";

export const DEV_AUTH_ENABLED = import.meta.env.VITE_DEV_AUTH_ENABLED === "true";
export const DEV_AUTH_USER_KEY = "crm-dev-user-id";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface DevAuthProfile {
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

interface DevAuthEnvelope<T> {
  data: T;
}

export function getDevAuthUserId(): string | null {
  if (!DEV_AUTH_ENABLED) return null;
  return window.localStorage.getItem(DEV_AUTH_USER_KEY);
}

export function setDevAuthUserId(id: string): void {
  window.localStorage.setItem(DEV_AUTH_USER_KEY, id);
}

export function clearDevAuthUserId(): void {
  window.localStorage.removeItem(DEV_AUTH_USER_KEY);
}

export function mapDevAuthProfile(profile: DevAuthProfile): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    avatar: profile.avatar ?? undefined,
    is_active: profile.is_active,
    credit_balance: profile.credit_balance ?? 0,
    telemarketer_access: profile.telemarketer_access ?? false,
    telemarketer_id: profile.telemarketer_id ?? undefined,
    leads_access: profile.leads_access ?? true,
    created_at: profile.created_at,
  };
}

async function devFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  const json = (await res.json()) as DevAuthEnvelope<T> & { message?: string };
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return json.data;
}

export async function fetchDevAuthUsers(): Promise<User[]> {
  const profiles = await devFetch<DevAuthProfile[]>("/api/dev-auth/users");
  return profiles.map(mapDevAuthProfile);
}

export async function fetchDevAuthUser(id: string): Promise<User> {
  const profile = await devFetch<DevAuthProfile>(`/api/dev-auth/users/${encodeURIComponent(id)}`);
  return mapDevAuthProfile(profile);
}
