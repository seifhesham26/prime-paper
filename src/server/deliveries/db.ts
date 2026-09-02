import { db } from "@/db";
import { deliveries, deliveryItems, payments, companies, products } from "@/db/schema";
import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";
import type { z } from "zod";
import type {
  CreateDeliverySchema,
  UpdateDeliverySchema,
  AddPaymentSchema,
  UpdatePaymentSchema,
} from "./types";
import { PAYMENT_STATUS_SQL } from "./status";
import { likePattern, pickSortKey } from "../shared/list-query";
import { DELIVERY_SORT_KEYS } from "./types";

/** Recompute a delivery's status from its payments in one atomic statement. */
export async function recomputeDeliveryStatus(deliveryId: string) {
  await db
    .update(deliveries)
    .set({
      paymentStatus: PAYMENT_STATUS_SQL as never,
      updatedAt: new Date(),
    })
    .where(eq(deliveries.id, deliveryId));
}

export async function findDeliveries(
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
        ilike(companies.name, likePattern(term)),
        ilike(deliveries.notes, likePattern(term)),
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(deliveries)
    .leftJoin(companies, eq(deliveries.companyId, companies.id))
    .where(where);
  const total = Number(totalResult?.count || 0);

  const SORT_COLUMNS = {
    date: deliveries.date,
    companyName: companies.name,
    sellingPriceEgp: deliveries.sellingPriceEgp,
    paymentStatus: deliveries.paymentStatus,
  } as const;

  const key = pickSortKey(sortBy, DELIVERY_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key ? direction(SORT_COLUMNS[key]) : desc(deliveries.date);

  const data = await db
    .select({
      id: deliveries.id,
      date: deliveries.date,
      companyId: deliveries.companyId,
      companyName: companies.name,
      sellingPriceEgp: deliveries.sellingPriceEgp,
      paymentStatus: deliveries.paymentStatus,
      notes: deliveries.notes,
      createdAt: deliveries.createdAt,
    })
    .from(deliveries)
    .leftJoin(companies, eq(deliveries.companyId, companies.id))
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

export async function findDeliveryById(id: string) {
  const [delivery] = await db
    .select({
      id: deliveries.id,
      date: deliveries.date,
      companyId: deliveries.companyId,
      companyName: companies.name,
      sellingPriceEgp: deliveries.sellingPriceEgp,
      paymentStatus: deliveries.paymentStatus,
      notes: deliveries.notes,
    })
    .from(deliveries)
    .leftJoin(companies, eq(deliveries.companyId, companies.id))
    .where(eq(deliveries.id, id));

  if (!delivery) return null;

  const items = await db
    .select({
      id: deliveryItems.id,
      productId: deliveryItems.productId,
      quantity: deliveryItems.quantity,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      weightKg: products.weightKg,
    })
    .from(deliveryItems)
    .leftJoin(products, eq(deliveryItems.productId, products.id))
    .where(eq(deliveryItems.deliveryId, id));

  const paymentsList = await db
    .select()
    .from(payments)
    .where(eq(payments.deliveryId, id))
    .orderBy(desc(payments.date));

  const [totalPaid] = await db
    .select({ total: sql<string>`COALESCE(SUM(${payments.amountEgp}), 0)` })
    .from(payments)
    .where(eq(payments.deliveryId, id));

  return {
    ...delivery,
    items,
    payments: paymentsList,
    totalPaid: Number(totalPaid?.total || 0),
    remaining: Number(delivery.sellingPriceEgp) - Number(totalPaid?.total || 0),
  };
}

export async function insertDelivery(
  data: z.infer<typeof CreateDeliverySchema>,
  userId: string,
) {
  // The id is generated here rather than by the database so both inserts can
  // go in one batch. db.batch runs as a single transaction but cannot feed
  // one statement's result into the next, so the items would otherwise have
  // no delivery id to reference.
  const deliveryId = crypto.randomUUID();

  const insertRow = db.insert(deliveries).values({
    id: deliveryId,
    date: data.date,
    companyId: data.companyId,
    sellingPriceEgp: data.sellingPriceEgp,
    paymentStatus: "unpaid",
    notes: data.notes || null,
    createdBy: userId,
  });

  if (data.items.length > 0) {
    await db.batch([
      insertRow,
      db.insert(deliveryItems).values(
        data.items.map((item) => ({
          deliveryId,
          productId: item.productId,
          quantity: item.quantity,
        })),
      ),
    ]);
  } else {
    await insertRow;
  }

  return { id: deliveryId };
}

export async function editDelivery(data: z.infer<typeof UpdateDeliverySchema>) {
  // Batched so replacing the items cannot half-apply and lose them.
  const updateRow = db
    .update(deliveries)
    .set({
      date: data.date,
      companyId: data.companyId,
      sellingPriceEgp: data.sellingPriceEgp,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(deliveries.id, data.id));

  const clearItems = db.delete(deliveryItems).where(eq(deliveryItems.deliveryId, data.id));

  if (data.items.length > 0) {
    await db.batch([
      updateRow,
      clearItems,
      db.insert(deliveryItems).values(
        data.items.map((item) => ({
          deliveryId: data.id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      ),
    ]);
  } else {
    await db.batch([updateRow, clearItems]);
  }

  // The price may have changed, which can flip the status either way.
  await recomputeDeliveryStatus(data.id);
  return { id: data.id };
}

export async function removeDelivery(id: string) {
  await db.delete(deliveries).where(eq(deliveries.id, id));
  return { success: true };
}

export async function insertPayment(
  data: z.infer<typeof AddPaymentSchema>,
  userId: string,
) {
  await db.insert(payments).values({
    deliveryId: data.deliveryId,
    amountEgp: data.amountEgp,
    date: data.date,
    notes: data.notes || null,
    createdBy: userId,
  });

  await recomputeDeliveryStatus(data.deliveryId);
  return { success: true };
}

export async function findPaymentById(id: string) {
  const [row] = await db.select().from(payments).where(eq(payments.id, id));
  return row ?? null;
}

export async function editPayment(data: z.infer<typeof UpdatePaymentSchema>) {
  const [row] = await db
    .update(payments)
    .set({ amountEgp: data.amountEgp, date: data.date, notes: data.notes || null })
    .where(eq(payments.id, data.id))
    .returning({ deliveryId: payments.deliveryId });

  if (row) await recomputeDeliveryStatus(row.deliveryId);
  return { success: true };
}

export async function removePayment(id: string) {
  const [row] = await db
    .delete(payments)
    .where(eq(payments.id, id))
    .returning({ deliveryId: payments.deliveryId });

  if (row) await recomputeDeliveryStatus(row.deliveryId);
  return { success: true };
}
