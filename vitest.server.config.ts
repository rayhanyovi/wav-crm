import { defineConfig } from "vitest/config";

/**
 * Backend test config — kept separate from the frontend `vitest.config.ts`
 * (which globs `src/**`). Run with `npm run test:server`.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["server/**/*.test.ts"],
    setupFiles: ["server/tests/setup.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage/server",
      // Broadened to all module business logic (services, authz, side-effects).
      // Thin glue (controllers/routes/schema) is exercised via app.routes.test.ts
      // and intentionally not measured here.
      include: [
        "server/modules/**/*.service.ts",
        "server/modules/**/*.authz.ts",
        "server/modules/**/*.sideEffects.ts",
      ],
      // Trivial 2-line re-export stubs with no testable logic.
      exclude: [
        "server/modules/audit-logs/auditLogs.sideEffects.ts",
        "server/modules/notifications/notifications.sideEffects.ts",
        "server/modules/catalog/catalog.sideEffects.ts",
        "server/modules/call-sessions/callSessions.sideEffects.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 75,
        statements: 90,
      },
    },
  },
});
