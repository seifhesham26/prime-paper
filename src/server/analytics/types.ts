import { z } from "zod";

export const DashboardStatsSchema = z.object({
  totalRawMaterials: z.number(),
  totalProducts: z.number(),
  salesThisMonth: z.number(),
  outstandingPayments: z.number(),
  monthlyData: z.array(
    z.object({
      month: z.string(),
      revenue: z.number(),
      payments: z.number(),
    })
  ),
  topUnpaidCompanies: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      balance: z.number(),
    })
  ),
  recentDeliveries: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      companyName: z.string(),
      sellingPriceEgp: z.number(),
      paymentStatus: z.enum(["paid", "partial", "unpaid"]),
    })
  ),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
