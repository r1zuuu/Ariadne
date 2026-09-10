"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { useFailure } from "@/components/failure";
import { Collapse, FadeIn } from "@/components/motion";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Meta,
  PageHeader,
  Select,
  Status,
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

const EMPTY_CREATE = {
  title: "",
  description: "",
  priority: "medium" as TaskPriority,
};

/** One page of the list. Counters are only true while the whole list fits in one. */
const PAGE_SIZE = 50;

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
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
      }).format(new Date(iso)),
    [locale],
  );

  /** Whether anything is narrowing the list, which decides which nothing to show. */
  const filtered = query.trim() !== "" || tab !== "all";

  const filters = useMemo(() => {
    const trimmed = query.trim();
    return {
      // "All" used to send active:true, which the server reads as everything
      // except done and archived. So the list under the tab named "all" was
      // missing exactly one status, and the "done" counter - derived from that
      // same page - could only ever be zero. Sending no status filter gives
      // everything but archived, which is what the word means; the server
      // already sorts done to the bottom, so nothing crowds the top of the list.
      ...(tab === "all" ? {} : { status: tab as TaskStatus }),
      ...(trimmed ? { query: trimmed } : {}),
      limit: PAGE_SIZE,
    };
  }, [query, tab]);

  const load = useCallback(
    async (cursor?: string) => {
      if (!projectId) return;
      setError(null);
      try {
        const page = await listTasks(projectId, { ...filters, cursor });
        setTasks((prev) =>
          cursor && prev ? [...prev, ...page.tasks] : page.tasks,
        );
        setNextCursor(page.nextCursor);
        if (tab === "all" && !query.trim() && !cursor) {
          // Only when the unfiltered list arrived whole. Past one page these are
          // counts of what happens to be loaded, and a counter that means
          // something different depending on how far you scrolled is worse than
          // no counter.
          setTabCounts(
            page.nextCursor
              ? {}
              : {
                  all: page.tasks.length,
                  todo: page.tasks.filter((row) => row.status === "todo")
                    .length,
                  in_progress: page.tasks.filter(
                    (row) => row.status === "in_progress",
                  ).length,
                  blocked: page.tasks.filter((row) => row.status === "blocked")
                    .length,
                  done: page.tasks.filter((row) => row.status === "done")
                    .length,
                },
          );
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
    <div className="work-canvas">
      <PageHeader
        size="work"
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
              <Button
                variant="secondary"
                onClick={() => void refreshProjects()}
              >
                {t("retry")}
              </Button>
            }
          />
        ) : projects !== null && projects.length === 0 ? (
          <EmptyState
            title={t("noProject")}
            note={t("noProjectNote")}
            illustration="context"
          />
        ) : (
          <p className="text-body text-ink-3">{t("loading")}</p>
        )
      ) : (
        <>
          <Collapse open={createOpen}>
            {/* The form is a column, not the full canvas: a 1240px-wide title
                field would be a database row rather than a question, and a card
                three quarters empty to the right of it is worse. */}
            <Card as="section" className="mb-6 max-w-[680px] p-6">
              <div className="grid gap-5">
                <Input
                  id="task-title"
                  label={t("field.title")}
                  value={createDraft.title}
                  maxLength={160}
                  placeholder={t("titlePlaceholder")}
                  autoFocus={createOpen}
                  onChange={(event) =>
                    setCreateDraft((draft) => ({
                      ...draft,
                      title: event.target.value,
                    }))
                  }
                />
                <Textarea
                  id="task-description"
                  label={t("field.description")}
                  rows={3}
                  value={createDraft.description}
                  placeholder={t("descriptionPlaceholder")}
                  onChange={(event) =>
                    setCreateDraft((draft) => ({
                      ...draft,
                      description: event.target.value,
                    }))
                  }
                />
                <Select
                  id="task-priority"
                  label={t("field.priority")}
                  value={createDraft.priority}
                  onChange={(value) =>
                    setCreateDraft((draft) => ({
                      ...draft,
                      priority: value as TaskPriority,
                    }))
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

          {/* One row of tools, and no rule under it. The rule used to be here -
              border-b on this strip - 3px above the first card's own top border,
              which is where the double edge over the list came from. The gap
              below does the separating. */}
          <div className="flex flex-col gap-4 pb-5 xl:flex-row xl:items-center xl:justify-between">
            {/* No wrapping. Five filters that reflow to a second line leave one of
                them stranded there and make the strip taller than the field
                beside it; a group that scrolls inside itself keeps the row one
                row at every width, and the page never scrolls sideways. */}
            <div
              className="flex gap-1 overflow-x-auto rounded-control border border-edge/50 bg-plaster-sunk p-1 xl:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                  className={`inline-flex h-[32px] shrink-0 items-center gap-2 rounded-[4px] px-3 text-small font-medium transition-colors duration-state ${
                    tab === item
                      ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                      : "text-ink-2 hover:bg-surface/50 hover:text-ink"
                  }`}
                >
                  <span>{t(`tab.${item}`)}</span>
                  {typeof tabCounts[item] === "number" ? (
                    <span
                      className={`tabular text-data leading-none ${
                        tab === item ? "text-thread-lift" : "text-ink-3"
                      }`}
                    >
                      {tabCounts[item]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="relative w-full xl:w-[300px]">
              <Input
                id="task-search"
                placeholder={t("search")}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-control p-1 text-ink-3 transition-colors duration-state hover:text-ink"
                  aria-label={t("clearSearch")}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          {error ? <p className="pb-4 text-small text-iron">{error}</p> : null}

          {tasks === null ? (
            <p className="text-body text-ink-3">{t("loading")}</p>
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
            // One entrance for the whole list, keyed on the tab so changing the
            // filter says so and a keystroke in the search field does not.
            //
            // Not a per-row cascade. Fifteen rows means fifteen animations that
            // each start at opacity zero, and anything that stops the frame loop
            // - an occluded window is enough - leaves most of the list invisible
            // with the data sitting right there in the DOM. The signal wanted
            // here is "this list is now a different list", and one fade says it.
            <FadeIn key={tab}>
              {/* A column of flex items, not a grid. A grid item carries
                  min-width:auto, so the single implicit track was sized to the
                  widest row's min-content - 1723px against a 1240px canvas - and
                  every row hung out past the page into a horizontal scrollbar.
                  A column flex container stretches its items to its own width
                  instead, which is what a list wants. */}
              <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    stamp={stamp}
                    onRename={rename}
                    onStatus={changeStatus}
                  />
                ))}
              </ul>
            </FadeIn>
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

// One task, as a line in a list rather than a page about itself.
//
// It used to be a 225px card with information in all four corners: a shouting
// status pill and a raw id top left, a date top right, a two-line title, a
// two-line description, a rule, then the author bottom left and a button bottom
// right. Nothing was next to the thing it described and a dozen of them could
// not be scanned.
//
// Now the row is a title with everything about it underneath in one metadata
// line, and the things you can do to it on the far edge. The rest - the full
// description, the identifier, the dates - is behind a native disclosure, which
// is where the identifier belongs: it matters when you are quoting a task to an
// agent and never while you are looking for one.
function TaskRow({
  task,
  stamp,
  onRename,
  onStatus,
}: {
  task: Task;
  stamp: (iso: string) => string;
  onRename: (task: Task, title: string) => Promise<void>;
  onStatus: (task: Task, status: TaskStatus) => Promise<void>;
}) {
  const t = useTranslations("tasks");
  const runs = freshRuns(task.activeRuns);
  const author = task.createdBy
    ? t("createdBy", { who: who(task.createdBy) })
    : null;

  // A click that lands on the title or on an action is about that control, not
  // about opening the row, and a <summary> toggles on anything that reaches it.
  //
  // Bubble phase, not capture. onClickCapture on the wrapper stopped the event
  // on its way down, before it ever reached the button inside - so "mark as
  // done" silently did nothing. Stopping it on the way back up lets the button
  // fire first and only then keeps it away from the summary.
  const swallow = (event: React.MouseEvent) => event.stopPropagation();

  return (
    <li>
      <details className="group rounded-card border border-edge/40 bg-surface/40 transition-colors duration-state hover:border-edge hover:bg-surface/70">
        {/* Three tracks on a wide screen, one on a narrow one. Prose left, state
            in a column of its own so fifteen rows can be scanned down the status
            instead of read across, actions on the edge.
            
            The two right-hand tracks are fixed widths, and that is the point:
            with an auto-sized action column a row carrying two buttons was 330px
            wide and a row carrying one was 190px, so the status of every second
            row started 140px further left and the column zig-zagged down the
            page. Below the breakpoint the three stack, and the metadata sits
            under the title where its left edge cannot move at all. */}
        <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 marker:hidden xl:grid xl:grid-cols-[minmax(0,1fr)_240px_290px] xl:items-start xl:gap-6">
          <div className="min-w-0">
            <TaskTitle
              task={task}
              onRename={onRename}
              onClickCapture={swallow}
            />

            {task.status === "blocked" && task.blockedReason ? (
              <p className="truncate pt-1.5 text-small text-iron">
                {t("blockedLabel")}: {task.blockedReason}
              </p>
            ) : task.description ? (
              // One line. The second line of a preview never finished a
              // sentence either, and it cost every row 25px.
              <p className="truncate pt-1.5 text-small text-ink-2">
                {task.description}
              </p>
            ) : null}
          </div>

          {/* flex-nowrap in the column is load-bearing: a wrapping flex column
                wraps into extra columns rather than extra rows, so the metadata
                grew sideways past its track and pushed the page into a
                horizontal scrollbar. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 xl:flex-col xl:flex-nowrap xl:items-start xl:gap-2">
            <span className="flex items-center gap-3">
              <Status
                tone={
                  task.status === "backlog" || task.status === "archived"
                    ? "archived"
                    : task.status
                }
              >
                {t(`status.${task.status}`)}
              </Status>
              {/* Only the two that change what you do next. "Średni" on every
                    second row is a column of the word "medium". */}
              {task.priority === "high" || task.priority === "critical" ? (
                <span
                  className={`text-data font-medium ${
                    task.priority === "critical" ? "text-iron" : "text-ochre"
                  }`}
                >
                  {t(`priority.${task.priority}`)}
                </span>
              ) : null}
            </span>
            {runs.length > 0 ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <LiveMark />
                <Meta
                  items={runs.map(
                    (run) => run.agentClient || t(`agentKind.${run.agentKind}`),
                  )}
                />
              </span>
            ) : (
              // The channel word only where it says something. A task filed
              // through the app form was filed by a person, so "człowiek ·
              // utworzył stanisław" spends a third of the line restating the
              // next two words.
              <Meta
                items={
                  task.source?.channel === "coder"
                    ? [t("agent"), author]
                    : [author ?? t("human")]
                }
              />
            )}
            {/* Its own line rather than a third item in the metadata string.
                  Strung on the end it was the item that wrapped, and a wrapped
                  Meta starts the new line with the separator dot that belonged
                  to the line above. On its own it also gives the list a date
                  column to scan. */}
            <span className="text-data text-ink-3">
              {t("updatedOn", { date: stamp(task.updatedAt) })}
            </span>
          </div>

          <div className="flex items-center gap-2 xl:justify-end">
            {/* The chevron is deliberately outside this wrapper: it is the one
                control in the row whose job is to open the row. */}
            <div className="flex items-center gap-2" onClick={swallow}>
              {task.status === "todo" || task.status === "backlog" ? (
                <Button
                  size="sm"
                  variant="quiet"
                  title={t("startHint")}
                  onClick={() => void onStatus(task, "in_progress")}
                >
                  {t("start")}
                </Button>
              ) : null}
              {task.status === "done" ? (
                <Button
                  size="sm"
                  variant="quiet"
                  title={t("reopenHint")}
                  onClick={() => void onStatus(task, "todo")}
                >
                  {t("reopen")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void onStatus(task, "done")}
                >
                  {t("markDone")}
                </Button>
              )}
            </div>
            <span
              aria-hidden="true"
              className="grid h-[30px] w-[24px] place-items-center text-ink-3 transition-transform duration-state group-open:rotate-180"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 4.5 6 8l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </span>
          </div>
        </summary>

        <div className="border-t border-hairline px-5 py-4">
          <p className="measure-wide whitespace-pre-wrap text-small text-ink-2">
            {task.description || t("noDescription")}
          </p>
          {task.blockedReason ? (
            <p className="measure-wide pt-3 text-small text-iron">
              {t("blockedLabel")}: {task.blockedReason}
            </p>
          ) : null}
          <div className="pt-4">
            <Meta
              items={[
                <span key="id" className="font-data">
                  {t("identifier")} {task.id}
                </span>,
                t("createdOn", { date: stamp(task.createdAt) }),
                t("updatedOn", { date: stamp(task.updatedAt) }),
                task.source?.client,
              ]}
            />
          </div>
        </div>
      </details>
    </li>
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
  onClickCapture,
}: {
  task: Task;
  onRename: (task: Task, title: string) => Promise<void>;
  /** Keeps a click on the title from reaching the row's disclosure. */
  onClickCapture?: (event: React.MouseEvent) => void;
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
        onClick={onClickCapture}
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
        className="w-full border-b border-thread bg-transparent pb-0.5 text-body font-medium text-ink outline-none disabled:opacity-50"
      />
    );
  }

  return (
    <button
      type="button"
      title={t("renameHint")}
      onClick={onClickCapture}
      onDoubleClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter") open();
      }}
      // break-words, not a truncation: a long Polish title breaks where it has
      // to and takes a second line, rather than being cut in the middle of the
      // one word that says which task this is.
      className="line-clamp-2 w-full cursor-text break-words text-left text-body font-medium text-ink transition-colors duration-state group-hover:text-thread"
    >
      {task.title}
    </button>
  );
}

// An agent has this task open right now. The dot is the one thing on the screen
// that reports a live state, so it says so in a word beside it.
function LiveMark() {
  const t = useTranslations("tasks");
  return (
    <span className="inline-flex items-center gap-2 text-data font-medium text-thread">
      <span
        className="h-[6px] w-[6px] rounded-pill bg-thread"
        aria-hidden="true"
      />
      <span>{t("liveNow")}</span>
    </span>
  );
}
