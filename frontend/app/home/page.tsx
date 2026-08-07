"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { AppShell, pickProject, readActiveProject } from "@/components/app-shell";
import { StatusMark } from "@/components/status-mark";
import type { ServerState } from "@/components/title-bar";
import { Banner } from "@/components/ui";
import {
  ApiError,
  listNodes,
  listProjects,
  readToken,
  type Node,
  type Project,
} from "@/lib/api";

// Screen 03. Answer one question after a coding session: what did the agent
// write down while I was away.
//
// The date in the heading is the previous visit, not "recently" and not "today".
// It lives in localStorage because it is a property of this window, not of the
// account: the same person on a second machine has their own "last time I
// looked", and the server has no column for it.

const LAST_SEEN_KEY = "ariadne.lastSeen";

// Fourteen rows and then a full stop, per the spec: the overview is a glance,
// not a feed. One extra row is fetched to learn whether the list was cut.
const VISIBLE_CHANGES = 14;

export default function HomeScreen() {
  const t = useTranslations("home");
  const router = useRouter();
  const { locale } = useLocale();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [changes, setChanges] = useState<{ rows: Node[]; cut: boolean } | null>(null);
  const [since, setSince] = useState<Date | null>(null);
  const [server, setServer] = useState<ServerState>("checking");

  // Read once, then stamped forward, so the heading answers "since when" with
  // the previous visit rather than with this one.
  useEffect(() => {
    if (!readToken()) {
      router.replace("/");
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
      // A remembered project that has since been deleted must not blank the
      // screen, so the newest one stands in.
      setActiveId(rows.some((p) => p.id === remembered) ? remembered : rows[0].id);
    } catch (caught) {
      // The spec is explicit that an unreachable server keeps the last known
      // rows on screen under a "may be out of date" line, so nothing already
      // loaded is cleared. Only a first attempt that never landed falls back to
      // an empty list, and it does so through the updater form so that retrying
      // does not have to re-read state this function closed over.
      setServer(caught instanceof ApiError && caught.failure === "unreachable" ? "down" : "up");
      setProjects((loaded) => loaded ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeId) return;
    let current = true;
    void listNodes(activeId, VISIBLE_CHANGES + 1)
      .then((page) => {
        if (!current) return;
        setChanges({ rows: page.nodes.slice(0, VISIBLE_CHANGES), cut: page.nodes.length > VISIBLE_CHANGES });
      })
      .catch(() => current && setChanges(null));
    // Switching projects fast must not let a slow first response overwrite a
    // fast second one.
    return () => {
      current = false;
    };
  }, [activeId]);

  const active = projects?.find((p) => p.id === activeId) ?? null;
  const stamp = useStamp(locale);

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
        <div className="mx-auto max-w-[860px]">
          {projects === null ? (
            <Skeleton />
          ) : projects.length === 0 ? (
            <Empty title={t("empty.title")} note={t("empty.note")} />
          ) : (
            <>
              {/* The heading answers "since when" and the sentence under it
                  answers "and what happened". Kept apart so that an empty list
                  still says so on a first visit, when there is no date to put
                  in front of it. */}
              <Changes
                heading={since ? t("since", { at: stamp(since, true) }) : t("firstVisit")}
                rows={changes?.rows ?? null}
                stamp={stamp}
              />

              {/* No "show all" button yet: it opens the entries screen, which is
                  the next piece of work. A count that leads nowhere would be a
                  worse answer than the honest cut below. */}
              {changes?.cut ? (
                <p className="pt-5 text-small text-ink-3">
                  {t("cut", { shown: VISIBLE_CHANGES, total: active?.nodeCount ?? 0 })}
                </p>
              ) : null}

              {/* Picking here reloads, same as the column's switcher: the open
                  project is named in the title bar and read by four screens, so
                  one of them changing it quietly would leave the rest lying. */}
              <Projects projects={projects} activeId={activeId} onPick={pickProject} />
            </>
          )}
        </div>
    </AppShell>
  );
}

function Changes({
  heading,
  rows,
  stamp,
}: {
  heading: string;
  rows: Node[] | null;
  stamp: (date: Date, withTime?: boolean) => string;
}) {
  const t = useTranslations("home");
  return (
    <section>
      <h1 className="text-section">{heading}</h1>
      {rows === null ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <p className="max-w-[68ch] pt-5 text-body text-ink-2">{t("nothing")}</p>
      ) : (
        <ul className="mt-6 border-t border-hairline">
          {rows.map((node) => (
            <li
              key={node.id}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto_auto] items-baseline gap-x-5 border-b border-hairline py-3"
            >
              {/* The mark sits on the text baseline rather than centred on the
                  row, so a two-line entry does not float it into the gap. */}
              <span className="translate-y-[1px]">
                <StatusMark status={node.status} label={t(`status.${node.status}`)} />
              </span>
              <span className="truncate text-body text-ink">{firstSentence(node.content)}</span>
              <span className="font-data text-data tabular text-ink-3">{stamp(new Date(node.createdAt))}</span>
              <span className="w-14 text-right font-data text-data text-ink-3">
                {t(node.source?.channel === "coder" ? "channel.agent" : "channel.you")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Projects({
  projects,
  activeId,
  onPick,
}: {
  projects: Project[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const t = useTranslations("home");
  return (
    // A step below the date heading, not level with it. This screen exists to
    // answer what changed; the project list is where you go next, and giving
    // both the same size left the screen with no way in.
    <section className="pt-9">
      <h2 className="text-lead">{t("projects")}</h2>
      <ul className="mt-6 border-t border-hairline">
        {projects.map((project) => {
          const current = project.id === activeId;
          return (
            <li key={project.id} className="border-b border-hairline">
              <button
                type="button"
                onClick={() => onPick(project.id)}
                aria-current={current ? "true" : undefined}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-6 py-3 pl-5 text-left transition-colors duration-state hover:bg-plaster-sunk ${
                  // A 2px rule in the thread colour, in the gutter. The open row
                  // needs to be findable at a glance and weight alone was not
                  // doing it; the border keeps the text baseline where it was.
                  current ? "border-l-2 border-blue" : "border-l-2 border-transparent"
                }`}
              >
                <span className={`truncate text-body ${current ? "text-ink" : "text-ink-2"}`}>
                  {project.name}
                </span>
                <span className="font-data text-data tabular text-ink-3">
                  {t("entries", { count: project.nodeCount ?? 0 })}
                </span>
                <span
                  className={`w-32 text-right font-data text-data tabular ${
                    project.pendingCount ? "text-ochre" : "text-ink-3"
                  }`}
                >
                  {project.pendingCount
                    ? t("waiting", { count: project.pendingCount })
                    : t("waitingNone")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Sunk plaster, no pulse and no spinner: the spec bans both, and a still
// skeleton is also what a slow disk read looks like when it finishes instantly.
function Skeleton() {
  return (
    <ul className="mt-6 border-t border-hairline" aria-hidden="true">
      {Array.from({ length: 6 }, (_, row) => (
        <li key={row} className="flex items-center gap-5 border-b border-hairline py-3">
          <span className="h-[10px] w-[10px] shrink-0 bg-plaster-sunk" />
          <span className="h-4 flex-1 bg-plaster-sunk" style={{ maxWidth: `${72 - row * 6}%` }} />
        </li>
      ))}
    </ul>
  );
}

function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="pt-10">
      <h1 className="text-section">{title}</h1>
      <p className="max-w-[68ch] pt-5 text-body text-ink-2">{note}</p>
    </div>
  );
}

// "21 lip, 09:12" in the heading and "19 lip" in a row: the same formatter, so
// the two never disagree about how a date looks. The heading carries the clock
// because "since" has to be exact enough to trust; a row does not.
// The year appears only when it is not this one, which keeps the common case
// short without ever being ambiguous.
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

// The row shows the opening sentence, not a truncated blob: an entry is up to
// 4000 characters and the first sentence is the one the agent wrote as a
// summary. Falls back to the whole string when there is no terminator.
function firstSentence(content: string): string {
  const end = /[.!?](\s|$)/.exec(content);
  return end ? content.slice(0, end.index + 1) : content;
}
