import { db } from "@/db";
import { deliveries, deliveryItems, payments, companies, products } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { z } from "zod";
import type { CreateDeliverySchema, AddPaymentSchema } from "./types";

export async function findDeliveries(page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: sql`count(*)` }).from(deliveries);
  const total = Number(totalResult?.count || 0);

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
    .orderBy(desc(deliveries.date))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
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

export async function insertDelivery(data: z.infer<typeof CreateDeliverySchema>) {
  const [delivery] = await db
    .insert(deliveries)
    .values({
      date: data.date,
      companyId: data.companyId,
      sellingPriceEgp: data.sellingPriceEgp,
      paymentStatus: data.paymentStatus,
      notes: data.notes || null,
    })
    .returning({ id: deliveries.id });

  if (data.items.length > 0) {
    await db.insert(deliveryItems).values(
      data.items.map((item) => ({
        deliveryId: delivery.id,
        productId: item.productId,
        quantity: item.quantity,
      })),
    );
  }

  return delivery;
}

export async function removeDelivery(id: string) {
  await db.delete(deliveries).where(eq(deliveries.id, id));
  return { success: true };
}

export async function insertPayment(data: z.infer<typeof AddPaymentSchema>) {
  await db.insert(payments).values({
    deliveryId: data.deliveryId,
    amountEgp: data.amountEgp,
    date: data.date,
    notes: data.notes || null,
  });

  // Calculate and Update delivery payment status using accurate Drizzle aggregates
  const [totalPaidRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${payments.amountEgp}), 0)` })
    .from(payments)
    .where(eq(payments.deliveryId, data.deliveryId));

  const [deliveryRow] = await db
    .select({ sellingPriceEgp: deliveries.sellingPriceEgp })
    .from(deliveries)
    .where(eq(deliveries.id, data.deliveryId));

  const paid = Number(totalPaidRow?.total || 0);
  const total = Number(deliveryRow?.sellingPriceEgp || 0);

  let status: "paid" | "partial" | "unpaid" = "unpaid";
  if (paid >= total) status = "paid";
  else if (paid > 0) status = "partial";

  await db
    .update(deliveries)
    .set({ paymentStatus: status, updatedAt: new Date() })
    .where(eq(deliveries.id, data.deliveryId));

  return { success: true, status };
}
