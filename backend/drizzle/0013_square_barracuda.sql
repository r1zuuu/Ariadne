CREATE TABLE "task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_events_action_check" CHECK ("task_events"."action" IN ('created','updated','status_changed','archived','linked_memories'))
);
--> statement-breakpoint
CREATE TABLE "task_memory_links" (
	"task_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_memory_links_task_id_node_id_pk" PRIMARY KEY("task_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"blocked_reason" text,
	"created_by" uuid,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" IN ('backlog','todo','in_progress','blocked','done','archived')),
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" IN ('low','medium','high','critical'))
);
--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_memory_links" ADD CONSTRAINT "task_memory_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_memory_links" ADD CONSTRAINT "task_memory_links_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_memory_links" ADD CONSTRAINT "task_memory_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_memory_links" ADD CONSTRAINT "task_memory_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_events_by_task" ON "task_events" USING btree ("task_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_events_by_workspace" ON "task_events" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_memory_links_by_node" ON "task_memory_links" USING btree ("workspace_id","project_id","node_id");--> statement-breakpoint
CREATE INDEX "task_memory_links_by_task" ON "task_memory_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_lookup" ON "tasks" USING btree ("workspace_id","project_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tasks_priority_lookup" ON "tasks" USING btree ("workspace_id","project_id","priority","updated_at" DESC NULLS LAST);--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "tasks", "task_memory_links", "task_events" TO ariadne_app;
--> statement-breakpoint

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tasks_tenant" ON "tasks" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
--> statement-breakpoint

ALTER TABLE "task_memory_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_memory_links_tenant" ON "task_memory_links" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
--> statement-breakpoint

ALTER TABLE "task_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_events_tenant" ON "task_events" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
