"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { headline } from "@/components/entry-card";
import { hasSeenTour } from "@/lib/first-run";
import { PENDING_QUESTION } from "@/lib/handoff";
import { listNodes, type Node } from "@/lib/api";
import { Banner, Button, EmptyState, SectionHeader, Status } from "@/components/ui";

// Screen 03. A welcome and a question, not a dashboard.
//
// The composer is the screen. Everything under it is one glance deep: the
// latest decision and the head of the review queue, each a single line that
// leads to its own screen. The sections this used to stack here (activity,
// project card, project list) said more and told less, and each already has a
// screen of its own.

const LAST_SEEN_KEY = "ariadne.lastSeen";

export default function HomeScreen() {
  const t = useTranslations("home");
  const router = useRouter();
  const { locale } = useLocale();
  const { projects, activeProject, pendingFeed, server, refreshProjects } = useApp();

  const [latestDecision, setLatestDecision] = useState<Node[] | null>(null);
  const [since, setSince] = useState<Date | null>(null);
  const [question, setQuestion] = useState("");

  // Read once, then stamped forward, so the line answers "since when" with the
  // previous visit rather than with this one.
  useEffect(() => {
    // The tour runs before the dashboard rather than over it: this is the one
    // place we know the reader is new. Skipping it marks it seen, so this
    // fires exactly once per machine.
    if (!hasSeenTour()) {
      router.replace("/onboarding-tour");
      return;
    }
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    if (stored) setSince(new Date(stored));
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, [router]);

  const activeId = activeProject?.id ?? null;

  useEffect(() => {
    if (!activeId) return;
    let current = true;
    // Cleared first, so a project switch never shows the old project's
    // decision under the new project's name while the fetch lands.
    setLatestDecision(null);
    void listNodes(activeId, 1, { type: "decision" })
      .then((page) => current && setLatestDecision(page.nodes))
      .catch(() => current && setLatestDecision([]));
    return () => {
      current = false;
    };
  }, [activeId]);

  const active = activeProject;
  const stamp = useStamp(locale);

  const ask = (text: string) => {
    // Handed over rather than answered here: the assistant owns conversation,
    // and two places streaming the same answer is two places to keep in step.
    sessionStorage.setItem(PENDING_QUESTION, text);
    router.push("/assistant");
  };

  const waiting = pendingFeed
    ? [
        ...pendingFeed.pendingActions.map((a) => ({
          text: headline(a.payload?.content ?? a.nodeContent),
          label: t(`pendingAction.${a.action}`),
        })),
        ...pendingFeed.nodesToReview.map((n) => ({
          text: headline(n.content),
          label: t(`status.${n.status}`),
        })),
      ]
    : null;

  return (
    <div className="mx-auto max-w-[1080px]">
      {server === "down" ? (
        <Banner
          variant="notice"
          what={t("stale", { at: since ? stamp(since, true) : t("staleUnknown") })}
          action={{ label: t("retry"), onClick: () => void refreshProjects() }}
        />
      ) : null}

      {projects === null ? (
        <p className="text-body text-ink-3">{t("loading")}</p>
      ) : projects.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          note={t("empty.note")}
          action={<Button onClick={() => router.push("/onboarding")}>{t("empty.action")}</Button>}
        />
      ) : (
        <>
          <section className="pb-9 pt-6">
            <p className="pb-3 text-data text-ink-3">
              {since ? t("seen", { at: stamp(since, true) }) : t("seenFirst")}
            </p>
            {/* The one display-size line in the app: the question the whole
                product exists to answer. Left-aligned, with the right side
                left open on purpose. */}
            <h1 className="max-w-[16ch] text-display text-ink">{t("askTitle")}</h1>

            <div className="max-w-[820px] pt-8">
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

            {/* Where the answers come from, in one real number. Under the
                composer rather than above it: the question is the thing to
                do, and this answers what a reader wonders after typing one. */}
            {active?.nodeCount ? (
              <p className="pt-5 text-small text-ink-3">
                {t("memoryLine", { entries: active.nodeCount })}{" "}
                <Link href="/project" className="text-thread underline underline-offset-2">
                  {t("memoryLink")}
                </Link>
              </p>
            ) : null}
          </section>

          {/* The thread picks up where the question ends: a short taut lead-in
              on the hairline that carries the eye down to what was decided. */}
          <div className="relative mb-9 border-t border-hairline" aria-hidden="true">
            <svg
              width="64"
              height="9"
              viewBox="0 0 64 9"
              className="absolute -top-[4px] left-0 text-thread/60"
            >
              <path d="M0 4.5h46c6 0 8-3 12-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="61" cy="1.5" r="2" fill="currentColor" />
            </svg>
          </div>

          {/* One glance deep: a single line each, leading to the screen that
              holds the rest. */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <section>
              <SectionHeader
                title={t("decisions")}
                action={
                  <Link
                    href="/project"
                    className="text-small text-thread underline underline-offset-2"
                  >
                    {t("decisionsAll")}
                  </Link>
                }
              />
              {latestDecision === null ? (
                <p className="text-small text-ink-3">{t("loading")}</p>
              ) : latestDecision.length === 0 ? (
                <EmptyState title={t("decisionsEmpty")} note={t("decisionsEmptyNote")} />
              ) : (
                <Link href="/project" className="group block max-w-[52ch]">
                  <p className="line-clamp-2 text-body font-medium leading-7 text-ink transition-colors duration-state group-hover:text-thread">
                    {headline(latestDecision[0].content)}
                  </p>
                </Link>
              )}
            </section>

            <section>
              <SectionHeader
                title={t("waitingTitle")}
                action={
                  waiting?.length ? (
                    <Link
                      href="/pending"
                      className="text-small text-thread underline underline-offset-2"
                    >
                      {t("waitingAll")} ({waiting.length})
                    </Link>
                  ) : null
                }
              />
              {waiting === null ? (
                <p className="text-small text-ink-3">{t("loading")}</p>
              ) : waiting.length === 0 ? (
                <EmptyState title={t("waitingEmpty")} note={t("waitingEmptyNote")} />
              ) : (
                <Link href="/pending" className="group block max-w-[52ch]">
                  <Status tone="proposed">{waiting[0].label}</Status>
                  <p className="line-clamp-2 pt-2 text-body font-medium leading-7 text-ink transition-colors duration-state group-hover:text-thread">
                    {waiting[0].text}
                  </p>
                </Link>
              )}
            </section>
          </div>
        </>
      )}
    </div>
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
