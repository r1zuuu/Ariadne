"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { Ask } from "@/components/ask";
import { headline, lead } from "@/components/entry-card";
import { useToast } from "@/components/toast";
import {
  approvePending,
  archiveNode,
  confirmNode,
  listNodes,
  listTokens,
  rejectPending,
  type ApiToken,
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

/**
 * A coder knocked with a repository this archive does not hold.
 *
 * The miss is answered over MCP and nowhere else, so the app looked healthy
 * while every session came back empty, and the only trace was a sentence in
 * somebody's terminal that an agent may well have paraphrased into "I have no
 * memory of this project". The token records the address it was asked for; this
 * is where the person finally reads it.
 *
 * It clears itself: nothing resets the column, but the notice is gone the moment
 * a project with that address exists in the archive the token reaches.
 */
function UnknownRepoNotice() {
  const t = useTranslations("home.unknownRepo");
  const router = useRouter();
  const { projects } = useApp();
  const [tokens, setTokens] = useState<ApiToken[]>([]);

  useEffect(() => {
    // Silent on failure: a broken token list is the settings screen's problem,
    // and this notice has nothing to say without one.
    void listTokens()
      .then(setTokens)
      .catch(() => {});
  }, []);

  // Only once the projects are actually read. Against a null list every address
  // looks missing, and the notice would accuse the archive during every load.
  const miss = projects
    ? tokens.find(
        (token) =>
          token.lastUnknownRepo &&
          !projects.some(
            (project) =>
              project.workspaceId === token.workspaceId &&
              project.repoRef === token.lastUnknownRepo,
          ),
      )
    : undefined;
  const repo = miss?.lastUnknownRepo;
  if (!miss || !repo) return null;

  return (
    <Banner
      variant="notice"
      what={t("what", { repo, archive: miss.workspaceName })}
      means={t("means")}
      action={{
        label: t("action"),
        onClick: () =>
          router.push(
            `/project/new?repo=${encodeURIComponent(repo)}&workspace=${miss.workspaceId}`,
          ),
      }}
    />
  );
}

const LAST_SEEN_KEY = "ariadne.lastSeen";
// Below this the line says nothing worth a line.
const STALE_AFTER_MS = 30 * 60 * 1000;

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
  const [settling, setSettling] = useState(false);

  // Read once, then stamped forward, so the line answers "since when" with the
  // previous visit rather than with this one.
  useEffect(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    // Only when it was actually a while ago. This effect reads and then writes,
    // so anything that mounts the screen twice - a development double-invoke, a
    // client-side navigation back to it - would otherwise report a visit from
    // seconds earlier. "Last time you were here, a moment ago" is not a fact
    // anyone needs, whatever produced it.
    const previous = stored ? new Date(stored) : null;
    if (previous && Date.now() - previous.getTime() > STALE_AFTER_MS) setSince(previous);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, []);

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
          text: lead(node),
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
    <div className="mx-auto max-w-[1080px]">
      <UnknownRepoNotice />

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
          // The project form, not the wizard. This screen is only reachable by
          // an account that has already been through onboarding and has no
          // project right now - it deleted its last one, or left a team - and
          // sending it back through the wizard would ask for a profile and a key
          // it already has, then overwrite the profile with whatever was typed.
          action={<Button onClick={() => router.push("/project/new")}>{t("empty.action")}</Button>}
        />
      ) : (
        <>
          {/* The conversation itself, with this screen's own words above and
              below the field. The answer arrives here rather than on a screen
              of its own: one room, one door. */}
          <Ask
            opening={
              <>
                <p className="pb-3 text-center text-data text-ink-3">
                  {since ? t("seen", { at: stamp(since, true) }) : t("seenFirst")}
                </p>
                {/* The one display-size line in the app: the question the whole
                    product exists to answer. Centred over the field it asks
                    for, so the two read as one object. */}
                <h1 className="mx-auto max-w-[16ch] text-center text-display text-ink">
                  {t("askTitle")}
                </h1>
              </>
            }
            footnote={
              // Where the answers come from, in one real number. Under the
              // composer rather than above it: the question is the thing to do,
              // and this answers what a reader wonders after typing one.
              active?.nodeCount ? (
                <p className="text-center text-small text-ink-3">
                  {t("memoryLine", { entries: active.nodeCount })}{" "}
                  <Link href="/project" className="text-thread underline underline-offset-2">
                    {t("memoryLink")}
                  </Link>
                </p>
              ) : null
            }
          />

          {/* The thread picks up where the question ends: a short taut lead-in
              on the hairline that carries the eye down to what was decided.

              The gap above it is the whole width of the field, and deliberate.
              A sticky composer only lets go at the end of the block it sits in,
              which is the end of the conversation - so without this the field
              was still hanging over the screen when the summary arrived under
              it. With it, the two never share a screen. */}
          <div className="relative mb-8 mt-10 border-t border-hairline" aria-hidden="true">
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
                      {lead(latestDecision[0])}
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
