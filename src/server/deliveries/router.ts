import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { getSettingsMap } from "../settings/db";
import {
  getDeliveriesService,
  getDeliveryByIdService,
  createDeliveryService,
  updateDeliveryService,
  deleteDeliveryService,
  addPaymentService,
  updatePaymentService,
  deletePaymentService,
} from "./services";
import {
  CreateDeliverySchema,
  UpdateDeliverySchema,
  GetDeliveriesSchema,
  GetDeliveryByIdSchema,
  DeleteDeliverySchema,
  AddPaymentSchema,
  UpdatePaymentSchema,
} from "./types";

export const deliveriesRouter = createTRPCRouter({
  getAll: protectedProcedure.input(GetDeliveriesSchema).query(async ({ input }) => {
    const { pageSizeDefault } = await getSettingsMap();
    return getDeliveriesService(
      input.page,
      pageSizeDefault,
      input.search,
      input.sortBy,
      input.sortDir,
    );
  }),

  getById: protectedProcedure.input(GetDeliveryByIdSchema).query(async ({ input }) => {
    const delivery = await getDeliveryByIdService(input.id);
    if (!delivery) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
    }
    return delivery;
  }),

  create: writerProcedure
    .input(CreateDeliverySchema)
    .mutation(async ({ input, ctx }) => createDeliveryService(input, ctx.session.user.id)),

  update: writerProcedure
    .input(UpdateDeliverySchema)
    .mutation(async ({ input }) => updateDeliveryService(input)),

  delete: writerProcedure
    .input(DeleteDeliverySchema)
    .mutation(async ({ input }) => deleteDeliveryService(input.id)),

  addPayment: writerProcedure
    .input(AddPaymentSchema)
    .mutation(async ({ input, ctx }) => addPaymentService(input, ctx.session.user.id)),

  updatePayment: writerProcedure
    .input(UpdatePaymentSchema)
    .mutation(async ({ input }) => updatePaymentService(input)),

  deletePayment: writerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => deletePaymentService(input.id)),
});
