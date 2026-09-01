import { db } from "@/db";
import {
  rawMaterialTypes,
  rawMaterialReceipts,
  rawMaterialConsumptions,
  products,
} from "@/db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import { weightedAvgCostPerTon } from "./balance";

// Scalar subqueries, deliberately. Joining both child tables under one
// GROUP BY produces a Cartesian fan-out that inflates both sums.
const receivedSql = sql<string>`COALESCE((
  SELECT SUM(r.weight_tons) FROM raw_material_receipts r WHERE r.type_id = ${rawMaterialTypes.id}
), 0)`;

const consumedSql = sql<string>`COALESCE((
  SELECT SUM(c.weight_tons) FROM raw_material_consumptions c WHERE c.type_id = ${rawMaterialTypes.id}
), 0)`;

const totalCostSql = sql<string>`COALESCE((
  SELECT SUM(r.cost_egp) FROM raw_material_receipts r WHERE r.type_id = ${rawMaterialTypes.id}
), 0)`;

function withDerived<
  T extends { receivedTons: string; consumedTons: string; totalCostEgp: string },
>(row: T) {
  return {
    ...row,
    balanceTons: (Number(row.receivedTons) - Number(row.consumedTons)).toFixed(3),
    avgCostPerTon: weightedAvgCostPerTon(row.totalCostEgp, row.receivedTons),
  };
}

export async function findTypes(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const [totalResult] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialTypes);
  const total = Number(totalResult?.count || 0);

  const rows = await db
    .select({
      id: rawMaterialTypes.id,
      name: rawMaterialTypes.name,
      notes: rawMaterialTypes.notes,
      createdAt: rawMaterialTypes.createdAt,
      receivedTons: receivedSql,
      consumedTons: consumedSql,
      totalCostEgp: totalCostSql,
    })
    .from(rawMaterialTypes)
    .orderBy(asc(rawMaterialTypes.name))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(withDerived),
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findTypeTotals(id: string) {
  const [row] = await db
    .select({
      receivedTons: receivedSql,
      consumedTons: consumedSql,
      totalCostEgp: totalCostSql,
    })
    .from(rawMaterialTypes)
    .where(eq(rawMaterialTypes.id, id));

  if (!row) return null;

  const derived = withDerived(row);
  return {
    receivedTons: derived.receivedTons,
    consumedTons: derived.consumedTons,
    balanceTons: derived.balanceTons,
  };
}

export async function findTypeById(id: string) {
  const [row] = await db
    .select({
      id: rawMaterialTypes.id,
      name: rawMaterialTypes.name,
      notes: rawMaterialTypes.notes,
      createdAt: rawMaterialTypes.createdAt,
      receivedTons: receivedSql,
      consumedTons: consumedSql,
      totalCostEgp: totalCostSql,
    })
    .from(rawMaterialTypes)
    .where(eq(rawMaterialTypes.id, id));

  if (!row) return null;

  const receipts = await db
    .select()
    .from(rawMaterialReceipts)
    .where(eq(rawMaterialReceipts.typeId, id))
    .orderBy(desc(rawMaterialReceipts.dateReceived));

  const consumptions = await db
    .select()
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.typeId, id))
    .orderBy(desc(rawMaterialConsumptions.date));

  const linkedProducts = await db
    .select({
      id: products.id,
      dateProduced: products.dateProduced,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      weightKg: products.weightKg,
      quantity: products.quantity,
    })
    .from(products)
    .where(eq(products.rawMaterialTypeId, id))
    .orderBy(desc(products.dateProduced));

  return { ...withDerived(row), receipts, consumptions, products: linkedProducts };
}

export async function countTypeChildren(id: string) {
  const [r] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialReceipts)
    .where(eq(rawMaterialReceipts.typeId, id));
  const [c] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.typeId, id));
  const [p] = await db
    .select({ count: sql<string>`count(*)` })
    .from(products)
    .where(eq(products.rawMaterialTypeId, id));

  return {
    receipts: Number(r?.count || 0),
    consumptions: Number(c?.count || 0),
    products: Number(p?.count || 0),
  };
}

export async function insertType(data: { name: string; notes?: string }, userId: string) {
  const [row] = await db
    .insert(rawMaterialTypes)
    .values({ name: data.name, notes: data.notes || null, createdBy: userId })
    .returning();
  return row;
}

export async function editType(data: { id: string; name: string; notes?: string }) {
  const [row] = await db
    .update(rawMaterialTypes)
    .set({ name: data.name, notes: data.notes || null, updatedAt: new Date() })
    .where(eq(rawMaterialTypes.id, data.id))
    .returning();
  return row;
}

export async function removeType(id: string) {
  await db.delete(rawMaterialTypes).where(eq(rawMaterialTypes.id, id));
  return { success: true };
}
