import { findRawMaterials, insertRawMaterial, editRawMaterial, removeRawMaterial } from "./db";
import type { z } from "zod";
import type { CreateRawMaterialSchema, UpdateRawMaterialSchema } from "./types";

export async function getRawMaterialsService(page: number, limit: number) {
  return await findRawMaterials(page, limit);
}

export async function createRawMaterialService(data: z.infer<typeof CreateRawMaterialSchema>) {
  const costPerTon = (
    parseFloat(data.costEgp) / parseFloat(data.weightTons)
  ).toFixed(2);
  
  return await insertRawMaterial(data, costPerTon);
}

export async function updateRawMaterialService(data: z.infer<typeof UpdateRawMaterialSchema>) {
  const costPerTon = (
    parseFloat(data.costEgp) / parseFloat(data.weightTons)
  ).toFixed(2);

  return await editRawMaterial(data, costPerTon);
}

export async function deleteRawMaterialService(id: string) {
  return await removeRawMaterial(id);
}
