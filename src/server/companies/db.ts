import { db } from "@/db";
import { companies, deliveries } from "@/db/schema";
import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";
import type { z } from "zod";
import { likePattern, pickSortKey } from "../shared/list-query";
import { COMPANY_SORT_KEYS } from "./types";
import type { CreateCompanySchema, UpdateCompanySchema } from "./types";

export async function findCompanies(
  page = 1,
  limit = 10,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  const offset = (page - 1) * limit;

  // The count and the page must share one predicate, or totalPages
  // describes a different result set than the rows returned.
  const term = search?.trim();
  const where = term
    ? or(
        ilike(companies.name, likePattern(term)),
        ilike(companies.contactPerson, likePattern(term)),
        ilike(companies.phone, likePattern(term)),
        ilike(companies.address, likePattern(term)),
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(companies)
    .where(where);
  const total = Number(totalResult?.count || 0);

  const SORT_COLUMNS = {
    name: companies.name,
    contactPerson: companies.contactPerson,
    createdAt: companies.createdAt,
  } as const;

  const key = pickSortKey(sortBy, COMPANY_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key ? direction(SORT_COLUMNS[key]) : desc(companies.createdAt);

  const data = await db
    .select()
    .from(companies)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
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
