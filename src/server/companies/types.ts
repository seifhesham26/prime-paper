import { z } from "zod";

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

export const GetCompaniesSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

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
