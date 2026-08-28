-- Additive NOT NULL `name` on price_lists that 0008 created without it.
-- Drizzle emits `ADD COLUMN … NOT NULL` with no default, which PostgreSQL
-- rejects on a non-empty table (23502). A temporary DEFAULT is the db.md §7
-- exception (same class as 0012): dropped immediately so the live column
-- matches pricing.ts (text NOT NULL, no default). SHO-171.
-- Backfill existing rows: `Default` when is_default, otherwise `Price list`.
-- The length CHECK is applied after backfill so the temporary default
-- (`Price list`) and `Default` both satisfy 1..120.
ALTER TABLE "price_lists" ADD COLUMN "name" text DEFAULT 'Price list' NOT NULL;--> statement-breakpoint
UPDATE "price_lists" SET "name" = 'Default' WHERE "is_default" = true;--> statement-breakpoint
ALTER TABLE "price_lists" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_name_length_check" CHECK (char_length("price_lists"."name") BETWEEN 1 AND 120);
