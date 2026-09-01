// Seed script - run with: node src/scripts/seed-settings.mjs
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const dashboardCards = pgTable("dashboard_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  equation: text("equation").notNull(),
  unit: text("unit").notNull(),
  icon: text("icon").notNull(),
  gradient: text("gradient").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const defaultCards = [
  {
    title: "Raw Material Balance",
    titleAr: "رصيد المواد الخام",
    equation: "BALANCE(raw_materials)",
    unit: "tons",
    icon: "Package",
    gradient: "from-blue-500 to-blue-600",
    sortOrder: 0,
    visible: true,
  },
  {
    title: "Total Products",
    titleAr: "إجمالي المنتجات",
    equation: "SUM(products.quantity)",
    unit: "rolls",
    icon: "Factory",
    gradient: "from-emerald-500 to-emerald-600",
    sortOrder: 1,
    visible: true,
  },
  {
    title: "Sales This Month",
    titleAr: "مبيعات الشهر",
    equation: "SUM_THIS_MONTH(deliveries.selling_price_egp)",
    unit: "egp",
    icon: "Truck",
    gradient: "from-amber-500 to-amber-600",
    sortOrder: 2,
    visible: true,
  },
  {
    title: "Outstanding Payments",
    titleAr: "المدفوعات المعلقة",
    // Was unpaid + partial - ALL payments, which let an overpaid delivery
    // cancel out debt on another.
    equation: "OUTSTANDING(deliveries)",
    unit: "egp",
    icon: "CreditCard",
    gradient: "from-rose-500 to-rose-600",
    sortOrder: 3,
    visible: true,
  },
];

async function seed() {
  console.log("🌱 Seeding system settings...");

  await db
    .insert(systemSettings)
    .values([
      { key: "page_size_default", value: "50", category: "operational" },
      { key: "dropdown_list_limit", value: "1000", category: "operational" },
      { key: "dashboard_recent_deliveries", value: "5", category: "dashboard" },
      { key: "dashboard_top_unpaid", value: "5", category: "dashboard" },
      { key: "dashboard_chart_months", value: "6", category: "dashboard" },
      // Without this row the toggle can never be switched on: the Settings
      // screen only edits keys that already exist. Defaults to off.
      { key: "allow_public_signup", value: "false", category: "operational" },
    ])
    .onConflictDoNothing();

  console.log("✅ System settings seeded");
  console.log("🌱 Seeding dashboard cards...");

  // Upsert by title so an existing database picks up corrected equations
  // instead of being skipped because some cards already exist.
  for (const card of defaultCards) {
    const [found] = await db
      .select({ id: dashboardCards.id })
      .from(dashboardCards)
      .where(eq(dashboardCards.title, card.title));

    if (found) {
      await db
        .update(dashboardCards)
        .set({ equation: card.equation, unit: card.unit, updatedAt: new Date() })
        .where(eq(dashboardCards.id, found.id));
      console.log(`  updated:  ${card.title}`);
    } else {
      await db.insert(dashboardCards).values(card);
      console.log(`  inserted: ${card.title}`);
    }
  }

  console.log("🎉 Seeding complete!");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
