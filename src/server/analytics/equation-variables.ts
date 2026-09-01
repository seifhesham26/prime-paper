import { db } from "@/db";
import {
  rawMaterialReceipts,
  rawMaterialConsumptions,
  rawMaterialTypes,
  products,
  deliveries,
  payments,
  companies,
} from "@/db/schema";
import { sql, eq, gte, type SQL } from "drizzle-orm";

async function scalar(query: PromiseLike<{ v: string }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.v || 0);
}

/** For aggregates that have no single FROM table to hang off. */
async function scalarSql(expression: SQL): Promise<number> {
  const result = await db.execute<{ v: string }>(sql`SELECT ${expression} AS v`);
  return Number(result.rows[0]?.v || 0);
}

function firstOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const RESOLVERS: Record<string, () => Promise<number>> = {
  // ─── Raw materials ─────────────────────────────────────
  "SUM(raw_material_receipts.weight_tons)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${rawMaterialReceipts.weightTons}), 0)` })
        .from(rawMaterialReceipts),
    ),
  "SUM(raw_material_receipts.cost_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${rawMaterialReceipts.costEgp}), 0)` })
        .from(rawMaterialReceipts),
    ),
  "SUM(raw_material_consumptions.weight_tons)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${rawMaterialConsumptions.weightTons}), 0)` })
        .from(rawMaterialConsumptions),
    ),
  "BALANCE(raw_materials)": () =>
    scalarSql(
      sql`COALESCE((SELECT SUM(weight_tons) FROM raw_material_receipts), 0)
        - COALESCE((SELECT SUM(weight_tons) FROM raw_material_consumptions), 0)`,
    ),
  "AVG(raw_material_receipts.cost_per_ton)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(AVG(${rawMaterialReceipts.costPerTon}), 0)` })
        .from(rawMaterialReceipts),
    ),
  "COUNT(raw_material_types)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(rawMaterialTypes)),
  "COUNT(raw_material_receipts)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(rawMaterialReceipts)),

  // ─── Products ──────────────────────────────────────────
  "SUM(products.quantity)": () =>
    scalar(
      db.select({ v: sql<string>`COALESCE(SUM(${products.quantity}), 0)` }).from(products),
    ),
  "SUM(products.weight_kg)": () =>
    scalar(
      db.select({ v: sql<string>`COALESCE(SUM(${products.weightKg}), 0)` }).from(products),
    ),
  "COUNT(products)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(products)),

  // ─── Sales and payments ────────────────────────────────
  "SUM(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries),
    ),
  "SUM_THIS_MONTH(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries)
        .where(gte(deliveries.date, firstOfMonth())),
    ),
  "SUM(payments.amount_egp)": () =>
    scalar(
      db.select({ v: sql<string>`COALESCE(SUM(${payments.amountEgp}), 0)` }).from(payments),
    ),
  "SUM_UNPAID(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries)
        .where(eq(deliveries.paymentStatus, "unpaid")),
    ),
  "SUM_PARTIAL(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries)
        .where(eq(deliveries.paymentStatus, "partial")),
    ),
  /**
   * Correct receivable: the positive remainder per delivery, summed.
   * A global "prices minus all payments" lets an overpaid delivery cancel
   * out debt on another — which is exactly the bug this replaces.
   */
  "OUTSTANDING(deliveries)": () =>
    scalarSql(
      sql`COALESCE((
        SELECT SUM(GREATEST(d.selling_price_egp - COALESCE(p.paid, 0), 0))
        FROM deliveries d
        LEFT JOIN (
          SELECT delivery_id, SUM(amount_egp) AS paid FROM payments GROUP BY delivery_id
        ) p ON p.delivery_id = d.id
      ), 0)`,
    ),
  "COUNT(deliveries)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(deliveries)),
  "COUNT(companies)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(companies)),
};

/**
 * Tokens from the previous schema, kept working so saved dashboard cards do
 * not silently start rendering zero after the raw materials remodel.
 */
const ALIASES: Record<string, string> = {
  "SUM(raw_materials.weight_tons)": "SUM(raw_material_receipts.weight_tons)",
  "SUM(raw_materials.cost_egp)": "SUM(raw_material_receipts.cost_egp)",
  "AVG(raw_materials.cost_per_ton)": "AVG(raw_material_receipts.cost_per_ton)",
  "COUNT(raw_materials)": "COUNT(raw_material_receipts)",
};

export const KNOWN_TOKENS = new Set([...Object.keys(RESOLVERS), ...Object.keys(ALIASES)]);

export async function resolveVariable(token: string): Promise<number> {
  const trimmed = token.trim();
  const key = ALIASES[trimmed] ?? trimmed;
  const resolver = RESOLVERS[key];
  if (resolver) return resolver();

  const num = parseFloat(trimmed);
  if (!Number.isNaN(num)) return num;

  throw new Error(`Unknown equation variable: "${trimmed}"`);
}

/** Offered in the card builder. Aliases are deliberately not listed. */
export const EQUATION_VARIABLES = [
  { token: "BALANCE(raw_materials)", label: "Raw Material Balance (in stock)", labelAr: "رصيد المواد الخام (المتاح)" },
  { token: "SUM(raw_material_receipts.weight_tons)", label: "Total Raw Materials Received", labelAr: "إجمالي المواد الخام الواردة" },
  { token: "SUM(raw_material_consumptions.weight_tons)", label: "Total Raw Materials Consumed", labelAr: "إجمالي المواد الخام المستهلكة" },
  { token: "SUM(raw_material_receipts.cost_egp)", label: "Total Raw Materials Cost", labelAr: "إجمالي تكلفة المواد الخام" },
  { token: "AVG(raw_material_receipts.cost_per_ton)", label: "Average Cost per Ton", labelAr: "متوسط التكلفة لكل طن" },
  { token: "COUNT(raw_material_types)", label: "Number of Material Types", labelAr: "عدد أنواع الخامات" },
  { token: "COUNT(raw_material_receipts)", label: "Number of Receipts", labelAr: "عدد الواردات" },
  { token: "SUM(products.quantity)", label: "Total Products Quantity", labelAr: "إجمالي كمية المنتجات" },
  { token: "SUM(products.weight_kg)", label: "Total Products Weight", labelAr: "إجمالي وزن المنتجات" },
  { token: "COUNT(products)", label: "Number of Products", labelAr: "عدد المنتجات" },
  { token: "SUM(deliveries.selling_price_egp)", label: "Total Sales (All Time)", labelAr: "إجمالي المبيعات (كل الوقت)" },
  { token: "SUM_THIS_MONTH(deliveries.selling_price_egp)", label: "Sales This Month", labelAr: "مبيعات الشهر" },
  { token: "SUM(payments.amount_egp)", label: "Total Payments Collected", labelAr: "إجمالي المدفوعات المحصلة" },
  { token: "OUTSTANDING(deliveries)", label: "Outstanding Receivable", labelAr: "إجمالي المستحقات" },
  { token: "SUM_UNPAID(deliveries.selling_price_egp)", label: "Total Unpaid Deliveries", labelAr: "إجمالي التسليمات غير المدفوعة" },
  { token: "SUM_PARTIAL(deliveries.selling_price_egp)", label: "Total Partial Deliveries", labelAr: "إجمالي التسليمات الجزئية" },
  { token: "COUNT(deliveries)", label: "Number of Deliveries", labelAr: "عدد التسليمات" },
  { token: "COUNT(companies)", label: "Number of Companies", labelAr: "عدد الشركات" },
];
