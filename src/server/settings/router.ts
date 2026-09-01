import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { validateEquation } from "../analytics/equation-parser";
import { KNOWN_TOKENS } from "../analytics/equation-variables";
import { SETTINGS_BY_KEY } from "./registry";
import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import {
  getAllSettings,
  upsertSetting,
  getAllDashboardCards,
  createDashboardCard,
  updateDashboardCard,
  deleteDashboardCard,
  reorderDashboardCards,
} from "./db";
import {
  UpdateSettingSchema,
  CreateDashboardCardSchema,
  UpdateDashboardCardSchema,
  ReorderCardsSchema,
} from "./types";

/** Rejects an equation that would silently render as zero on the dashboard. */
function assertValidEquation(equation: string) {
  const result = validateEquation(equation, KNOWN_TOKENS);
  if (!result.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: result.unknown.length
        ? `Unknown variables: ${result.unknown.join(", ")}`
        : "The equation is malformed",
    });
  }
}

export const settingsRouter = createTRPCRouter({
  // ─── System Settings ───────────────────────────────────
  getAll: protectedProcedure.query(async () => {
    return await getAllSettings();
  }),

  update: writerProcedure
    .input(UpdateSettingSchema)
    .mutation(async ({ input }) => {
      const def = SETTINGS_BY_KEY.get(input.key);
      if (def?.type === "int") {
        const n = Number(input.value);
        if (!Number.isInteger(n) || n < def.min || n > def.max) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${def.label} must be a whole number between ${def.min} and ${def.max}`,
          });
        }
      }
      if (def?.type === "boolean" && input.value !== "true" && input.value !== "false") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${def.label} must be either "true" or "false"`,
        });
      }
      await upsertSetting(input.key, input.value);
      return { success: true };
    }),

  // ─── Dashboard Cards ───────────────────────────────────
  getCards: protectedProcedure.query(async () => {
    return await getAllDashboardCards();
  }),

  createCard: writerProcedure
    .input(CreateDashboardCardSchema)
    .mutation(async ({ input }) => {
      assertValidEquation(input.equation);
      return await createDashboardCard(input);
    }),

  updateCard: writerProcedure
    .input(UpdateDashboardCardSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.equation) assertValidEquation(data.equation);
      await updateDashboardCard(id, data);
      return { success: true };
    }),

  deleteCard: writerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await deleteDashboardCard(input.id);
      return { success: true };
    }),

  reorderCards: writerProcedure
    .input(ReorderCardsSchema)
    .mutation(async ({ input }) => {
      await reorderDashboardCards(input.cards);
      return { success: true };
    }),
});
