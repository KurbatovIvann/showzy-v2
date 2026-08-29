-- SHO-240 order_number. Drizzle emits `ADD COLUMN … NOT NULL` with no
-- default, which PostgreSQL rejects on existing orders (23502). Add
-- nullable, backfill a contiguous per-company sequence ordered by
-- created_at asc, id asc (not a UUID slice), then SET NOT NULL and the
-- UNIQUE / positive CHECKs. Nullable add + per-row UPDATE + SET NOT NULL
-- is the db.md §7 exception for widening populated tables (same as 0025).
ALTER TABLE "orders" ADD COLUMN "order_number" integer;--> statement-breakpoint
UPDATE "orders" AS o
SET "order_number" = numbered.n
FROM (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "company_id"
			ORDER BY "created_at" ASC, "id" ASC
		) AS n
	FROM "orders"
) AS numbered
WHERE o."id" = numbered."id";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_order_number_uq" UNIQUE("company_id","order_number");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_positive_check" CHECK ("orders"."order_number" > 0);
