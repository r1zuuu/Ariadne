// Focused checks for the project Tasks section. Run from backend/:
// npx tsx scripts/verify-tasks.ts
//
// This deliberately avoids Gemini: tasks are operational state, not semantic
// memory. Memory links are checked with a directly inserted node.
import assert from "node:assert/strict";

process.loadEnvFile("../.env");

const APP_URL = process.env.DATABASE_URL_APP;
process.env.DATABASE_URL_APP = process.env.DATABASE_URL;
if (!APP_URL) throw new Error("DATABASE_URL_APP is not set, so the policy block has nothing to test");

const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { eq, inArray } = await import("drizzle-orm");
const { createRestApp } = await import("../src/rest.js");
const { db } = await import("../src/db/client.js");
const { nodes, taskActiveRuns, taskEvents, tasks, users, workspaces } = await import(
  "../src/db/schema.js"
);
const service = await import("../src/service.js");

const HUMAN = "task-human@ariadne.local";
const OTHER = "task-other@ariadne.local";
const PASSWORD = "verify-password-123";
const embedding = Array.from({ length: 768 }, () => 0.01);

await db.delete(users).where(inArray(users.email, [HUMAN, OTHER]));

let passed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  assert.deepStrictEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}`);
  console.log(`ok  ${label}`);
  passed++;
}

type Options = { method?: string; token?: string; body?: unknown };
async function call(path: string, { method = "GET", token, body }: Options = {}) {
  const res = await app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

function mcpJson(result: unknown): unknown {
  const content = (result as { content?: unknown }).content as
    | Array<{ type: string; text?: string }>
    | undefined;
  const text = content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("MCP result did not contain text JSON");
  return JSON.parse(text);
}

const app = createRestApp();

const registered = await call("/auth/register", {
  method: "POST",
  body: { email: HUMAN, password: PASSWORD },
});
check("human registration returns 201", registered.status, 201);
const token: string = registered.body.token;

const createdProject = await call("/projects", {
  method: "POST",
  token,
  body: { name: "Tasks", repoRef: "git@github.com:r1zuuu/Tasks.git" },
});
check("project creation returns 201", createdProject.status, 201);
const projectId: string = createdProject.body.id;

const [{ id: userId }] = await db.select({ id: users.id }).from(users).where(eq(users.email, HUMAN));
const [{ id: workspaceId }] = await db
  .select({ id: workspaces.id })
  .from(workspaces)
  .where(eq(workspaces.ownerId, userId));

const [memory] = await db
  .insert(nodes)
  .values({
    workspaceId,
    authorId: userId,
    projectId,
    type: "decision",
    status: "confirmed",
    content: "Tasks reference memories without changing them",
    summary: "Tasks link memories only",
    embedding,
  })
  .returning({ id: nodes.id });

const createdTask = await call(`/projects/${projectId}/tasks`, {
  method: "POST",
  token,
  body: { title: "Add task verification", description: "Cover REST behaviour" },
});
check("human task creation returns 201", createdTask.status, 201);
check("default priority is medium", createdTask.body.priority, "medium");
check("default status is todo", createdTask.body.status, "todo");
check("human source is recorded", createdTask.body.source.channel, "app_form");
check("creation writes one event", createdTask.body.events[0].action, "created");
const taskId: string = createdTask.body.id;
const firstRevision: number = createdTask.body.revision;

const listed = await call(`/projects/${projectId}/tasks?active=true`, { token });
check("active listing includes the task", listed.body.tasks.some((t: { id: string }) => t.id === taskId), true);

const partial = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: { revision: firstRevision, description: "Changed without replacing title" },
});
check("partial update returns 200", partial.status, 200);
check("partial update keeps the title", partial.body.title, "Add task verification");
check("partial update bumps revision", partial.body.revision, firstRevision + 1);

const stale = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: { revision: firstRevision, title: "Overwrite from stale state" },
});
check("stale revision is a conflict", stale.status, 409);

const blocked = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: {
    revision: partial.body.revision,
    status: "blocked",
    blockedReason: "Need production credentials",
  },
});
check("blocked reason persists", blocked.body.blockedReason, "Need production credentials");

const done = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: { revision: blocked.body.revision, status: "done" },
});
check("completion records completedBy", done.body.completedBy, HUMAN);
check("completion records completedAt", typeof done.body.completedAt, "string");
check("leaving blocked clears the reason", done.body.blockedReason, null);

const reopened = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: { revision: done.body.revision, status: "todo" },
});
check("reopening clears completedBy", reopened.body.completedBy, null);
check("reopening clears completedAt", reopened.body.completedAt, null);

const linked = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: { revision: reopened.body.revision, relatedMemoryIds: [memory.id] },
});
check("linked memory id is returned", linked.body.relatedMemoryIds, [memory.id]);
check("linked memory can be opened in detail", linked.body.relatedMemories[0].id, memory.id);
const [memoryAfterLink] = await db.select({ status: nodes.status }).from(nodes).where(eq(nodes.id, memory.id));
check("linking a memory does not change its status", memoryAfterLink.status, "confirmed");

const archived = await call(`/tasks/${taskId}`, {
  method: "PATCH",
  token,
  body: { revision: linked.body.revision, status: "archived" },
});
check("archive is a task status", archived.body.status, "archived");
check(
  "archived tasks disappear from active view",
  (await call(`/projects/${projectId}/tasks?active=true`, { token })).body.tasks.some(
    (t: { id: string }) => t.id === taskId,
  ),
  false,
);

const agentToken = await service.createApiToken({ userId, label: "codex" });
const [mcpClientSide, mcpServerSide] = InMemoryTransport.createLinkedPair();
const mcpClient = new Client({ name: "verify-tasks", version: "0" });
const { createMcpServer } = await import("../src/mcp.js");
await Promise.all([
  createMcpServer({ userId, tokenId: agentToken.id }).connect(mcpServerSide),
  mcpClient.connect(mcpClientSide),
]);
const agentCreated = await mcpClient.callTool({
  name: "create_task",
  arguments: {
    repo_ref: "https://github.com/r1zuuu/Tasks.git",
    title: "Finish task MCP coverage",
    priority: "high",
    source: { client: "Codex", session_id: "verify" },
  },
});
assert.equal(agentCreated.isError, false);
const agentBody = mcpJson(agentCreated) as { id: string; revision: number; status: string; source: { channel: string; client: string } };
check("agent task creation records coder source", agentBody.source.channel, "coder");
check("agent client is recorded", agentBody.source.client, "Codex");
const started = await mcpClient.callTool({
  name: "start_task_work",
  arguments: {
    task_id: agentBody.id,
    source: { client: "Codex", session_id: "verify-live" },
  },
});
assert.equal(started.isError, false);
const startedBody = mcpJson(started) as {
  run: { id: string; agent_kind: string; agent_client: string; expires_at: string };
  task: { status: string; revision: number; active_runs: Array<{ id: string; agent_kind: string }> };
};
check("mcp start_task_work moves todo to in_progress", startedBody.task.status, "in_progress");
check("mcp start_task_work bumps task revision", startedBody.task.revision, agentBody.revision + 1);
check("mcp start_task_work returns codex run", startedBody.run.agent_kind, "codex");
check("mcp start_task_work returns active run on task", startedBody.task.active_runs.length, 1);
await new Promise((resolve) => setTimeout(resolve, 5));
const heartbeat = await mcpClient.callTool({
  name: "heartbeat_task_work",
  arguments: { run_id: startedBody.run.id },
});
assert.equal(heartbeat.isError, false);
const heartbeatBody = mcpJson(heartbeat) as { run: { expires_at: string } };
check(
  "heartbeat extends the run lease",
  Date.parse(heartbeatBody.run.expires_at) >= Date.parse(startedBody.run.expires_at),
  true,
);
check(
  "heartbeat does not bump task revision",
  (await service.getTask({ userId, taskId: agentBody.id })).revision,
  startedBody.task.revision,
);
const claudeToken = await service.createApiToken({ userId, label: "Claude Code" });
const [claudeClientSide, claudeServerSide] = InMemoryTransport.createLinkedPair();
const claudeClient = new Client({ name: "verify-tasks-claude", version: "0" });
await Promise.all([
  createMcpServer({ userId, tokenId: claudeToken.id }).connect(claudeServerSide),
  claudeClient.connect(claudeClientSide),
]);
const claudeStarted = await claudeClient.callTool({
  name: "start_task_work",
  arguments: {
    task_id: agentBody.id,
    source: { client: "Claude Code", session_id: "verify-claude" },
  },
});
assert.equal(claudeStarted.isError, false);
const claudeStartedBody = mcpJson(claudeStarted) as {
  run: { id: string; agent_kind: string };
  task: { active_runs: Array<{ id: string; agent_kind: string }> };
};
check("claude live run is classified", claudeStartedBody.run.agent_kind, "claude");
check("multiple agents are visible on one task", claudeStartedBody.task.active_runs.length, 2);
await db
  .update(taskActiveRuns)
  .set({ expiresAt: new Date(Date.now() - 1000) })
  .where(eq(taskActiveRuns.id, startedBody.run.id));
check(
  "expired live runs disappear from detail",
  (await service.getTask({ userId, taskId: agentBody.id })).activeRuns.length,
  1,
);
const agentListed = await mcpClient.callTool({
  name: "get_tasks",
  arguments: { repo_ref: "github.com/r1zuuu/Tasks", active: true },
});
assert.equal(agentListed.isError, false);
const agentListBody = mcpJson(agentListed) as { tasks: Array<{ id: string; active_runs: unknown[] }> };
check("mcp get_tasks reads active tasks", agentListBody.tasks.length, 1);
check(
  "expired live runs disappear from list",
  agentListBody.tasks.find((task) => task.id === agentBody.id)?.active_runs.length,
  1,
);
const agentUpdated = await mcpClient.callTool({
  name: "update_task",
  arguments: {
    task_id: agentBody.id,
    revision: startedBody.task.revision,
    status: "in_progress",
    source: { client: "Codex", session_id: "verify" },
  },
});
assert.equal(agentUpdated.isError, false);
check("mcp update_task changes status", (mcpJson(agentUpdated) as { status: string }).status, "in_progress");

const boot = await service.getBootContext({ userId, tokenId: agentToken.id, repoRef: "github.com/r1zuuu/Tasks" });
check("boot context names the task tool", boot.tasks.tool, "get_tasks");
check("boot context counts active tasks", boot.tasks.total_active, 1);
check("boot context returns a compact current list", boot.tasks.current.length, 1);
check("boot context includes fresh live runs only", boot.tasks.current[0].active_runs.length, 1);

const stopped = await claudeClient.callTool({
  name: "stop_task_work",
  arguments: { run_id: claudeStartedBody.run.id, outcome: "paused" },
});
assert.equal(stopped.isError, false);
check("stop_task_work removes the live run", (await service.getTask({ userId, taskId: agentBody.id })).activeRuns.length, 0);
const afterStop = await service.getTask({ userId, taskId: agentBody.id });
const doneForLive = await call(`/tasks/${agentBody.id}`, {
  method: "PATCH",
  token,
  body: { revision: afterStop.revision, status: "done" },
});
check("done before live start rejection returns 200", doneForLive.status, 200);
const startDone = await mcpClient.callTool({
  name: "start_task_work",
  arguments: {
    task_id: agentBody.id,
    source: { client: "Codex", session_id: "verify-live-done" },
  },
});
check("done task rejects live start", startDone.isError, true);
const archivedForLive = await call(`/tasks/${agentBody.id}`, {
  method: "PATCH",
  token,
  body: { revision: doneForLive.body.revision, status: "archived" },
});
check("archive before live start rejection returns 200", archivedForLive.status, 200);
const startArchived = await mcpClient.callTool({
  name: "start_task_work",
  arguments: {
    task_id: agentBody.id,
    source: { client: "Codex", session_id: "verify-live-archived" },
  },
});
check("archived task rejects live start", startArchived.isError, true);

const theirToken: string = (
  await call("/auth/register", { method: "POST", body: { email: OTHER, password: PASSWORD } })
).body.token;
const restLiveTask = await call(`/projects/${projectId}/tasks`, {
  method: "POST",
  token,
  body: { title: "Exercise REST live runs" },
});
const restStarted = await call(`/tasks/${restLiveTask.body.id}/runs`, {
  method: "POST",
  token,
  body: { client: "Claude", sessionId: "rest-live" },
});
check("REST start task run returns 201", restStarted.status, 201);
check("REST start task run classifies Claude", restStarted.body.run.agentKind, "claude");
check("REST start moves todo task to in_progress", restStarted.body.task.status, "in_progress");
const restRunId: string = restStarted.body.run.id;
const restRevision: number = restStarted.body.task.revision;
const restHeartbeat = await call(`/task-runs/${restRunId}/heartbeat`, {
  method: "POST",
  token,
});
check("REST heartbeat returns 200", restHeartbeat.status, 200);
check("REST heartbeat keeps task revision unchanged", (await service.getTask({ userId, taskId: restLiveTask.body.id })).revision, restRevision);
check(
  "another user cannot list my task project",
  (await call(`/projects/${projectId}/tasks`, { token: theirToken })).status,
  404,
);
check("another user cannot read my task by id", (await call(`/tasks/${agentBody.id}`, { token: theirToken })).status, 404);
check(
  "another user cannot update my task by id",
  (await call(`/tasks/${agentBody.id}`, {
    method: "PATCH",
    token: theirToken,
    body: { status: "done" },
  })).status,
  404,
);
check(
  "another user cannot start my task run",
  (await call(`/tasks/${restLiveTask.body.id}/runs`, {
    method: "POST",
    token: theirToken,
    body: { client: "Codex", sessionId: "outsider" },
  })).status,
  404,
);
check(
  "another user cannot heartbeat my task run",
  (await call(`/task-runs/${restRunId}/heartbeat`, { method: "POST", token: theirToken })).status,
  404,
);
check(
  "another user cannot stop my task run",
  (await call(`/task-runs/${restRunId}`, { method: "DELETE", token: theirToken })).status,
  404,
);

const events = await db.select().from(taskEvents).where(eq(taskEvents.taskId, agentBody.id));
check("task event history is auditable", events.length >= 5, true);
check("work_started event is auditable", events.some((event) => event.action === "work_started"), true);
check("work_stopped event is auditable", events.some((event) => event.action === "work_stopped"), true);
const taskRows = await db.select().from(tasks).where(eq(tasks.id, agentBody.id));
check("task row survived verification", taskRows.length, 1);

const { default: pg } = await import("pg");
const appPool = new pg.Pool({ connectionString: APP_URL });
const client = await appPool.connect();

async function asRole(user: string | null, statement: string, params: unknown[] = []) {
  await client.query("BEGIN");
  if (user) await client.query("SELECT set_config('app.user_id', $1, true)", [user]);
  try {
    return await client.query(statement, params);
  } finally {
    await client.query("ROLLBACK");
  }
}

const [{ id: otherUserId }] = await db.select({ id: users.id }).from(users).where(eq(users.email, OTHER));
check(
  "RLS lets the owner see their task rows",
  (await asRole(userId, "SELECT count(*)::int AS n FROM tasks WHERE project_id = $1", [projectId])).rows[0].n > 0,
  true,
);
check(
  "RLS lets the owner see live task run rows",
  (await asRole(userId, "SELECT count(*)::int AS n FROM task_active_runs WHERE project_id = $1", [projectId])).rows[0].n > 0,
  true,
);
check(
  "RLS hides task rows from outsiders",
  (await asRole(otherUserId, "SELECT count(*)::int AS n FROM tasks WHERE project_id = $1", [projectId])).rows[0].n,
  0,
);
check(
  "RLS hides live task runs from outsiders",
  (await asRole(otherUserId, "SELECT count(*)::int AS n FROM task_active_runs WHERE project_id = $1", [projectId])).rows[0].n,
  0,
);
const smuggled = await asRole(
  otherUserId,
  "INSERT INTO tasks (workspace_id, project_id, title) VALUES ($1, $2, 'smuggled')",
  [workspaceId, projectId],
).then(
  () => "no error",
  (error: { code?: string }) => error.code,
);
check("RLS refuses writes into another workspace", smuggled, "42501");
const smuggledRun = await asRole(
  otherUserId,
  "INSERT INTO task_active_runs (workspace_id, project_id, task_id, agent_client, session_id, expires_at) VALUES ($1, $2, $3, 'Codex', 'smuggled', now() + interval '2 minutes')",
  [workspaceId, projectId, restLiveTask.body.id],
).then(
  () => "no error",
  (error: { code?: string }) => error.code,
);
check("RLS refuses live run writes into another workspace", smuggledRun, "42501");

check("REST stop task run returns 204", (await call(`/task-runs/${restRunId}`, { method: "DELETE", token })).status, 204);

client.release();
await appPool.end();
await db.delete(users).where(inArray(users.email, [HUMAN, OTHER]));

console.log(`\n${passed} task checks passed`);
process.exit(0);
