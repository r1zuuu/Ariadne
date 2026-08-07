"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AppShell, queueChanged } from "@/components/app-shell";
import { EntryCard, headline } from "@/components/entry-card";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import {
  approvePending,
  archiveNode,
  confirmNode,
  getPending,
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

  const [feed, setFeed] = useState<{
    pendingActions: PendingAction[];
    nodesToReview: ReviewNode[];
  } | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    void getPending()
      .then(setFeed)
      .catch(() => setFeed({ pendingActions: [], nodesToReview: [] }));
  }, []);

  useEffect(load, [load]);

  // Every button here is the same shape: run one call, say what happened,
  // refetch. Refetching rather than patching locally, because approving an
  // update changes a node the second list may also be showing.
  const act = async (key: string, run: () => Promise<void>, message: string) => {
    setWorking(key);
    try {
      await run();
      toast(message);
      load();
      // The column's counter lives outside this tree and would otherwise keep
      // showing the number from page load.
      queueChanged();
    } catch {
      toast(t("toastFailed"), "error");
    } finally {
      setWorking(null);
    }
  };

  const groups = feed ? groupByProject(feed) : [];
  const empty = feed && !feed.pendingActions.length && !feed.nodesToReview.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-[860px]">
        <PageHeader title={t("title")} lead={t("lead")} />

        {feed === null ? (
          <p className="text-body text-ink-3">{t("loading")}</p>
        ) : empty ? (
          <EmptyState title={t("empty")} note={t("emptyNote")} />
        ) : (
          <div className="flex flex-col gap-10">
            {groups.map((group) => (
              <section key={group.project}>
                <div className="flex items-baseline gap-3 pb-4">
                  <h2 className="text-lead text-ink">{group.project}</h2>
                  <Badge tone="ochre">
                    {t("count", { count: group.actions.length + group.nodes.length })}
                  </Badge>
                </div>

                {group.actions.length ? (
                  <div className="pb-6">
                    <SectionHeader title={t("queued")} />
                    <ul className="flex flex-col gap-3">
                      {group.actions.map((action) => (
                        <li key={action.id}>
                          <ActionCard
                            action={action}
                            busy={working === action.id}
                            onApprove={() =>
                              void act(action.id, () => approvePending(action.id), t("toastApproved"))
                            }
                            onReject={() =>
                              void act(action.id, () => rejectPending(action.id), t("toastRejected"))
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {group.nodes.length ? (
                  <div>
                    <SectionHeader title={t("entries")} />
                    <ul className="flex flex-col gap-3">
                      {group.nodes.map((node) => (
                        <li key={node.id}>
                          <EntryCard
                            entry={node}
                            meta={`${new Date(node.createdAt).toISOString().slice(0, 10)} · ${node.projectName}`}
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
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ActionCard({
  action,
  busy,
  onApprove,
  onReject,
}: {
  action: PendingAction;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("pending");
  const tEntry = useTranslations("entry");

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={action.action === "delete" ? "iron" : "ochre"}>
          {t(`action.${action.action}`)}
        </Badge>
        <span className="font-data text-data text-ink-3">
          {new Date(action.createdAt).toISOString().slice(0, 10)} ·{" "}
          {tEntry(`by.${action.requestedBy === "coder" ? "coder" : "app_chat"}`)}
        </span>
      </div>

      <p className="pt-3 text-body font-medium leading-7 text-ink">
        {headline(action.payload?.content ?? action.nodeContent)}
      </p>

      {/* Side by side, both labelled. Struck-through text above replacement text
          reads as one paragraph with a line through half of it; two labelled
          columns read as a change. */}
      {action.payload?.content ? (
        <div className="grid gap-3 pt-4 sm:grid-cols-2">
          <div className="rounded-control bg-plaster-sunk/70 p-4">
            <p className="pb-2 font-data text-label uppercase tracking-[0.12em] text-ink-3">
              {t("before")}
            </p>
            <p className="line-clamp-6 whitespace-pre-wrap text-small leading-6 text-ink-3">
              {action.nodeContent}
            </p>
          </div>
          <div className="rounded-control border border-blue/20 bg-blue/5 p-4">
            <p className="pb-2 font-data text-label uppercase tracking-[0.12em] text-blue">
              {t("after")}
            </p>
            <p className="line-clamp-6 whitespace-pre-wrap text-small leading-6 text-ink">
              {action.payload.content}
            </p>
          </div>
        </div>
      ) : (
        <p className="line-clamp-4 whitespace-pre-wrap pt-3 text-small leading-6 text-ink-2">
          {action.nodeContent}
        </p>
      )}

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
function groupByProject(feed: { pendingActions: PendingAction[]; nodesToReview: ReviewNode[] }) {
  const groups = new Map<string, { project: string; actions: PendingAction[]; nodes: ReviewNode[] }>();
  const of = (name: string) => {
    if (!groups.has(name)) groups.set(name, { project: name, actions: [], nodes: [] });
    return groups.get(name)!;
  };
  for (const action of feed.pendingActions) of(action.projectName).actions.push(action);
  for (const node of feed.nodesToReview) of(node.projectName).nodes.push(node);
  return [...groups.values()];
}
