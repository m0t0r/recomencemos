ALTER TABLE "contact_exchange" ADD COLUMN "worker_full_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "worker_phone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "worker_email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "hirer_name" text;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "hirer_phone" text;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "hirer_email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "worker_copy" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD COLUMN "hirer_copy" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD CONSTRAINT "contact_exchange_worker_copy_known" CHECK ("contact_exchange"."worker_copy" IN ('pending', 'sent', 'failed'));--> statement-breakpoint
ALTER TABLE "contact_exchange" ADD CONSTRAINT "contact_exchange_hirer_copy_known" CHECK ("contact_exchange"."hirer_copy" IN ('pending', 'sent', 'failed'));