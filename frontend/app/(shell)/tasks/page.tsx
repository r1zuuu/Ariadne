"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { headline } from "@/components/entry-card";
import { useFailure } from "@/components/failure";
import { Collapse } from "@/components/motion";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Input, Meta, PageHeader, Textarea } from "@/components/ui";
import {
  ApiError,
  createTask,
  getTask,
  listNodes,
  listTasks,
  updateTask,
  type Node,
  type RelatedMemory,
  type Task,
  type TaskActiveRun,
  type TaskDetail,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api";

type Tab = "all" | "todo" | "in_progress" | "blocked" | "done";

const TABS: Tab[] = ["all", "todo", "in_progress", "blocked", "done"];
const STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "blocked", "done"];
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
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [memories, setMemories] = useState<Node[]>([]);

  const stamp = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso)),
    [locale],
  );

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
    setSelected(null);
    setDetail(null);
    if (projectId) {
      void load();
      void listNodes(projectId, 50, { sort: "updated" }).then((page) => setMemories(page.nodes));
    }
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

  const openDetail = async (id: string) => {
    setSelected((current) => (current === id ? null : id));
    if (selected === id) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await getTask(id));
    } catch (caught) {
      toast(failure(caught), "error");
    }
  };

  const submitCreate = async () => {
    if (!projectId) return;
    setCreateBusy(true);
    try {
      const created = await createTask(projectId, {
        title: createDraft.title,
        description: createDraft.description,
        priority: createDraft.priority,
      });
      setCreateDraft(EMPTY_CREATE);
      setCreateOpen(false);
      setSelected(created.id);
      setDetail(created);
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
            <EmptyState title={t("empty")} note={t("emptyNote")} />
          ) : (
            <ul className="flex flex-col">
              {tasks.map((task) => {
                const activeRuns = freshRuns(task.activeRuns);
                return (
                  <li key={task.id} className="border-b border-hairline">
                    <button
                      type="button"
                      onClick={() => void openDetail(task.id)}
                      aria-expanded={selected === task.id}
                      className="flex w-full flex-col gap-3 px-1 py-5 text-left transition-colors duration-state hover:bg-plaster-sunk/40 sm:px-3"
                    >
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
                        <p className="text-lead text-ink">{task.title}</p>
                        {task.blockedReason ? (
                          <p className="pt-1 text-small text-iron">{task.blockedReason}</p>
                        ) : task.description ? (
                          <p className="line-clamp-2 pt-1 text-small text-ink-2">
                            {task.description}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    <Collapse open={selected === task.id}>
                      {detail?.id === task.id ? (
                        <TaskEditor
                          task={detail}
                          memories={memories}
                          stamp={stamp}
                          onSaved={async (updated) => {
                            setDetail(updated);
                            toast(t("toastSaved"));
                            await load();
                          }}
                        />
                      ) : (
                        <p className="px-3 pb-5 text-small text-ink-3">{t("loading")}</p>
                      )}
                    </Collapse>
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

function TaskEditor({
  task,
  memories,
  stamp,
  onSaved,
}: {
  task: TaskDetail;
  memories: Node[];
  stamp: (iso: string) => string;
  onSaved: (task: TaskDetail) => Promise<void>;
}) {
  const t = useTranslations("tasks");
  const failure = useFailure();
  const toast = useToast();
  const [draft, setDraft] = useState(task);
  const [saving, setSaving] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState<string | null>(null);

  useEffect(() => setDraft(task), [task]);

  const set = (key: keyof TaskDetail) => (event: { target: { value: string } }) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const related = new Set(draft.relatedMemoryIds);
  const blockedNeedsReason = draft.status === "blocked" && !draft.blockedReason?.trim();
  const activeRuns = freshRuns(task.activeRuns);

  const save = async () => {
    setSaving(true);
    try {
      await onSaved(
        await updateTask(task.id, {
          revision: task.revision,
          title: draft.title,
          description: draft.description,
          status: draft.status,
          priority: draft.priority,
          blockedReason: draft.blockedReason,
          relatedMemoryIds: draft.relatedMemoryIds,
        }),
      );
    } catch (caught) {
      toast(
        caught instanceof ApiError && caught.code === "conflict"
          ? t("conflict")
          : failure(caught),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3 pb-6">
      <Card className="p-6">
        <div className="grid gap-5">
          <Input
            id={`title-${task.id}`}
            label={t("field.title")}
            value={draft.title}
            maxLength={160}
            onChange={set("title")}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              id={`status-${task.id}`}
              label={t("field.status")}
              value={draft.status}
              onChange={(status) =>
                setDraft((prev) => ({
                  ...prev,
                  status: status as TaskStatus,
                  blockedReason: status === "blocked" ? prev.blockedReason : "",
                }))
              }
              options={STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))}
            />
            <Select
              id={`priority-${task.id}`}
              label={t("field.priority")}
              value={draft.priority}
              onChange={(priority) =>
                setDraft((prev) => ({ ...prev, priority: priority as TaskPriority }))
              }
              options={PRIORITIES.map((priority) => ({
                value: priority,
                label: t(`priority.${priority}`),
              }))}
            />
          </div>
          {draft.status === "blocked" ? (
            <Textarea
              id={`blocked-${task.id}`}
              label={t("field.blockedReason")}
              rows={2}
              value={draft.blockedReason ?? ""}
              error={blockedNeedsReason ? t("blockedRequired") : undefined}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, blockedReason: event.target.value }))
              }
            />
          ) : null}
          <Textarea
            id={`description-${task.id}`}
            label={t("field.description")}
            rows={4}
            value={draft.description}
            onChange={set("description")}
          />

          {activeRuns.length ? (
            <section className="border-t border-hairline pt-5">
              <p className="text-label uppercase tracking-[0.12em] text-ink-3">
                {t("activeWork")}
              </p>
              <ul className="flex flex-col pt-2">
                {activeRuns.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center gap-3 py-2">
                    <AgentRunChips runs={[run]} />
                    <Meta
                      items={[
                        run.actor ? t("runActor", { who: who(run.actor) }) : null,
                        t("lastSeen", { when: stamp(run.lastSeenAt) }),
                        t("expires", { when: stamp(run.expiresAt) }),
                      ]}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-t border-hairline pt-5">
            <p className="text-label uppercase tracking-[0.12em] text-ink-3">
              {t("relatedContext")}
            </p>
            {memories.length ? (
              <ul className="flex flex-col pt-2">
                {memories.map((memory) => (
                  <li key={memory.id}>
                    <label className="flex cursor-pointer items-start gap-3 py-2 text-small text-ink-2 transition-colors duration-state hover:text-ink">
                      <input
                        type="checkbox"
                        checked={related.has(memory.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setDraft((prev) => ({
                            ...prev,
                            relatedMemoryIds: checked
                              ? [...prev.relatedMemoryIds, memory.id]
                              : prev.relatedMemoryIds.filter((id) => id !== memory.id),
                          }));
                        }}
                        className="mt-[6px] h-[14px] w-[14px] accent-thread"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">{memory.summary || headline(memory.content)}</span>
                        <span className="text-data text-ink-3">{t(`memory.${memory.type}`)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pt-2 text-small text-ink-3">{t("noMemories")}</p>
            )}
          </section>

          {task.relatedMemories.length ? (
            <section className="border-t border-hairline pt-5">
              <p className="text-label uppercase tracking-[0.12em] text-ink-3">
                {t("linkedMemories")}
              </p>
              <ul className="flex flex-col pt-2">
                {task.relatedMemories.map((memory) => (
                  <RelatedMemoryRow
                    key={memory.id}
                    memory={memory}
                    open={memoryOpen === memory.id}
                    onOpen={() => setMemoryOpen(memoryOpen === memory.id ? null : memory.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-t border-hairline pt-5">
            <p className="text-label uppercase tracking-[0.12em] text-ink-3">
              {t("history")}
            </p>
            <ul className="flex flex-col pt-2">
              {task.events.map((event) => (
                <li key={event.id} className="py-1 text-small text-ink-2">
                  <Meta
                    items={[
                      t(`event.${event.action}`),
                      event.actor ? who(event.actor) : null,
                      event.source?.channel === "coder" ? t("agent") : t("human"),
                      stamp(event.createdAt),
                    ]}
                  />
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save()} loading={saving} disabled={blockedNeedsReason}>
              {saving ? t("saving") : t("save")}
            </Button>
            <Button
              variant="secondary"
              loading={saving}
              onClick={() =>
                void updateTask(task.id, { revision: task.revision, status: "archived" })
                  .then(onSaved)
                  .then(() => toast(t("toastArchived")))
                  .catch((caught) => toast(failure(caught), "error"))
              }
            >
              {t("archive")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
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

function AgentKindMark({ kind }: { kind: TaskActiveRun["agentKind"] }) {
  const shared = { width: 11, height: 11, viewBox: "0 0 12 12", "aria-hidden": true as const };
  if (kind === "codex") {
    return (
      <svg {...shared} className="text-thread">
        <rect x="2" y="2" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4.2 6h3.6M6 4.2v3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "claude") {
    return (
      <svg {...shared} className="text-ochre">
        <path d="M6 1.8 10 10H2Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M4.4 7.2h3.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...shared} className="text-aegean">
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

function RelatedMemoryRow({
  memory,
  open,
  onOpen,
}: {
  memory: RelatedMemory;
  open: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("tasks");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className="flex w-full items-baseline gap-3 py-[5px] text-left text-small text-ink-2 transition-colors duration-state hover:text-ink"
      >
        <span className="shrink-0 text-data text-ink-3">{t(`memory.${memory.type}`)}</span>
        <span className="min-w-0 flex-1 truncate">{memory.summary || headline(memory.content)}</span>
      </button>
      <Collapse open={open}>
        <div className="border-l border-hairline py-2 pl-5">
          <p className="whitespace-pre-wrap text-small leading-6 text-ink-2">{memory.content}</p>
        </div>
      </Collapse>
    </li>
  );
}
