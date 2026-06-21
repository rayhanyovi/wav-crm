import { describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: apiMock,
  asNumber: (v: unknown) => (v == null ? undefined : Number(v)),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { bulkCreateLeads, type CreateLeadPayload } from "./leads";

function payload(first_name: string): CreateLeadPayload {
  return { first_name, last_name: "-", status: "NA", source: "OTHERS", created_by: "u1" } as CreateLeadPayload;
}

// api.post resolves to an Envelope { data: ApiLead }; only firstName is read back here.
function ok(first_name: string) {
  return { data: { id: `id-${first_name}`, firstName: first_name, lastName: "-", status: "NA", source: "OTHERS", createdBy: "u1", createdAt: "", updatedAt: "" } };
}

describe("bulkCreateLeads", () => {
  it("creates every lead when all succeed (more than one batch)", async () => {
    apiMock.post.mockImplementation((...args: unknown[]) => {
      const body = args[1] as { first_name: string };
      return Promise.resolve(ok(body.first_name));
    });
    const leads = Array.from({ length: 17 }, (_, i) => payload(`L${i}`));

    const res = await bulkCreateLeads(leads);

    expect(res.created).toHaveLength(17);
    expect(res.failed).toHaveLength(0);
    expect(res.created.map((l) => l.first_name).sort()).toEqual(leads.map((l) => l.first_name).sort());
  });

  it("does not let one failure discard the rest of the batch", async () => {
    apiMock.post.mockImplementation((...args: unknown[]) => {
      const body = args[1] as { first_name: string };
      return body.first_name === "L2"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve(ok(body.first_name));
    });
    const leads = Array.from({ length: 6 }, (_, i) => payload(`L${i}`));

    const res = await bulkCreateLeads(leads);

    // L2 fails on both the initial pass and the retry pass.
    expect(res.created).toHaveLength(5);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].error).toBe("boom");
    expect(res.failed[0].payload.first_name).toBe("L2");
  });

  it("retries transient failures and recovers them", async () => {
    let firstAttempt = true;
    apiMock.post.mockImplementation((...args: unknown[]) => {
      const body = args[1] as { first_name: string };
      if (body.first_name === "L1" && firstAttempt) {
        firstAttempt = false;
        return Promise.reject(new Error("pool timeout"));
      }
      return Promise.resolve(ok(body.first_name));
    });
    const leads = Array.from({ length: 3 }, (_, i) => payload(`L${i}`));

    const res = await bulkCreateLeads(leads);

    expect(res.created).toHaveLength(3);
    expect(res.failed).toHaveLength(0);
  });
});
