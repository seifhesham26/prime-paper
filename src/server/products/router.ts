import { createTRPCRouter, publicProcedure } from "../trpc";
import { getProductsService, createProductService, updateProductService, deleteProductService } from "./services";
import { CreateProductSchema, GetProductsSchema, UpdateProductSchema, DeleteProductSchema } from "./types";

export const productsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(GetProductsSchema)
    .query(async ({ input }) => {
      return await getProductsService(input.page, input.limit);
    }),

  create: publicProcedure
    .input(CreateProductSchema)
    .mutation(async ({ input }) => {
      return await createProductService(input);
    }),

  update: publicProcedure
    .input(UpdateProductSchema)
    .mutation(async ({ input }) => {
      return await updateProductService(input);
    }),

  delete: publicProcedure
    .input(DeleteProductSchema)
    .mutation(async ({ input }) => {
      return await deleteProductService(input.id);
    }),
});
