CREATE TABLE "task_active_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" uuid,
	"token_id" uuid,
	"agent_client" text NOT NULL,
	"agent_kind" text DEFAULT 'agent' NOT NULL,
	"session_id" text NOT NULL,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_active_runs_task_id_session_id_unique" UNIQUE("task_id","session_id"),
	CONSTRAINT "task_active_runs_kind_check" CHECK ("task_active_runs"."agent_kind" IN ('codex','claude','agent'))
);
--> statement-breakpoint
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_action_check";--> statement-breakpoint
ALTER TABLE "task_active_runs" ADD CONSTRAINT "task_active_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_active_runs" ADD CONSTRAINT "task_active_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_active_runs" ADD CONSTRAINT "task_active_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_active_runs" ADD CONSTRAINT "task_active_runs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_active_runs" ADD CONSTRAINT "task_active_runs_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_active_runs_by_project" ON "task_active_runs" USING btree ("workspace_id","project_id","expires_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_active_runs_by_task" ON "task_active_runs" USING btree ("task_id","expires_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_active_runs_expiry" ON "task_active_runs" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_action_check" CHECK ("task_events"."action" IN ('created','updated','status_changed','archived','linked_memories','work_started','work_stopped'));
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "task_active_runs" TO ariadne_app;
--> statement-breakpoint

ALTER TABLE "task_active_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_active_runs_tenant" ON "task_active_runs" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
