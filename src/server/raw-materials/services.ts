import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { canConsume, costPerTon } from "./balance";
import { toUnits } from "@/server/shared/validation";
import {
  findTypes,
  findTypeById,
  findTypeTotals,
  countTypeChildren,
  insertType,
  editType,
  removeType,
} from "./types.db";
import { findReceiptById, insertReceipt, editReceipt, removeReceipt } from "./receipts.db";
import {
  findConsumptionById,
  insertConsumption,
  editConsumption,
  removeConsumption,
} from "./consumptions.db";
import type {
  CreateTypeSchema,
  UpdateTypeSchema,
  CreateReceiptSchema,
  UpdateReceiptSchema,
  CreateConsumptionSchema,
  UpdateConsumptionSchema,
} from "./types";

const TON_SCALE = 3;

function tons(units: number): string {
  return (units / 10 ** TON_SCALE).toFixed(TON_SCALE);
}

async function requireTotals(typeId: string) {
  const totals = await findTypeTotals(typeId);
  if (!totals) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Raw material type not found" });
  }
  return totals;
}

// ─── Types ───────────────────────────────────────────────
export async function getTypesService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return findTypes(page, limit, search, sortBy, sortDir);
}

export async function getTypeByIdService(id: string) {
  const type = await findTypeById(id);
  if (!type) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Raw material type not found" });
  }
  return type;
}

export async function createTypeService(
  data: z.infer<typeof CreateTypeSchema>,
  userId: string,
) {
  return insertType(data, userId);
}

export async function updateTypeService(data: z.infer<typeof UpdateTypeSchema>) {
  return editType(data);
}

export async function deleteTypeService(id: string) {
  const children = await countTypeChildren(id);
  const blockers: string[] = [];
  if (children.receipts > 0) blockers.push(`${children.receipts} receipt(s)`);
  if (children.consumptions > 0) blockers.push(`${children.consumptions} consumption(s)`);
  if (children.products > 0) blockers.push(`${children.products} product(s)`);

  if (blockers.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this material: it still has ${blockers.join(", ")}.`,
    });
  }

  return removeType(id);
}

// ─── Receipts ────────────────────────────────────────────
export async function createReceiptService(
  data: z.infer<typeof CreateReceiptSchema>,
  userId: string,
) {
  await requireTotals(data.typeId);
  return insertReceipt(data, costPerTon(data.costEgp, data.weightTons), userId);
}

export async function updateReceiptService(data: z.infer<typeof UpdateReceiptSchema>) {
  const existing = await findReceiptById(data.id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Receipt not found" });
  }

  // Lowering a receipt must not drive the balance negative.
  const totals = await requireTotals(existing.typeId);
  const balanceAfter =
    toUnits(totals.balanceTons, TON_SCALE) -
    toUnits(existing.weightTons, TON_SCALE) +
    toUnits(data.weightTons, TON_SCALE);

  if (balanceAfter < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Reducing this receipt would leave a negative balance (${tons(balanceAfter)} t). Remove consumption entries first.`,
    });
  }

  return editReceipt(data, costPerTon(data.costEgp, data.weightTons));
}

export async function deleteReceiptService(id: string) {
  const existing = await findReceiptById(id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Receipt not found" });
  }

  const totals = await requireTotals(existing.typeId);
  const balanceAfter =
    toUnits(totals.balanceTons, TON_SCALE) - toUnits(existing.weightTons, TON_SCALE);

  if (balanceAfter < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Deleting this receipt would leave a negative balance (${tons(balanceAfter)} t). Remove consumption entries first.`,
    });
  }

  return removeReceipt(id);
}

// ─── Consumptions ────────────────────────────────────────
export async function createConsumptionService(
  data: z.infer<typeof CreateConsumptionSchema>,
  userId: string,
) {
  const totals = await requireTotals(data.typeId);

  if (!canConsume(totals.balanceTons, data.weightTons)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot consume ${data.weightTons} t — only ${totals.balanceTons} t remain.`,
    });
  }

  return insertConsumption(data, userId);
}

export async function updateConsumptionService(
  data: z.infer<typeof UpdateConsumptionSchema>,
) {
  const existing = await findConsumptionById(data.id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Consumption entry not found" });
  }

  // Compare against the balance with this entry's own weight added back,
  // otherwise editing 5t down to 4t is measured against a balance that
  // already counts the 5t.
  const totals = await requireTotals(existing.typeId);
  const available =
    toUnits(totals.balanceTons, TON_SCALE) + toUnits(existing.weightTons, TON_SCALE);

  if (toUnits(data.weightTons, TON_SCALE) > available) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot consume ${data.weightTons} t — only ${tons(available)} t are available.`,
    });
  }

  return editConsumption(data);
}

export async function deleteConsumptionService(id: string) {
  const existing = await findConsumptionById(id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Consumption entry not found" });
  }
  return removeConsumption(id);
}
