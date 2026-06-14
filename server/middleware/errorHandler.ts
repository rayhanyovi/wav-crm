import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { Prisma } from "../../prisma/generated/client/index.js";
import { AppError, NotFoundError, isAppError, type ErrorCode } from "../lib/errors.js";
import { isProd } from "../config/env.js";
import { logger } from "../lib/logger.js";

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Translate a raw thrown value into a normalised AppError. */
function normalise(err: unknown): AppError {
  if (isAppError(err)) return err;

  if (err instanceof z.ZodError) {
    return new AppError(422, "VALIDATION", "Request validation failed", {
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2025": // record not found for update/delete
        return new AppError(404, "NOT_FOUND", "Resource not found");
      case "P2002": // unique constraint violation
        return new AppError(409, "CONFLICT", "A record with these values already exists", {
          details: { target: err.meta?.target },
        });
      case "P2003": // FK constraint
        return new AppError(409, "CONFLICT", "Related record constraint failed");
      default:
        return new AppError(400, "BAD_REQUEST", "Database request error", {
          details: isProd ? undefined : { prismaCode: err.code },
        });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new AppError(400, "BAD_REQUEST", "Invalid database query");
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  return new AppError(500, "INTERNAL", message, { expose: false, cause: err });
}

/** Final Express error middleware — converts anything into the JSON envelope. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = normalise(err);

  if (appErr.status >= 500) {
    logger.error({ err: appErr, requestId: req.requestId, path: req.path }, "request failed");
  } else {
    logger.warn(
      { code: appErr.code, status: appErr.status, requestId: req.requestId, path: req.path },
      appErr.message,
    );
  }

  const body: ErrorBody = {
    error: {
      code: appErr.code,
      message: appErr.expose ? appErr.message : "Internal server error",
      requestId: req.requestId,
    },
  };
  if (appErr.details !== undefined && (appErr.expose || !isProd)) {
    body.error.details = appErr.details;
  }

  res.status(appErr.status).json(body);
};

/** Catches requests that matched no route. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
};
