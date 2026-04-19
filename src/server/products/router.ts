import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { getProductsService, createProductService, updateProductService, deleteProductService } from "./services";
import { CreateProductSchema, GetProductsSchema, UpdateProductSchema, DeleteProductSchema } from "./types";

export const productsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetProductsSchema)
    .query(async ({ input }) => {
      return await getProductsService(input.page, input.limit);
    }),

  create: writerProcedure
    .input(CreateProductSchema)
    .mutation(async ({ input }) => {
      return await createProductService(input);
    }),

  update: writerProcedure
    .input(UpdateProductSchema)
    .mutation(async ({ input }) => {
      return await updateProductService(input);
    }),

  delete: writerProcedure
    .input(DeleteProductSchema)
    .mutation(async ({ input }) => {
      return await deleteProductService(input.id);
    }),
});
