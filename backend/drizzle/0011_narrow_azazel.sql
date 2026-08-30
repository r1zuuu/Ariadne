ALTER TABLE "api_tokens" ADD COLUMN "last_unknown_repo" text;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "last_unknown_repo_at" timestamp with time zone;