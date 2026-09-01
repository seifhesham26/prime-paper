import { sql } from "drizzle-orm";

export type PaymentStatus = "paid" | "partial" | "unpaid";

/**
 * The single rule for delivery payment status.
 *
 * IMPORTANT: PAYMENT_STATUS_SQL below encodes this exact rule for the atomic
 * UPDATE. The two must be changed together — they live in this one file so
 * the pairing is impossible to miss.
 */
export function derivePaymentStatus(paidEgp: string, priceEgp: string): PaymentStatus {
  const paid = Number(paidEgp);
  const price = Number(priceEgp);

  if (paid <= 0) return "unpaid";
  if (paid >= price) return "paid";
  return "partial";
}

/** The positive remainder only — overpayment must not offset other debts. */
export function outstandingFor(paidEgp: string, priceEgp: string): number {
  return Math.max(Number(priceEgp) - Number(paidEgp), 0);
}

/**
 * SQL twin of derivePaymentStatus. Recomputing in a single statement avoids
 * a read-then-write gap between summing payments and storing the status.
 */
export const PAYMENT_STATUS_SQL = sql`(CASE
  WHEN (SELECT COALESCE(SUM(amount_egp), 0) FROM payments WHERE delivery_id = deliveries.id) <= 0
    THEN 'unpaid'
  WHEN (SELECT COALESCE(SUM(amount_egp), 0) FROM payments WHERE delivery_id = deliveries.id) >= deliveries.selling_price_egp
    THEN 'paid'
  ELSE 'partial'
END)::payment_status`;
