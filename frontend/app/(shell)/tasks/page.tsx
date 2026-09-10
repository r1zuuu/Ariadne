"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { useFailure } from "@/components/failure";
import { Collapse } from "@/components/motion";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Meta,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import {
  createTask,
  listTasks,
  updateTask,
  type Task,
  type TaskActiveRun,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api";

type Tab = "all" | "todo" | "in_progress" | "blocked" | "done";

const TABS: Tab[] = ["all", "todo", "in_progress", "blocked", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];

const EMPTY_CREATE = { title: "", description: "", priority: "medium" as TaskPriority };

function who(email: string | null | undefined): string {
  return email ? email.split("@")[0] : "";
}

function freshRuns(runs: TaskActiveRun[]): TaskActiveRun[] {
  const now = Date.now();
  return runs.filter((run) => Date.parse(run.expiresAt) > now);
}

export default function TasksScreen() {
  const t = useTranslations("tasks");
  const toast = useToast();
  const failure = useFailure();
  const { activeProject, server, refreshProjects, projects } = useApp();
  const { locale } = useLocale();

  const projectId = activeProject?.id ?? null;
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_CREATE);

  const [tabCounts, setTabCounts] = useState<Partial<Record<Tab, number>>>({});

  const stamp = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso)),
    [locale],
  );

  /** Whether anything is narrowing the list, which decides which nothing to show. */
  const filtered = query.trim() !== "" || tab !== "all";

  const filters = useMemo(() => {
    const trimmed = query.trim();
    return {
      ...(tab === "all" ? { active: true } : { status: tab as TaskStatus }),
      ...(trimmed ? { query: trimmed } : {}),
      limit: 50,
    };
  }, [query, tab]);

  const load = useCallback(
    async (cursor?: string) => {
      if (!projectId) return;
      setError(null);
      try {
        const page = await listTasks(projectId, { ...filters, cursor });
        setTasks((prev) => (cursor && prev ? [...prev, ...page.tasks] : page.tasks));
        setNextCursor(page.nextCursor);
        if (tab === "all" && !query.trim() && !cursor) {
          setTabCounts({
            all: page.tasks.length,
            todo: page.tasks.filter((t) => t.status === "todo").length,
            in_progress: page.tasks.filter((t) => t.status === "in_progress").length,
            blocked: page.tasks.filter((t) => t.status === "blocked").length,
            done: page.tasks.filter((t) => t.status === "done").length,
          });
        }
      } catch (caught) {
        setError(failure(caught));
        if (!cursor) setTasks([]);
      }
    },
    [failure, filters, projectId, query, tab],
  );

  useEffect(() => {
    setTasks(null);
    if (projectId) void load();
  }, [projectId, load]);

  useEffect(() => {
    if (!projectId) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [load, projectId]);

  const rename = async (task: Task, title: string) => {
    try {
      await updateTask(task.id, { title, revision: task.revision });
      toast(t("toastRenamed"));
      await load();
    } catch (caught) {
      toast(failure(caught), "error");
    }
  };

  const changeStatus = async (task: Task, newStatus: TaskStatus) => {
    try {
      await updateTask(task.id, { status: newStatus, revision: task.revision });
      toast(t("event.status_changed"));
      await load();
    } catch (caught) {
      toast(failure(caught), "error");
    }
  };

  const submitCreate = async () => {
    if (!projectId) return;
    setCreateBusy(true);
    try {
      await createTask(projectId, {
        title: createDraft.title,
        description: createDraft.description,
        priority: createDraft.priority,
      });
      setCreateDraft(EMPTY_CREATE);
      setCreateOpen(false);
      toast(t("toastCreated"));
      await load();
    } catch (caught) {
      toast(failure(caught), "error");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        actions={
          <Button
            variant={createOpen ? "quiet" : "primary"}
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? (
              t("createClose")
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
                <span>{t("create")}</span>
              </>
            )}
          </Button>
        }
      />

      {projectId === null ? (
        server === "down" ? (
          <EmptyState
            title={t("unreachable")}
            note={t("unreachableNote")}
            illustration="compact"
            action={
              <Button variant="secondary" onClick={() => void refreshProjects()}>
                {t("retry")}
              </Button>
            }
          />
        ) : projects !== null && projects.length === 0 ? (
          <EmptyState title={t("noProject")} note={t("noProjectNote")} illustration="context" />
        ) : (
          <p className="text-body text-ink-3">{t("loading")}</p>
        )
      ) : (
        <>
          <Collapse open={createOpen}>
            <Card as="section" className="mb-6 border-edge/50 bg-surface/80 p-6 backdrop-blur-sm">
              <div className="grid gap-5">
                <Input
                  id="task-title"
                  label={t("field.title")}
                  value={createDraft.title}
                  maxLength={160}
                  placeholder="np. Zaimplementuj obsługę powiadomień webhooks"
                  autoFocus={createOpen}
                  onChange={(event) =>
                    setCreateDraft((draft) => ({ ...draft, title: event.target.value }))
                  }
                />
                <Textarea
                  id="task-description"
                  label={t("field.description")}
                  rows={3}
                  value={createDraft.description}
                  placeholder="Krótki opis celu i zakresu zadania..."
                  onChange={(event) =>
                    setCreateDraft((draft) => ({ ...draft, description: event.target.value }))
                  }
                />
                <Select
                  id="task-priority"
                  label={t("field.priority")}
                  value={createDraft.priority}
                  onChange={(value) =>
                    setCreateDraft((draft) => ({ ...draft, priority: value as TaskPriority }))
                  }
                  options={PRIORITIES.map((priority) => ({
                    value: priority,
                    label: t(`priority.${priority}`),
                  }))}
                />
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    loading={createBusy}
                    disabled={!createDraft.title.trim()}
                    onClick={() => void submitCreate()}
                  >
                    {createBusy ? t("creating") : t("create")}
                  </Button>
                  <Button variant="quiet" onClick={() => setCreateOpen(false)}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            </Card>
          </Collapse>

          {/* Structured Modern Toolbar */}
          <div className="flex flex-col gap-3.5 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input with embedded icon and clear button */}
            <div className="relative w-full sm:max-w-[300px]">
              <Input
                id="task-search"
                placeholder={t("search") + "..."}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                icon={
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="7" cy="7" r="5" />
                    <path d="m11 11 3.5 3.5" />
                  </svg>
                }
                className="!h-[38px] text-small"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink transition-colors"
                  aria-label="Wyczyść wyszukiwanie"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Segmented Filter Tabs with Counts */}
            <div
              className="inline-flex flex-wrap rounded-control border border-edge/60 bg-plaster-sunk p-1 gap-1"
              role="tablist"
              aria-label={t("filters")}
            >
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  onClick={() => setTab(item)}
                  className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-small font-medium transition-all duration-state ${
                    tab === item
                      ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                      : "text-ink-2 hover:bg-surface/50 hover:text-ink"
                  }`}
                >
                  <span>{t(`tab.${item}`)}</span>
                  {typeof tabCounts[item] === "number" ? (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono leading-none ${
                        tab === item
                          ? "bg-thread/20 text-thread-deep font-semibold"
                          : "bg-surface-2 text-ink-3"
                      }`}
                    >
                      {tabCounts[item]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="pt-5 text-small text-iron">{error}</p> : null}

          {tasks === null ? (
            <p className="pt-6 text-body text-ink-3">{t("loading")}</p>
          ) : tasks.length === 0 ? (
            filtered ? (
              <EmptyState
                title={t("noMatch")}
                note={t("noMatchNote")}
                illustration="compact"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setTab("all");
                    }}
                  >
                    {t("clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title={t("empty")}
                note={t("emptyNote")}
                illustration="tasks"
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    {t("create")}
                  </Button>
                }
              />
            )
          ) : (
            <div className="grid grid-cols-1 gap-3.5 pt-1">
              {tasks.map((task) => {
                const activeRuns = freshRuns(task.activeRuns);
                return (
                  <div
                    key={task.id}
                    className="group relative flex flex-col justify-between rounded-card border border-edge/50 bg-surface/40 p-4 sm:p-5 transition-all duration-200 hover:border-edge-strong/70 hover:bg-surface/75 hover:shadow-card"
                  >
                    {/* Top Row: Typographic Status Badge, Priority Badge, ID, and Date */}
                    <div className="flex items-center justify-between gap-3 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <TaskStatusBadge status={task.status} />
                        {task.priority !== "medium" ? (
                          <PriorityBadge priority={task.priority} />
                        ) : null}
                        <span className="font-mono text-data text-ink-3/70">
                          #{task.id.slice(0, 7)}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-data text-ink-3">
                        {stamp(task.updatedAt)}
                      </span>
                    </div>

                    {/* Middle Row: Title & Description */}
                    <div className="py-1">
                      <TaskTitle task={task} onRename={rename} />

                      {task.blockedReason ? (
                        <div className="mt-2.5 flex items-center gap-2 rounded-control border border-iron/30 bg-iron/10 px-3 py-2 text-small text-iron">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="shrink-0"
                            aria-hidden="true"
                          >
                            <circle cx="8" cy="8" r="6" />
                            <path d="M8 5v4M8 11.5v.5" />
                          </svg>
                          <span className="font-medium">{task.blockedReason}</span>
                        </div>
                      ) : task.description ? (
                        <p className="mt-2 line-clamp-2 text-small text-ink-2 leading-relaxed">
                          {task.description}
                        </p>
                      ) : null}
                    </div>

                    {/* Bottom Row: Active Agents, Author, and Quick Status Actions */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/60 pt-3">
                      {/* Left side: Live agents / Creator */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {activeRuns.length > 0 ? (
                          <>
                            <TaskLiveBadge runs={activeRuns} />
                            <AgentRunChips runs={activeRuns} />
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-data text-ink-3">
                            <span>{task.source?.channel === "coder" ? t("agent") : t("human")}</span>
                            {task.createdBy ? (
                              <>
                                <span className="text-edge/60">•</span>
                                <span>{t("createdBy", { who: who(task.createdBy) })}</span>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Right side: Quick Status Actions */}
                      <div className="flex items-center gap-2">
                        {task.status !== "done" ? (
                          <button
                            type="button"
                            onClick={() => void changeStatus(task, "done")}
                            className="inline-flex items-center gap-1.5 rounded-control border border-edge/60 bg-surface/60 px-2.5 py-1 text-data font-medium text-ink-2 transition-all hover:border-laurel/40 hover:bg-laurel/10 hover:text-laurel"
                            title="Oznacz jako zrobione"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3.5 8.5l3 3 6-7" />
                            </svg>
                            <span>{t("status.done")}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void changeStatus(task, "todo")}
                            className="inline-flex items-center gap-1.5 rounded-control border border-edge/60 bg-surface/60 px-2.5 py-1 text-data font-medium text-ink-3 transition-all hover:border-ochre/40 hover:bg-ochre/10 hover:text-ochre"
                            title="Przywróć do zrobienia"
                          >
                            <span>Przywróć</span>
                          </button>
                        )}
                        {task.status === "todo" ? (
                          <button
                            type="button"
                            onClick={() => void changeStatus(task, "in_progress")}
                            className="inline-flex items-center gap-1.5 rounded-control border border-edge/60 bg-surface/60 px-2.5 py-1 text-data font-medium text-ink-2 transition-all hover:border-aegean/40 hover:bg-aegean/10 hover:text-aegean"
                            title="Rozpocznij pracę"
                          >
                            <span>Rozpocznij</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {nextCursor ? (
            <div className="pt-5">
              <Button variant="secondary" onClick={() => void load(nextCursor)}>
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// The title, and the one thing on this screen a person edits.
//
// Two clicks rather than a pencil, because the pencil would be on every row of a
// list nobody comes here to edit. Enter opens it from the keyboard, so the only
// way in is not a gesture a keyboard cannot make.
//
// It looks like the text it replaces: same size, no box, one hairline that takes
// up the thread while it has focus. A field with a border here would say the row
// is a form, which is the thing being taken away.
function TaskTitle({
  task,
  onRename,
}: {
  task: Task;
  onRename: (task: Task, title: string) => Promise<void>;
}) {
  const t = useTranslations("tasks");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [saving, setSaving] = useState(false);

  const open = () => {
    setDraft(task.title);
    setEditing(true);
  };

  const commit = async () => {
    const title = draft.trim();
    setEditing(false);
    // Nothing typed, or nothing changed: leaving is not an edit, so it writes
    // nothing and says nothing.
    if (!title || title === task.title) {
      setDraft(task.title);
      return;
    }
    setSaving(true);
    try {
      await onRename(task, title);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={draft}
        disabled={saving}
        aria-label={t("renameLabel")}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        // Clicking away is a decision to keep what was typed, the same as Enter.
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(task.title);
            setEditing(false);
          }
        }}
        className="w-full border-b border-thread bg-transparent pb-0.5 text-body font-semibold text-ink outline-none disabled:opacity-50"
      />
    );
  }

  return (
    <button
      type="button"
      title={t("renameHint")}
      onDoubleClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter") open();
      }}
      className="w-full cursor-text rounded-control text-left text-body font-semibold text-ink transition-colors group-hover:text-thread"
    >
      {task.title}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const t = useTranslations("tasks");
  const color = {
    low: "text-stone border-stone/30 bg-stone/10",
    medium: "text-ink-3 border-edge/50 bg-surface/50",
    high: "text-ochre border-ochre/30 bg-ochre/10",
    critical: "text-iron border-iron/35 bg-iron/10",
  }[priority];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-data font-medium leading-none ${color}`}
      title={t(`priority.${priority}`)}
    >
      {priority === "critical" ? (
        <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1l7 14H1L8 1zm0 4v5h1.5V5H8zm0 7v1.5h1.5V12H8z" />
        </svg>
      ) : priority === "high" ? (
        <svg
          width="9"
          height="9"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M8 13V3M4 7l4-4 4 4" />
        </svg>
      ) : null}
      <span>{t(`priority.${priority}`)}</span>
    </span>
  );
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const t = useTranslations("tasks");
  const toneMap: Record<TaskStatus, string> = {
    backlog: "bg-surface-2 text-ink-3 border-edge/60",
    todo: "bg-ochre/12 text-ochre border-ochre/30",
    in_progress: "bg-aegean/15 text-aegean border-aegean/30",
    blocked: "bg-iron/15 text-iron border-iron/30",
    done: "bg-laurel/15 text-laurel border-laurel/30",
    archived: "bg-surface-2 text-ink-3 border-edge/60",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-data font-semibold uppercase tracking-wider leading-none border ${
        toneMap[status] ?? toneMap.todo
      }`}
      title={t(`status.${status}`)}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function TaskLiveBadge({ runs }: { runs: TaskActiveRun[] }) {
  const t = useTranslations("tasks");
  if (!runs.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-thread/30 bg-thread/10 px-2.5 py-0.5 text-data font-medium text-thread leading-none">
      <span className="h-[6px] w-[6px] rounded-full bg-thread" aria-hidden />
      <span>{t("liveNow")}</span>
    </span>
  );
}

function AgentRunChips({ runs }: { runs: TaskActiveRun[] }) {
  const t = useTranslations("tasks");
  if (!runs.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {runs.map((run) => (
        <span
          key={run.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-edge/60 bg-surface px-2.5 py-0.5 text-data text-ink-2 leading-none"
          title={t("workingAgent", { client: run.agentClient })}
        >
          <AgentKindMark kind={run.agentKind} />
          <span>{run.agentClient || t(`agentKind.${run.agentKind}`)}</span>
        </span>
      ))}
    </span>
  );
}

const AGENT_MARKS: Partial<Record<TaskActiveRun["agentKind"], string>> = {
  claude: "/agent-claude.webp",
  codex: "/agent-codex.webp",
};

function AgentKindMark({ kind }: { kind: TaskActiveRun["agentKind"] }) {
  const mark = AGENT_MARKS[kind];
  if (mark) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mark} alt="" aria-hidden width={14} height={14} className="shrink-0" />;
  }
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden
      className="shrink-0 text-aegean"
    >
      <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 3.6v4.8M3.6 6h4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
