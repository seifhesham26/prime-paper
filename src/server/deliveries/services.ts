import {
  findDeliveries,
  findDeliveryById,
  insertDelivery,
  editDelivery,
  removeDelivery,
  insertPayment,
  editPayment,
  removePayment,
} from "./db";
import type { z } from "zod";
import type {
  CreateDeliverySchema,
  UpdateDeliverySchema,
  AddPaymentSchema,
  UpdatePaymentSchema,
} from "./types";

export async function getDeliveriesService(page: number, limit: number) {
  return await findDeliveries(page, limit);
}

export async function getDeliveryByIdService(id: string) {
  return await findDeliveryById(id);
}

export async function createDeliveryService(
  data: z.infer<typeof CreateDeliverySchema>,
  userId: string,
) {
  return await insertDelivery(data, userId);
}

export async function updateDeliveryService(data: z.infer<typeof UpdateDeliverySchema>) {
  return await editDelivery(data);
}

export async function deleteDeliveryService(id: string) {
  return await removeDelivery(id);
}

export async function addPaymentService(
  data: z.infer<typeof AddPaymentSchema>,
  userId: string,
) {
  return await insertPayment(data, userId);
}

export async function updatePaymentService(data: z.infer<typeof UpdatePaymentSchema>) {
  return await editPayment(data);
}

export async function deletePaymentService(id: string) {
  return await removePayment(id);
}
