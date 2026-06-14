import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["MASTER", "ADVISER", "TELEMARKETER"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
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

/** Body for POST /users/:id/approve — MASTER assigns a role and activates. */
export const approveUserSchema = z.object({
  role: z.enum(["MASTER", "ADVISER", "TELEMARKETER"]),
});

/** Body for POST /users/onboarding — a signed-in user finishes their own profile. */
export const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  requested_role: z.enum(["ADVISER", "TELEMARKETER"]),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ApproveUserInput = z.infer<typeof approveUserSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
