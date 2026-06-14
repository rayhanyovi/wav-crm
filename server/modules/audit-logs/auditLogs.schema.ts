import { z } from "zod";

export const listQuerySchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  user_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
