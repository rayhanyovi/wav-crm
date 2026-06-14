import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createScriptSchema = z.object({
  title:   z.string().min(1).max(200),
  content: z.string().default(""),
});

export const updateScriptSchema = z.object({
  title:   z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

export type CreateScriptInput = z.infer<typeof createScriptSchema>;
export type UpdateScriptInput = z.infer<typeof updateScriptSchema>;
