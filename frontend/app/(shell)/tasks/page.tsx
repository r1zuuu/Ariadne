"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { useFailure } from "@/components/failure";
import { Collapse } from "@/components/motion";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Input, Meta, PageHeader, Textarea } from "@/components/ui";
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
      } catch (caught) {
        setError(failure(caught));
        if (!cursor) setTasks([]);
      }
    },
    [failure, filters, projectId],
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

  // The only thing a person changes here by hand. Everything else about a task -
  // status, priority, what is blocking it, which entries it leans on - is
  // written by whichever coder is doing the work, and a form for a human to
  // duplicate that was six fields nobody filled in.
  const rename = async (task: Task, title: string) => {
    try {
      await updateTask(task.id, { title, revision: task.revision });
      toast(t("toastRenamed"));
      await load();
    } catch (caught) {
      toast(failure(caught), "error");
    }
  };

  const submitCreate = async () => {
    if (!projectId) return;
    setCreateBusy(true);
    try {
      // The row it makes arrives with the next load; there is nothing to open
      // any more, so nothing here has to hold on to it.
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
            variant={createOpen ? "quiet" : "secondary"}
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? t("createClose") : t("createOpen")}
          </Button>
        }
      />

      {projectId === null ? (
        server === "down" ? (
          <EmptyState
            title={t("unreachable")}
            note={t("unreachableNote")}
            action={
              <Button variant="secondary" onClick={() => void refreshProjects()}>
                {t("retry")}
              </Button>
            }
          />
        ) : projects !== null && projects.length === 0 ? (
          <EmptyState title={t("noProject")} note={t("noProjectNote")} />
        ) : (
          <p className="text-body text-ink-3">{t("loading")}</p>
        )
      ) : (
        <>
          <Collapse open={createOpen}>
            <Card as="section" className="mb-6 p-6">
              <div className="grid gap-5">
                <Input
                  id="task-title"
                  label={t("field.title")}
                  value={createDraft.title}
                  maxLength={160}
                  onChange={(event) =>
                    setCreateDraft((draft) => ({ ...draft, title: event.target.value }))
                  }
                />
                <Textarea
                  id="task-description"
                  label={t("field.description")}
                  rows={3}
                  value={createDraft.description}
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
                <div className="flex flex-wrap gap-3">
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

          <div className="flex flex-wrap items-end gap-4 border-b border-hairline pb-5">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("filters")}>
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  onClick={() => setTab(item)}
                  className={`rounded-control px-4 py-[8px] text-small transition-colors duration-state ${
                    tab === item
                      ? "bg-surface text-ink shadow-card"
                      : "text-ink-2 hover:bg-surface/70 hover:text-ink"
                  }`}
                >
                  {t(`tab.${item}`)}
                </button>
              ))}
            </div>
            <div className="min-w-[220px] flex-1">
              <Input
                id="task-search"
                label={t("search")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {error ? <p className="pt-5 text-small text-iron">{error}</p> : null}

          {tasks === null ? (
            <p className="pt-6 text-body text-ink-3">{t("loading")}</p>
          ) : tasks.length === 0 ? (
            // Two different nothings. An archive with no tasks in it needs to be
            // told what would put one there; a search that matched none of seven
            // needs to be told that the seven are still there and how to see
            // them. Saying "nobody has left any work here yet" to someone who
            // just typed a word is simply false.
            filtered ? (
              <EmptyState
                title={t("noMatch")}
                note={t("noMatchNote")}
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
              <EmptyState title={t("empty")} note={t("emptyNote")} />
            )
          ) : (
            <ul className="flex flex-col">
              {tasks.map((task) => {
                const activeRuns = freshRuns(task.activeRuns);
                return (
                  <li key={task.id} className="border-b border-hairline">
                    <div className="flex flex-col gap-3 px-1 py-5 sm:px-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <TaskStatusLabel status={task.status} />
                        <TaskLiveBadge runs={activeRuns} />
                        <AgentRunChips runs={activeRuns} />
                        <Meta
                          items={[
                            t(`priority.${task.priority}`),
                            task.source?.channel === "coder" ? t("agent") : t("human"),
                            task.createdBy ? t("createdBy", { who: who(task.createdBy) }) : null,
                            stamp(task.updatedAt),
                          ]}
                        />
                      </div>
                      <div className="min-w-0">
                        <TaskTitle task={task} onRename={rename} />
                        {task.blockedReason ? (
                          <p className="pt-1 text-small text-iron">{task.blockedReason}</p>
                        ) : task.description ? (
                          <p className="line-clamp-2 pt-1 text-small text-ink-2">
                            {task.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
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
        className="w-full border-b border-thread bg-transparent pb-1 text-lead text-ink outline-none disabled:opacity-50"
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
      // cursor-text and nothing else: the row is not a control any more, so the
      // only hint it needs is the one the pointer gives over editable text.
      className="w-full cursor-text rounded-control text-left text-lead text-ink"
    >
      {task.title}
    </button>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block pb-2 text-small font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[44px] w-full rounded-control border border-edge/60 bg-surface px-5 text-body text-ink outline-none focus:border-thread focus:ring-2 focus:ring-thread/25"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TaskLiveBadge({ runs }: { runs: TaskActiveRun[] }) {
  const t = useTranslations("tasks");
  if (!runs.length) return null;
  return (
    <span className="inline-flex items-center gap-[7px] rounded-label bg-thread/10 px-[7px] py-[2px] text-label uppercase tracking-[0.12em] text-thread">
      <span className="relative flex h-[7px] w-[7px]" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
        <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-current" />
      </span>
      {t("liveNow")}
    </span>
  );
}

function AgentRunChips({ runs }: { runs: TaskActiveRun[] }) {
  const t = useTranslations("tasks");
  if (!runs.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {runs.map((run) => (
        <span
          key={run.id}
          className="inline-flex items-center gap-[6px] rounded-label border border-edge/70 bg-surface px-[7px] py-[2px] text-data text-ink-2"
          title={t("workingAgent", { client: run.agentClient })}
        >
          <AgentKindMark kind={run.agentKind} />
          <span>{run.agentClient || t(`agentKind.${run.agentKind}`)}</span>
        </span>
      ))}
    </span>
  );
}

// Each tool's own mark, in public/ at three times its drawn size (see
// scripts/optimise-image.mjs). Redrawn in the house line weight they were two
// abstract glyphs nobody could name; a logo's whole job is to be recognised, so
// this is the one place in the app that shows somebody else's brand.
//
// It is also the only colour here the palette does not own. That is the price of
// recognising a tool at a glance, and it is paid on a mark that identifies rather
// than decorates.
const AGENT_MARKS: Partial<Record<TaskActiveRun["agentKind"], string>> = {
  claude: "/agent-claude.webp",
  codex: "/agent-codex.webp",
};

function AgentKindMark({ kind }: { kind: TaskActiveRun["agentKind"] }) {
  const mark = AGENT_MARKS[kind];
  if (mark) {
    // Empty alt and hidden from the tree: the chip around this already names the
    // client in words, so announcing the mark would read the same thing twice.
    // Plain img and not next/image - this export has no optimiser behind it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mark} alt="" aria-hidden width={14} height={14} className="shrink-0" />;
  }
  // An agent nobody has a mark for. Kept as a drawing so the row still carries
  // something in the shape position rather than jumping a few pixels narrower.
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 12 12"
      aria-hidden
      className="shrink-0 text-aegean"
    >
      <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 3.6v4.8M3.6 6h4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function TaskStatusLabel({ status }: { status: TaskStatus }) {
  const t = useTranslations("tasks");
  const tone = {
    backlog: "bg-stone/12 text-stone",
    todo: "bg-ochre/12 text-ochre",
    in_progress: "bg-aegean/12 text-aegean",
    blocked: "bg-iron/10 text-iron",
    done: "bg-laurel/10 text-laurel",
    archived: "bg-stone/12 text-stone",
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-[7px] rounded-label px-[7px] py-[2px] text-label uppercase tracking-[0.12em] ${tone}`}
    >
      <TaskStatusMark status={status} />
      {t(`status.${status}`)}
    </span>
  );
}

function TaskStatusMark({ status }: { status: TaskStatus }) {
  const shared = { width: 7, height: 7, viewBox: "0 0 8 8", "aria-hidden": true as const };
  if (status === "done") return <svg {...shared}><rect x="1" y="1" width="6" height="6" fill="currentColor" /></svg>;
  if (status === "blocked") return <svg {...shared}><path d="M1.2 1.2 6.8 6.8M6.8 1.2 1.2 6.8" stroke="currentColor" strokeWidth="1.4" /></svg>;
  if (status === "in_progress") return <svg {...shared}><path d="M4 1.1a2.9 2.9 0 1 1 0 5.8Z" fill="currentColor" /><circle cx="4" cy="4" r="2.9" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
  if (status === "archived" || status === "backlog") return <svg {...shared}><path d="M1 4h6" stroke="currentColor" strokeWidth="1.6" /></svg>;
  return <svg {...shared}><circle cx="4" cy="4" r="2.9" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
}
