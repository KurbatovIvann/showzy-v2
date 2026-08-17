CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"channel" text NOT NULL,
	"ai_trace_id" text,
	"tool_call_id" text,
	"company_id" uuid,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"input_hash" text NOT NULL,
	"outcome" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_actor_type_check" CHECK ("audit_log"."actor_type" IN ('user', 'system')),
	CONSTRAINT "audit_log_channel_check" CHECK ("audit_log"."channel" IN ('ui', 'ai', 'system', 'webhook'))
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"company_id" uuid,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_sequence" bigint NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"channel" text NOT NULL,
	"request_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"dispatched_at" timestamp with time zone,
	CONSTRAINT "domain_events_actor_type_check" CHECK ("domain_events"."actor_type" IN ('user', 'system')),
	CONSTRAINT "domain_events_channel_check" CHECK ("domain_events"."channel" IN ('ui', 'ai', 'system', 'webhook'))
);
--> statement-breakpoint
CREATE TABLE "event_aggregate_sequences" (
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"company_id" uuid,
	"last_sequence" bigint NOT NULL,
	CONSTRAINT "event_aggregate_sequences_pk" PRIMARY KEY("aggregate_type","aggregate_id")
);
--> statement-breakpoint
CREATE TABLE "event_deliveries" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"last_error" text,
	"processed_at" timestamp with time zone,
	CONSTRAINT "event_deliveries_pk" PRIMARY KEY("consumer","event_id"),
	CONSTRAINT "event_deliveries_status_check" CHECK ("event_deliveries"."status" IN ('pending', 'processing', 'processed', 'dead'))
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"principal_key" text NOT NULL,
	"scope_key" text NOT NULL,
	"company_id" uuid,
	"action" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"confirmation_challenge_id" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmation_expires_at" timestamp with time zone,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_pk" PRIMARY KEY("principal_key","scope_key","action","key"),
	CONSTRAINT "idempotency_keys_status_check" CHECK ("idempotency_keys"."status" IN ('in_progress', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "event_deliveries" ADD CONSTRAINT "event_deliveries_event_id_domain_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_company_created_at_idx" ON "audit_log" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_created_at_idx" ON "audit_log" USING btree ("actor_type","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_events_aggregate_sequence_uq" ON "domain_events" USING btree ("aggregate_type","aggregate_id","aggregate_sequence");--> statement-breakpoint
CREATE INDEX "domain_events_undispatched_idx" ON "domain_events" USING btree ("dispatched_at") WHERE "domain_events"."dispatched_at" IS NULL;--> statement-breakpoint
CREATE INDEX "domain_events_company_occurred_at_idx" ON "domain_events" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_deliveries_status_next_attempt_at_idx" ON "event_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "event_deliveries_event_id_idx" ON "event_deliveries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_status_lease_expires_at_idx" ON "idempotency_keys" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_company_created_at_idx" ON "idempotency_keys" USING btree ("company_id","created_at");