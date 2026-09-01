import { z } from "zod";
import { dimensionSchema } from "@/server/shared/validation";

export const CreateProductSchema = z.object({
  rawMaterialTypeId: z.string().uuid().optional(),
  dateProduced: z.date(),
  lengthM: dimensionSchema,
  widthCm: dimensionSchema,
  weightKg: dimensionSchema,
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export const UpdateProductSchema = CreateProductSchema.extend({
  id: z.string().uuid(),
});

export const GetProductsSchema = z.object({
  page: z.number().int().min(1).default(1),
  /** Fetching to fill a picker rather than to page a table. */
  forDropdown: z.boolean().default(false),
});

export const DeleteProductSchema = z.object({
  id: z.string().uuid(),
});

// Defining output types manually mapping to db columns
export type Product = {
  id: string;
  rawMaterialTypeId: string | null;
  dateProduced: Date;
  lengthM: string;
  widthCm: string;
  weightKg: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  materialName: string | null;
};
