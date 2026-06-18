import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import { canViewCatalog } from "./catalog.authz.js";

const actor = { id: "u1", role: "TELEMARKETER" } as unknown as Actor;

describe("catalog.authz", () => {
  it("lets any authenticated user browse the catalog", () => {
    expect(canViewCatalog(actor)).toBe(true);
  });
});
