import { db } from "@/db";
import { products, rawMaterials } from "@/db/schema";
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
      rawMaterialId: products.rawMaterialId,
      dateProduced: products.dateProduced,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      weightKg: products.weightKg,
      quantity: products.quantity,
      notes: products.notes,
      createdAt: products.createdAt,
      supplierName: rawMaterials.supplierName,
    })
    .from(products)
    .leftJoin(rawMaterials, eq(products.rawMaterialId, rawMaterials.id))
    .orderBy(desc(products.dateProduced))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function insertProduct(data: z.infer<typeof CreateProductSchema>) {
  const [newProduct] = await db.insert(products).values({
    rawMaterialId: data.rawMaterialId || null,
    dateProduced: data.dateProduced,
    lengthM: data.lengthM,
    widthCm: data.widthCm,
    weightKg: data.weightKg,
    quantity: data.quantity,
    notes: data.notes || null,
  }).returning();
  return newProduct;
}

export async function editProduct(data: z.infer<typeof UpdateProductSchema>) {
  const [updatedProduct] = await db
    .update(products)
    .set({
      rawMaterialId: data.rawMaterialId || null,
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
