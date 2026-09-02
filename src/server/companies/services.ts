import { TRPCError } from "@trpc/server";
import {
  findCompanies,
  insertCompany,
  editCompany,
  removeCompany,
  countCompanyDeliveries,
} from "./db";
import type { z } from "zod";
import type { CreateCompanySchema, UpdateCompanySchema } from "./types";

export async function getCompaniesService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return await findCompanies(page, limit, search, sortBy, sortDir);
}

export async function createCompanyService(
  data: z.infer<typeof CreateCompanySchema>,
  userId: string,
) {
  return await insertCompany(data, userId);
}

export async function updateCompanyService(data: z.infer<typeof UpdateCompanySchema>) {
  return await editCompany(data);
}

export async function deleteCompanyService(id: string) {
  const linked = await countCompanyDeliveries(id);
  if (linked > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this company: it has ${linked} delivery/deliveries. Delete those first.`,
    });
  }
  return await removeCompany(id);
}
