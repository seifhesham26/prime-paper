import { findCompanies, insertCompany, editCompany, removeCompany } from "./db";
import type { z } from "zod";
import type { CreateCompanySchema, UpdateCompanySchema } from "./types";

export async function getCompaniesService(page: number, limit: number) {
  return await findCompanies(page, limit);
}

export async function createCompanyService(data: z.infer<typeof CreateCompanySchema>) {
  return await insertCompany(data);
}

export async function updateCompanyService(data: z.infer<typeof UpdateCompanySchema>) {
  return await editCompany(data);
}

export async function deleteCompanyService(id: string) {
  return await removeCompany(id);
}
