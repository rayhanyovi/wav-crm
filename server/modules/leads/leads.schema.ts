import { z } from "zod";

export const LEAD_STATUSES = [
  "NA",
  "APPOINTMENT",
  "NOT_INTERESTED",
  "AVOID",
  "KIV",
  "OTHERS",
  "COOLDOWN",
] as const;

export const LEAD_SOURCES = ["AP_MARKETING", "LP_MARKETING", "OWN_SOURCE", "OTHERS"] as const;

const leadStatus = z.enum(LEAD_STATUSES);
const leadSource = z.enum(LEAD_SOURCES);

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const listQuerySchema = z.object({
  status: leadStatus.optional(),
  source: leadSource.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  includeAbandoned: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createLeadSchema = z.object({
  first_name: z.string().trim().min(1, "first_name is required").max(120),
  last_name: z.string().trim().max(120).default("-"),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  phone: z.string().trim().max(40).optional(),
  source: leadSource.default("OTHERS"),
  status: leadStatus.default("NA"),
  notes: z.string().max(5000).optional(),
  assigned_to_id: z.string().optional(),
  // created_by is taken from the authenticated actor, never the client.
});

/**
 * Patch semantics: every field optional; only provided keys are written
 * (mirrors `rpc_update_lead`'s jsonb_populate_record merge). Fields the client
 * must never set directly (audit/ownership-derived) are intentionally omitted.
 */
export const updateLeadSchema = z
  .object({
    salutation: z.string().max(20).nullish(),
    first_name: z.string().trim().min(1).max(120),
    last_name: z.string().trim().max(120),
    email: z.string().email().nullish(),
    phone: z.string().trim().max(40).nullish(),
    age: z.number().int().min(0).max(150).nullish(),
    gender: z.string().max(20).nullish(),
    status: leadStatus,
    source: leadSource,
    notes: z.string().max(5000).nullish(),
    appointment_date: z.string().max(40).nullish(),
    appointment_time: z.string().max(40).nullish(),
    assigned_to_id: z.string().nullish(),
    telemarketer_owner_id: z.string().nullish(),
    adviser_owner_id: z.string().nullish(),
    bounce_count: z.number().int().min(0).nullish(),
    converted_contact_id: z.string().nullish(),
    fact_find_done: z.boolean().nullish(),
    fact_find_notes: z.string().max(5000).nullish(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Empty update payload" });

/** Body for POST /leads/:id/convert — moves a lead to APPOINTMENT. */
export const convertLeadSchema = z.object({
  appointment_date: z.string().min(1, "appointment_date is required"),
  appointment_time: z.string().optional(),
  contact_id: z.string().optional(), // pre-existing contact to link; omit to create a new one
  // Contact fields — used when contact_id is absent (new contact is created)
  first_name: z.string().trim().min(1).max(120).optional(),
  last_name: z.string().trim().max(120).optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().max(5000).optional(),
});

/** Body for POST /leads/claim-for-call — batch-claim leads into a TM session. */
export const claimForCallSchema = z.object({
  count: z.number().int().min(1).max(50).default(15),
});

/** Body for POST /leads/:id/notes */
export const addNoteSchema = z.object({
  content: z.string().trim().min(1, "content is required").max(5000),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type ClaimForCallInput = z.infer<typeof claimForCallSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
