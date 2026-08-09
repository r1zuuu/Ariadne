"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { headline } from "@/components/entry-card";
import { useToast } from "@/components/toast";
import { hasSeenTour } from "@/lib/first-run";
import { PENDING_QUESTION } from "@/lib/handoff";
import {
  approvePending,
  archiveNode,
  confirmNode,
  listNodes,
  rejectPending,
  type Node,
} from "@/lib/api";
import { Banner, Button, Card, EmptyState, IconButton, SectionHeader, Status } from "@/components/ui";

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
  const tQueue = useTranslations("pending");
  const router = useRouter();
  const toast = useToast();
  const { locale } = useLocale();
  const { projects, activeProject, pendingFeed, server, refreshProjects, refreshPending } =
    useApp();

  const [latestDecision, setLatestDecision] = useState<Node[] | null>(null);
  const [since, setSince] = useState<Date | null>(null);
  const [question, setQuestion] = useState("");
  const [settling, setSettling] = useState(false);

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

  // The head of the review queue, with enough identity to settle it here: a
  // tick and a cross on the overview is the whole point of surfacing it.
  const waitingCount = pendingFeed
    ? pendingFeed.pendingActions.length + pendingFeed.nodesToReview.length
    : 0;
  const action = pendingFeed?.pendingActions[0];
  const node = pendingFeed?.nodesToReview[0];
  const head = action
    ? {
        id: action.id,
        label: t(`pendingAction.${action.action}`),
        text: headline(action.payload?.content ?? action.nodeContent),
        accept: () => approvePending(action.id),
        acceptToast: tQueue("toastApproved"),
        dismiss: () => rejectPending(action.id),
        dismissToast: tQueue("toastRejected"),
        acceptable: true,
      }
    : node
      ? {
          id: node.id,
          label: t(`status.${node.status}`),
          text: headline(node.content),
          accept: () => confirmNode(node.id),
          acceptToast: tQueue("toastConfirmed"),
          dismiss: () => archiveNode(node.id),
          dismissToast: tQueue("toastArchived"),
          // A contradicted entry is already settled; confirming it would put
          // two contradicting entries on equal footing.
          acceptable: node.status === "proposed",
        }
      : null;

  const settle = async (accept: boolean) => {
    if (!head) return;
    setSettling(true);
    try {
      await (accept ? head.accept() : head.dismiss());
      toast(accept ? head.acceptToast : head.dismissToast);
      await refreshPending();
    } catch {
      toast(tQueue("toastFailed"), "error");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col">
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
          {/* The question and its field take the whole screen and sit in the
              middle of it; what is under them starts below the fold, which is
              where a glance-deep summary belongs. */}
          <section className="flex flex-1 flex-col justify-center pb-8 pt-6">
            <p className="pb-3 text-center text-data text-ink-3">
              {since ? t("seen", { at: stamp(since, true) }) : t("seenFirst")}
            </p>
            {/* The one display-size line in the app: the question the whole
                product exists to answer. Centred over the field it asks for,
                so the two read as one object. */}
            <h1 className="mx-auto max-w-[16ch] text-center text-display text-ink">
              {t("askTitle")}
            </h1>

            {/* w-full, because auto side margins on a flex child stop it from
                stretching and the field would shrink to its own text. */}
            <div className="mx-auto w-full max-w-[820px] pt-8">
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
              <p className="pt-5 text-center text-small text-ink-3">
                {t("memoryLine", { entries: active.nodeCount })}{" "}
                <Link href="/project" className="text-thread underline underline-offset-2">
                  {t("memoryLink")}
                </Link>
              </p>
            ) : null}
          </section>

          {/* The thread picks up where the question ends: a short taut lead-in
              on the hairline that carries the eye down to what was decided. */}
          <div className="relative mb-8 border-t border-hairline" aria-hidden="true">
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
                <Link href="/project" className="block">
                  <Card interactive className="p-5">
                    <p className="line-clamp-2 text-body font-medium leading-7 text-ink">
                      {headline(latestDecision[0].content)}
                    </p>
                    <p className="pt-2 text-data text-ink-3">
                      {stamp(new Date(latestDecision[0].createdAt))}
                    </p>
                  </Card>
                </Link>
              )}
            </section>

            <section>
              <SectionHeader
                title={t("waitingTitle")}
                action={
                  waitingCount ? (
                    <Link
                      href="/pending"
                      className="text-small text-thread underline underline-offset-2"
                    >
                      {t("waitingAll")} ({waitingCount})
                    </Link>
                  ) : null
                }
              />
              {pendingFeed === null ? (
                <p className="text-small text-ink-3">{t("loading")}</p>
              ) : head === null ? (
                <EmptyState title={t("waitingEmpty")} note={t("waitingEmptyNote")} />
              ) : (
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Status tone="proposed">{head.label}</Status>
                      <p className="line-clamp-2 pt-2 text-body font-medium leading-7 text-ink">
                        {head.text}
                      </p>
                    </div>
                    {/* Settled without leaving the overview: a tick keeps it,
                        a cross sends it away. The queue screen holds the rest. */}
                    <div className="flex shrink-0 gap-1 pt-1">
                      {head.acceptable ? (
                        <IconButton
                          label={tQueue("confirm")}
                          disabled={settling}
                          onClick={() => void settle(true)}
                          className="hover:bg-laurel/10 hover:text-laurel"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M2.5 8.5 6 12l7.5-8" />
                          </svg>
                        </IconButton>
                      ) : null}
                      <IconButton
                        label={tQueue("archive")}
                        disabled={settling}
                        onClick={() => void settle(false)}
                        className="hover:bg-iron/10 hover:text-iron"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                        </svg>
                      </IconButton>
                    </div>
                  </div>
                </Card>
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
