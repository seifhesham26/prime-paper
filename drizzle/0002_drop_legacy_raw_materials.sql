ALTER TABLE "raw_materials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "invitation" CASCADE;--> statement-breakpoint
DROP TABLE "raw_materials" CASCADE;--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_raw_material_id_raw_materials_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "raw_material_id";