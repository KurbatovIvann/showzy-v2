-- Additive NOT NULL `name` on catalog tables that 0008 created without it.
-- Drizzle emits `ADD COLUMN … NOT NULL` with no default, which PostgreSQL
-- rejects on a non-empty table (23502). A temporary DEFAULT is the db.md §7
-- exception (same class as 0011): dropped immediately so the live column
-- matches catalog.ts (text NOT NULL, no default). SHO-96 / SHO-89 GUARD.
ALTER TABLE "product_variants" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "name" DROP DEFAULT;
