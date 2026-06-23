import { describe, it, expect } from "vitest";
import {
  allowsAnyRegistrationEmail,
  isAllowedRegistrationEmail,
  isSuperAdminEmail,
  normalizeEmail,
  normalizeRegistrationEmailPolicy,
  ALLOWED_REGISTRATION_DOMAIN,
  ALLOWED_TEST_EMAILS,
  SUPER_ADMIN_EMAIL,
} from "./auth-domain";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@SG-Alliance.com  ")).toBe("foo@sg-alliance.com");
  });
});

describe("isSuperAdminEmail", () => {
  it("matches the super admin regardless of case/whitespace", () => {
    expect(isSuperAdminEmail(SUPER_ADMIN_EMAIL)).toBe(true);
    expect(isSuperAdminEmail("  TECH@WAV.SG ")).toBe(true);
  });
  it("rejects anyone else", () => {
    expect(isSuperAdminEmail("tech@sg-alliance.com")).toBe(false);
    expect(isSuperAdminEmail("hacker@wav.sg")).toBe(false);
  });
});

describe("isAllowedRegistrationEmail", () => {
  it("allows the company domain", () => {
    expect(isAllowedRegistrationEmail(`alice@${ALLOWED_REGISTRATION_DOMAIN}`, "company")).toBe(true);
    expect(isAllowedRegistrationEmail("Bob.Smith@SG-Alliance.com", "company")).toBe(true);
  });

  it("allows the single super-admin exception", () => {
    expect(isAllowedRegistrationEmail("tech@wav.sg", "company")).toBe(true);
  });

  it("allows explicitly whitelisted test emails", () => {
    for (const email of ALLOWED_TEST_EMAILS) {
      expect(isAllowedRegistrationEmail(email, "company")).toBe(true);
    }
    // Spot-check: yovihan@gmail.com is the current test account
    expect(isAllowedRegistrationEmail("yovihan@gmail.com", "company")).toBe(true);
  });

  it("rejects other domains in company policy, including look-alikes", () => {
    expect(isAllowedRegistrationEmail("eve@wav.sg", "company")).toBe(false);
    expect(isAllowedRegistrationEmail("eve@gmail.com", "company")).toBe(false);
    // suffix tricks must not pass
    expect(isAllowedRegistrationEmail("eve@evilsg-alliance.com", "company")).toBe(false);
    expect(isAllowedRegistrationEmail("eve@sg-alliance.com.evil.com", "company")).toBe(false);
  });

  it("allows any valid email in staging-style any policy", () => {
    expect(isAllowedRegistrationEmail("eve@wav.sg", "any")).toBe(true);
    expect(isAllowedRegistrationEmail("eve@gmail.com", "any")).toBe(true);
    expect(isAllowedRegistrationEmail("Bob.Smith@Example.test", "any")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isAllowedRegistrationEmail("", "any")).toBe(false);
    expect(isAllowedRegistrationEmail("not-an-email", "any")).toBe(false);
    expect(isAllowedRegistrationEmail("@sg-alliance.com", "any")).toBe(false);
    expect(isAllowedRegistrationEmail("user@", "any")).toBe(false);
  });
});

describe("registration email policy", () => {
  it("normalizes unknown values to the company policy", () => {
    expect(normalizeRegistrationEmailPolicy("any")).toBe("any");
    expect(normalizeRegistrationEmailPolicy(" ANY ")).toBe("any");
    expect(normalizeRegistrationEmailPolicy("staging")).toBe("company");
    expect(normalizeRegistrationEmailPolicy(undefined)).toBe("company");
  });

  it("reports whether any-email registration is enabled", () => {
    expect(allowsAnyRegistrationEmail("any")).toBe(true);
    expect(allowsAnyRegistrationEmail("company")).toBe(false);
  });
});
