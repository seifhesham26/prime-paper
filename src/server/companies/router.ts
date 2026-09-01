import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { z } from "zod";
import { getSettingsMap } from "../settings/db";
import { getCompaniesService, createCompanyService, updateCompanyService, deleteCompanyService } from "./services";
import { CreateCompanySchema, GetCompaniesSchema, UpdateCompanySchema } from "./types";

export const companiesRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetCompaniesSchema)
    .query(async ({ input }) => {
      const { pageSizeDefault, dropdownListLimit } = await getSettingsMap();
      return await getCompaniesService(
        input.page,
        input.forDropdown ? dropdownListLimit : pageSizeDefault,
        input.search,
        input.sortBy,
        input.sortDir,
      );
    }),

  create: writerProcedure
    .input(CreateCompanySchema)
    .mutation(async ({ input, ctx }) => {
      return await createCompanyService(input, ctx.session.user.id);
    }),

  update: writerProcedure
    .input(UpdateCompanySchema)
    .mutation(async ({ input }) => {
      return await updateCompanyService(input);
    }),

  delete: writerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return await deleteCompanyService(input.id);
    }),
});
