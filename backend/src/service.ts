import { and, eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { codeAnchors, nodes, projects } from "./db/schema.js";
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
