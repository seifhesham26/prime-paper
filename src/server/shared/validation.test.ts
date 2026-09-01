import { describe, expect, it } from "vitest";
import { decimalString, toUnits } from "./validation";

describe("toUnits", () => {
  it("scales a decimal string to an exact integer", () => {
    expect(toUnits("10.5", 3)).toBe(10500);
    expect(toUnits("0.001", 3)).toBe(1);
    expect(toUnits("7", 2)).toBe(700);
  });

  it("does not accumulate float error", () => {
    expect(toUnits("0.1", 3) + toUnits("0.2", 3)).toBe(toUnits("0.3", 3));
  });

  it("truncates beyond the given scale", () => {
    expect(toUnits("1.2349", 3)).toBe(1234);
  });
});

describe("decimalString", () => {
  const weight = decimalString({ scale: 3, min: 0, minExclusive: true });
  const money = decimalString({ scale: 2, min: 0 });

  it("accepts well-formed numbers", () => {
    expect(weight.safeParse("10.5").success).toBe(true);
    expect(money.safeParse("0").success).toBe(true);
    expect(money.safeParse("1200.75").success).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(money.safeParse("abc").success).toBe(false);
    expect(money.safeParse("").success).toBe(false);
    expect(money.safeParse("12abc").success).toBe(false);
  });

  it("rejects negatives when min is 0", () => {
    expect(money.safeParse("-5").success).toBe(false);
  });

  it("rejects zero when minExclusive", () => {
    expect(weight.safeParse("0").success).toBe(false);
    expect(weight.safeParse("0.001").success).toBe(true);
  });

  it("rejects more decimal places than the column allows", () => {
    expect(money.safeParse("1.234").success).toBe(false);
    expect(weight.safeParse("1.2345").success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(money.safeParse("  12.50  ").success).toBe(true);
  });
});
