import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Bypass real auth: inject a fixed actor so we test routing/validation/errors.
vi.mock("../middleware/auth.js", () => ({
  requireAuth: () => (req: { actor?: unknown }, _res: unknown, next: () => void) => {
    req.actor = { id: "u1", role: "MASTER", telemarketerAccess: true };
    next();
  },
  requireSession: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getActor: (req: { actor?: unknown }) => req.actor,
  supabaseJwtVerifier: {},
}));

// Control the service layer so we can assert HTTP behaviour in isolation.
vi.mock("../modules/leads/leads.service.js", () => ({
  listLeads: vi.fn(),
  getLead: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  softDeleteLead: vi.fn(),
}));

const { createApp } = await import("../app.js");
const service = await import("../modules/leads/leads.service.js");

const app = createApp();

beforeEach(() => vi.clearAllMocks());

describe("health", () => {
  it("GET /healthz → 200", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/leads", () => {
  it("returns 200 with the paginated payload", async () => {
    vi.mocked(service.listLeads).mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25 });
    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], total: 0, page: 1, pageSize: 25 });
  });

  it("rejects an invalid page with a 422 validation envelope", async () => {
    const res = await request(app).get("/api/leads?page=0");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});

describe("POST /api/leads", () => {
  it("rejects a body missing first_name with 422", async () => {
    const res = await request(app).post("/api/leads").send({ last_name: "X" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});

describe("error mapping", () => {
  it("maps a thrown NotFoundError to a 404 envelope", async () => {
    const { NotFoundError } = await import("../lib/errors.js");
    vi.mocked(service.getLead).mockRejectedValue(new NotFoundError("Lead not found"));
    const res = await request(app).get("/api/leads/abc");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", message: "Lead not found" });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("hides the message of an unexpected error behind a 500", async () => {
    vi.mocked(service.getLead).mockRejectedValue(new Error("secret db detail"));
    const res = await request(app).get("/api/leads/abc");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(res.body.error.message).toBe("Internal server error");
    expect(JSON.stringify(res.body)).not.toContain("secret db detail");
  });

  it("returns a 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
