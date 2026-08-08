"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { ConversationList } from "@/components/conversation-list";
import { FadeIn } from "@/components/motion";
import { useToast } from "@/components/toast";
import { Card, EmptyState, Meta, PageHeader, Status } from "@/components/ui";
import {
  chatEdit,
  createConversation,
  getConversation,
  listConversations,
  saveConversation,
  type ConversationMessage,
  type ConversationSummary,
  type Proposal,
} from "@/lib/api";

// Screen 06. Where knowledge goes in, as opposed to the assistant, where it
// comes out. That distinction was the screen's whole problem: it was called
// "talk to the base" and the placeholder was a sentence fragment, so nobody
// could tell the two apart.
//
// Nothing here writes to project memory. Every proposal goes to the review
// queue, and the card says so next to a link to it.
//
// The exchange is kept, so "what did I tell Ariadne last week and what happened
// to it" has an answer. The status of each proposal is not stored with it: it
// changes in the queue, so it is read from the feed and matched by id.

type Turn = { message: string; reply?: string; queued?: Proposal[]; error?: string };

const toMessages = (turns: Turn[]): ConversationMessage[] =>
  turns.flatMap((turn) => [
    { role: "user" as const, text: turn.message },
    { role: "ariadne" as const, text: turn.reply ?? "", proposals: turn.queued ?? [] },
  ]);

function toTurns(messages: ConversationMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({ message: message.text });
      continue;
    }
    const last = turns.at(-1);
    if (last) {
      last.reply = message.text;
      last.queued = message.proposals ?? [];
    }
  }
  return turns;
}

export default function DatabaseScreen() {
  const t = useTranslations("database");
  const toast = useToast();

  const { activeProject, pendingFeed, refreshPending } = useApp();

  const projectId = activeProject?.id ?? null;
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Ids still waiting in the review queue, derived from the shared feed.
  // Anything a past proposal points at that is not in here has been settled
  // one way or the other.
  const stillWaiting =
    pendingFeed === null
      ? null
      : new Set([
          ...pendingFeed.pendingActions.map((a) => a.id),
          ...pendingFeed.nodesToReview.map((n) => n.id),
        ]);

  const refreshHistory = useCallback((project: string) => {
    void listConversations(project, "memory")
      .then(setHistory)
      .catch(() => {});
  }, []);

  // Which project the transcript on screen belongs to. Clearing happens only
  // when this actually changes - not on every effect run, because StrictMode
  // double-invokes effects in dev and would wipe a transcript mid-exchange.
  const shownFor = useRef<string | null>(null);

  // Without the reload that used to wipe this screen, switching projects must
  // clear the transcript itself.
  useEffect(() => {
    if (!projectId || shownFor.current === projectId) return;
    shownFor.current = projectId;
    setTurns([]);
    setConversationId(null);
    setMessage("");
    // One conversation is one session, so entries created from it group the way
    // a coder's session does.
    setSessionId(crypto.randomUUID());
    refreshHistory(projectId);
  }, [projectId, refreshHistory]);

  const send = async (said: string) => {
    if (!projectId) return;
    setMessage("");
    setBusy(true);
    const index = turns.length;
    setTurns((prev) => [...prev, { message: said }]);

    const patch = (change: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn, i) => (i === index ? { ...turn, ...change } : turn)));

    let settled: Turn = { message: said };
    try {
      const answer = await chatEdit(projectId, said, sessionId);
      settled = { message: said, reply: answer.reply, queued: answer.queued };
      patch({ reply: answer.reply, queued: answer.queued });
      if (answer.queued.length) {
        toast(t("toast"));
        // The shared feed knows nothing about what was queued a second ago,
        // so without this the new card claims "saved" about something still
        // waiting, and the column's counter is equally stale.
        await refreshPending();
      }
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : String(caught);
      settled = { message: said, error };
      patch({ error });
    } finally {
      setBusy(false);
    }

    // A failed exchange is still worth keeping: "I told it this and it broke"
    // is exactly the thing someone comes back to check.
    try {
      const all = [...turns, settled];
      if (conversationId) {
        await saveConversation(conversationId, toMessages(all));
      } else {
        const created = await createConversation(projectId, "memory", toMessages(all));
        setConversationId(created.id);
      }
      refreshHistory(projectId);
    } catch {
      // Same reasoning as the assistant: a storage failure must not replace what
      // is already on screen.
    }
  };

  const open = async (id: string) => {
    const conversation = await getConversation(id);
    setTurns(toTurns(conversation.messages));
    setConversationId(id);
  };

  const startNew = () => {
    setTurns([]);
    setConversationId(null);
    setMessage("");
    setSessionId(crypto.randomUUID());
  };

  const empty = turns.length === 0;

  return (
    <div className="mx-auto max-w-[760px]">
        <PageHeader title={t("title")} lead={t("lead")} />

        <Composer
          value={message}
          onChange={setMessage}
          onSubmit={send}
          placeholder={t("placeholder")}
          submitLabel={t("send")}
          busyLabel={t("sending")}
          hint={t("hint")}
          busy={busy}
          disabled={!projectId}
          rows={4}
          autoFocus
          suggestions={empty ? [t("suggest1"), t("suggest2"), t("suggest3")] : []}
        />

        <ul className="flex flex-col gap-9 pt-9">
          {turns.map((turn, i) => (
            <li key={i}>
              <p className="text-label uppercase tracking-[0.12em] text-ink-3">
                {t("youWrote")}
              </p>
              <p className="pt-2 text-body text-ink">{turn.message}</p>

              {turn.error ? (
                <p className="pt-5 text-body text-iron">{turn.error}</p>
              ) : turn.reply ? (
                <FadeIn>
                  <p className="pt-5 text-label uppercase tracking-[0.12em] text-ink-3">
                    {t("ariadneProposed")}
                  </p>
                  <p className="pt-2 text-body leading-8 text-ink">{turn.reply}</p>
                  {turn.queued?.length ? (
                    <Queued proposals={turn.queued} stillWaiting={stillWaiting} />
                  ) : (
                    <div className="pt-4">
                      <EmptyState title={t("nothingProposed")} note={t("nothingProposedNote")} />
                    </div>
                  )}
                </FadeIn>
              ) : (
                <p className="pt-5 text-body text-ink-3">{t("thinking")}</p>
              )}
            </li>
          ))}
        </ul>

        <div className="pt-9">
          <ConversationList
            conversations={history}
            activeId={conversationId}
            onOpen={(id) => void open(id)}
            onNew={startNew}
            collapsible={!empty}
            labels={{
              title: t("historyTitle"),
              newOne: t("historyNew"),
              empty: t("historyEmpty"),
              emptyNote: t("historyEmptyNote"),
            }}
          />
        </div>
    </div>
  );
}

// What will be saved, exactly as it will be saved, with where it stands now.
// This is the screen's promise: you see the text before it becomes memory, and
// you can come back later and see whether it made it.
function Queued({
  proposals,
  stillWaiting,
}: {
  proposals: Proposal[];
  stillWaiting: Set<string> | null;
}) {
  const t = useTranslations("database");

  return (
    <div className="pt-5">
      <p className="pb-3 text-label uppercase tracking-[0.12em] text-ink-3">
        {t("willSave")}
      </p>
      <ul className="flex flex-col gap-3">
        {proposals.map((proposal) => {
          // Until the feed has loaded, say nothing rather than guess: claiming
          // "saved" about something still queued is the one wrong answer here.
          const id = proposal.pendingActionId ?? proposal.nodeId;
          const waiting = stillWaiting === null ? null : stillWaiting.has(id);
          return (
            <li key={`${proposal.action}-${proposal.nodeId}`}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Meta items={[t(`action.${proposal.action}`)]} />
                  {waiting === null ? null : waiting ? (
                    <Status tone="proposed">{t("statusPending")}</Status>
                  ) : (
                    <Status tone="confirmed">{t("statusSaved")}</Status>
                  )}
                </div>
                <p className="whitespace-pre-wrap pt-3 text-small leading-6 text-ink">
                  {proposal.content}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
      <Link
        href="/pending"
        className="mt-4 inline-block text-small text-thread underline underline-offset-2"
      >
        {t("queuedLink")}
      </Link>
    </div>
  );
}
