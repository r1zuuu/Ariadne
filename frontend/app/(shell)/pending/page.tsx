"use client";

import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp, type PendingFeed } from "@/components/app-provider";
import { Collapse, enterTransition } from "@/components/motion";
import { EntryCard, headline } from "@/components/entry-card";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Meta, PageHeader, Status } from "@/components/ui";
import {
  approvePending,
  archiveNode,
  confirmNode,
  rejectPending,
  type PendingAction,
  type ReviewNode,
} from "@/lib/api";

// Screen 07. Two things wait here and they are not the same thing, so they are
// not one list: a queued action wants yes or no on a change someone proposed,
// and an unsettled entry wants yes or no on whether it is true.
//
// Grouped by project, because the queue is account-wide and a card with no
// project on it is a card you cannot act on. The group heading carries the name
// and the count; the cards below it then do not have to repeat either.
//
// The screen is ignorable by design and says so under the title.

export default function PendingScreen() {
  const t = useTranslations("pending");
  const toast = useToast();

  const { pendingFeed: feed, refreshPending } = useApp();
  const { locale } = useLocale();
  const [working, setWorking] = useState<string | null>(null);
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));

  // Every button here is the same shape: run one call, say what happened,
  // refetch. Refetching rather than patching locally, because approving an
  // update changes a node the second list may also be showing - and the
  // column's counter reads the same feed, so it stays honest for free.
  const act = async (key: string, run: () => Promise<void>, message: string) => {
    setWorking(key);
    try {
      await run();
      toast(message);
      await refreshPending();
    } catch {
      toast(t("toastFailed"), "error");
    } finally {
      setWorking(null);
    }
  };

  const groups = feed ? groupByProject(feed) : [];
  const empty = feed && !feed.pendingActions.length && !feed.nodesToReview.length;

  return (
    <div className="mx-auto max-w-[860px]">
        <PageHeader title={t("title")} />

        {feed === null ? (
          <p className="text-body text-ink-3">{t("loading")}</p>
        ) : empty ? (
          <EmptyState title={t("empty")} note={t("emptyNote")} />
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.project}>
                <div className="flex items-baseline gap-4 pb-4">
                  <h2 className="text-section text-ink">{group.project}</h2>
                  <Meta items={[t("count", { count: group.actions.length + group.nodes.length })]} />
                </div>

                {group.actions.length ? (
                  <div className="pb-6">
                    <ul className="flex flex-col gap-3">
                      {/* A settled card leaves the queue visibly instead of the
                          list snapping shorter: the decision happened here. */}
                      <AnimatePresence initial={false}>
                        {group.actions.map((action) => (
                          <m.li
                            key={action.id}
                            layout
                            exit={{ opacity: 0, y: -6 }}
                            transition={enterTransition}
                          >
                            <ActionCard
                              action={action}
                              stamp={stamp}
                              busy={working === action.id}
                              onApprove={() =>
                                void act(action.id, () => approvePending(action.id), t("toastApproved"))
                              }
                              onReject={() =>
                                void act(action.id, () => rejectPending(action.id), t("toastRejected"))
                              }
                            />
                          </m.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                ) : null}

                {group.nodes.length ? (
                  <div>
                    <ul className="flex flex-col gap-3">
                      <AnimatePresence initial={false}>
                        {group.nodes.map((node) => (
                          <m.li
                            key={node.id}
                            layout
                            exit={{ opacity: 0, y: -6 }}
                            transition={enterTransition}
                          >
                          <EntryCard
                            entry={node}
                            meta={`${stamp(node.createdAt)} · ${node.projectName}`}
                            actions={
                              <>
                                {/* A contradicted entry is already settled: it
                                    was overruled by another entry, and
                                    confirming it would put two contradicting
                                    entries on equal footing. */}
                                {node.status === "proposed" ? (
                                  <Button
                                    loading={working === node.id}
                                    onClick={() =>
                                      void act(node.id, () => confirmNode(node.id), t("toastConfirmed"))
                                    }
                                  >
                                    {t("confirm")}
                                  </Button>
                                ) : null}
                                <Button
                                  variant="secondary"
                                  loading={working === node.id}
                                  onClick={() =>
                                    void act(node.id, () => archiveNode(node.id), t("toastArchived"))
                                  }
                                >
                                  {t("archive")}
                                </Button>
                              </>
                            }
                          />
                          </m.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
      )}
    </div>
  );
}

function ActionCard({
  action,
  stamp,
  busy,
  onApprove,
  onReject,
}: {
  action: PendingAction;
  stamp: (iso: string) => string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("pending");
  const tEntry = useTranslations("entry");
  // The full before/after is for whoever actually wants to read it; the card
  // itself stays one headline deep.
  const [showChange, setShowChange] = useState(false);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Status tone={action.action === "delete" ? "contradicted" : "proposed"}>
          {t(`action.${action.action}`)}
        </Status>
        <Meta
          items={[
            stamp(action.createdAt),
            tEntry(`by.${action.requestedBy === "coder" ? "coder" : "app_chat"}`),
          ]}
        />
      </div>

      <p className="line-clamp-2 pt-3 text-body font-medium leading-7 text-ink">
        {headline(action.payload?.content ?? action.nodeContent)}
      </p>

      {action.payload?.content ? (
        <>
          <button
            type="button"
            onClick={() => setShowChange((open) => !open)}
            aria-expanded={showChange}
            className="pt-2 text-small text-thread underline underline-offset-2"
          >
            {t(showChange ? "hideChange" : "showChange")}
          </button>
          <Collapse open={showChange}>
            {/* Side by side, both labelled: two columns read as a change,
                struck-through text would read as one broken paragraph. */}
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <div className="rounded-control bg-plaster-sunk/70 p-4">
                <p className="pb-2 text-label uppercase tracking-[0.12em] text-ink-3">
                  {t("before")}
                </p>
                <p className="whitespace-pre-wrap text-small leading-6 text-ink-3">
                  {action.nodeContent}
                </p>
              </div>
              <div className="rounded-control border border-thread/20 bg-thread/5 p-4">
                <p className="pb-2 text-label uppercase tracking-[0.12em] text-thread">
                  {t("after")}
                </p>
                <p className="whitespace-pre-wrap text-small leading-6 text-ink">
                  {action.payload.content}
                </p>
              </div>
            </div>
          </Collapse>
        </>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-4">
        <Button loading={busy} onClick={onApprove}>
          {t("approve")}
        </Button>
        <Button variant="secondary" loading={busy} onClick={onReject}>
          {t("reject")}
        </Button>
      </div>
    </Card>
  );
}

// The feed arrives as two flat account-wide lists; the screen needs them per
// project. Order follows first appearance, which is newest-first from the API.
function groupByProject(feed: PendingFeed) {
  const groups = new Map<string, { project: string; actions: PendingAction[]; nodes: ReviewNode[] }>();
  const of = (name: string) => {
    if (!groups.has(name)) groups.set(name, { project: name, actions: [], nodes: [] });
    return groups.get(name)!;
  };
  for (const action of feed.pendingActions) of(action.projectName).actions.push(action);
  for (const node of feed.nodesToReview) of(node.projectName).nodes.push(node);
  return [...groups.values()];
}
