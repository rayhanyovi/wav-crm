import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelative,
  formatDuration,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("renders a grouped IDR amount with no decimals", () => {
    expect(formatCurrency(1500000)).toMatch(/1[.,]500[.,]000/);
  });
});

describe("formatDate / formatDateTime", () => {
  it("returns an em-dash for empty or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("nope")).toBe("—");
  });

  it("formats valid ISO dates", () => {
    expect(formatDate("2026-07-01")).toMatch(/Jul 2026/);
    expect(formatDateTime("2026-07-01T09:30:00.000Z")).toMatch(/2026/);
  });
});

describe("formatRelative", () => {
  it("returns em-dash for bad input and a string for a real date", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative("bad")).toBe("—");
    expect(typeof formatRelative(new Date().toISOString())).toBe("string");
  });
});

describe("formatDuration", () => {
  it("formats seconds across s / m / h tiers", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3725)).toBe("1h 2m 5s");
  });
});
