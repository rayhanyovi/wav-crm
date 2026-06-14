import { z } from "zod";

const LEAD_SOURCES = ["AP_MARKETING", "LP_MARKETING", "OWN_SOURCE", "OTHERS"] as const;

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

export const createContactSchema = z.object({
  first_name: z.string().trim().min(1, "first_name is required").max(120),
  last_name: z.string().trim().max(120).default("-"),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  phone: z.string().trim().max(40).optional(),
  title: z.string().trim().max(120).optional(),
  source: z.enum(LEAD_SOURCES).default("OTHERS"),
  financial_goal: z
    .enum(["RETIREMENT", "EDUCATION", "WEALTH_GROWTH", "INCOME", "EMERGENCY_FUND", "OTHER"])
    .optional(),
  risk_tolerance: z.enum(["CONSERVATIVE", "MODERATE", "BALANCED", "GROWTH", "AGGRESSIVE"]).optional(),
  investment_horizon: z.enum(["SHORT", "MEDIUM", "LONG"]).optional(),
  monthly_investable: z.number().nonnegative().optional(),
  existing_investments: z.string().max(5000).optional(),
  fact_find_notes: z.string().max(5000).optional(),
  fact_find_done: z.boolean().optional(),
});

export const updateContactSchema = z
  .object({
    first_name: z.string().trim().min(1).max(120),
    last_name: z.string().trim().max(120),
    email: z.string().email().nullish(),
    phone: z.string().trim().max(40).nullish(),
    title: z.string().trim().max(120).nullish(),
    source: z.enum(LEAD_SOURCES),
    financial_goal: z
      .enum(["RETIREMENT", "EDUCATION", "WEALTH_GROWTH", "INCOME", "EMERGENCY_FUND", "OTHER"])
      .nullish(),
    risk_tolerance: z.enum(["CONSERVATIVE", "MODERATE", "BALANCED", "GROWTH", "AGGRESSIVE"]).nullish(),
    investment_horizon: z.enum(["SHORT", "MEDIUM", "LONG"]).nullish(),
    monthly_investable: z.number().nonnegative().nullish(),
    existing_investments: z.string().max(5000).nullish(),
    fact_find_notes: z.string().max(5000).nullish(),
    fact_find_done: z.boolean().nullish(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Empty update payload" });

export const addNoteSchema = z.object({
  content: z.string().trim().min(1, "content is required").max(5000),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
