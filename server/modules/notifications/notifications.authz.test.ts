import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import { canAccessNotifications } from "./notifications.authz.js";

const actor = { id: "u1", role: "ADVISER" } as unknown as Actor;

describe("notifications.authz", () => {
  it("lets a user access their own notifications", () => {
    expect(canAccessNotifications(actor)).toBe(true);
  });
});
