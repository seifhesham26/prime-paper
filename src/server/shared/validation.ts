import { z } from "zod";

const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Convert a decimal string to an exact integer in the smallest unit.
 * Avoids float arithmetic, which cannot be trusted for balance comparisons.
 * toUnits("10.5", 3) === 10500
 */
export function toUnits(value: string, scale: number): number {
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = trimmed.replace("-", "").split(".");
  const padded = (fraction + "0".repeat(scale)).slice(0, scale);
  const magnitude = Number(whole) * 10 ** scale + Number(padded || "0");
  return negative ? -magnitude : magnitude;
}

export type DecimalStringOptions = {
  scale: number;
  min?: number;
  max?: number;
  minExclusive?: boolean;
};

/**
 * Zod schema for a decimal column supplied as a string.
 * Drizzle returns and accepts `decimal` columns as strings, so values stay
 * strings end to end; this validates them before Postgres ever sees them.
 */
export function decimalString(opts: DecimalStringOptions) {
  const { scale, min, max, minExclusive = false } = opts;

  return z
    .string()
    .trim()
    .refine((v) => v.length > 0, { message: "Required" })
    .refine((v) => NUMERIC.test(v), { message: "Must be a number" })
    .refine((v) => Number.isFinite(Number(v)), { message: "Must be a finite number" })
    .refine((v) => (v.split(".")[1]?.length ?? 0) <= scale, {
      message: `At most ${scale} decimal places`,
    })
    .refine(
      (v) => (min === undefined ? true : minExclusive ? Number(v) > min : Number(v) >= min),
      { message: minExclusive ? `Must be greater than ${min}` : `Must be at least ${min}` },
    )
    .refine((v) => (max === undefined ? true : Number(v) <= max), {
      message: `Must be at most ${max}`,
    });
}

/** Weight in tons — decimal(10,3), must be positive. */
export const weightTonsSchema = decimalString({ scale: 3, min: 0, minExclusive: true });

/** Money in EGP — decimal(12,2), non-negative. */
export const moneySchema = decimalString({ scale: 2, min: 0 });

/** A positive money amount — for payments, which must move something. */
export const positiveMoneySchema = decimalString({ scale: 2, min: 0, minExclusive: true });

/** Product dimensions — decimal(10,2), must be positive. */
export const dimensionSchema = decimalString({ scale: 2, min: 0, minExclusive: true });
