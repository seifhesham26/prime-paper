import { z } from "zod";
import { moneySchema, weightTonsSchema } from "@/server/shared/validation";

// ─── Types (Parent Material) ─────────────────────────────
export const CreateTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  notes: z.string().optional(),
});

export const UpdateTypeSchema = CreateTypeSchema.extend({
  id: z.string().uuid(),
});

export const GetTypesSchema = z.object({
  page: z.number().int().min(1).default(1),
  /** Fetching to fill a picker rather than to page a table. */
  forDropdown: z.boolean().default(false),
});

export const IdSchema = z.object({ id: z.string().uuid() });

// ─── Receipts ────────────────────────────────────────────
export const CreateReceiptSchema = z.object({
  typeId: z.string().uuid(),
  dateReceived: z.date(),
  weightTons: weightTonsSchema,
  costEgp: moneySchema,
  notes: z.string().optional(),
});

export const UpdateReceiptSchema = CreateReceiptSchema.omit({ typeId: true }).extend({
  id: z.string().uuid(),
});

// ─── Consumptions ────────────────────────────────────────
export const CreateConsumptionSchema = z.object({
  typeId: z.string().uuid(),
  date: z.date(),
  weightTons: weightTonsSchema,
  notes: z.string().optional(),
});

export const UpdateConsumptionSchema = CreateConsumptionSchema.omit({ typeId: true }).extend({
  id: z.string().uuid(),
});

export type RawMaterialType = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  receivedTons: string;
  consumedTons: string;
  balanceTons: string;
  totalCostEgp: string;
  avgCostPerTon: string | null;
};
