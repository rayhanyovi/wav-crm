import { z } from "zod";

export const DEAL_STAGES = ["CALLING", "APPOINTMENT", "PROPOSAL", "SUBMITTED", "WON", "LOST"] as const;
export const PROPOSAL_STATUSES = ["DRAFT", "PRESENTED", "ACCEPTED", "REJECTED"] as const;

const dealStage = z.enum(DEAL_STAGES);
const proposalStatus = z.enum(PROPOSAL_STATUSES);

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const proposalParamSchema = z.object({
  id: z.string().min(1),
  proposalId: z.string().min(1),
});

export const lineParamSchema = z.object({
  id: z.string().min(1),
  proposalId: z.string().min(1),
  lineId: z.string().min(1),
});

export const listQuerySchema = z.object({
  stage: dealStage.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createDealSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(255),
  value: z.number().nonnegative().optional(),
  contact_id: z.string().min(1, "contact_id is required"),
  lead_id: z.string().optional(),
  telemarketer_id: z.string().optional(),
  // assigned_to_id is derived from actor for ADVISER; MASTER may pass it explicitly
  assigned_to_id: z.string().optional(),
});

export const updateDealSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    value: z.number().nonnegative().nullish(),
    expected_close_date: z.string().max(40).nullish(),
    financial_goal: z
      .enum(["RETIREMENT", "EDUCATION", "WEALTH_GROWTH", "INCOME", "EMERGENCY_FUND", "OTHER"])
      .nullish(),
    risk_tolerance: z
      .enum(["CONSERVATIVE", "MODERATE", "BALANCED", "GROWTH", "AGGRESSIVE"])
      .nullish(),
    investment_horizon: z.enum(["SHORT", "MEDIUM", "LONG"]).nullish(),
    monthly_investable: z.number().nonnegative().nullish(),
    existing_investments: z.string().max(5000).nullish(),
    fact_find_notes: z.string().max(5000).nullish(),
    fact_find_done: z.boolean().nullish(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Empty update payload" });

export const stageTransitionSchema = z.object({
  to_stage: dealStage,
  note: z.string().max(5000).optional(),
  // Conditionally required depending on the target stage — validated in service.
  lost_reason: z.string().max(1000).optional(),
  insurer: z.string().max(120).optional(),
  insurer_ref: z.string().max(120).optional(),
  policy_number: z.string().max(120).optional(),
});

export const createProposalSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  notes: z.string().max(5000).optional(),
});

export const updateProposalSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    status: proposalStatus,
    notes: z.string().max(5000).nullish(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Empty update payload" });

export const addProposalLineSchema = z.object({
  fund_isin: z.string().trim().min(1).max(20),
  fund_name: z.string().trim().min(1).max(255),
  risk_rating: z.number().int().min(1).max(10),
  allocation_pct: z.number().min(0).max(100),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type AddProposalLineInput = z.infer<typeof addProposalLineSchema>;
