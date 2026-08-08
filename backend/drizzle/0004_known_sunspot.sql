ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_repo_ref_unique";--> statement-breakpoint
ALTER TABLE "nodes" DROP CONSTRAINT "nodes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pending_actions" DROP CONSTRAINT "pending_actions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "nodes_lookup";--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_actions" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "pending_actions_lookup" ON "pending_actions" USING btree ("workspace_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "nodes_lookup" ON "nodes" USING btree ("workspace_id","project_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "nodes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "pending_actions" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_repo_ref_unique" UNIQUE("workspace_id","repo_ref");