// Runs before any test module is imported, so config/env.ts validates cleanly.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-value";
process.env.CORS_ORIGINS ??= "http://localhost:5173";
