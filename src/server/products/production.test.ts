import { describe, it, expect } from "vitest";
import {
  computeWeightKg,
  computeConsumedTons,
  resolveWastePercent,
  isSystemManaged,
} from "./production";

describe("computeWeightKg", () => {
  it("computes grammage over area: 1000 m x 100 cm at 80 gsm is 80 kg", () => {
    expect(computeWeightKg("1000", "100", "80")).toBe("80.00");
  });

  it("halves the weight when the roll is half as wide", () => {
    expect(computeWeightKg("1000", "50", "80")).toBe("40.00");
  });

  it("returns 2 decimal places", () => {
    expect(computeWeightKg("123.45", "67.8", "90")).toBe("7.53");
  });

  it("rejects a non-positive dimension", () => {
    expect(() => computeWeightKg("0", "100", "80")).toThrow(RangeError);
    expect(() => computeWeightKg("1000", "-5", "80")).toThrow(RangeError);
  });

  it("rejects a non-positive gsm", () => {
    expect(() => computeWeightKg("1000", "100", "0")).toThrow(RangeError);
  });
});

describe("computeConsumedTons", () => {
  it("multiplies by quantity because weight is per roll", () => {
    expect(computeConsumedTons("80", 5, "0")).toBe("0.400");
  });

  it("adds the waste percentage on top", () => {
    expect(computeConsumedTons("80", 5, "5")).toBe("0.420");
  });

  it("treats zero waste as an exact conversion", () => {
    expect(computeConsumedTons("1000", 1, "0")).toBe("1.000");
  });

  it("returns 3 decimal places", () => {
    expect(computeConsumedTons("33.33", 3, "7.5")).toBe("0.107");
  });

  it("rejects a non-positive weight", () => {
    expect(() => computeConsumedTons("0", 1, "5")).toThrow(RangeError);
  });

  it("rejects a non-integer or non-positive quantity", () => {
    expect(() => computeConsumedTons("80", 0, "5")).toThrow(RangeError);
    expect(() => computeConsumedTons("80", 1.5, "5")).toThrow(RangeError);
  });

  it("rejects a negative waste percentage", () => {
    expect(() => computeConsumedTons("80", 1, "-1")).toThrow(RangeError);
  });
});

describe("resolveWastePercent", () => {
  it("prefers the material's own override", () => {
    expect(resolveWastePercent("12.5", 5)).toBe("12.50");
  });

  it("falls back to the global default when unset", () => {
    expect(resolveWastePercent(null, 5)).toBe("5.00");
  });

  it("treats an explicit zero override as a real value, not as unset", () => {
    expect(resolveWastePercent("0", 5)).toBe("0.00");
  });
});

describe("isSystemManaged", () => {
  it("is true for production-sourced rows", () => {
    expect(isSystemManaged("production")).toBe(true);
  });

  it("is false for hand-entered rows", () => {
    expect(isSystemManaged("manual")).toBe(false);
  });
});
