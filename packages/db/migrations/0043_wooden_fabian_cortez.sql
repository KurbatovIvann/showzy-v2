ALTER TABLE "orders" DROP CONSTRAINT "orders_status_check";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_confirmed_requires_confirmed_at_check";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('new', 'confirmed', 'in_progress', 'done', 'canceled'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_requires_confirmed_at_check" CHECK ("orders"."status" NOT IN ('confirmed', 'in_progress', 'done') OR "orders"."confirmed_at" IS NOT NULL);