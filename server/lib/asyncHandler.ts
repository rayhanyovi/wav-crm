import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so any thrown error (including rejected promises)
 * is forwarded to Express's error pipeline instead of crashing the process.
 * Without this, an `await` that rejects in a handler becomes an unhandled
 * rejection rather than a clean 500.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
