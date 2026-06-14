import { z } from "zod";

export const createCallSessionSchema = z.object({
  id: z.string().min(1, "id is required"),
  started_at: z.string().datetime({ offset: true }),
  ended_at: z.string().datetime({ offset: true }).optional(),
  total_duration_seconds: z.number().int().min(0).default(0),
  calls_made: z.number().int().min(0).default(0),
  pickups: z.number().int().min(0).default(0),
  lead_ids: z.array(z.string()).default([]),
});

export type CreateCallSessionInput = z.infer<typeof createCallSessionSchema>;
