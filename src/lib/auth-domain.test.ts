import { describe, it, expect } from "vitest";
import {
  isAllowedRegistrationEmail,
  isSuperAdminEmail,
  normalizeEmail,
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
    expect(isAllowedRegistrationEmail(`alice@${ALLOWED_REGISTRATION_DOMAIN}`)).toBe(true);
    expect(isAllowedRegistrationEmail("Bob.Smith@SG-Alliance.com")).toBe(true);
  });

  it("allows the single super-admin exception", () => {
    expect(isAllowedRegistrationEmail("tech@wav.sg")).toBe(true);
  });

  it("allows explicitly whitelisted test emails", () => {
    for (const email of ALLOWED_TEST_EMAILS) {
      expect(isAllowedRegistrationEmail(email)).toBe(true);
    }
    // Spot-check: yovihan@gmail.com is the current test account
    expect(isAllowedRegistrationEmail("yovihan@gmail.com")).toBe(true);
  });

  it("rejects other domains, including look-alikes", () => {
    expect(isAllowedRegistrationEmail("eve@wav.sg")).toBe(false);
    expect(isAllowedRegistrationEmail("eve@gmail.com")).toBe(false);
    // suffix tricks must not pass
    expect(isAllowedRegistrationEmail("eve@evilsg-alliance.com")).toBe(false);
    expect(isAllowedRegistrationEmail("eve@sg-alliance.com.evil.com")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isAllowedRegistrationEmail("")).toBe(false);
    expect(isAllowedRegistrationEmail("not-an-email")).toBe(false);
    expect(isAllowedRegistrationEmail("@sg-alliance.com")).toBe(false);
    expect(isAllowedRegistrationEmail("user@")).toBe(false);
  });
});
