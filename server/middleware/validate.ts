import type { RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { ValidationError } from "../lib/errors.js";

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function flatten(err: z.ZodError) {
  return err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * Validates and COERCES request parts against zod schemas. On success the parsed
 * (typed, defaulted) values replace the raw ones so handlers consume clean data.
 * On failure raises a single 422 with every issue listed.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // req.query is a getter-only in some Express versions — assign defensively.
        Object.assign(req.query, schemas.query.parse(req.query));
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new ValidationError("Request validation failed", flatten(err)));
        return;
      }
      next(err);
    }
  };
}
