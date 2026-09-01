import {
  pgTable,
  text,
  timestamp,
  decimal,
  integer,
  uuid,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────
export const paymentStatusEnum = pgEnum("payment_status", [
  "paid",
  "partial",
  "unpaid",
]);

// ─── Better Auth tables ──────────────────────────────────
// Better Auth will auto-create user/session/account tables
// We reference the user table for relations

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});


// ─── Raw Material Types (Parent Material) ────────────────
// The owner's own label for a kind of material, usually reflecting where it
// came from. Stock is never stored here — it is derived from the receipts
// and consumptions below, so the two can never disagree.
export const rawMaterialTypes = pgTable("raw_material_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Raw Material Receipts (Incoming Shipments) ──────────
export const rawMaterialReceipts = pgTable("raw_material_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  typeId: uuid("type_id")
    .notNull()
    .references(() => rawMaterialTypes.id),
  dateReceived: timestamp("date_received").notNull(),
  weightTons: decimal("weight_tons", { precision: 10, scale: 3 }).notNull(),
  costEgp: decimal("cost_egp", { precision: 12, scale: 2 }).notNull(),
  costPerTon: decimal("cost_per_ton", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Raw Material Consumptions (Converted to Rolls) ──────
// Recorded by hand when material goes into production. Nothing deducts
// automatically — a product's weight never moves this balance.
export const rawMaterialConsumptions = pgTable("raw_material_consumptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  typeId: uuid("type_id")
    .notNull()
    .references(() => rawMaterialTypes.id),
  date: timestamp("date").notNull(),
  weightTons: decimal("weight_tons", { precision: 10, scale: 3 }).notNull(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Products (Finished Rolls) ───────────────────────────
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawMaterialTypeId: uuid("raw_material_type_id").references(() => rawMaterialTypes.id, {
    onDelete: "set null",
  }),
  dateProduced: timestamp("date_produced").notNull(),
  lengthM: decimal("length_m", { precision: 10, scale: 2 }).notNull(),
  widthCm: decimal("width_cm", { precision: 10, scale: 2 }).notNull(),
  weightKg: decimal("weight_kg", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Companies (Clients) ────────────────────────────────
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Deliveries ──────────────────────────────────────────
export const deliveries = pgTable("deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: timestamp("date").notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  sellingPriceEgp: decimal("selling_price_egp", {
    precision: 12,
    scale: 2,
  }).notNull(),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("unpaid"),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Delivery Items ──────────────────────────────────────
export const deliveryItems = pgTable("delivery_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
});

// ─── Payments (Installments) ─────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  amountEgp: decimal("amount_egp", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Manual Password Reset Requests ──────────────────────
export const resetRequests = pgTable("reset_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  status: text("status", { enum: ["pending", "resolved"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── System Settings (Key-Value Config) ──────────────────
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  category: text("category").notNull(), // 'dashboard', 'operational', 'ui'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Dashboard Cards (Configurable Stat Cards) ──────────
export const dashboardCards = pgTable("dashboard_cards", {
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
