import { describe, expect, it } from "vitest";
import { formatTimeForInputDisplay, parseTimeInput } from "@/lib/time";

describe("parseTimeInput", () => {
  it("accepts typed 12-hour and 24-hour appointment times", () => {
    expect(parseTimeInput("4:30 pm")).toBe("16:30");
    expect(parseTimeInput("430pm")).toBe("16:30");
    expect(parseTimeInput("4p")).toBe("16:00");
    expect(parseTimeInput("16:30")).toBe("16:30");
    expect(parseTimeInput("0830")).toBe("08:30");
  });

  it("handles noon, midnight, clearing, and invalid times", () => {
    expect(parseTimeInput("12am")).toBe("00:00");
    expect(parseTimeInput("12:15 PM")).toBe("12:15");
    expect(parseTimeInput("")).toBe("");
    expect(parseTimeInput("25:00")).toBeNull();
    expect(parseTimeInput("4:75 pm")).toBeNull();
  });
});

describe("formatTimeForInputDisplay", () => {
  it("formats canonical values for the editable text field", () => {
    expect(formatTimeForInputDisplay("16:30")).toBe("4:30 PM");
    expect(formatTimeForInputDisplay("00:00")).toBe("12:00 AM");
  });
});
