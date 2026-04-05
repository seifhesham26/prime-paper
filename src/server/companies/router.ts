import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { getCompaniesService, createCompanyService, updateCompanyService, deleteCompanyService } from "./services";
import { CreateCompanySchema, GetCompaniesSchema, UpdateCompanySchema } from "./types";

export const companiesRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(GetCompaniesSchema)
    .query(async ({ input }) => {
      return await getCompaniesService(input.page, input.limit);
    }),

  create: publicProcedure
    .input(CreateCompanySchema)
    .mutation(async ({ input }) => {
      return await createCompanyService(input);
    }),

  update: publicProcedure
    .input(UpdateCompanySchema)
    .mutation(async ({ input }) => {
      return await updateCompanyService(input);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return await deleteCompanyService(input.id);
    }),
});
