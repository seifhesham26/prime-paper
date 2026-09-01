import { z } from "zod";
import { listQueryFields } from "../shared/list-query";

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const COMPANY_SORT_KEYS = ["name", "contactPerson", "createdAt"] as const;
export type CompanySortKey = (typeof COMPANY_SORT_KEYS)[number];

export const GetCompaniesSchema = z.object(listQueryFields(COMPANY_SORT_KEYS));

export const CreateCompanySchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.extend({
  id: z.string().uuid(),
});

export type Company = z.infer<typeof CompanySchema>;
