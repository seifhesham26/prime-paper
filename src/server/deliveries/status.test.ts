import { describe, expect, it } from "vitest";
import { derivePaymentStatus, outstandingFor } from "./status";

describe("derivePaymentStatus", () => {
  it("is unpaid when nothing has been paid", () => {
    expect(derivePaymentStatus("0", "1000")).toBe("unpaid");
  });

  it("is partial between zero and the full price", () => {
    expect(derivePaymentStatus("400", "1000")).toBe("partial");
  });

  it("is paid at exactly the price", () => {
    expect(derivePaymentStatus("1000", "1000")).toBe("paid");
  });

  it("is paid when overpaid — overpayment is allowed", () => {
    expect(derivePaymentStatus("1200", "1000")).toBe("paid");
  });

  it("is unpaid for a zero-price delivery with no payments", () => {
    expect(derivePaymentStatus("0", "0")).toBe("unpaid");
  });
});

describe("outstandingFor", () => {
  it("is the unpaid remainder", () => {
    expect(outstandingFor("400", "1000")).toBe(600);
  });

  it("is zero when settled", () => {
    expect(outstandingFor("1000", "1000")).toBe(0);
  });

  it("clamps overpayment to zero so it cannot offset other debts", () => {
    expect(outstandingFor("1200", "1000")).toBe(0);
  });
});
