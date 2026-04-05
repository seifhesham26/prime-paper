import { findProducts, insertProduct, editProduct, removeProduct } from "./db";
import type { z } from "zod";
import type { CreateProductSchema, UpdateProductSchema } from "./types";

export async function getProductsService(page: number, limit: number) {
  return await findProducts(page, limit);
}

export async function createProductService(data: z.infer<typeof CreateProductSchema>) {
  return await insertProduct(data);
}

export async function updateProductService(data: z.infer<typeof UpdateProductSchema>) {
  return await editProduct(data);
}

export async function deleteProductService(id: string) {
  return await removeProduct(id);
}
