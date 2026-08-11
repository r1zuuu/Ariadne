-- Row-Level Security on the archive tables (plan section 14, first item of step 6).
--
-- Until now isolation lived in one place: a where-clause in service.ts. One
-- forgotten filter leaked a workspace's archive to whoever asked. That was
-- survivable while every account was Stas; on a shared server it leaks between
-- people, and with several teams between companies.
--
-- Two roles, because Postgres does not apply policies to the role that owns the
-- tables. Migrations keep running as the owner (DATABASE_URL); the server
-- connects as ariadne_app (DATABASE_URL_APP), which owns nothing and is bound by
-- every policy below. The role is created without LOGIN on purpose: it cannot
-- connect until someone gives it a password, so a migration run never quietly
-- opens a new way in. See setup.md.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ariadne_app') THEN
    CREATE ROLE ariadne_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint

-- Grants cover the tables that exist right now, and no default privileges are
-- set on purpose. A table added later starts unreachable and the server says
-- "permission denied" on first use, which is the loud version of the mistake.
-- The quiet version, a new table silently readable across every workspace
-- because nobody remembered to write its policy, is the one worth preventing.
GRANT USAGE ON SCHEMA public TO ariadne_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ariadne_app;
--> statement-breakpoint

-- Who the current request belongs to. Set per transaction by the server, empty
-- everywhere else, and empty means no rows rather than all rows: a policy that
-- opened up when the setting was missing would turn every forgotten wrapper into
-- a silent full-archive read.
--
-- nullif before the cast, because current_setting on an unset key returns an
-- empty string, and ''::uuid is an error rather than a null.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint

-- The membership join, spelled once per table. This is the same rule the service
-- layer applies; the point of having it twice is that both have to fail before
-- anything leaks.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "projects_tenant" ON "projects" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
--> statement-breakpoint

ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "nodes_tenant" ON "nodes" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
--> statement-breakpoint

ALTER TABLE "pending_actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "pending_actions_tenant" ON "pending_actions" FOR ALL
  USING ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()))
  WITH CHECK ("workspace_id" IN (SELECT "workspace_id" FROM "memberships" WHERE "user_id" = app_user_id()));
--> statement-breakpoint

-- Anchors have no workspace of their own, and giving them a copy of one would be
-- a second answer to the same question. They inherit: the subquery reads nodes,
-- which is itself behind a policy, so an anchor is reachable exactly when its
-- entry is.
ALTER TABLE "code_anchors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "code_anchors_tenant" ON "code_anchors" FOR ALL
  USING (EXISTS (SELECT 1 FROM "nodes" WHERE "nodes"."id" = "code_anchors"."node_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "nodes" WHERE "nodes"."id" = "code_anchors"."node_id"));
--> statement-breakpoint

-- A conversation belongs to the person, not to the team (schema.ts), so this one
-- rule is by user and not by membership. A teammate reads the entries that came
-- out of a chat, never the chat.
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "conversations_own" ON "conversations" FOR ALL
  USING ("user_id" = app_user_id())
  WITH CHECK ("user_id" = app_user_id());
--> statement-breakpoint

-- Deliberately left without policies: users, workspaces, memberships, invites,
-- api_tokens. Every one of them is read before there is a user to scope by, or
-- in order to establish one. Login looks up an account by email, accepting an
-- invite finds it by a code the joiner has and no membership yet, and a coder's
-- token is resolved into an identity before any of this can apply. They are also
-- what the policies above are written in terms of, so putting them behind their
-- own policy would make the rule circular. What guards them is the service layer
-- and the shape of their lookups: by unique token hash, by unique invite code.
COMMENT ON FUNCTION app_user_id() IS
  'Identity of the current request, set by the server with set_config(..., true). Null outside a scoped transaction, which every archive policy reads as "no rows".';
