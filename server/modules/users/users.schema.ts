import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["MASTER", "ADVISER", "TELEMARKETER"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.enum(["MASTER", "ADVISER", "TELEMARKETER"]),
    is_active: z.boolean(),
    credit_balance: z.number().int().min(0),
    telemarketer_access: z.boolean(),
    telemarketer_id: z.string().nullish(),
    leads_access: z.boolean(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Empty update payload" });

export type ListQuery = z.infer<typeof listQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
