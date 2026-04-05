import { z } from "zod";

export const CreateProductSchema = z.object({
  rawMaterialId: z.string().uuid().optional(),
  dateProduced: z.date(),
  lengthM: z.string().min(1, "Length is required"),
  widthCm: z.string().min(1, "Width is required"),
  weightKg: z.string().min(1, "Weight is required"),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export const UpdateProductSchema = CreateProductSchema.extend({
  id: z.string().uuid(),
});

export const GetProductsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export const DeleteProductSchema = z.object({
  id: z.string().uuid(),
});

// Defining output types manually mapping to db columns
export type Product = {
  id: string;
  rawMaterialId: string | null;
  dateProduced: Date;
  lengthM: string;
  widthCm: string;
  weightKg: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  supplierName: string | null;
};
