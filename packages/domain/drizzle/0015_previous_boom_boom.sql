CREATE TABLE "photo_upload" (
	"account_id" text PRIMARY KEY NOT NULL,
	"photo_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_action" DROP CONSTRAINT "admin_action_action_known";--> statement-breakpoint
ALTER TABLE "rate_counter" DROP CONSTRAINT "rate_counter_action_known";--> statement-breakpoint
ALTER TABLE "capability_profile" ADD COLUMN "photo_attached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photo_upload" ADD CONSTRAINT "photo_upload_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_profile_photo_pending_idx" ON "capability_profile" USING btree ("photo_attached_at","id") WHERE "capability_profile"."photo_state" = 'pending';--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_action_known" CHECK ("admin_action"."action" IN ('revokeSessions', 'promoteSkill', 'deliverOffer', 'approvePhoto', 'rejectPhoto'));--> statement-breakpoint
ALTER TABLE "rate_counter" ADD CONSTRAINT "rate_counter_action_known" CHECK ("rate_counter"."action" IN ('requestMagicLink', 'verifyAdminTotp', 'verifyAdminBackupCode', 'publishProfile', 'requestSkill', 'updateProfile', 'sendOffer', 'readProfileHourly', 'readProfileDaily', 'createPhotoUpload'));