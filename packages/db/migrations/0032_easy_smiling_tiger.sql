-- SHO-250 text order_number + order_number_counters.
-- Drizzle emits ALTER TYPE text then the shape CHECK, which would leave
-- existing integer rows as '1' and fail the CHECK. Seed counters from the
-- integer max, rewrite via companies.prefix + v1 obfuscate_seq, then CHECK.
--
-- Foundation SQL exception (SHO-250 / db.md §7, ADR-0014): Drizzle cannot
-- express a typed rewrite that joins companies.prefix. Temporary helpers
-- are dropped at the end of this migration. The orders module must not
-- query companies after this.
CREATE TABLE "order_number_counters" (
	"company_id" uuid NOT NULL,
	"last_number" bigint NOT NULL,
	CONSTRAINT "order_number_counters_pk" PRIMARY KEY("company_id"),
	CONSTRAINT "order_number_counters_last_number_check" CHECK ("order_number_counters"."last_number" > 0)
);
--> statement-breakpoint
INSERT INTO "order_number_counters" ("company_id", "last_number")
SELECT "company_id", MAX("order_number")
FROM "orders"
GROUP BY "company_id";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_order_number_positive_check";
--> statement-breakpoint
CREATE FUNCTION showzy_sho250_to_base36(n bigint)
	RETURNS text
	LANGUAGE plpgsql
	SET search_path = ''
AS $$
DECLARE
	base36_chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	res          text := '';
	remainder    integer;
BEGIN
	IF n = 0 THEN
		RETURN '0';
	END IF;
	WHILE n > 0 LOOP
		remainder := n % 36;
		res := substr(base36_chars, remainder + 1, 1) || res;
		n := n / 36;
	END LOOP;
	RETURN res;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION showzy_sho250_obfuscate_seq(seq bigint)
	RETURNS text
	LANGUAGE plpgsql
	SET search_path = ''
AS $$
DECLARE
	secret_multiplier CONSTANT bigint := 73856093;
	secret_offset     CONSTANT bigint := 12345;
	obfuscated                 bigint;
BEGIN
	obfuscated := (seq * secret_multiplier + secret_offset) % 1000000007;
	RETURN public.showzy_sho250_to_base36(obfuscated);
END;
$$;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" SET DATA TYPE text USING (
	(SELECT c."prefix" FROM "companies" AS c WHERE c."id" = "orders"."company_id")
	|| '-' ||
	public.showzy_sho250_obfuscate_seq("order_number"::bigint)
);
--> statement-breakpoint
DROP FUNCTION showzy_sho250_obfuscate_seq(bigint);
--> statement-breakpoint
DROP FUNCTION showzy_sho250_to_base36(bigint);
--> statement-breakpoint
ALTER TABLE "order_number_counters" ADD CONSTRAINT "order_number_counters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_shape_check" CHECK ("orders"."order_number" ~ '^[A-Z0-9]+-[0-9A-Z]+$');
