import { z } from "zod";

const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "FOLLOW_UP"] as const;
const ACTIVITY_RESULTS = ["COMPLETED", "NO_ANSWER", "FOLLOW_UP_NEEDED", "MEETING_SCHEDULED"] as const;

const activityType = z.enum(ACTIVITY_TYPES);
const activityResult = z.enum(ACTIVITY_RESULTS);

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listQuerySchema = z.object({
  lead_id: z.string().optional(),
  deal_id: z.string().optional(),
  contact_id: z.string().optional(),
  type: activityType.optional(),
  calendar: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createActivitySchema = z.object({
  type: activityType,
  subject: z.string().trim().min(1, "subject is required").max(255),
  description: z.string().max(5000).optional(),
  result: activityResult.optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  completed_at: z.string().datetime({ offset: true }).optional(),
  lead_id: z.string().optional(),
  deal_id: z.string().optional(),
  contact_id: z.string().optional(),
  assigned_to_id: z.string().optional(),
});

export const updateActivitySchema = z
  .object({
    subject: z.string().trim().min(1).max(255),
    description: z.string().max(5000).nullish(),
    result: activityResult.nullish(),
    scheduled_at: z.string().datetime({ offset: true }).nullish(),
    completed_at: z.string().datetime({ offset: true }).nullish(),
    assigned_to_id: z.string().nullish(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Empty update payload" });

export const addCommentSchema = z.object({
  text: z.string().trim().min(1, "text is required").max(5000),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
