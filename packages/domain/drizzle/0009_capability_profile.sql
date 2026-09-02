CREATE TABLE "capability_profile" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "capability_profile_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account_id" text NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"first_name" text NOT NULL,
	"last_initial" text NOT NULL,
	"city" text NOT NULL,
	"headline" text NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"phone" text NOT NULL,
	"photo_state" text DEFAULT 'absent' NOT NULL,
	"photo_key" text,
	"state" text DEFAULT 'published' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_offer_count" integer DEFAULT 0 NOT NULL,
	"rotation_key" integer DEFAULT 0 NOT NULL,
	"search_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_profile_account_id_key" UNIQUE("account_id"),
	CONSTRAINT "capability_profile_slug_key" UNIQUE("slug"),
	CONSTRAINT "capability_profile_city_known" CHECK ("capability_profile"."city" IN ('pereira', 'dosquebradas', 'santa_rosa_de_cabal')),
	CONSTRAINT "capability_profile_photo_state_known" CHECK ("capability_profile"."photo_state" IN ('absent', 'pending', 'approved', 'rejected')),
	CONSTRAINT "capability_profile_state_known" CHECK ("capability_profile"."state" IN ('published', 'taken_down')),
	CONSTRAINT "capability_profile_last_initial_one_letter" CHECK (char_length("capability_profile"."last_initial") = 1)
);
--> statement-breakpoint
CREATE TABLE "profile_skill" (
	"capability_profile_id" bigint NOT NULL,
	"skill_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_skill_pkey" PRIMARY KEY("capability_profile_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "work_history_entry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_history_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"capability_profile_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_history_entry_capability_profile_id_position_key" UNIQUE("capability_profile_id","position"),
	CONSTRAINT "work_history_entry_position_non_negative" CHECK ("work_history_entry"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rate_counter" DROP CONSTRAINT "rate_counter_action_known";--> statement-breakpoint
ALTER TABLE "capability_profile" ADD CONSTRAINT "capability_profile_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skill" ADD CONSTRAINT "profile_skill_capability_profile_id_capability_profile_id_fk" FOREIGN KEY ("capability_profile_id") REFERENCES "public"."capability_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skill" ADD CONSTRAINT "profile_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_history_entry" ADD CONSTRAINT "work_history_entry_capability_profile_id_capability_profile_id_fk" FOREIGN KEY ("capability_profile_id") REFERENCES "public"."capability_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_profile_wall_idx" ON "capability_profile" USING btree ("published_at" DESC,"id" DESC) WHERE "capability_profile"."state" = 'published';--> statement-breakpoint
CREATE INDEX "capability_profile_browse_idx" ON "capability_profile" USING btree ("delivered_offer_count","rotation_key","id") WHERE "capability_profile"."state" = 'published';--> statement-breakpoint
CREATE INDEX "capability_profile_browse_city_idx" ON "capability_profile" USING btree ("city","delivered_offer_count","rotation_key","id") WHERE "capability_profile"."state" = 'published';--> statement-breakpoint
CREATE INDEX "capability_profile_phone_idx" ON "capability_profile" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "profile_skill_skill_id_idx" ON "profile_skill" USING btree ("skill_id","capability_profile_id");--> statement-breakpoint
ALTER TABLE "rate_counter" ADD CONSTRAINT "rate_counter_action_known" CHECK ("rate_counter"."action" IN ('requestMagicLink', 'verifyAdminTotp', 'verifyAdminBackupCode', 'publishProfile'));