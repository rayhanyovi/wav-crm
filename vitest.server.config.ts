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
  },
});
