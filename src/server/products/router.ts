import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { getSettingsMap } from "../settings/db";
import {
  getProductsService,
  createProductService,
  updateProductService,
  deleteProductService,
} from "./services";
import {
  CreateProductSchema,
  GetProductsSchema,
  UpdateProductSchema,
  DeleteProductSchema,
} from "./types";

export const productsRouter = createTRPCRouter({
  getAll: protectedProcedure.input(GetProductsSchema).query(async ({ input }) => {
    const settings = await getSettingsMap();
    return getProductsService(
      input.page,
      input.forDropdown ? settings.dropdownListLimit : settings.pageSizeDefault,
    );
  }),

  create: writerProcedure
    .input(CreateProductSchema)
    .mutation(async ({ input, ctx }) => createProductService(input, ctx.session.user.id)),

  update: writerProcedure
    .input(UpdateProductSchema)
    .mutation(async ({ input }) => updateProductService(input)),

  delete: writerProcedure
    .input(DeleteProductSchema)
    .mutation(async ({ input }) => deleteProductService(input.id)),
});
