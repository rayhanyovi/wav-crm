import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import "./middleware/context.js"; // augments Express.Request
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { leadsRouter } from "./modules/leads/leads.routes.js";
import { dealsRouter } from "./modules/deals/deals.routes.js";
import { contactsRouter } from "./modules/contacts/contacts.routes.js";
import { activitiesRouter } from "./modules/activities/activities.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { callSessionsRouter } from "./modules/call-sessions/callSessions.routes.js";
import { fundsRouter, productsRouter, bundlesRouter } from "./modules/catalog/catalog.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { auditLogsRouter } from "./modules/audit-logs/auditLogs.routes.js";
import { scriptsRouter } from "./modules/scripts/scripts.routes.js";

// Global rate limiter: 200 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tight limiter for auth-adjacent mutation endpoints (claim, release, stage)
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const httpLogger = pinoHttp({
  autoLogging: { ignore: (req) => req.url === "/api/health" },
  customProps: (req) => ({ requestId: (req as express.Request).requestId }),
  quietReqLogger: true,
});

/**
 * Builds the Express app. Exported separately from the server bootstrap so tests
 * (supertest) can mount it without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(globalLimiter);

  // Correlation id on every request, echoed in error envelopes.
  app.use((req, res, next) => {
    const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    req.requestId = id;
    res.setHeader("x-request-id", id);
    next();
  });

  app.use(httpLogger);

  app.use("/", healthRouter);
  app.use("/api/leads/claim", mutationLimiter);
  app.use("/api/leads/return", mutationLimiter);
  app.use("/api/leads", leadsRouter);
  app.use(/^\/api\/deals\/[^/]+\/(claim|release|stage)$/, mutationLimiter);
  app.use("/api/deals", dealsRouter);
  app.use("/api/contacts", contactsRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/call-sessions", callSessionsRouter);
  app.use("/api/funds", fundsRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/bundles", bundlesRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/audit-logs", auditLogsRouter);
  app.use("/api/scripts", scriptsRouter);

  // 404 for unmatched routes, then the central error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
