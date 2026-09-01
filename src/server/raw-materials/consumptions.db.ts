import { db } from "@/db";
import { rawMaterialConsumptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function findConsumptionById(id: string) {
  const [row] = await db
    .select()
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.id, id));
  return row ?? null;
}

export async function insertConsumption(
  data: { typeId: string; date: Date; weightTons: string; notes?: string },
  userId: string,
) {
  const [row] = await db
    .insert(rawMaterialConsumptions)
    .values({
      typeId: data.typeId,
      date: data.date,
      weightTons: data.weightTons,
      notes: data.notes || null,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function editConsumption(data: {
  id: string;
  date: Date;
  weightTons: string;
  notes?: string;
}) {
  const [row] = await db
    .update(rawMaterialConsumptions)
    .set({
      date: data.date,
      weightTons: data.weightTons,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(rawMaterialConsumptions.id, data.id))
    .returning();
  return row;
}

export async function removeConsumption(id: string) {
  await db.delete(rawMaterialConsumptions).where(eq(rawMaterialConsumptions.id, id));
  return { success: true };
}
