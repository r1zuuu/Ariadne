import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ServiceError,
  createNode,
  getBootContext,
  requestDelete,
  requestUpdate,
  resolveProjectByRepoRef,
  searchNodes,
} from "./service.js";

// The 5 tools of plan section 9. Thin wrappers: schema in, service call,
// result out. All business logic stays in service.ts.

const anchorSchema = z.object({
  path: z.string().describe('repo-relative path, e.g. "src/db/schema.ts"'),
  symbol: z.string().optional().describe("function or class the note is about"),
  sha: z.string().optional().describe("commit SHA, if the note is tied to one"),
});

const repoRef = z
  .string()
  .describe("identifier of this repo, normally its git remote origin URL");

// The MCP contract is snake_case, the service layer speaks camelCase.
// Converting once here beats hand-mapping every field in every tool.
function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (value instanceof Date) return value; // JSON.stringify turns it into ISO
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
      toSnakeCase(v),
    ]),
  );
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

// A rejected call comes back as a readable tool error, not a protocol crash,
// so the coder can fix its input and retry (plan section 5).
async function run(fn: () => Promise<unknown>) {
  try {
    return textResult(JSON.stringify(toSnakeCase(await fn()), null, 2));
  } catch (error) {
    if (error instanceof ServiceError) {
      return textResult(`${error.code}: ${error.message}`, true);
    }
    console.error("[mcp] unexpected error:", error);
    return textResult("internal error, check the server logs", true);
  }
}

type LifecycleResult = { applied: true } | { applied: false; pendingActionId: string };

// Without all_permission a destructive change only queues up for approval
// in the app; with it, it runs immediately (plan section 9).
function lifecycleResult(
  nodeId: string,
  appliedStatus: "updated" | "archived",
  result: LifecycleResult,
) {
  if (result.applied) return { node_id: nodeId, status: appliedStatus };
  return {
    pending_action_id: result.pendingActionId,
    status: "pending",
    message: "Czeka na zatwierdzenie w aplikacji",
  };
}

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: "ariadne", version: "0.1.0" });

  server.registerTool(
    "get_project_context",
    {
      description:
        "Call this at the start of every session, before reading files or git history. " +
        "Returns who the user is, what this project is, the summary of the last session, " +
        "and an index of the decisions and notes already recorded here. The index holds " +
        "headlines only: when one touches what you are about to do, call search_context " +
        "to read the full entry before you act.",
      inputSchema: { repo_ref: repoRef },
    },
    ({ repo_ref }) => run(() => getBootContext({ userId, repoRef: repo_ref })),
  );

  server.registerTool(
    "search_context",
    {
      description:
        "Search past decisions, notes and session summaries of this project by meaning. " +
        "Use it instead of guessing why something was built the way it is. Treat results " +
        "with status 'proposed' as revisable and 'confirmed' as settled.",
      inputSchema: {
        repo_ref: repoRef,
        query: z.string().describe("what you want to know, in plain words"),
        k: z.number().optional().describe("how many results, 1 to 10, default 5"),
      },
    },
    ({ repo_ref, query, k }) =>
      run(async () => {
        const project = await resolveProjectByRepoRef(userId, repo_ref);
        return { results: await searchNodes({ userId, projectId: project.id, query, k }) };
      }),
  );

  server.registerTool(
    "add_context",
    {
      description:
        "Record one thought worth remembering after this session ends: a decision, a note, " +
        "or an end-of-session summary. One thought per call, max 4000 characters. Add anchors " +
        "for the files it concerns. If it reverses an earlier decision, pass replaces_node_id.",
      inputSchema: {
        repo_ref: repoRef,
        type: z
          .enum(["decision", "note", "session_summary"])
          .describe("decision: a choice made; note: a fact; session_summary: end of session"),
        content: z.string().describe("the thought itself, written for a human to read"),
        anchors: z.array(anchorSchema).optional().describe("files this thought is about"),
        source: z.object({
          session_id: z.string().describe("uuid you generated at the start of this session"),
          commit_sha: z.string().optional().describe("related commit, if there is one"),
        }),
        replaces_node_id: z
          .string()
          .optional()
          .describe("uuid of the node this decision overturns"),
      },
    },
    ({ repo_ref, type, content, anchors, source, replaces_node_id }) =>
      run(async () => {
        const project = await resolveProjectByRepoRef(userId, repo_ref);
        return createNode({
          userId,
          projectId: project.id,
          type,
          content,
          anchors,
          // Reaching this server means the writer is a coder; not the caller's to claim.
          source: { ...source, channel: "coder" },
          replacesNodeId: replaces_node_id,
        });
      }),
  );

  server.registerTool(
    "update_context",
    {
      description:
        "Correct the content or anchors of an existing node. Needs the node_id from " +
        "search_context. Unless the user granted all-permission, this only queues the " +
        "change for their approval in the app.",
      inputSchema: {
        node_id: z.string().describe("uuid of the node to correct"),
        content: z.string().optional().describe("the corrected thought"),
        anchors: z.array(anchorSchema).optional().describe("replaces the current anchors"),
      },
    },
    ({ node_id, content, anchors }) =>
      run(async () =>
        lifecycleResult(
          node_id,
          "updated",
          await requestUpdate({ userId, nodeId: node_id, content, anchors, requestedBy: "coder" }),
        ),
      ),
  );

  server.registerTool(
    "delete_context",
    {
      description:
        "Archive a node that is no longer true, so it stops showing up in searches. " +
        "Nothing is ever physically deleted. Unless the user granted all-permission, " +
        "this only queues the removal for their approval in the app.",
      inputSchema: { node_id: z.string().describe("uuid of the node to archive") },
    },
    ({ node_id }) =>
      run(async () =>
        lifecycleResult(
          node_id,
          "archived",
          await requestDelete({ userId, nodeId: node_id, requestedBy: "coder" }),
        ),
      ),
  );

  return server;
}
