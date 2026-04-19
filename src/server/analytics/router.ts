import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getDashboardStats } from "./services";
import { DashboardStatsSchema } from "./types";
import { evaluateEquation, EQUATION_VARIABLES } from "./equation-engine";
import { getVisibleDashboardCards } from "../settings/db";

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure
    .output(DashboardStatsSchema)
    .query(async () => {
      return await getDashboardStats();
    }),

  /** Evaluate all visible dashboard cards and return their computed values */
  evaluateCards: protectedProcedure.query(async () => {
    const cards = await getVisibleDashboardCards();

    const results = await Promise.all(
      cards.map(async (card) => {
        try {
          const value = await evaluateEquation(card.equation);
          return {
            id: card.id,
            title: card.title,
            titleAr: card.titleAr,
            value,
            unit: card.unit,
            icon: card.icon,
            gradient: card.gradient,
            sortOrder: card.sortOrder,
          };
        } catch (err) {
          console.error(`Error evaluating card "${card.title}":`, err);
          return {
            id: card.id,
            title: card.title,
            titleAr: card.titleAr,
            value: 0,
            unit: card.unit,
            icon: card.icon,
            gradient: card.gradient,
            sortOrder: card.sortOrder,
          };
        }
      })
    );

    return results;
  }),

  /** Return available equation variables for the card builder UI */
  getEquationVariables: protectedProcedure.query(() => {
    return EQUATION_VARIABLES;
  }),
});
