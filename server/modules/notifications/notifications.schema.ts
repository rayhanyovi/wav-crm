import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listQuerySchema = z.object({
  unread_only: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
