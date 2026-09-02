import { z } from "zod";
import { dimensionSchema } from "@/server/shared/validation";
import { listQueryFields } from "../shared/list-query";

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

export const PRODUCT_SORT_KEYS = [
  "dateProduced",
  "lengthM",
  "widthCm",
  "weightKg",
  "quantity",
] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const GetProductsSchema = z.object(listQueryFields(PRODUCT_SORT_KEYS));

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
