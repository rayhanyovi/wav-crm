/**
 * Typed application error hierarchy.
 *
 * Every error the API deliberately raises is an `AppError` carrying an HTTP
 * status, a stable machine-readable `code`, and an optional `details` payload.
 * The central error handler (src/middleware/errorHandler.ts) turns these into a
 * consistent JSON envelope. Anything that is NOT an AppError is treated as an
 * unexpected 500 and its message is hidden from clients in production.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  /** true → safe to expose `message` to the client. */
  readonly expose: boolean;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; expose?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.expose = options?.expose ?? true;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(400, "BAD_REQUEST", message, { details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(422, "VALIDATION", message, { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this resource") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, "CONFLICT", message, { details });
  }
}

/** Non-AppError thrown internally; never exposes its message in production. */
export class InternalError extends AppError {
  constructor(message = "Internal server error", cause?: unknown) {
    super(500, "INTERNAL", message, { expose: false, cause });
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
