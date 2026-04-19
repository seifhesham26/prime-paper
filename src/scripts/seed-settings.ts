import { db } from "@/db";
import { systemSettings, dashboardCards } from "@/db/schema";

async function seed() {
  console.log("🌱 Seeding system settings...");

  // System Settings
  await db.insert(systemSettings).values([
    { key: "page_size_default", value: "100", category: "operational" },
    { key: "dropdown_list_limit", value: "1000", category: "operational" },
    { key: "dashboard_recent_deliveries", value: "5", category: "dashboard" },
    { key: "dashboard_top_unpaid", value: "5", category: "dashboard" },
    { key: "dashboard_chart_months", value: "6", category: "dashboard" },
  ]).onConflictDoNothing();

  console.log("✅ System settings seeded");

  // Dashboard Cards
  console.log("🌱 Seeding dashboard cards...");

  const existing = await db.select().from(dashboardCards);
  if (existing.length === 0) {
    await db.insert(dashboardCards).values([
      {
        title: "Total Raw Materials",
        titleAr: "إجمالي المواد الخام",
        equation: "SUM(raw_materials.weight_tons)",
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
        equation: "SUM_UNPAID(deliveries.selling_price_egp) + SUM_PARTIAL(deliveries.selling_price_egp) - SUM(payments.amount_egp)",
        unit: "egp",
        icon: "CreditCard",
        gradient: "from-rose-500 to-rose-600",
        sortOrder: 3,
        visible: true,
      },
    ]);
    console.log("✅ Dashboard cards seeded (4 default cards)");
  } else {
    console.log("⏭️  Dashboard cards already exist, skipping");
  }

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
