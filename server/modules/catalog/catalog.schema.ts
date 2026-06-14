import { z } from "zod";

export const fundsQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  sourceSheet: z.string().trim().min(1).max(80).optional(),
  insurer: z.string().trim().min(1).max(80).optional(),
  platform: z.string().trim().min(1).max(80).optional(),
  assetClass: z.string().trim().min(1).max(80).optional(),
  riskCategory: z.string().trim().min(1).max(40).optional(),
  riskRatings: z.string().trim().min(1).max(80).optional(),
  hasDividend: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

export const productsQuerySchema = z.object({
  active_only: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === undefined || v === true || v === "true"),
});

export type FundsQuery = z.infer<typeof fundsQuerySchema>;
export type ProductsQuery = z.infer<typeof productsQuerySchema>;
