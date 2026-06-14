import express, { type Express } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import "./middleware/context.js"; // augments Express.Request
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { leadsRouter } from "./modules/leads/leads.routes.js";

/**
 * Builds the Express app. Exported separately from the server bootstrap so tests
 * (supertest) can mount it without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  // Correlation id on every request, echoed in error envelopes.
  app.use((req, res, next) => {
    const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    req.requestId = id;
    res.setHeader("x-request-id", id);
    next();
  });

  app.use("/", healthRouter);
  app.use("/api/leads", leadsRouter);

  // 404 for unmatched routes, then the central error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
