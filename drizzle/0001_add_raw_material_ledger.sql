CREATE TABLE "raw_material_consumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"weight_tons" numeric(10, 3) NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_material_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid NOT NULL,
	"date_received" timestamp NOT NULL,
	"weight_tons" numeric(10, 3) NOT NULL,
	"cost_egp" numeric(12, 2) NOT NULL,
	"cost_per_ton" numeric(12, 2),
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_material_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "raw_material_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "raw_material_type_id" uuid;--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD CONSTRAINT "raw_material_consumptions_type_id_raw_material_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."raw_material_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD CONSTRAINT "raw_material_consumptions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_material_receipts" ADD CONSTRAINT "raw_material_receipts_type_id_raw_material_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."raw_material_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_material_receipts" ADD CONSTRAINT "raw_material_receipts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_material_types" ADD CONSTRAINT "raw_material_types_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_raw_material_type_id_raw_material_types_id_fk" FOREIGN KEY ("raw_material_type_id") REFERENCES "public"."raw_material_types"("id") ON DELETE set null ON UPDATE no action;