import { db } from "@/db";
import { systemSettings, dashboardCards } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// ─── System Settings ─────────────────────────────────────

export async function getAllSettings() {
  return db.select().from(systemSettings);
}

export async function getSettingByKey(key: string) {
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  return result[0] ?? null;
}

export async function upsertSetting(key: string, value: string) {
  const existing = await getSettingByKey(key);
  if (existing) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({
      key,
      value,
      category: "operational",
      updatedAt: new Date(),
    });
  }
}

// ─── Dashboard Cards ─────────────────────────────────────

export async function getAllDashboardCards() {
  return db
    .select()
    .from(dashboardCards)
    .orderBy(asc(dashboardCards.sortOrder));
}

export async function getVisibleDashboardCards() {
  return db
    .select()
    .from(dashboardCards)
    .where(eq(dashboardCards.visible, true))
    .orderBy(asc(dashboardCards.sortOrder));
}

export async function createDashboardCard(data: {
  title: string;
  titleAr: string;
  equation: string;
  unit: string;
  icon: string;
  gradient: string;
  sortOrder: number;
  visible: boolean;
}) {
  const result = await db.insert(dashboardCards).values(data).returning();
  return result[0];
}

export async function updateDashboardCard(
  id: string,
  data: Partial<{
    title: string;
    titleAr: string;
    equation: string;
    unit: string;
    icon: string;
    gradient: string;
    sortOrder: number;
    visible: boolean;
  }>
) {
  await db
    .update(dashboardCards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dashboardCards.id, id));
}

export async function deleteDashboardCard(id: string) {
  await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
}

export async function reorderDashboardCards(
  cards: { id: string; sortOrder: number }[]
) {
  for (const card of cards) {
    await db
      .update(dashboardCards)
      .set({ sortOrder: card.sortOrder, updatedAt: new Date() })
      .where(eq(dashboardCards.id, card.id));
  }
}
