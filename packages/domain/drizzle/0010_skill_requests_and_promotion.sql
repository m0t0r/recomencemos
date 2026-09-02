CREATE TABLE "skill_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account_id" text NOT NULL,
	"text" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_request_state_known" CHECK ("skill_request"."state" IN ('pending', 'promoted', 'declined'))
);
--> statement-breakpoint
ALTER TABLE "admin_action" DROP CONSTRAINT "admin_action_action_known";--> statement-breakpoint
ALTER TABLE "rate_counter" DROP CONSTRAINT "rate_counter_action_known";--> statement-breakpoint
ALTER TABLE "skill" ALTER COLUMN "cuoc_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_request" ADD CONSTRAINT "skill_request_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_request_account_id_idx" ON "skill_request" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "skill_request_pending_idx" ON "skill_request" USING btree ("created_at") WHERE "skill_request"."state" = 'pending';--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_action_known" CHECK ("admin_action"."action" IN ('revokeSessions', 'promoteSkill'));--> statement-breakpoint
ALTER TABLE "rate_counter" ADD CONSTRAINT "rate_counter_action_known" CHECK ("rate_counter"."action" IN ('requestMagicLink', 'verifyAdminTotp', 'verifyAdminBackupCode', 'publishProfile', 'requestSkill'));