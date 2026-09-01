import { describe, expect, it } from "vitest";
import { balanceUnits, canConsume, costPerTon, weightedAvgCostPerTon } from "./balance";

describe("balanceUnits", () => {
  it("subtracts consumed from received in exact units", () => {
    expect(balanceUnits("10.5", "3.25")).toBe(7250);
  });

  it("returns zero when fully consumed", () => {
    expect(balanceUnits("10.5", "10.5")).toBe(0);
  });

  it("is exact where float subtraction is not", () => {
    expect(balanceUnits("0.3", "0.1")).toBe(200);
  });
});

describe("canConsume", () => {
  it("allows less than the balance", () => {
    expect(canConsume("10", "3")).toBe(true);
  });

  it("allows exactly the balance — full conversion", () => {
    expect(canConsume("10.5", "10.5")).toBe(true);
  });

  it("rejects more than the balance", () => {
    expect(canConsume("10.5", "10.501")).toBe(false);
  });

  it("rejects any consumption against a zero balance", () => {
    expect(canConsume("0", "0.001")).toBe(false);
  });
});

describe("costPerTon", () => {
  it("divides cost by weight to 2 places", () => {
    expect(costPerTon("1000", "4")).toBe("250.00");
  });

  it("rounds to 2 places", () => {
    expect(costPerTon("1000", "3")).toBe("333.33");
  });

  it("throws on zero weight rather than producing Infinity", () => {
    expect(() => costPerTon("1000", "0")).toThrow(RangeError);
  });

  it("throws on negative weight", () => {
    expect(() => costPerTon("1000", "-2")).toThrow(RangeError);
  });
});

describe("weightedAvgCostPerTon", () => {
  it("weights by tonnage, not by receipt count", () => {
    // 1t at 100/t and 9t at 200/t -> 1900 total over 10t -> 190, not 150
    expect(weightedAvgCostPerTon("1900", "10")).toBe("190.00");
  });

  it("returns null for an empty set instead of NaN", () => {
    expect(weightedAvgCostPerTon("0", "0")).toBeNull();
  });
});
