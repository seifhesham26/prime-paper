import { db } from "@/db";
import { rawMaterialReceipts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function findReceiptById(id: string) {
  const [row] = await db
    .select()
    .from(rawMaterialReceipts)
    .where(eq(rawMaterialReceipts.id, id));
  return row ?? null;
}

export async function insertReceipt(
  data: {
    typeId: string;
    dateReceived: Date;
    weightTons: string;
    costEgp: string;
    notes?: string;
  },
  costPerTon: string,
  userId: string,
) {
  const [row] = await db
    .insert(rawMaterialReceipts)
    .values({
      typeId: data.typeId,
      dateReceived: data.dateReceived,
      weightTons: data.weightTons,
      costEgp: data.costEgp,
      costPerTon,
      notes: data.notes || null,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function editReceipt(
  data: {
    id: string;
    dateReceived: Date;
    weightTons: string;
    costEgp: string;
    notes?: string;
  },
  costPerTon: string,
) {
  const [row] = await db
    .update(rawMaterialReceipts)
    .set({
      dateReceived: data.dateReceived,
      weightTons: data.weightTons,
      costEgp: data.costEgp,
      costPerTon,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(rawMaterialReceipts.id, data.id))
    .returning();
  return row;
}

export async function removeReceipt(id: string) {
  await db.delete(rawMaterialReceipts).where(eq(rawMaterialReceipts.id, id));
  return { success: true };
}
