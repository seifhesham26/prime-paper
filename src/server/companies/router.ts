import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import { z } from "zod";
import { getCompaniesService, createCompanyService, updateCompanyService, deleteCompanyService } from "./services";
import { CreateCompanySchema, GetCompaniesSchema, UpdateCompanySchema } from "./types";

export const companiesRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetCompaniesSchema)
    .query(async ({ input }) => {
      return await getCompaniesService(input.page, input.limit);
    }),

  create: writerProcedure
    .input(CreateCompanySchema)
    .mutation(async ({ input }) => {
      return await createCompanyService(input);
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
