import { z } from "zod";

const DeliveryItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const CreateDeliverySchema = z.object({
  date: z.date(),
  companyId: z.string().uuid(),
  sellingPriceEgp: z.string().min(1, "Price is required"),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]),
  notes: z.string().optional(),
  items: z.array(DeliveryItemSchema),
});

export const AddPaymentSchema = z.object({
  deliveryId: z.string().uuid(),
  amountEgp: z.string().min(1, "Amount is required"),
  date: z.date(),
  notes: z.string().optional(),
});

export const GetDeliveriesSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
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
