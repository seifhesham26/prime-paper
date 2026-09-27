import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { computeConsumedTons, resolveWastePercent } from "./production";
import { toUnits } from "../shared/validation";
import { getSettingsMap } from "../settings/db";
import { findTypeTotals } from "../raw-materials/types.db";
import {
  buildInsertProductConsumption,
  buildDeleteConsumptionForProduct,
  findConsumptionByProductId,
  type ProductConsumptionInput,
} from "../raw-materials/consumptions.db";
import {
  findProducts,
  countProductDeliveryItems,
  buildInsertProduct,
  buildUpdateProduct,
  buildDeleteProduct,
} from "./db";
import type { z } from "zod";
import type { CreateProductSchema, UpdateProductSchema } from "./types";

export async function getProductsService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return await findProducts(page, limit, search, sortBy, sortDir);
}

/**
 * The single place a production-sourced consumption row is built.
 *
 * Returns null when the product declares no raw material — such a product is
 * informational and moves no weight, exactly as before this feature existed.
 *
 * Nothing else in the codebase may write a row with source 'production'. If a
 * second writer ever appears, the derived balance will drift and there is no
 * stored value to check it against.
 */
async function syncProductConsumption(
  productId: string,
  data: { rawMaterialTypeId?: string; dateProduced: Date; weightKg: string; quantity: number },
  userId: string,
  isUpdate = false,
): Promise<ProductConsumptionInput | null> {
  if (!data.rawMaterialTypeId) return null;

  // findTypeTotals, not findTypeById: one query instead of four, and this runs
  // on every product write.
  const [totals, settings] = await Promise.all([
    findTypeTotals(data.rawMaterialTypeId),
    getSettingsMap(),
  ]);
  if (!totals) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Raw material type not found" });
  }

  const wastePercent = resolveWastePercent(totals.wastePercent, settings.defaultWastePercent);
  const weightTons = computeConsumedTons(data.weightKg, data.quantity, wastePercent);

  if (!settings.allowNegativeStock) {
    // On update the old consumption is about to be deleted, so its weight is
    // released back into the balance. Without this adjustment, editing a
    // product's weight down would see a falsely low balance and reject.
    let available = toUnits(totals.balanceTons, 3);
    if (isUpdate) {
      const existing = await findConsumptionByProductId(productId);
      if (existing && existing.typeId === data.rawMaterialTypeId) {
        available += toUnits(existing.weightTons, 3);
      }
    }
    const remaining = available - toUnits(weightTons, 3);
    if (remaining < 0) {
      const availableTons = (available / 1000).toFixed(3);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Not enough stock: this run needs ${weightTons} t but only ${availableTons} t remain.`,
      });
    }
  }

  return {
    typeId: data.rawMaterialTypeId,
    productId,
    date: data.dateProduced,
    weightTons,
    userId,
  };
}

export async function createProductService(
  data: z.infer<typeof CreateProductSchema>,
  userId: string,
) {
  const id = randomUUID();
  const consumptionInput = await syncProductConsumption(id, data, userId);
  const product = buildInsertProduct(data, userId, id);

  if (consumptionInput) {
    await db.batch([product, buildInsertProductConsumption(consumptionInput)]);
  } else {
    await product;
  }
  return { id };
}

export async function updateProductService(
  data: z.infer<typeof UpdateProductSchema>,
  userId: string,
) {
  const consumptionInput = await syncProductConsumption(data.id, data, userId, true);
  const product = buildUpdateProduct(data);
  const clear = buildDeleteConsumptionForProduct(data.id);

  // Delete-then-insert rather than read-then-update: deterministic, idempotent,
  // and it correctly drops the row when the material type is cleared.
  if (consumptionInput) {
    await db.batch([product, clear, buildInsertProductConsumption(consumptionInput)]);
  } else {
    await db.batch([product, clear]);
  }
  return { id: data.id };
}

export async function deleteProductService(id: string) {
  const linked = await countProductDeliveryItems(id);
  if (linked > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this product: it appears in ${linked} delivery item(s).`,
    });
  }
  // Consumption first: it holds the foreign key to the product.
  await db.batch([buildDeleteConsumptionForProduct(id), buildDeleteProduct(id)]);
  return { success: true };
}
