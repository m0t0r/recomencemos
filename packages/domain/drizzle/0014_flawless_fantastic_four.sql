CREATE TABLE "block" (
	"worker_profile_id" bigint NOT NULL,
	"hirer_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_worker_profile_id_hirer_account_id_pk" PRIMARY KEY("worker_profile_id","hirer_account_id")
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"capability_profile_id" bigint NOT NULL,
	"hirer_account_id" text NOT NULL,
	"work_description" text NOT NULL,
	"pay_terms" text NOT NULL,
	"when_text" text NOT NULL,
	"state" text DEFAULT 'pending_review' NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_state_known" CHECK ("offer"."state" IN ('pending_review', 'on_hold', 'delivered', 'accepted', 'declined', 'expired', 'rejected_by_admin', 'reported')),
	CONSTRAINT "offer_terms_present" CHECK (char_length(btrim("offer"."work_description")) > 0
        AND char_length(btrim("offer"."pay_terms")) > 0
        AND char_length(btrim("offer"."when_text")) > 0)
);
--> statement-breakpoint
ALTER TABLE "admin_action" DROP CONSTRAINT "admin_action_action_known";--> statement-breakpoint
ALTER TABLE "rate_counter" DROP CONSTRAINT "rate_counter_action_known";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "hirer_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "hirer_phone" text;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_worker_profile_id_capability_profile_id_fk" FOREIGN KEY ("worker_profile_id") REFERENCES "public"."capability_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_hirer_account_id_user_id_fk" FOREIGN KEY ("hirer_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_capability_profile_id_capability_profile_id_fk" FOREIGN KEY ("capability_profile_id") REFERENCES "public"."capability_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_hirer_account_id_user_id_fk" FOREIGN KEY ("hirer_account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_hirer_account_id_idx" ON "block" USING btree ("hirer_account_id");--> statement-breakpoint
CREATE INDEX "offer_capability_profile_id_created_at_idx" ON "offer" USING btree ("capability_profile_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "offer_hirer_account_id_created_at_idx" ON "offer" USING btree ("hirer_account_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "offer_pending_idx" ON "offer" USING btree ("created_at") WHERE "offer"."state" IN ('pending_review', 'on_hold');--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_action_known" CHECK ("admin_action"."action" IN ('revokeSessions', 'promoteSkill', 'deliverOffer'));--> statement-breakpoint
ALTER TABLE "rate_counter" ADD CONSTRAINT "rate_counter_action_known" CHECK ("rate_counter"."action" IN ('requestMagicLink', 'verifyAdminTotp', 'verifyAdminBackupCode', 'publishProfile', 'requestSkill', 'updateProfile', 'sendOffer', 'readProfileHourly', 'readProfileDaily'));