import { z } from "zod";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createCallSessionSchema = z.object({
  id: z.string().min(1, "id is required"),
  started_at: z.string().datetime({ offset: true }),
  ended_at: z.string().datetime({ offset: true }).optional(),
  total_duration_seconds: z.number().int().min(0).default(0),
  calls_made: z.number().int().min(0).default(0),
  pickups: z.number().int().min(0).default(0),
  lead_ids: z.array(z.string()).default([]),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateCallSessionInput = z.infer<typeof createCallSessionSchema>;
