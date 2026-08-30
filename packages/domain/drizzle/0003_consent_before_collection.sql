CREATE TABLE "consent" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consent_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account_id" text NOT NULL,
	"side" text NOT NULL,
	"notice_version" text NOT NULL,
	"authorization_version" text NOT NULL,
	"transmission_acknowledged" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_side_known" CHECK ("consent"."side" IN ('worker', 'hirer')),
	CONSTRAINT "consent_transmission_acknowledged" CHECK ("consent"."transmission_acknowledged")
);
--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_account_id_user_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_account_id_idx" ON "consent" USING btree ("account_id","created_at");