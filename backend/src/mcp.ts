import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  type Actor,
  type TaskPriority,
  type TaskStatus,
  ServiceError,
  createTask,
  createNode,
  getBootContext,
  heartbeatTaskWork,
  listTasks,
  requestDelete,
  requestUpdate,
  resolveProjectByRepoRef,
  searchNodes,
  startTaskWork,
  stopTaskWork,
  updateTask,
} from "./service.js";

// The 5 tools of plan section 9. Thin wrappers: schema in, service call,
// result out. All business logic stays in service.ts.

const anchorSchema = z.object({
  path: z.string().describe('repo-relative path, e.g. "src/db/schema.ts"'),
  symbol: z.string().optional().describe("function or class the note is about"),
  sha: z.string().optional().describe("commit SHA, if the note is tied to one"),
});

const taskStatus = z.enum(["backlog", "todo", "in_progress", "blocked", "done", "archived"]);
const taskPriority = z.enum(["low", "medium", "high", "critical"]);

// The second sentence is there because a repository without a remote had no
// answer at all. The app files those as local/<project name>, a coder has no way
// to read that off a directory, and every session ended in unknown_repo.
const repoRef = z
  .string()
  .describe(
    "identifier of this repo, normally its git remote origin URL. " +
      "A repo with no remote is filed as local/<project name>, so send that form instead.",
  );

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

// What the client hands the model before it has called anything, so the habit
// is in place before the first file is read. Every MCP client is told to show
// this; not all of them do, which is why each tool still carries its own
// trigger in its description rather than relying on this text alone.
//
// Kept short on purpose: it is loaded into every session of every user, so a
// paragraph of pitch here is a paragraph nobody asked for, charged per session.
const INSTRUCTIONS = `Ariadne is this project's memory between sessions. The repository answers what the code does. Ariadne holds what it cannot: which choices were made and why, what was rejected, which limits are real, where someone already got hurt.

Read before you write. get_project_context opens a session. search_context answers why something you did not design is the way it is.

Write the moment a choice is settled, not when the session ends: by then the reason is gone and only the diff is left. A choice not to do something counts, and is the one the code never records.

Leave out what the repository already answers: what the code does, what a commit changed, what a test covers.

Tasks are the other half of the archive: not what was decided, but what is still to be done. get_tasks opens the list, create_task adds to it, update_task moves it.

Read the list when you open the session, straight after the context. Work somebody else left is the fastest answer to "what next", and starting without looking is how two agents do the same job twice.

Write a task the moment concrete work is named and left undone, whether you found it, were asked for it, or chose to defer it. Verb plus object, and enough detail for an agent who was not in this conversation. Vague unease is not a task; the reason behind it is context.

While you are actually working: start_task_work takes a short lease saying this task is being worked on right now, heartbeat_task_work every 45 seconds holds it, and stop_task_work ends it and says how it went. Without the lease nobody else can see that the task is taken.`;

// The token says who is speaking, and nothing about where. Which archive a call
// reaches follows from the repository it names, so one token covers every
// project its owner can see; the user still signs what gets written.
export function createMcpServer({ userId, tokenId }: Actor): McpServer {
  const server = new McpServer(
    { name: "ariadne", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "get_project_context",
    {
      description:
        "Call this at the start of every session, before reading files or git history. " +
        "Returns who the user is, what this project is, the summary of the last session, " +
        "and an index of the decisions and notes already recorded here. Entries carry the " +
        "author, which may be someone else on the team. The index is a sample, not the " +
        "archive: it says how many entries exist in total (index.total) against how many " +
        "headlines it shows (index.showing), and lists which files have entries about them " +
        "(index.by_file). Before you edit a file named there, or when a headline touches " +
        "what you are about to do, call search_context and read the entry itself.",
      inputSchema: { repo_ref: repoRef },
    },
    ({ repo_ref }) => run(() => getBootContext({ userId, tokenId, repoRef: repo_ref })),
  );

  server.registerTool(
    "search_context",
    {
      description:
        "Call this before you change something you did not design yourself: a file the boot " +
        "index names, a library choice, a limit, an approach that looks wrong. It searches " +
        "past decisions and notes of this project by meaning and by name. " +
        // Everything that comes back has been through a person, so there is no
        // status to weigh: the sentence about 'proposed' that used to stand here
        // described results this tool has not returned since searchNodes started
        // filtering the coder channel down to confirmed entries.
        "Use it instead of guessing why something was built the way it is. " +
        // Written the way code writes it, and not merely "a library": the model
        // that recognised React Flow as a name is gone, so what is matched
        // literally is now exactly what a regex can see is an identifier.
        "Writing a name the way code writes it helps - search_text, service.ts, " +
        "@xyflow/react, normalizeRepoRef - because those are matched letter by " +
        "letter as well as by meaning.",
      inputSchema: {
        repo_ref: repoRef,
        query: z.string().describe("what you want to know, in plain words"),
        k: z.number().optional().describe("how many results, 1 to 10, default 5"),
      },
    },
    ({ repo_ref, query, k }) =>
      run(async () => {
        const project = await resolveProjectByRepoRef({ userId, tokenId, repoRef: repo_ref });
        return {
          results: await searchNodes({ userId, projectId: project.id, query, k, channel: "coder" }),
        };
      }),
  );

  server.registerTool(
    "add_context",
    {
      description:
        // The old wording asked the model to judge what is "worth remembering" and
        // put the act "after this session ends", so it landed at the end of a session
        // or not at all. What a tool description has to carry is the moment it fires.
        "Call this the moment a choice is settled, while you are still in it, not when the " +
        "session ends: a library or framework picked over another, an approach rejected, a " +
        "constraint found by hitting it, a workaround whose reason will not be obvious in a " +
        "month. A decision not to do something counts, and is the kind that leaves no trace " +
        "in the code, so nothing else will record it. One thought per call, max 4000 " +
        "characters. Add anchors for the files it concerns. If it reverses an earlier " +
        "decision, pass replaces_node_id.",
      inputSchema: {
        repo_ref: repoRef,
        type: z
          .enum(["decision", "note", "session_summary"])
          .describe("decision: a choice made; note: a fact; session_summary: end of session"),
        content: z.string().describe("the thought itself, written for a human to read"),
        anchors: z.array(anchorSchema).optional().describe("files this thought is about"),
        source: z.object({
          // It used to say "uuid you generated at the start of this session",
          // which reads as a fact being reported and is not one: there is no
          // session id to look up, so a model invents a fresh uuid per call and
          // the field records nothing. Saying what it is for is what makes it
          // worth anything - one value reused across a run groups those entries
          // on the review screen, which is the whole of its job.
          session_id: z
            .string()
            .describe(
              "any uuid you make up once per working session and then reuse for every call in that session; it only groups the entries from one run together on the review screen",
            ),
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
        const project = await resolveProjectByRepoRef({ userId, tokenId, repoRef: repo_ref });
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
    "get_tasks",
    {
      description:
        "Call this when you need the active work list for this project, when boot context says more tasks exist, or before deciding what unfinished work to continue. " +
        "Tasks are operational work state, not confirmed project knowledge. Use search_context for decisions and notes.",
      inputSchema: {
        repo_ref: repoRef,
        status: taskStatus.optional().describe("filter to one task status"),
        priority: taskPriority.optional().describe("filter to one priority"),
        active: z.boolean().optional().describe("true returns backlog/todo/in_progress/blocked"),
        completed: z.boolean().optional().describe("true returns done tasks; false returns active tasks"),
        query: z.string().optional().describe("plain lexical search over task title and description"),
        limit: z.number().optional().describe("how many tasks to return, 1 to 100, default 50"),
        cursor: z.string().optional().describe("cursor returned by a previous get_tasks call"),
      },
    },
    ({ repo_ref, status, priority, active, completed, query, limit, cursor }) =>
      run(async () => {
        const project = await resolveProjectByRepoRef({ userId, tokenId, repoRef: repo_ref });
        return listTasks({
          userId,
          projectId: project.id,
          status: status as TaskStatus | undefined,
          priority: priority as TaskPriority | undefined,
          active,
          completed,
          query,
          limit,
          cursor,
        });
      }),
  );

  server.registerTool(
    "create_task",
    {
      description:
        "Call this when concrete unfinished work should survive this session for a human or another coding agent. " +
        "Write a specific verb-plus-object title. Do not create tasks for vague thoughts; knowledge belongs in add_context.",
      inputSchema: {
        repo_ref: repoRef,
        title: z.string().describe("specific work item, max 160 characters"),
        description: z.string().optional().describe("details another agent needs to continue"),
        status: taskStatus.optional().describe("default todo"),
        priority: taskPriority.optional().describe("default medium"),
        blocked_reason: z.string().optional().describe("required when status is blocked"),
        related_memory_ids: z
          .array(z.string())
          .optional()
          .describe("existing Ariadne memory node ids this task refers to"),
        source: z
          .object({
            client: z.string().optional().describe("agent/client name, e.g. Codex or Claude Code"),
            session_id: z.string().optional().describe("working session id, if you have one"),
            commit_sha: z.string().optional().describe("related commit, if there is one"),
          })
          .optional(),
      },
    },
    ({
      repo_ref,
      title,
      description,
      status,
      priority,
      blocked_reason,
      related_memory_ids,
      source,
    }) =>
      run(async () => {
        const project = await resolveProjectByRepoRef({ userId, tokenId, repoRef: repo_ref });
        return createTask({
          userId,
          projectId: project.id,
          title,
          description,
          status: status as TaskStatus | undefined,
          priority: priority as TaskPriority | undefined,
          blockedReason: blocked_reason,
          relatedMemoryIds: related_memory_ids,
          source: { channel: "coder", token_id: tokenId, ...source },
        });
      }),
  );

  server.registerTool(
    "update_task",
    {
      description:
        "Call this after reading a task when you have made progress, need to block it with a reason, complete it, reopen it, archive it, or refine its title/description/links. " +
        "Only send fields you mean to change. Include revision when you have it so a stale update fails instead of overwriting newer work.",
      inputSchema: {
        task_id: z.string().describe("uuid of the task to update"),
        revision: z.number().optional().describe("task revision you last read"),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        status: taskStatus.optional(),
        priority: taskPriority.optional(),
        blocked_reason: z.string().nullable().optional(),
        related_memory_ids: z.array(z.string()).optional(),
        source: z
          .object({
            client: z.string().optional().describe("agent/client name, e.g. Codex or Claude Code"),
            session_id: z.string().optional().describe("working session id, if you have one"),
            commit_sha: z.string().optional().describe("related commit, if there is one"),
          })
          .optional(),
      },
    },
    ({
      task_id,
      revision,
      title,
      description,
      status,
      priority,
      blocked_reason,
      related_memory_ids,
      source,
    }) =>
      run(() =>
        updateTask({
          userId,
          taskId: task_id,
          revision,
          patch: {
            title,
            description,
            status: status as TaskStatus | undefined,
            priority: priority as TaskPriority | undefined,
            blockedReason: blocked_reason,
            relatedMemoryIds: related_memory_ids,
          },
          source: { channel: "coder", token_id: tokenId, ...source },
        }),
      ),
  );

  server.registerTool(
    "start_task_work",
    {
      description:
        "Call this when you are actively starting or resuming work on a task right now. " +
        "It creates a short live lease, refreshes an existing lease for the same session, and moves backlog/todo tasks to in_progress.",
      inputSchema: {
        task_id: z.string().describe("uuid of the task you are actively working on"),
        source: z.object({
          client: z.string().optional().describe("agent/client name, e.g. Codex or Claude Code"),
          session_id: z.string().describe("stable id reused for this working session"),
          commit_sha: z.string().optional().describe("related commit, if there is one"),
        }),
      },
    },
    ({ task_id, source }) =>
      run(() =>
        startTaskWork({
          userId,
          taskId: task_id,
          source: { channel: "coder", token_id: tokenId, ...source },
        }),
      ),
  );

  server.registerTool(
    "heartbeat_task_work",
    {
      description:
        "Call this every 45 seconds while you are still actively working on a task run. " +
        "It extends the live lease without changing the task itself or writing task history.",
      inputSchema: {
        run_id: z.string().describe("uuid returned by start_task_work"),
      },
    },
    ({ run_id }) =>
      run(() =>
        heartbeatTaskWork({
          userId,
          runId: run_id,
        }),
      ),
  );

  server.registerTool(
    "stop_task_work",
    {
      description:
        "Call this when you stop actively working on a task, whether it was completed, paused, blocked, or handed off. " +
        "It removes the live lease and writes one auditable stop event.",
      inputSchema: {
        run_id: z.string().describe("uuid returned by start_task_work"),
        outcome: z.string().optional().describe("brief outcome, e.g. completed, paused, blocked, handed off"),
      },
    },
    ({ run_id, outcome }) =>
      run(() =>
        stopTaskWork({
          userId,
          runId: run_id,
          outcome,
        }),
      ),
  );

  server.registerTool(
    "update_context",
    {
      description:
        "Call this when an entry you have read is wrong in a detail rather than wrong as a " +
        "whole. It corrects the content or anchors of an existing node. Needs the node_id from " +
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
        "Call this when a recorded entry is no longer true and correcting it would not help. " +
        "It archives the node, so it stops showing up in searches. " +
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
