import { db } from "@/db";
import { rawMaterials, products, deliveries, payments, companies } from "@/db/schema";
import { sql, eq, gte, desc } from "drizzle-orm";
import type { DashboardStats } from "./types";

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [rawMaterialsResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${rawMaterials.weightTons}), 0)`,
      })
      .from(rawMaterials);

    const [productsResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${products.quantity}), 0)` })
      .from(products);

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [salesResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)`,
      })
      .from(deliveries)
      .where(gte(deliveries.date, firstOfMonth));

    const [totalDeliveries] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)`,
      })
      .from(deliveries)
      .where(eq(deliveries.paymentStatus, "unpaid"));

    const [totalPayments] = await db
      .select({ total: sql<string>`COALESCE(SUM(${payments.amountEgp}), 0)` })
      .from(payments);

    const [partialDeliveries] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)`,
      })
      .from(deliveries)
      .where(eq(deliveries.paymentStatus, "partial"));

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Using PostgreSQL date_trunc for monthly aggregation
    const monthlyDeliveries = await db
      .select({
        month: sql<string>`to_char(${deliveries.date}, 'YYYY-MM')`,
        total: sql<string>`SUM(${deliveries.sellingPriceEgp})`,
      })
      .from(deliveries)
      .where(gte(deliveries.date, sixMonthsAgo))
      .groupBy(sql`to_char(${deliveries.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${deliveries.date}, 'YYYY-MM')`);

    const monthlyPayments = await db
      .select({
        month: sql<string>`to_char(${payments.date}, 'YYYY-MM')`,
        total: sql<string>`SUM(${payments.amountEgp})`,
      })
      .from(payments)
      .where(gte(payments.date, sixMonthsAgo))
      .groupBy(sql`to_char(${payments.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${payments.date}, 'YYYY-MM')`);

    // Merge into single array filling missing months
    const monthlyDataMap = new Map<string, { month: string; revenue: number; payments: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyDataMap.set(m, { month: m, revenue: 0, payments: 0 });
    }

    monthlyDeliveries.forEach((d) => {
      if (monthlyDataMap.has(d.month)) {
        monthlyDataMap.get(d.month)!.revenue = Number(d.total || 0);
      }
    });
    monthlyPayments.forEach((p) => {
      if (monthlyDataMap.has(p.month)) {
        monthlyDataMap.get(p.month)!.payments = Number(p.total || 0);
      }
    });

    const monthlyData = Array.from(monthlyDataMap.values());

    const unpaidCompaniesRaw = await db
      .select({
        id: companies.id,
        name: companies.name,
        totalSales: sql<string>`(
          SELECT COALESCE(SUM(selling_price_egp), 0)
          FROM deliveries
          WHERE company_id = companies.id
        )`,
        totalPaid: sql<string>`(
          SELECT COALESCE(SUM(p.amount_egp), 0)
          FROM payments p
          JOIN deliveries d ON p.delivery_id = d.id
          WHERE d.company_id = companies.id
        )`
      })
      .from(companies);

    const topUnpaidCompanies = unpaidCompaniesRaw
      .map(c => ({
        id: c.id,
        name: c.name,
        balance: Number(c.totalSales) - Number(c.totalPaid)
      }))
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);

    const recentDeliveriesResult = await db
      .select({
        id: deliveries.id,
        date: deliveries.date,
        sellingPriceEgp: deliveries.sellingPriceEgp,
        paymentStatus: deliveries.paymentStatus,
        companyName: companies.name,
      })
      .from(deliveries)
      .leftJoin(companies, eq(deliveries.companyId, companies.id))
      .orderBy(desc(deliveries.date))
      .limit(5);

    const recentDeliveries = recentDeliveriesResult.map((d) => {
      // paymentStatus from schema has type 'paid' | 'partial' | 'unpaid' | null; zod wants exact.
      let validPaymentStatus: "paid" | "partial" | "unpaid" = "unpaid";
      if (d.paymentStatus === "paid" || d.paymentStatus === "partial") {
        validPaymentStatus = d.paymentStatus;
      }
      return {
        id: d.id,
        date: d.date.toISOString(),
        companyName: d.companyName || "-",
        sellingPriceEgp: Number(d.sellingPriceEgp),
        paymentStatus: validPaymentStatus,
      };
    });

    return {
      totalRawMaterials: Number(rawMaterialsResult?.total || 0),
      totalProducts: Number(productsResult?.total || 0),
      salesThisMonth: Number(salesResult?.total || 0),
      outstandingPayments:
        Number(totalDeliveries?.total || 0) +
        Number(partialDeliveries?.total || 0) -
        Number(totalPayments?.total || 0),
      monthlyData,
      topUnpaidCompanies,
      recentDeliveries,
    };
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    throw err; // Let tRPC handle it
  }
}
