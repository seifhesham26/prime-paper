import { db } from "@/db";
import { companies, deliveries } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { z } from "zod";
import type { CreateCompanySchema, UpdateCompanySchema } from "./types";

export async function findCompanies(page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: sql`count(*)` }).from(companies);
  const total = Number(totalResult?.count || 0);

  const data = await db
    .select()
    .from(companies)
    .orderBy(desc(companies.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/** Blocks deletion of a company a delivery still refers to. */
export async function countCompanyDeliveries(id: string) {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(deliveries)
    .where(eq(deliveries.companyId, id));
  return Number(row?.count || 0);
}

export async function insertCompany(
  data: z.infer<typeof CreateCompanySchema>,
  userId: string,
) {
  const [newCompany] = await db.insert(companies).values({
    createdBy: userId,
    name: data.name,
    contactPerson: data.contactPerson || null,
    phone: data.phone || null,
    address: data.address || null,
    notes: data.notes || null,
  }).returning();
  return newCompany;
}

export async function editCompany(data: z.infer<typeof UpdateCompanySchema>) {
  const [updatedCompany] = await db
    .update(companies)
    .set({
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, data.id))
    .returning();
  return updatedCompany;
}

export async function removeCompany(id: string) {
  await db.delete(companies).where(eq(companies.id, id));
  return { success: true };
}
