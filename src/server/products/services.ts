import { TRPCError } from "@trpc/server";
import {
  findProducts,
  insertProduct,
  editProduct,
  removeProduct,
  countProductDeliveryItems,
} from "./db";
import type { z } from "zod";
import type { CreateProductSchema, UpdateProductSchema } from "./types";

export async function getProductsService(page: number, limit: number) {
  return await findProducts(page, limit);
}

export async function createProductService(
  data: z.infer<typeof CreateProductSchema>,
  userId: string,
) {
  return await insertProduct(data, userId);
}

export async function updateProductService(data: z.infer<typeof UpdateProductSchema>) {
  return await editProduct(data);
}

export async function deleteProductService(id: string) {
  const linked = await countProductDeliveryItems(id);
  if (linked > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this product: it appears in ${linked} delivery item(s).`,
    });
  }
  return await removeProduct(id);
}
