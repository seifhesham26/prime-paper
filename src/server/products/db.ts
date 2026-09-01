import { db } from "@/db";
import { products, rawMaterialTypes, deliveryItems } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { z } from "zod";
import type { CreateProductSchema, UpdateProductSchema } from "./types";

export async function findProducts(page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: sql`count(*)` }).from(products);
  const total = Number(totalResult?.count || 0);

  const data = await db
    .select({
      id: products.id,
      rawMaterialTypeId: products.rawMaterialTypeId,
      dateProduced: products.dateProduced,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      weightKg: products.weightKg,
      quantity: products.quantity,
      notes: products.notes,
      createdAt: products.createdAt,
      materialName: rawMaterialTypes.name,
    })
    .from(products)
    .leftJoin(rawMaterialTypes, eq(products.rawMaterialTypeId, rawMaterialTypes.id))
    .orderBy(desc(products.dateProduced))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Blocks deletion of a product that a delivery still refers to. */
export async function countProductDeliveryItems(id: string) {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(deliveryItems)
    .where(eq(deliveryItems.productId, id));
  return Number(row?.count || 0);
}

export async function insertProduct(
  data: z.infer<typeof CreateProductSchema>,
  userId: string,
) {
  const [newProduct] = await db
    .insert(products)
    .values({
      rawMaterialTypeId: data.rawMaterialTypeId || null,
      dateProduced: data.dateProduced,
      lengthM: data.lengthM,
      widthCm: data.widthCm,
      weightKg: data.weightKg,
      quantity: data.quantity,
      notes: data.notes || null,
      createdBy: userId,
    })
    .returning();
  return newProduct;
}

export async function editProduct(data: z.infer<typeof UpdateProductSchema>) {
  const [updatedProduct] = await db
    .update(products)
    .set({
      rawMaterialTypeId: data.rawMaterialTypeId || null,
      dateProduced: data.dateProduced,
      lengthM: data.lengthM,
      widthCm: data.widthCm,
      weightKg: data.weightKg,
      quantity: data.quantity,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, data.id))
    .returning();
  return updatedProduct;
}

export async function removeProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
  return { success: true };
}
