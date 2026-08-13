CREATE TABLE "oauth_accounts" (
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_accounts_provider_provider_user_id_pk" PRIMARY KEY("provider","provider_user_id"),
	CONSTRAINT "oauth_accounts_provider_check" CHECK ("oauth_accounts"."provider" IN ('google','github'))
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_accounts_by_user" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
-- Migration 0008 set no default privileges on purpose, so a table added later is
-- unreachable until someone says otherwise. This is that someone.
--
-- No policy on it, for the same reason users and api_tokens have none: the row is
-- read to work out who is asking, which is strictly before there is an identity to
-- filter by. What guards it is the lookup shape - by the provider's own id, which
-- only arrives from the provider over a channel the client never touches.
GRANT SELECT, INSERT, UPDATE, DELETE ON "oauth_accounts" TO ariadne_app;