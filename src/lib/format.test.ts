import { describe, expect, it } from "vitest";
import { formatDecimal, localeTag, toDateInputValue } from "./format";

describe("localeTag", () => {
  it("maps ar to the Egyptian tag", () => {
    expect(localeTag("ar")).toBe("ar-EG");
  });

  it("maps en to the US tag", () => {
    expect(localeTag("en")).toBe("en-US");
  });

  it("falls back to en-US for an unknown locale", () => {
    expect(localeTag("fr")).toBe("en-US");
  });
});

describe("formatDecimal", () => {
  it("accepts the strings Drizzle returns for decimal columns", () => {
    expect(formatDecimal("1234.5", "en")).toBe("1,234.5");
  });

  it("accepts numbers too", () => {
    expect(formatDecimal(1234.5, "en")).toBe("1,234.5");
  });

  it("renders an em dash rather than NaN for a non-numeric value", () => {
    expect(formatDecimal("", "en")).toBe("—");
    expect(formatDecimal("abc", "en")).toBe("—");
  });

  it("renders zero as zero, not as the empty placeholder", () => {
    expect(formatDecimal("0", "en")).toBe("0");
  });
});

describe("toDateInputValue", () => {
  it("uses local calendar date, not UTC", () => {
    // 01:30 on the 2nd in UTC+3 is still 22:30 on the 1st in UTC.
    // toISOString would report the 1st; the date input must show the 2nd.
    const d = new Date(2026, 8, 2, 1, 30);
    expect(toDateInputValue(d)).toBe("2026-09-02");
  });

  it("zero-pads month and day", () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
