import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { getDeliveriesService, getDeliveryByIdService, createDeliveryService, deleteDeliveryService, addPaymentService } from "./services";
import { CreateDeliverySchema, GetDeliveriesSchema, GetDeliveryByIdSchema, DeleteDeliverySchema, AddPaymentSchema } from "./types";

export const deliveriesRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetDeliveriesSchema)
    .query(async ({ input }) => {
      return await getDeliveriesService(input.page, input.limit);
    }),

  getById: protectedProcedure
    .input(GetDeliveryByIdSchema)
    .query(async ({ input }) => {
      const delivery = await getDeliveryByIdService(input.id);
      if (!delivery) {
        throw new Error("Delivery not found");
      }
      return delivery;
    }),

  create: writerProcedure
    .input(CreateDeliverySchema)
    .mutation(async ({ input }) => {
      return await createDeliveryService(input);
    }),

  delete: writerProcedure
    .input(DeleteDeliverySchema)
    .mutation(async ({ input }) => {
      return await deleteDeliveryService(input.id);
    }),

  addPayment: writerProcedure
    .input(AddPaymentSchema)
    .mutation(async ({ input }) => {
      return await addPaymentService(input);
    }),
});
