"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusMark } from "@/components/status-mark";
import { Button } from "@/components/ui";
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
// The screen is ignorable by design. Nothing blocks on it, which is why there
// is no count shouting at the top and no ordering by urgency.

export default function PendingScreen() {
  const t = useTranslations("pending");
  const tHome = useTranslations("home");

  const [feed, setFeed] = useState<{ pendingActions: PendingAction[]; nodesToReview: ReviewNode[] } | null>(
    null,
  );
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    void getPending()
      .then(setFeed)
      .catch(() => setFeed({ pendingActions: [], nodesToReview: [] }));
  }, []);

  useEffect(load, [load]);

  // Every button on this screen is the same shape: run one call, then refetch.
  // Refetching rather than patching state locally, because approving an update
  // can change a node that the second list is also showing.
  const act = async (key: string, run: () => Promise<void>) => {
    setWorking(key);
    try {
      await run();
      load();
    } finally {
      setWorking(null);
    }
  };

  const empty = feed && !feed.pendingActions.length && !feed.nodesToReview.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-[860px]">
        <h1 className="text-section">{t("title")}</h1>

        {feed === null ? (
          <p className="pt-6 text-body text-ink-3">{t("loading")}</p>
        ) : empty ? (
          <p className="max-w-[68ch] pt-5 text-body text-ink-2">{t("empty")}</p>
        ) : (
          <>
            {feed.pendingActions.length ? (
              <section className="pt-7">
                <h2 className="text-lead">{t("queued")}</h2>
                <ul className="mt-5 border-t border-hairline">
                  {feed.pendingActions.map((action) => (
                    <li key={action.id} className="border-b border-hairline py-5">
                      <p className="font-data text-label uppercase tracking-[0.12em] text-ochre">
                        {t(`action.${action.action}`)} · {action.projectName} · {action.requestedBy}
                      </p>

                      {/* Old above new, both in full. A change to a recorded
                          decision is read, not skimmed, so nothing is collapsed
                          behind a toggle. */}
                      <p className="whitespace-pre-wrap pt-3 text-small text-ink-3 line-through decoration-iron/40">
                        {action.nodeContent}
                      </p>
                      {action.payload?.content ? (
                        <p className="whitespace-pre-wrap pt-3 text-body text-ink">
                          {action.payload.content}
                        </p>
                      ) : null}

                      <div className="flex gap-4 pt-4">
                        <Button
                          disabled={working === action.id}
                          onClick={() => void act(action.id, () => approvePending(action.id))}
                        >
                          {t("approve")}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={working === action.id}
                          onClick={() => void act(action.id, () => rejectPending(action.id))}
                        >
                          {t("reject")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {feed.nodesToReview.length ? (
              <section className="pt-9">
                <h2 className="text-lead">{t("entries")}</h2>
                <ul className="mt-5 border-t border-hairline">
                  {feed.nodesToReview.map((node) => (
                    <li key={node.id} className="border-b border-hairline py-5">
                      <div className="flex items-center gap-3">
                        <StatusMark status={node.status} label={tHome(`status.${node.status}`)} />
                        <span className="font-data text-label uppercase tracking-[0.12em] text-ink-3">
                          {tHome(`status.${node.status}`)} · {node.projectName}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap pt-3 text-body text-ink">{node.content}</p>

                      <div className="flex gap-4 pt-4">
                        {/* A contradicted entry is already settled: it was
                            overruled by another entry, and confirming it would
                            put two contradicting entries on equal footing. */}
                        {node.status === "proposed" ? (
                          <Button
                            disabled={working === node.id}
                            onClick={() => void act(node.id, () => confirmNode(node.id))}
                          >
                            {t("confirm")}
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          disabled={working === node.id}
                          onClick={() => void act(node.id, () => archiveNode(node.id))}
                        >
                          {t("archive")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
