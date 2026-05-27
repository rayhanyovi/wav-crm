// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES' | 'VIEWER';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type LeadSource = 'WEBSITE' | 'REFERRAL' | 'COLD_CALL' | 'SOCIAL_MEDIA' | 'EVENT' | 'ADVERTISEMENT' | 'OTHER';

export type DealStage = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE' | 'DEMO' | 'FOLLOW_UP';
export type ActivityResult = 'COMPLETED' | 'NO_ANSWER' | 'FOLLOW_UP_NEEDED' | 'MEETING_SCHEDULED' | 'DEAL_ADVANCED' | 'CANCELLED' | 'FAILED';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type CampaignType = 'PRODUCT' | 'BUNDLE' | 'MIXED';
export type CampaignOfferKind = 'PRODUCT' | 'BUNDLE';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STAGE_CHANGE' | 'ASSIGNMENT_CHANGE' | 'STATUS_CHANGE' | 'CONVERSION' | 'ARCHIVE';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  is_active: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  company_id?: string;
  source?: LeadSource;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  company_id?: string;
  assigned_to_id?: string;
  converted_contact_id?: string;
  converted_at?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  contact_id: string;
  company_id?: string;
  lead_id?: string;
  assigned_to_id?: string;
  expected_close_date?: string;
  lost_reason?: string;
  closed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
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
  campaign_id?: string;
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
  risk_score: number; // 1–10: 1=very low, 10=very high
  annual_return?: number; // % e.g. 18.5
  market_cap?: string; // e.g. "Large Cap"
  is_active: boolean;
  created_at: string;
}

export interface Bundle {
  id: string;
  name: string;
  description?: string;
  product_ids: string[];
  allocations?: Record<string, number>; // product_id → weight % (must sum to 100)
  risk_score: number; // weighted avg of component risk_scores
  is_active: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  product_id?: string;
  bundle_id?: string;
  offer_items?: CampaignOfferItem[];
  status: CampaignStatus;
  start_date?: string;
  end_date?: string;
  target_count?: number;
  script?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignOfferItem {
  kind: CampaignOfferKind;
  id: string;
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
  campaign_id: string;
  started_at: string;
  ended_at?: string;
  total_duration_seconds: number;
  calls_made: number;
  pickups: number;
  lead_ids: string[];
}
