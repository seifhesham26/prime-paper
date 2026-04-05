import { createTRPCRouter, publicProcedure } from "../trpc";
import { getDeliveriesService, getDeliveryByIdService, createDeliveryService, deleteDeliveryService, addPaymentService } from "./services";
import { CreateDeliverySchema, GetDeliveriesSchema, GetDeliveryByIdSchema, DeleteDeliverySchema, AddPaymentSchema } from "./types";

export const deliveriesRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(GetDeliveriesSchema)
    .query(async ({ input }) => {
      return await getDeliveriesService(input.page, input.limit);
    }),

  getById: publicProcedure
    .input(GetDeliveryByIdSchema)
    .query(async ({ input }) => {
      const delivery = await getDeliveryByIdService(input.id);
      if (!delivery) {
        throw new Error("Delivery not found");
      }
      return delivery;
    }),

  create: publicProcedure
    .input(CreateDeliverySchema)
    .mutation(async ({ input }) => {
      return await createDeliveryService(input);
    }),

  delete: publicProcedure
    .input(DeleteDeliverySchema)
    .mutation(async ({ input }) => {
      return await deleteDeliveryService(input.id);
    }),

  addPayment: publicProcedure
    .input(AddPaymentSchema)
    .mutation(async ({ input }) => {
      return await addPaymentService(input);
    }),
});
