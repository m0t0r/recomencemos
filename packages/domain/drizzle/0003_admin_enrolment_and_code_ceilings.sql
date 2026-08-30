CREATE TABLE "admin_enrolment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_enrolment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_enrolment_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_second_factor" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_second_factor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_second_factor_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "rate_counter" DROP CONSTRAINT "rate_counter_action_known";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_sign_in_method_known";--> statement-breakpoint
ALTER TABLE "admin_enrolment" ADD CONSTRAINT "admin_enrolment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_second_factor" ADD CONSTRAINT "admin_second_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_enrolment_user_id_idx" ON "admin_enrolment" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "rate_counter" ADD CONSTRAINT "rate_counter_action_known" CHECK ("rate_counter"."action" IN ('requestMagicLink', 'verifyAdminTotp', 'verifyAdminBackupCode'));--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_sign_in_method_known" CHECK ("session"."sign_in_method" IN ('magic_link', 'google', 'password', 'password_totp', 'link_totp'));