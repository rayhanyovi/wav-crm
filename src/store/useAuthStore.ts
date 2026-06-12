import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/data/types";
import { supabase } from "@/lib/supabase";

export type AccountStatus =
  | "PENDING_PROFILE"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "REJECTED";

interface AuthProfileRow {
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

interface AuthState {
  /** Only set for fully ACTIVE, role-assigned users. */
  currentUser: User | null;
  /** Status of the signed-in auth user; null when there is no session. */
  accountStatus: AccountStatus | null;
  /** Email of the signed-in auth user (useful on pending/onboarding screens). */
  authEmail: string | null;
  /** Requested role captured during onboarding (for the pending screen). */
  requestedRole: string | null;
  /**
   * Set when a PENDING_PROFILE user already has a role + is_active=true
   * (i.e. a pre-configured master admin). OnboardingPage uses this to skip
   * the role-selection step and self-activate via activate_super_admin().
   */
  preConfiguredRole: User["role"] | null;
  authReady: boolean;
  login: (user: User) => void;
  loadSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export function mapAuthProfile(profile: AuthProfileRow): User {
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

const PROFILE_COLS =
  "id,name,email,role,avatar,is_active,credit_balance,telemarketer_access,telemarketer_id,leads_access,created_at,account_status,requested_role";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      accountStatus: null,
      authEmail: null,
      requestedRole: null,
      preConfiguredRole: null,
      authReady: false,
      login: (user) =>
        set({ currentUser: user, accountStatus: "ACTIVE", authEmail: user.email, preConfiguredRole: null }),
      loadSession: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData.session?.user;
        if (!authUser) {
          set({
            currentUser: null,
            accountStatus: null,
            authEmail: null,
            requestedRole: null,
            preConfiguredRole: null,
            authReady: true,
          });
          return;
        }

        const { data: profile, error } = await supabase
          .from("crm_users")
          .select(PROFILE_COLS)
          .eq("auth_user_id", authUser.id)
          .single();

        // No CRM row at all → genuinely invalid; sign out.
        if (error || !profile) {
          await supabase.auth.signOut();
          set({
            currentUser: null,
            accountStatus: null,
            authEmail: null,
            requestedRole: null,
            preConfiguredRole: null,
            authReady: true,
          });
          return;
        }

        const status = (profile.account_status as AccountStatus | null) ?? null;
        const email = profile.email ?? authUser.email ?? null;

        // Fully active, role-assigned users get a session as currentUser.
        if (status === "ACTIVE" && profile.is_active && profile.role) {
          set({
            currentUser: mapAuthProfile(profile as AuthProfileRow),
            accountStatus: "ACTIVE",
            authEmail: email,
            requestedRole: (profile.requested_role as string | null) ?? null,
            preConfiguredRole: null,
            authReady: true,
          });
          return;
        }

        // Pending / rejected users keep their session (needed for onboarding
        // and the pending screen) but are NOT granted currentUser access.
        // preConfiguredRole is set when the profile already has a role + is_active
        // (i.e. a pre-configured master admin awaiting password setup).
        const preConfiguredRole =
          status === "PENDING_PROFILE" && profile.is_active && profile.role
            ? (profile.role as User["role"])
            : null;

        set({
          currentUser: null,
          accountStatus: status,
          authEmail: email,
          requestedRole: (profile.requested_role as string | null) ?? null,
          preConfiguredRole,
          authReady: true,
        });
      },
      logout: async () => {
        await supabase.auth.signOut();
        set({
          currentUser: null,
          accountStatus: null,
          authEmail: null,
          requestedRole: null,
          preConfiguredRole: null,
          authReady: true,
        });
      },
    }),
    { name: "crm-auth-v1" }
  )
);
