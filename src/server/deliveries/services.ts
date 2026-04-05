import { findDeliveries, findDeliveryById, insertDelivery, removeDelivery, insertPayment } from "./db";
import type { z } from "zod";
import type { CreateDeliverySchema, AddPaymentSchema } from "./types";

export async function getDeliveriesService(page: number, limit: number) {
  return await findDeliveries(page, limit);
}

export async function getDeliveryByIdService(id: string) {
  return await findDeliveryById(id);
}

export async function createDeliveryService(data: z.infer<typeof CreateDeliverySchema>) {
  return await insertDelivery(data);
}

export async function deleteDeliveryService(id: string) {
  return await removeDelivery(id);
}

export async function addPaymentService(data: z.infer<typeof AddPaymentSchema>) {
  return await insertPayment(data);
}
