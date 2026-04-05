import { z } from "zod";

export const CreateRawMaterialSchema = z.object({
  dateReceived: z.date(),
  supplierName: z.string().min(1, "Supplier name is required"),
  weightTons: z.string().min(1, "Weight in tons is required"),
  costEgp: z.string().min(1, "Cost in EGP is required"),
  notes: z.string().optional(),
});

export const UpdateRawMaterialSchema = CreateRawMaterialSchema.extend({
  id: z.string().uuid(),
});

export const GetRawMaterialsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export const DeleteRawMaterialSchema = z.object({
  id: z.string().uuid(),
});

export type RawMaterial = {
  id: string;
  dateReceived: Date;
  supplierName: string;
  weightTons: string;
  costEgp: string;
  costPerTon: string | null;
  notes: string | null;
  createdAt: Date;
};
