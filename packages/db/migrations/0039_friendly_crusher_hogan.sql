-- SHO-320 assistant_conversations / assistant_messages /
-- assistant_tool_runs. UNIQUE (company_id, id) is ADR-0025. Composite FKs
-- to conversations are CASCADE. user_id → user is RESTRICT (files/chat
-- staff-user convention). No FK to orders/documents. result_ids is uuid[]
-- (ids only, not status snapshots). Module tables attach the shared
-- updated_at primitive (db.md §5) because Drizzle cannot express triggers
-- (db.md §7) — see the triggers at the end.
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_conversations_company_id_id_uq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_messages_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "assistant_messages_role_check" CHECK ("assistant_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "assistant_tool_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"action_name" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"challenge_id" uuid,
	"result_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_tool_runs_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "assistant_tool_runs_outcome_check" CHECK ("assistant_tool_runs"."outcome" IN ('success', 'error', 'confirmation_required'))
);
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversations_company_fk" FOREIGN KEY ("company_id","conversation_id") REFERENCES "public"."assistant_conversations"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tool_runs" ADD CONSTRAINT "assistant_tool_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tool_runs" ADD CONSTRAINT "assistant_tool_runs_conversations_company_fk" FOREIGN KEY ("company_id","conversation_id") REFERENCES "public"."assistant_conversations"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_conversations_company_updated_at_idx" ON "assistant_conversations" USING btree ("company_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assistant_messages_company_conversation_idx" ON "assistant_messages" USING btree ("company_id","conversation_id");--> statement-breakpoint
CREATE INDEX "assistant_tool_runs_company_conversation_idx" ON "assistant_tool_runs" USING btree ("company_id","conversation_id");
--> statement-breakpoint
-- Module tables attach the shared updated_at primitive (db.md §5) here
-- because Drizzle cannot express triggers (db.md §7).
CREATE TRIGGER assistant_conversations_set_updated_at
BEFORE UPDATE ON assistant_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER assistant_messages_set_updated_at
BEFORE UPDATE ON assistant_messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER assistant_tool_runs_set_updated_at
BEFORE UPDATE ON assistant_tool_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();