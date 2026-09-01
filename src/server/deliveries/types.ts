import { z } from "zod";
import { moneySchema, positiveMoneySchema } from "@/server/shared/validation";

const DeliveryItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

// paymentStatus is deliberately absent — it is always derived from the
// payments recorded against the delivery, never chosen by the user.
export const CreateDeliverySchema = z.object({
  date: z.date(),
  companyId: z.string().uuid(),
  sellingPriceEgp: moneySchema,
  notes: z.string().optional(),
  items: z.array(DeliveryItemSchema),
});

export const UpdateDeliverySchema = CreateDeliverySchema.extend({
  id: z.string().uuid(),
});

export const AddPaymentSchema = z.object({
  deliveryId: z.string().uuid(),
  amountEgp: positiveMoneySchema,
  date: z.date(),
  notes: z.string().optional(),
});

export const UpdatePaymentSchema = z.object({
  id: z.string().uuid(),
  amountEgp: positiveMoneySchema,
  date: z.date(),
  notes: z.string().optional(),
});

export const GetDeliveriesSchema = z.object({
  page: z.number().int().min(1).default(1),
});

export const DeleteDeliverySchema = z.object({
  id: z.string().uuid(),
});

export const GetDeliveryByIdSchema = z.object({
  id: z.string().uuid(),
});

// Defining output types manually for clearer return inference without bloated Drizzle schemas on client
export type DeliveryItem = {
  id: string;
  productId: string;
  quantity: number;
  lengthM: string | null;
  widthCm: string | null;
  weightKg: string | null;
};

export type DeliveryPayment = {
  id: string;
  deliveryId: string;
  amountEgp: string;
  date: Date;
  notes: string | null;
  createdAt: Date;
};

export type DeliveryDetail = {
  id: string;
  date: Date;
  companyId: string;
  companyName: string | null;
  sellingPriceEgp: string;
  paymentStatus: "paid" | "partial" | "unpaid" | null;
  notes: string | null;
  items: DeliveryItem[];
  payments: DeliveryPayment[];
  totalPaid: number;
  remaining: number;
};
