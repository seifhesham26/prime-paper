import { db } from "@/db";
import { rawMaterials } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { z } from "zod";
import type { CreateRawMaterialSchema, UpdateRawMaterialSchema } from "./types";

export async function findRawMaterials(page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(rawMaterials);

  const total = Number(totalResult?.count || 0);

  const data = await db
    .select()
    .from(rawMaterials)
    .orderBy(desc(rawMaterials.dateReceived))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function insertRawMaterial(data: z.infer<typeof CreateRawMaterialSchema>, costPerTon: string) {
  const [newRawMaterial] = await db.insert(rawMaterials).values({
    dateReceived: data.dateReceived,
    supplierName: data.supplierName,
    weightTons: data.weightTons,
    costEgp: data.costEgp,
    costPerTon,
    notes: data.notes || null,
  }).returning();

  return newRawMaterial;
}

export async function editRawMaterial(data: z.infer<typeof UpdateRawMaterialSchema>, costPerTon: string) {
  const [updatedRawMaterial] = await db
    .update(rawMaterials)
    .set({
      dateReceived: data.dateReceived,
      supplierName: data.supplierName,
      weightTons: data.weightTons,
      costEgp: data.costEgp,
      costPerTon,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(rawMaterials.id, data.id))
    .returning();

  return updatedRawMaterial;
}

export async function removeRawMaterial(id: string) {
  await db.delete(rawMaterials).where(eq(rawMaterials.id, id));
  return { success: true };
}
