ALTER TABLE "raw_material_types" ADD COLUMN "waste_percent" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gsm" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD COLUMN "product_id" uuid;
--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD CONSTRAINT "raw_material_consumptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "raw_material_consumptions_product_id_idx" ON "raw_material_consumptions" ("product_id");
