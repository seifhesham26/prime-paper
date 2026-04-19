import { z } from "zod";
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

export const settingsRouter = createTRPCRouter({
  // ─── System Settings ───────────────────────────────────
  getAll: protectedProcedure.query(async () => {
    return await getAllSettings();
  }),

  update: writerProcedure
    .input(UpdateSettingSchema)
    .mutation(async ({ input }) => {
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
      return await createDashboardCard(input);
    }),

  updateCard: writerProcedure
    .input(UpdateDashboardCardSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
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
