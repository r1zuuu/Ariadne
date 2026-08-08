"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { AppShell, pickProject, readActiveProject } from "@/components/app-shell";
import { Composer } from "@/components/composer";
import { EntryCard, headline } from "@/components/entry-card";
import { hasSeenTour } from "@/lib/first-run";
import { PENDING_QUESTION } from "@/lib/handoff";
import {
  ApiError,
  getPending,
  listNodes,
  listProjects,
  readToken,
  type Node,
  type PendingAction,
  type Project,
  type ReviewNode,
} from "@/lib/api";
import { ScreenHint } from "@/components/screen-hint";
import { Banner, Button, Card, EmptyState, Meta, SectionHeader, Status } from "@/components/ui";

// Screen 03. The project's home, not a list of entries.
//
// The composer is at the top because asking is the thing people come here to do,
// and making them find a separate tab first was the largest single friction in
// the product. It does not answer here: it hands the question to the assistant,
// so a conversation lives in exactly one place.

const LAST_SEEN_KEY = "ariadne.lastSeen";
const RECENT = 4;

export default function HomeScreen() {
  const t = useTranslations("home");
  const tHint = useTranslations("hint.home");
  const router = useRouter();
  const { locale } = useLocale();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Node[] | null>(null);
  const [activity, setActivity] = useState<Node[] | null>(null);
  const [waiting, setWaiting] = useState<{ actions: PendingAction[]; nodes: ReviewNode[] } | null>(null);
  const [since, setSince] = useState<Date | null>(null);
  const [server, setServer] = useState<"checking" | "up" | "down">("checking");
  const [question, setQuestion] = useState("");

  // Read once, then stamped forward, so the line answers "since when" with the
  // previous visit rather than with this one.
  useEffect(() => {
    if (!readToken()) {
      router.replace("/");
      return;
    }
    // The tour runs before the dashboard rather than over it. Ariadne's model
    // (you tell it, you approve, it remembers) is not guessable from a screen of
    // sections, and this is the one place we know the reader is new. Skipping it
    // marks it seen, so this fires exactly once per machine.
    if (!hasSeenTour()) {
      router.replace("/onboarding-tour");
      return;
    }
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    if (stored) setSince(new Date(stored));
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, [router]);

  const load = useCallback(async () => {
    setServer("checking");
    try {
      const rows = await listProjects();
      setProjects(rows);
      setServer("up");
      if (!rows.length) return;
      const remembered = readActiveProject();
      setActiveId(rows.some((p) => p.id === remembered) ? remembered : rows[0].id);
    } catch (caught) {
      // An unreachable server keeps whatever is already on screen and says so,
      // rather than blanking into an empty state that reads as data loss.
      setServer(caught instanceof ApiError && caught.failure === "unreachable" ? "down" : "up");
      setProjects((loaded) => loaded ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void getPending()
      .then((feed) => setWaiting({ actions: feed.pendingActions, nodes: feed.nodesToReview }))
      .catch(() => setWaiting({ actions: [], nodes: [] }));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let current = true;
    // Two different questions, so two calls: what was decided, and what has been
    // touched. The same list sorted twice would answer neither well.
    void listNodes(activeId, RECENT, { type: "decision" })
      .then((page) => current && setDecisions(page.nodes))
      .catch(() => current && setDecisions([]));
    void listNodes(activeId, RECENT, { sort: "updated" })
      .then((page) => current && setActivity(page.nodes))
      .catch(() => current && setActivity([]));
    return () => {
      current = false;
    };
  }, [activeId]);

  const active = projects?.find((p) => p.id === activeId) ?? null;
  // True once projects arrive from more than one archive, which is the only
  // case where naming the archive tells the reader anything.
  const shared = new Set((projects ?? []).map((p) => p.workspaceId)).size > 1;
  const stamp = useStamp(locale);

  const ask = (text: string) => {
    // Handed over rather than answered here: the assistant owns conversation,
    // and two places streaming the same answer is two places to keep in step.
    sessionStorage.setItem(PENDING_QUESTION, text);
    router.push("/assistant");
  };

  const waitingCount = waiting ? waiting.actions.length + waiting.nodes.length : 0;

  return (
    <AppShell
      server={server}
      banner={
        server === "down" ? (
          <Banner
            variant="notice"
            what={t("stale", { at: since ? stamp(since, true) : t("staleUnknown") })}
            action={{ label: t("retry"), onClick: () => void load() }}
          />
        ) : null
      }
    >
      <div className="mx-auto max-w-[1080px]">
        {projects === null ? (
          <p className="text-body text-ink-3">{t("loading")}</p>
        ) : projects.length === 0 ? (
          <EmptyState
            title={t("empty.title")}
            note={t("empty.note")}
            action={
              <Button onClick={() => router.push("/onboarding")}>{t("empty.action")}</Button>
            }
          />
        ) : (
          <>
            <ScreenHint screen="home" title={tHint("title")} note={tHint("note")} />

            <section className="pb-10">
              <p className="pb-2 font-data text-data text-ink-3">
                {since ? t("seen", { at: stamp(since, true) }) : t("seenFirst")}
              </p>
              <h1 className="text-title text-ink">{t("askTitle")}</h1>
              <p className="max-w-[62ch] pt-2 text-body text-ink-2">{t("askLead")}</p>

              <div className="pt-6">
                <Composer
                  value={question}
                  onChange={setQuestion}
                  onSubmit={ask}
                  placeholder={t("askPlaceholder")}
                  submitLabel={t("ask")}
                  busyLabel={t("asking")}
                  hint={t("askHint")}
                  suggestions={[t("suggest1"), t("suggest2"), t("suggest3"), t("suggest4")]}
                />
              </div>

              {/* Where the answers come from, in real numbers. Under the
                  composer rather than above it: the question is the thing to
                  do, and this answers what a reader wonders after typing one. */}
              {active?.nodeCount ? (
                <p className="pt-5 text-small text-ink-3">
                  {t("memoryLine", { decisions: decisions?.length ?? 0, entries: active.nodeCount })}{" "}
                  <Link href="/project" className="text-blue underline underline-offset-2">
                    {t("memoryLink")}
                  </Link>
                </p>
              ) : null}
            </section>

            {/* minmax(0, …) at both widths, and grid-cols-1 is not redundant:
                a grid with no explicit columns sizes its single column to
                min-content, so a long entry pushes the card past the window.
                Same reason the two-column ratio is spelled out rather than
                written as a bare 3fr/2fr. */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="flex flex-col gap-8">
                <section>
                  <SectionHeader title={t("decisions")} />
                  {decisions === null ? (
                    <CardSkeleton />
                  ) : decisions.length === 0 ? (
                    <EmptyState title={t("decisionsEmpty")} note={t("decisionsEmptyNote")} />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {decisions.map((node) => (
                        <li key={node.id}>
                          <EntryCard
                            entry={node}
                            meta={`${stamp(new Date(node.createdAt))} · ${t(
                              node.source?.channel === "coder" ? "channel.agent" : "channel.you",
                            )}`}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <SectionHeader title={t("activity")} />
                  {activity === null ? (
                    <CardSkeleton />
                  ) : activity.length === 0 ? (
                    <EmptyState title={t("activityEmpty")} note={t("activityEmptyNote")} />
                  ) : (
                    <Card className="divide-y divide-hairline">
                      {activity.map((node) => {
                        // Anything whose updatedAt has moved past createdAt was
                        // touched after it was written; that is as close to an
                        // event log as the data goes without a new table.
                        const changed = node.updatedAt !== node.createdAt;
                        return (
                          <div key={node.id} className="flex items-baseline gap-4 px-5 py-4">
                            <span className="shrink-0 font-data text-data text-ink-3">
                              {t(changed ? "activityChanged" : "activityAdded")}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-small text-ink">
                              {headline(node.content)}
                            </span>
                            <span className="shrink-0 font-data text-data tabular text-ink-3">
                              {stamp(new Date(changed ? node.updatedAt : node.createdAt))}
                            </span>
                          </div>
                        );
                      })}
                    </Card>
                  )}
                </section>
              </div>

              <div className="flex flex-col gap-8">
                <section>
                  <SectionHeader
                    title={t("waitingTitle")}
                    action={
                      waitingCount ? (
                        <Link
                          href="/pending"
                          className="text-small text-blue underline underline-offset-2"
                        >
                          {t("waitingAll")}
                        </Link>
                      ) : null
                    }
                  />
                  {waiting === null ? (
                    <CardSkeleton />
                  ) : waitingCount === 0 ? (
                    <EmptyState title={t("waitingEmpty")} note={t("waitingEmptyNote")} />
                  ) : (
                    <Card className="divide-y divide-hairline">
                      {[...waiting.actions.map((a) => ({
                        id: a.id,
                        text: headline(a.payload?.content ?? a.nodeContent),
                        tone: "proposed" as const,
                        label: t(`pendingAction.${a.action}`),
                      })), ...waiting.nodes.map((n) => ({
                        id: n.id,
                        text: headline(n.content),
                        tone: "proposed" as const,
                        label: t(`status.${n.status}`),
                      }))]
                        .slice(0, 3)
                        .map((row) => (
                          <div key={row.id} className="px-5 py-4">
                            <Status tone={row.tone}>{row.label}</Status>
                            <p className="line-clamp-2 pt-2 text-small text-ink">{row.text}</p>
                          </div>
                        ))}
                      <Link
                        href="/pending"
                        className="block px-5 py-3 text-small text-blue transition-colors hover:bg-surface-2"
                      >
                        {t("waitingAll")} ({waitingCount})
                      </Link>
                    </Card>
                  )}
                </section>

                {active ? <AboutProject project={active} onOpen={() => router.push("/project")} /> : null}

                {projects.length > 1 ? (
                  <section>
                    <SectionHeader title={t("projects")} />
                    <Card className="divide-y divide-hairline">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => pickProject(project.id)}
                          className={`flex w-full items-baseline justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-surface-2 ${
                            project.id === activeId ? "text-ink" : "text-ink-2"
                          }`}
                        >
                          <span className="min-w-0 truncate text-small">
                            {project.name}
                            {/* Only once there is more than one archive in play.
                                With a single workspace this line would repeat
                                the same name under every project. */}
                            {shared && project.workspaceName ? (
                              <span className="pl-3 font-data text-data uppercase tracking-[0.08em] text-ink-3">
                                {project.workspaceName}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-data text-data tabular text-ink-3">
                            {t("entries", { count: project.nodeCount ?? 0 })}
                          </span>
                        </button>
                      ))}
                    </Card>
                  </section>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function AboutProject({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const t = useTranslations("home");
  const tProject = useTranslations("project");
  // The stack is stored as one line of prose; splitting on commas is what turns
  // it into something scannable without changing how it is written.
  const stack = project.stack
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <section>
      <SectionHeader
        title={t("about")}
        action={
          <button onClick={onOpen} className="text-small text-blue underline underline-offset-2">
            {t("openProject")}
          </button>
        }
      />
      <Card className="flex flex-col gap-4 p-5">
        <Meta items={[tProject(`etap.${project.etap}`), project.repoRef]} />

        {project.opis ? <p className="text-small leading-6 text-ink-2">{project.opis}</p> : null}

        {stack.length ? <Meta items={stack} /> : null}

        {project.ograniczenia ? (
          <div>
            <p className="pb-1 font-data text-label uppercase tracking-[0.12em] text-ink-3">
              {t("aboutLimits")}
            </p>
            <p className="line-clamp-4 text-small leading-6 text-ink-2">{project.ograniczenia}</p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

// Still, not pulsing: the spec bans a spinner, and a shimmer on a card is the
// same thing wearing a different coat.
function CardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-5" aria-hidden="true">
      {[80, 62, 45].map((width) => (
        <span key={width} className="h-[14px] rounded-label bg-plaster-sunk" style={{ width: `${width}%` }} />
      ))}
    </Card>
  );
}

function useStamp(locale: string) {
  return useCallback(
    (date: Date, withTime = false) =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(date),
    [locale],
  );
}
