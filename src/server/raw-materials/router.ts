import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { getRawMaterialsService, createRawMaterialService, updateRawMaterialService, deleteRawMaterialService } from "./services";
import { CreateRawMaterialSchema, GetRawMaterialsSchema, UpdateRawMaterialSchema, DeleteRawMaterialSchema } from "./types";

export const rawMaterialsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetRawMaterialsSchema)
    .query(async ({ input }) => {
      return await getRawMaterialsService(input.page, input.limit);
    }),

  create: writerProcedure
    .input(CreateRawMaterialSchema)
    .mutation(async ({ input }) => {
      return await createRawMaterialService(input);
    }),

  update: writerProcedure
    .input(UpdateRawMaterialSchema)
    .mutation(async ({ input }) => {
      return await updateRawMaterialService(input);
    }),

  delete: writerProcedure
    .input(DeleteRawMaterialSchema)
    .mutation(async ({ input }) => {
      return await deleteRawMaterialService(input.id);
    }),
});
