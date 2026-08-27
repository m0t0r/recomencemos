CREATE TABLE "rate_counter" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_counter_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"principal" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_counter_principal_action_window_start_key" UNIQUE("principal","action","window_start"),
	CONSTRAINT "rate_counter_count_non_negative" CHECK ("rate_counter"."count" >= 0)
);
