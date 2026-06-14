import { pino } from "pino";
import { env, isProd, isTest } from "../config/env.js";

export const logger = pino({
  level: isTest ? "silent" : isProd ? "info" : "debug",
  base: { service: "wav-crm-backend" },
  redact: {
    // Never log auth material.
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
    remove: true,
  },
  // Pretty transport only in local dev — never in prod (JSON logs) or test.
  transport:
    isProd || isTest
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});

logger.debug({ env: env.NODE_ENV, port: env.PORT }, "logger initialised");
