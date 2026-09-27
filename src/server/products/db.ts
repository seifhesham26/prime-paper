import { db } from "@/db";
import { products, rawMaterialTypes, deliveryItems } from "@/db/schema";
import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";
import type { z } from "zod";
import type { CreateProductSchema, UpdateProductSchema } from "./types";
import { likePattern, pickSortKey } from "../shared/list-query";
import { PRODUCT_SORT_KEYS } from "./types";

export async function findProducts(
  page = 1,
  limit = 10,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  const offset = (page - 1) * limit;

  const term = search?.trim();
  const where = term
    ? or(
        ilike(products.notes, likePattern(term)),
        ilike(rawMaterialTypes.name, likePattern(term)),
      )
    : undefined;

  // The count carries the same join as the page, because the predicate
  // reaches across it to the material name.
  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(products)
    .leftJoin(rawMaterialTypes, eq(products.rawMaterialTypeId, rawMaterialTypes.id))
    .where(where);
  const total = Number(totalResult?.count || 0);

  const SORT_COLUMNS = {
    dateProduced: products.dateProduced,
    lengthM: products.lengthM,
    widthCm: products.widthCm,
    weightKg: products.weightKg,
    quantity: products.quantity,
  } as const;

  const key = pickSortKey(sortBy, PRODUCT_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key ? direction(SORT_COLUMNS[key]) : desc(products.dateProduced);

  const data = await db
    .select({
      id: products.id,
      rawMaterialTypeId: products.rawMaterialTypeId,
      dateProduced: products.dateProduced,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      gsm: products.gsm,
      weightKg: products.weightKg,
      quantity: products.quantity,
      notes: products.notes,
      createdAt: products.createdAt,
      materialName: rawMaterialTypes.name,
    })
    .from(products)
    .leftJoin(rawMaterialTypes, eq(products.rawMaterialTypeId, rawMaterialTypes.id))
    .where(where)
    .orderBy(orderBy)
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

// ─── Batchable builders ──────────────────────────────────
// The id is supplied by the caller rather than defaulted by Postgres, because
// db.batch() cannot feed a returned id into a later statement in the batch.

export function buildInsertProduct(
  data: z.infer<typeof CreateProductSchema>,
  userId: string,
  id: string,
) {
  return db.insert(products).values({
    id,
    rawMaterialTypeId: data.rawMaterialTypeId || null,
    dateProduced: data.dateProduced,
    lengthM: data.lengthM,
    widthCm: data.widthCm,
    gsm: data.gsm ?? null,
    weightKg: data.weightKg,
    quantity: data.quantity,
    notes: data.notes || null,
    createdBy: userId,
  });
}

export function buildUpdateProduct(data: z.infer<typeof UpdateProductSchema>) {
  return db
    .update(products)
    .set({
      rawMaterialTypeId: data.rawMaterialTypeId || null,
      dateProduced: data.dateProduced,
      lengthM: data.lengthM,
      widthCm: data.widthCm,
      gsm: data.gsm ?? null,
      weightKg: data.weightKg,
      quantity: data.quantity,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, data.id));
}

export function buildDeleteProduct(id: string) {
  return db.delete(products).where(eq(products.id, id));
}
