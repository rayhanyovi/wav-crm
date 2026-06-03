// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'MASTER' | 'ADVISER' | 'TELEMARKETER';

export type LeadStatus = 'NA' | 'APPOINTMENT' | 'NOT_INTERESTED' | 'AVOID' | 'KIV' | 'OTHERS';
export type LeadSource = 'AP_MARKETING' | 'LP_MARKETING' | 'OWN_SOURCE' | 'OTHERS';

// WAV deal pipeline:
//   CALLING     — telemarketer is cold-calling (telemarketer-only view)
//   APPOINTMENT — appointment set; adviser steps in from here
//   PROPOSAL    — adviser has presented fund proposal(s)
//   SUBMITTED   — client agreed; application submitted to insurer
//   WON         — insurer confirmed; policy active
//   LOST        — dropped / not interested at any stage
export type DealStage = 'CALLING' | 'APPOINTMENT' | 'PROPOSAL' | 'SUBMITTED' | 'WON' | 'LOST';

// Fact-find fields collected by adviser after first meeting
export type FinancialGoal = 'RETIREMENT' | 'EDUCATION' | 'WEALTH_GROWTH' | 'INCOME' | 'EMERGENCY_FUND' | 'OTHER';
export type RiskTolerance = 'CONSERVATIVE' | 'MODERATE' | 'BALANCED' | 'GROWTH' | 'AGGRESSIVE';
export type InvestmentHorizon = 'SHORT' | 'MEDIUM' | 'LONG'; // SHORT <3yr, MEDIUM 3-7yr, LONG 7yr+

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE' | 'FOLLOW_UP';
export type ActivityResult = 'COMPLETED' | 'NO_ANSWER' | 'FOLLOW_UP_NEEDED' | 'MEETING_SCHEDULED' | 'CANCELLED' | 'FAILED';

export type AppointmentResult = 'MET' | 'NO_SHOW' | 'RESCHEDULED' | 'CANCELLED';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STAGE_CHANGE' | 'ASSIGNMENT_CHANGE' | 'STATUS_CHANGE' | 'CONVERSION' | 'ARCHIVE';

export type CreditAction = 'RETURN' | 'CLAIM' | 'ADMIN_ASSIGN';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  is_active: boolean;
  // Lead buy-back credit system
  credit_balance?: number;
  // Telemarketer access toggle
  telemarketer_access?: boolean;
  telemarketer_id?: string;
  created_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  source?: LeadSource;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface StatusHistoryEntry {
  status: LeadStatus;
  changed_at: string;
  changed_by: string;
  note?: string;
}

export interface Lead {
  id: string;
  // Name
  salutation?: string;
  first_name: string;
  last_name: string;
  // Contact
  email?: string;
  phone?: string;
  // Demographics (from Excel migration)
  age?: number;
  gender?: string;
  residential_status?: string;
  income_range?: string;
  zipcode?: string;
  // Classification
  source: LeadSource;
  status: LeadStatus;
  // Client profile (Task #13)
  personality?: string;
  preferred_contact_method?: string;
  best_time_to_call?: string;
  // Notes — legacy single field + running log via LeadNote
  notes?: string;
  // Appointment fields (Task #4)
  appointment_date?: string;
  appointment_time?: string;
  appointment_result?: AppointmentResult;
  // Status history auto-timestamps (Task #3)
  status_history?: StatusHistoryEntry[];
  // Abandon (Task #5)
  is_abandoned?: boolean;
  abandoned_at?: string;
  // Others free-text (Task #6)
  other_status_note?: string;
  // Products discussed (Task #12)
  products_discussed?: string[];  // array of product IDs from atlas
  // Ownership
  assigned_to_id?: string;
  telemarketer_owner_id?: string;
  adviser_owner_id?: string;
  bounce_count?: number;
  last_bounced_at?: string;    // set whenever NO_SHOW resets the lead; used to sort TM queue
  converted_contact_id?: string;
  converted_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;           // total investment value (SGD)
  stage: DealStage;
  lead_id?: string;        // source lead
  contact_id: string;      // converted contact (may be same as lead initially)
  telemarketer_id?: string; // who cold-called this lead
  assigned_to_id?: string;  // adviser handling the deal
  expected_close_date?: string;
  lost_reason?: string;
  closed_at?: string;
  // Adviser handoff: insurer submission details (filled when moving to SUBMITTED)
  insurer?: string;
  insurer_ref?: string;
  submitted_at?: string;
  policy_number?: string;   // filled when WON
  // Fact-find — filled by adviser after first meeting
  financial_goal?: FinancialGoal;
  risk_tolerance?: RiskTolerance;
  investment_horizon?: InvestmentHorizon;
  monthly_investable?: number;      // SGD per month client can invest
  existing_investments?: string;    // free text: what they already hold
  fact_find_notes?: string;         // adviser's notes from fact-find session
  fact_find_done?: boolean;         // whether fact-find is complete
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ─── Deal Proposals (fund allocation plans per deal) ──────────────────────────
export type DealProposalStatus = 'DRAFT' | 'PRESENTED' | 'ACCEPTED' | 'REJECTED';

export interface DealProposalLine {
  id: string;
  fund_isin: string;
  fund_name: string;
  risk_rating: number;
  allocation_pct: number; // 0–100
}

export interface DealProposal {
  id: string;
  deal_id: string;
  name: string;                     // e.g. "Conservative Plan", "Growth Plan"
  status: DealProposalStatus;
  total_value: number;              // SGD
  notes?: string;
  lines: DealProposalLine[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StageHistoryEntry {
  id: string;
  deal_id: string;
  from_stage: DealStage | null;
  to_stage: DealStage;
  changed_by: string;
  note?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  description?: string;
  result?: ActivityResult;
  scheduled_at?: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
  deal_id?: string;
  contact_id?: string;
  lead_id?: string;
  assigned_to_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Comment {
  id: string;
  activity_id: string;
  text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  ticker: string;
  description?: string;
  category: string;
  risk_score: number;
  annual_return?: number;
  market_cap?: string;
  is_active: boolean;
  created_at: string;
}

export interface Bundle {
  id: string;
  name: string;
  description?: string;
  product_ids: string[];
  allocations?: Record<string, number>;
  risk_score: number;
  is_active: boolean;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  lead_id?: string;
  action: CreditAction;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CallSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  total_duration_seconds: number;
  calls_made: number;
  pickups: number;
  lead_ids: string[];
}
