import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { getSettingsMap } from "../settings/db";
import {
  getTypesService,
  getTypeByIdService,
  createTypeService,
  updateTypeService,
  deleteTypeService,
  createReceiptService,
  updateReceiptService,
  deleteReceiptService,
  createConsumptionService,
  updateConsumptionService,
  deleteConsumptionService,
} from "./services";
import {
  GetTypesSchema,
  IdSchema,
  CreateTypeSchema,
  UpdateTypeSchema,
  CreateReceiptSchema,
  UpdateReceiptSchema,
  CreateConsumptionSchema,
  UpdateConsumptionSchema,
} from "./types";

export const rawMaterialsRouter = createTRPCRouter({
  getAll: protectedProcedure.input(GetTypesSchema).query(async ({ input }) => {
    const { pageSizeDefault, dropdownListLimit } = await getSettingsMap();
    return getTypesService(
      input.page,
      input.forDropdown ? dropdownListLimit : pageSizeDefault,
    );
  }),

  getById: protectedProcedure
    .input(IdSchema)
    .query(async ({ input }) => getTypeByIdService(input.id)),

  create: writerProcedure
    .input(CreateTypeSchema)
    .mutation(async ({ input, ctx }) => createTypeService(input, ctx.session.user.id)),

  update: writerProcedure
    .input(UpdateTypeSchema)
    .mutation(async ({ input }) => updateTypeService(input)),

  delete: writerProcedure
    .input(IdSchema)
    .mutation(async ({ input }) => deleteTypeService(input.id)),

  createReceipt: writerProcedure
    .input(CreateReceiptSchema)
    .mutation(async ({ input, ctx }) => createReceiptService(input, ctx.session.user.id)),

  updateReceipt: writerProcedure
    .input(UpdateReceiptSchema)
    .mutation(async ({ input }) => updateReceiptService(input)),

  deleteReceipt: writerProcedure
    .input(IdSchema)
    .mutation(async ({ input }) => deleteReceiptService(input.id)),

  createConsumption: writerProcedure
    .input(CreateConsumptionSchema)
    .mutation(async ({ input, ctx }) =>
      createConsumptionService(input, ctx.session.user.id),
    ),

  updateConsumption: writerProcedure
    .input(UpdateConsumptionSchema)
    .mutation(async ({ input }) => updateConsumptionService(input)),

  deleteConsumption: writerProcedure
    .input(IdSchema)
    .mutation(async ({ input }) => deleteConsumptionService(input.id)),
});
