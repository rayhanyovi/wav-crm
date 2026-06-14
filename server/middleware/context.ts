/**
 * The authenticated CRM user resolved from the bearer token, attached to every
 * authenticated request as `req.actor`. This is the app-layer equivalent of the
 * RLS helpers `get_crm_user_id()` / `get_crm_role()`.
 */
export type CrmRole = "MASTER" | "ADVISER" | "TELEMARKETER";

export interface Actor {
  /** crm_users.id (text) */
  id: string;
  /** auth.users.id (uuid) — the `sub` of the Supabase JWT */
  authUserId: string;
  email: string;
  role: CrmRole;
  isActive: boolean;
  creditBalance: number;
  telemarketerAccess: boolean;
  telemarketerId: string | null;
  leadsAccess: boolean;
  /**
   * Advisers that have delegated dealing access to this actor (a TELEMARKETER),
   * i.e. ADVISER rows with `telemarketerAccess` + `telemarketerId = actor.id`.
   * The TM may act on their behalf — book appointments assigned to them and
   * work their deals/proposals. Empty for non-TM actors.
   */
  delegatedAdviserIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present only after `requireAuth` runs. */
      actor?: Actor;
      /** Correlation id for logs/responses. */
      requestId?: string;
    }
  }
}

export {};
