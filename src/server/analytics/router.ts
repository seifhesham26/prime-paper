import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getDashboardStats } from "./services";
import { DashboardStatsSchema } from "./types";
import { evaluateEquation, extractTokens } from "./equation-parser";
import { resolveVariable, EQUATION_VARIABLES } from "./equation-variables";
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

    // Resolve each distinct token once rather than once per card that uses
    // it — four cards sharing tokens used to mean a dozen round trips.
    const tokens = new Set(cards.flatMap((c) => extractTokens(c.equation)));
    const values = new Map<string, number>();
    await Promise.all(
      [...tokens].map(async (token) => {
        try {
          values.set(token, await resolveVariable(token));
        } catch {
          // Left unset; evaluation below reports it as a per-card error.
        }
      }),
    );

    const cached = async (token: string) => {
      const hit = values.get(token.trim());
      if (hit !== undefined) return hit;
      return resolveVariable(token);
    };

    return Promise.all(
      cards.map(async (card) => {
        const base = {
          id: card.id,
          title: card.title,
          titleAr: card.titleAr,
          unit: card.unit,
          icon: card.icon,
          gradient: card.gradient,
          sortOrder: card.sortOrder,
        };
        try {
          return {
            ...base,
            value: await evaluateEquation(card.equation, cached),
            error: null as string | null,
          };
        } catch (err) {
          // A broken equation shows a warning, never a fake zero.
          console.error(`Error evaluating card "${card.title}":`, err);
          return {
            ...base,
            value: null as number | null,
            error: err instanceof Error ? err.message : "Invalid equation",
          };
        }
      }),
    );
  }),

  /** Return available equation variables for the card builder UI */
  getEquationVariables: protectedProcedure.query(() => {
    return EQUATION_VARIABLES;
  }),
});
