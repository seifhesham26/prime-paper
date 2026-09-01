import { toUnits } from "@/server/shared/validation";

const TON_SCALE = 3;
const MONEY_SCALE = 2;

/**
 * Balance in milli-tons. Decimal columns arrive as strings; comparing them
 * as floats can report 2.9999999996 for what is exactly 3, so all balance
 * arithmetic is done on integers.
 */
export function balanceUnits(receivedTons: string, consumedTons: string): number {
  return toUnits(receivedTons, TON_SCALE) - toUnits(consumedTons, TON_SCALE);
}

/** Consuming exactly the balance is allowed; consuming more is not. */
export function canConsume(balanceTons: string, amountTons: string): boolean {
  const amount = toUnits(amountTons, TON_SCALE);
  if (amount <= 0) return false;
  return amount <= toUnits(balanceTons, TON_SCALE);
}

/** Cost per ton for a single receipt. Weight must be positive. */
export function costPerTon(costEgp: string, weightTons: string): string {
  const weight = Number(weightTons);
  if (!(weight > 0)) {
    throw new RangeError("Weight must be greater than zero to compute cost per ton");
  }
  return (Number(costEgp) / weight).toFixed(MONEY_SCALE);
}

/**
 * Weighted average across receipts: total cost over total tonnage.
 * NOT the mean of per-receipt rates, which would over-weight small receipts.
 * Returns null when there is nothing to average.
 */
export function weightedAvgCostPerTon(
  totalCostEgp: string,
  totalWeightTons: string,
): string | null {
  const weight = Number(totalWeightTons);
  if (!(weight > 0)) return null;
  return (Number(totalCostEgp) / weight).toFixed(MONEY_SCALE);
}
