import { describe, expect, it } from "vitest";
import { evaluateEquation, extractTokens, validateEquation } from "./equation-parser";

const stub = async (token: string) => {
  const table: Record<string, number> = { A: 10, B: 4, C: 2, ZERO: 0 };
  if (token in table) return table[token];
  const n = Number(token);
  if (Number.isFinite(n) && token.trim() !== "") return n;
  throw new Error(`Unknown equation variable: "${token}"`);
};

describe("evaluateEquation", () => {
  it("adds and subtracts", async () => {
    await expect(evaluateEquation("A + B", stub)).resolves.toBe(14);
    await expect(evaluateEquation("A - B", stub)).resolves.toBe(6);
    await expect(evaluateEquation("A - B + C", stub)).resolves.toBe(8);
  });

  it("multiplies and divides", async () => {
    await expect(evaluateEquation("A * C", stub)).resolves.toBe(20);
    await expect(evaluateEquation("A / B", stub)).resolves.toBe(2.5);
  });

  it("gives multiplication precedence over addition", async () => {
    await expect(evaluateEquation("A + B * C", stub)).resolves.toBe(18);
  });

  it("handles operators without surrounding spaces", async () => {
    await expect(evaluateEquation("A*C", stub)).resolves.toBe(20);
  });

  it("does not split inside a token's parentheses", async () => {
    const parens = async (t: string) => (t === "SUM(a.b - c.d)" ? 7 : Number(t));
    await expect(evaluateEquation("SUM(a.b - c.d)", parens)).resolves.toBe(7);
  });

  it("treats division by zero as zero rather than Infinity", async () => {
    await expect(evaluateEquation("A / ZERO", stub)).resolves.toBe(0);
  });

  it("resolves bare numeric constants", async () => {
    await expect(evaluateEquation("A * 2", stub)).resolves.toBe(20);
  });

  it("rejects a dangling operator — the card editor could emit this", async () => {
    await expect(evaluateEquation("A * + B", stub)).rejects.toThrow();
  });

  it("rejects an empty equation", async () => {
    await expect(evaluateEquation("", stub)).rejects.toThrow();
  });

  it("propagates an unknown token", async () => {
    await expect(evaluateEquation("A + NOPE", stub)).rejects.toThrow(/NOPE/);
  });

  it("rounds to two decimal places", async () => {
    const third = async () => 1 / 3;
    await expect(evaluateEquation("X", third)).resolves.toBe(0.33);
  });
});

describe("extractTokens", () => {
  it("lists the variable tokens, excluding operators and constants", () => {
    expect(extractTokens("A + B * 2")).toEqual(["A", "B"]);
  });
});

describe("validateEquation", () => {
  const known = new Set(["A", "B"]);

  it("accepts an equation built only from known tokens", () => {
    expect(validateEquation("A + B", known)).toEqual({ ok: true });
  });

  it("accepts numeric constants alongside tokens", () => {
    expect(validateEquation("A * 2", known)).toEqual({ ok: true });
  });

  it("reports unknown tokens instead of silently yielding zero", () => {
    expect(validateEquation("A + TYPO", known)).toEqual({ ok: false, unknown: ["TYPO"] });
  });

  it("rejects a malformed equation", () => {
    expect(validateEquation("A * + B", known).ok).toBe(false);
  });
});
