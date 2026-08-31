CREATE TABLE "skill" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"label_es" text NOT NULL,
	"cuoc_code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "skill_active_label_es_idx" ON "skill" USING btree ("label_es") WHERE "skill"."active";