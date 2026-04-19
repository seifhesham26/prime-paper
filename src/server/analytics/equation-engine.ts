import { db } from "@/db";
import { rawMaterials, products, deliveries, payments, companies } from "@/db/schema";
import { sql, eq, gte } from "drizzle-orm";

/**
 * Equation Engine for Dashboard Cards.
 * 
 * Takes an equation string like "SUM(raw_materials.weight_tons)"
 * and resolves it to a number using pre-defined SQL queries.
 * 
 * Supports: +, -, *, / operators and constant numbers.
 * Each variable token maps to a safe, pre-defined SQL aggregation.
 */

// ─── Variable Resolvers ──────────────────────────────────

async function resolveVariable(token: string): Promise<number> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  switch (token.trim()) {
    case "SUM(raw_materials.weight_tons)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${rawMaterials.weightTons}), 0)` }).from(rawMaterials);
      return Number(r?.v || 0);
    }
    case "SUM(raw_materials.cost_egp)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${rawMaterials.costEgp}), 0)` }).from(rawMaterials);
      return Number(r?.v || 0);
    }
    case "SUM(products.quantity)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${products.quantity}), 0)` }).from(products);
      return Number(r?.v || 0);
    }
    case "SUM(products.weight_kg)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${products.weightKg}), 0)` }).from(products);
      return Number(r?.v || 0);
    }
    case "SUM(deliveries.selling_price_egp)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` }).from(deliveries);
      return Number(r?.v || 0);
    }
    case "SUM_THIS_MONTH(deliveries.selling_price_egp)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` }).from(deliveries).where(gte(deliveries.date, firstOfMonth));
      return Number(r?.v || 0);
    }
    case "SUM(payments.amount_egp)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${payments.amountEgp}), 0)` }).from(payments);
      return Number(r?.v || 0);
    }
    case "SUM_UNPAID(deliveries.selling_price_egp)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` }).from(deliveries).where(eq(deliveries.paymentStatus, "unpaid"));
      return Number(r?.v || 0);
    }
    case "SUM_PARTIAL(deliveries.selling_price_egp)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` }).from(deliveries).where(eq(deliveries.paymentStatus, "partial"));
      return Number(r?.v || 0);
    }
    case "AVG(raw_materials.cost_per_ton)": {
      const [r] = await db.select({ v: sql<string>`COALESCE(AVG(${rawMaterials.costPerTon}), 0)` }).from(rawMaterials);
      return Number(r?.v || 0);
    }
    case "COUNT(companies)": {
      const [r] = await db.select({ v: sql<string>`COUNT(*)` }).from(companies);
      return Number(r?.v || 0);
    }
    case "COUNT(deliveries)": {
      const [r] = await db.select({ v: sql<string>`COUNT(*)` }).from(deliveries);
      return Number(r?.v || 0);
    }
    case "COUNT(products)": {
      const [r] = await db.select({ v: sql<string>`COUNT(*)` }).from(products);
      return Number(r?.v || 0);
    }
    case "COUNT(raw_materials)": {
      const [r] = await db.select({ v: sql<string>`COUNT(*)` }).from(rawMaterials);
      return Number(r?.v || 0);
    }
    default:
      // Try parsing as a constant number
      const num = parseFloat(token);
      if (!isNaN(num)) return num;
      throw new Error(`Unknown equation variable: "${token}"`);
  }
}

// ─── Available Variables (for UI dropdown) ───────────────

export const EQUATION_VARIABLES = [
  { token: "SUM(raw_materials.weight_tons)", label: "Total Raw Materials Weight", labelAr: "إجمالي وزن المواد الخام" },
  { token: "SUM(raw_materials.cost_egp)", label: "Total Raw Materials Cost", labelAr: "إجمالي تكلفة المواد الخام" },
  { token: "SUM(products.quantity)", label: "Total Products Quantity", labelAr: "إجمالي كمية المنتجات" },
  { token: "SUM(products.weight_kg)", label: "Total Products Weight", labelAr: "إجمالي وزن المنتجات" },
  { token: "SUM(deliveries.selling_price_egp)", label: "Total Sales (All Time)", labelAr: "إجمالي المبيعات (كل الوقت)" },
  { token: "SUM_THIS_MONTH(deliveries.selling_price_egp)", label: "Sales This Month", labelAr: "مبيعات الشهر" },
  { token: "SUM(payments.amount_egp)", label: "Total Payments Collected", labelAr: "إجمالي المدفوعات المحصلة" },
  { token: "SUM_UNPAID(deliveries.selling_price_egp)", label: "Total Unpaid Deliveries", labelAr: "إجمالي التسليمات غير المدفوعة" },
  { token: "SUM_PARTIAL(deliveries.selling_price_egp)", label: "Total Partial Deliveries", labelAr: "إجمالي التسليمات الجزئية" },
  { token: "AVG(raw_materials.cost_per_ton)", label: "Average Cost per Ton", labelAr: "متوسط التكلفة لكل طن" },
  { token: "COUNT(companies)", label: "Number of Companies", labelAr: "عدد الشركات" },
  { token: "COUNT(deliveries)", label: "Number of Deliveries", labelAr: "عدد التسليمات" },
  { token: "COUNT(products)", label: "Number of Products", labelAr: "عدد المنتجات" },
  { token: "COUNT(raw_materials)", label: "Number of Raw Materials", labelAr: "عدد المواد الخام" },
];

// ─── Equation Parser ─────────────────────────────────────

/**
 * Tokenize: Split equation by + and - operators while preserving them.
 * We handle * and / inside additive terms.
 * 
 * Example: "SUM_UNPAID(...) + SUM_PARTIAL(...) - SUM(payments...)"
 *   → ["+", "SUM_UNPAID(...)", "+", "SUM_PARTIAL(...)", "-", "SUM(payments...)"]
 */
function tokenize(equation: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of equation) {
    if (char === "(") parenDepth++;
    if (char === ")") parenDepth--;

    if (parenDepth === 0 && (char === "+" || char === "-")) {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

export async function evaluateEquation(equation: string): Promise<number> {
  const tokens = tokenize(equation);
  
  let result = 0;
  let operator = "+";

  for (const token of tokens) {
    if (token === "+" || token === "-") {
      operator = token;
      continue;
    }

    // Handle multiplication/division within a term
    if (token.includes(" * ") || token.includes(" / ")) {
      const subParts = token.split(/\s*([*/])\s*/);
      let subResult = await resolveVariable(subParts[0]);
      for (let i = 1; i < subParts.length; i += 2) {
        const op = subParts[i];
        const val = await resolveVariable(subParts[i + 1]);
        if (op === "*") subResult *= val;
        if (op === "/") subResult = val !== 0 ? subResult / val : 0;
      }
      if (operator === "+") result += subResult;
      else result -= subResult;
    } else {
      const val = await resolveVariable(token);
      if (operator === "+") result += val;
      else result -= val;
    }
  }

  return Math.round(result * 100) / 100;
}
