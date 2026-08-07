import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // argon2id
  profile: text("profile").notNull().default(""), // who the user is, how they like to work
  allPermission: boolean("all_permission").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), // sha256; raw token shown once at generation
  label: text("label").notNull().default(""), // e.g. "work laptop"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    repoRef: text("repo_ref").notNull(), // normalized git remote origin URL (no .git, lowercase host)
    opis: text("opis").notNull().default(""),
    stack: text("stack").notNull().default(""),
    dlaKogo: text("dla_kogo").notNull().default(""),
    grupaOdbiorcza: text("grupa_odbiorcza"),
    konwencjeRef: text("konwencje_ref"), // reference to a file in the repo, not a copy
    ograniczenia: text("ograniczenia").notNull().default(""),
    etap: text("etap").notNull().default("prototyp"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.repoRef),
    check("projects_etap_check", sql`${t.etap} IN ('prototyp','produkcja','utrzymanie')`),
  ],
);

export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(), // one human-readable thought; this gets embedded
    status: text("status").notNull().default("proposed"),
    source: jsonb("source").notNull().default(sql`'{}'::jsonb`),
    // Which node overruled this one. Set together with status 'contradicted';
    // without it the status says "no longer true" and never says what replaced it.
    // Self-reference needs the explicit column type, otherwise TS cannot infer it.
    supersededBy: uuid("superseded_by").references((): AnyPgColumn => nodes.id, {
      onDelete: "set null",
    }),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("nodes_lookup").on(t.userId, t.projectId, t.status, t.createdAt.desc()),
    index("nodes_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    check("nodes_type_check", sql`${t.type} IN ('session_summary','decision','note')`),
    check(
      "nodes_status_check",
      sql`${t.status} IN ('proposed','confirmed','contradicted','archived')`,
    ),
  ],
);

export const codeAnchors = pgTable(
  "code_anchors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    path: text("path").notNull(), // path relative to repo root
    symbol: text("symbol"), // function / class, optional
    sha: text("sha"), // commit SHA, optional
  },
  (t) => [
    index("code_anchors_by_path").on(t.path),
    index("code_anchors_by_node").on(t.nodeId),
  ],
);

export const pendingActions = pgTable(
  "pending_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`), // for update: { "content": "...", "anchors": [...] }
    requestedBy: text("requested_by").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    check("pending_actions_action_check", sql`${t.action} IN ('update','delete')`),
    check(
      "pending_actions_requested_by_check",
      sql`${t.requestedBy} IN ('coder','app_agent')`,
    ),
    check(
      "pending_actions_status_check",
      sql`${t.status} IN ('pending','approved','rejected')`,
    ),
  ],
);

// What the person said to Ariadne and what came back, kept so that closing a
// screen stops throwing the exchange away.
//
// One table for both conversations in the app, separated by `kind`. Asking and
// adding to memory are the same shape underneath (a person writes, Ariadne
// answers); they differ only in what Ariadne does with the answer, and that
// difference already lives in nodes and pending_actions.
//
// Messages are a jsonb array rather than their own table. A conversation is
// always read whole, never queried across, and never edited in the middle, so
// rows per message would buy joins nobody makes. Search across conversations,
// if it is ever wanted, is what would justify splitting them out.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    // Trimmed from the opening message. No model call: a title is a label, and
    // paying for one on every first message would be absurd.
    title: text("title").notNull().default(""),
    // [{ role, text, sources?, proposals? }]. Proposals hold node and pending
    // action ids, never a copy of the status: the status changes in the review
    // queue and a copy here would go stale the moment it is approved.
    messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The list is always "this user, this project, this kind, newest first".
    index("conversations_lookup").on(t.userId, t.projectId, t.kind, t.updatedAt.desc()),
    check("conversations_kind_check", sql`${t.kind} IN ('ask','memory')`),
  ],
);
