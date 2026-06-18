import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage/client",
      // Pure-logic modules. UI/network/store-coupled code (components, pages,
      // api/supabase clients, zustand stores, thin service mappers) is exercised
      // via the Playwright e2e suite instead.
      include: [
        "src/lib/auth-domain.ts",
        "src/lib/dealAssignment.ts",
        "src/lib/permissions.ts",
        "src/lib/format.ts",
        "src/lib/selectors.ts",
        "src/lib/factFind.ts",
        "src/services/users.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
    // Dummy values so modules that construct the Supabase client at import
    // time don't throw during unit tests.
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
