import { createTRPCRouter, publicProcedure } from "../trpc";
import { getDashboardStats } from "./services";
import { DashboardStatsSchema } from "./types";

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: publicProcedure
    .output(DashboardStatsSchema)
    .query(async () => {
      return await getDashboardStats();
    }),
});
