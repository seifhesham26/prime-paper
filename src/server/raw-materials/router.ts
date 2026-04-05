import { createTRPCRouter, publicProcedure } from "../trpc";
import { getRawMaterialsService, createRawMaterialService, updateRawMaterialService, deleteRawMaterialService } from "./services";
import { CreateRawMaterialSchema, GetRawMaterialsSchema, UpdateRawMaterialSchema, DeleteRawMaterialSchema } from "./types";

export const rawMaterialsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(GetRawMaterialsSchema)
    .query(async ({ input }) => {
      return await getRawMaterialsService(input.page, input.limit);
    }),

  create: publicProcedure
    .input(CreateRawMaterialSchema)
    .mutation(async ({ input }) => {
      return await createRawMaterialService(input);
    }),

  update: publicProcedure
    .input(UpdateRawMaterialSchema)
    .mutation(async ({ input }) => {
      return await updateRawMaterialService(input);
    }),

  delete: publicProcedure
    .input(DeleteRawMaterialSchema)
    .mutation(async ({ input }) => {
      return await deleteRawMaterialService(input.id);
    }),
});
