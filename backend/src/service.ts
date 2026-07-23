import { and, cosineDistance, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { codeAnchors, nodes, projects, users } from "./db/schema.js";
import { embed } from "./gemini.js";

// Business logic lives here once; MCP tools and REST endpoints are thin
// wrappers over these functions (plan section 2).

export class ServiceError extends Error {
  constructor(
    public code: "validation" | "unknown_repo" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export type NodeType = "session_summary" | "decision" | "note";
export type Anchor = { path: string; symbol?: string; sha?: string };
export type SourceMeta = {
  session_id: string;
  commit_sha?: string;
  raw_input?: string;
  channel: "coder" | "app_chat" | "app_form";
};

const MAX_CONTENT_LENGTH = 4000;
const NODE_TYPES = ["session_summary", "decision", "note"] as const;
const CHANNELS = ["coder", "app_chat", "app_form"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, field: string) {
  if (!UUID_RE.test(value)) {
    throw new ServiceError("validation", `${field} must be a uuid`);
  }
}

function assertAnchors(anchors: Anchor[]) {
  for (const a of anchors) {
    const path = a.path ?? "";
    const looksAbsolute = path.startsWith("/") || /^[a-z]:/i.test(path);
    const escapesRepo = path.split("/").includes("..");
    if (!path || path.includes("\\") || looksAbsolute || escapesRepo) {
      throw new ServiceError(
        "validation",
        `invalid anchor path "${path}": expected a repo-relative path like "src/db/schema.ts"`,
      );
    }
  }
}

async function assertProjectOwned(userId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!project) {
    throw new ServiceError("not_found", "project not found for this user");
  }
}

export async function createNode(input: {
  userId: string;
  projectId: string;
  type: NodeType;
  content: string;
  anchors?: Anchor[];
  source: SourceMeta;
  replacesNodeId?: string;
}): Promise<{ nodeId: string; status: "proposed"; contradictedNodeId?: string }> {
  // Validation gate (plan section 5), shared by both entry paths.
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  if (input.replacesNodeId) assertUuid(input.replacesNodeId, "replacesNodeId");
  if (!NODE_TYPES.includes(input.type)) {
    throw new ServiceError("validation", `type must be one of: ${NODE_TYPES.join(", ")}`);
  }
  const content = input.content?.trim() ?? "";
  if (!content) throw new ServiceError("validation", "content must not be empty");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ServiceError(
      "validation",
      `content has ${content.length} chars, max is ${MAX_CONTENT_LENGTH}; split it into single thoughts`,
    );
  }
  if (!input.source?.session_id) {
    throw new ServiceError("validation", "source.session_id is required");
  }
  if (!CHANNELS.includes(input.source.channel)) {
    throw new ServiceError("validation", `source.channel must be one of: ${CHANNELS.join(", ")}`);
  }
  const anchors = input.anchors ?? [];
  assertAnchors(anchors);
  await assertProjectOwned(input.userId, input.projectId);

  // Network call stays outside the transaction.
  const embedding = await embed(content, "RETRIEVAL_DOCUMENT");

  return db.transaction(async (tx) => {
    let contradictedNodeId: string | undefined;
    if (input.replacesNodeId) {
      const [previous] = await tx
        .update(nodes)
        .set({ status: "contradicted", updatedAt: new Date() })
        .where(
          and(
            eq(nodes.id, input.replacesNodeId),
            eq(nodes.userId, input.userId),
            eq(nodes.projectId, input.projectId),
          ),
        )
        .returning({ id: nodes.id });
      if (!previous) {
        throw new ServiceError("not_found", "replaces_node_id not found in this project");
      }
      contradictedNodeId = previous.id;
    }

    const [node] = await tx
      .insert(nodes)
      .values({
        userId: input.userId,
        projectId: input.projectId,
        type: input.type,
        content,
        status: "proposed", // always forced, never taken from input
        source: input.source,
        embedding,
      })
      .returning({ id: nodes.id });

    if (anchors.length) {
      await tx.insert(codeAnchors).values(
        anchors.map((a) => ({ nodeId: node.id, path: a.path, symbol: a.symbol, sha: a.sha })),
      );
    }

    return { nodeId: node.id, status: "proposed", contradictedNodeId };
  });
}

// "https://github.com/User/Repo.git" and "git@github.com:User/Repo" both
// normalize to "github.com/User/Repo" (host lowercased, plan section 3).
export function normalizeRepoRef(raw: string): string {
  let ref = raw.trim();
  ref = ref.replace(/^git@([^:]+):/, "$1/"); // ssh form -> host/path
  ref = ref.replace(/^[a-z+]+:\/\//i, ""); // strip scheme
  ref = ref.replace(/^[^@/]+@/, ""); // strip user@ before host
  ref = ref.replace(/\.git$/i, "").replace(/\/+$/, "");
  const slash = ref.indexOf("/");
  if (slash === -1) return ref.toLowerCase();
  return ref.slice(0, slash).toLowerCase() + ref.slice(slash);
}

export async function resolveProjectByRepoRef(userId: string, repoRef: string) {
  const normalized = normalizeRepoRef(repoRef);
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.repoRef, normalized)));
  if (!project) {
    throw new ServiceError(
      "unknown_repo",
      `Zaloz projekt w aplikacji Ariadne i podaj repo_ref: ${normalized}`,
    );
  }
  return project;
}

export async function searchNodes(input: {
  userId: string;
  projectId: string;
  query: string;
  k?: number;
}) {
  const k = input.k ?? 5;
  if (!Number.isInteger(k) || k < 1 || k > 10) {
    throw new ServiceError("validation", "k must be an integer between 1 and 10");
  }
  if (!input.query?.trim()) {
    throw new ServiceError("validation", "query must not be empty");
  }

  const queryVector = await embed(input.query, "RETRIEVAL_QUERY");
  const distance = cosineDistance(nodes.embedding, queryVector);

  // Metadata filters BEFORE similarity: they narrow, vectors rank (plan section 7).
  const found = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      status: nodes.status,
      source: nodes.source,
      createdAt: nodes.createdAt,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(nodes)
    .where(
      and(
        eq(nodes.userId, input.userId),
        eq(nodes.projectId, input.projectId),
        ne(nodes.status, "archived"),
      ),
    )
    .orderBy(distance)
    .limit(k);

  const anchorRows = found.length
    ? await db
        .select()
        .from(codeAnchors)
        .where(inArray(codeAnchors.nodeId, found.map((n) => n.id)))
    : [];

  return found.map((node) => ({
    ...node,
    anchors: anchorRows
      .filter((a) => a.nodeId === node.id)
      .map(({ path, symbol, sha }) => ({ path, symbol, sha })),
  }));
}

// Boot context for a coder session start: user profile + project card +
// last session summary (plan section 6).
export async function getBootContext(input: { userId: string; repoRef: string }) {
  const project = await resolveProjectByRepoRef(input.userId, input.repoRef);

  const [user] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!user) throw new ServiceError("not_found", "user not found");

  const [lastSummary] = await db
    .select({ content: nodes.content, createdAt: nodes.createdAt })
    .from(nodes)
    .where(
      and(
        eq(nodes.projectId, project.id),
        eq(nodes.type, "session_summary"),
        ne(nodes.status, "archived"),
      ),
    )
    .orderBy(desc(nodes.createdAt))
    .limit(1);

  return {
    profile: user.profile,
    project: {
      name: project.name,
      opis: project.opis,
      stack: project.stack,
      dla_kogo: project.dlaKogo,
      grupa_odbiorcza: project.grupaOdbiorcza,
      konwencje_ref: project.konwencjeRef,
      ograniczenia: project.ograniczenia,
      etap: project.etap,
    },
    last_summary: lastSummary ?? null,
  };
}
