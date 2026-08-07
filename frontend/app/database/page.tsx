"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, readActiveProject } from "@/components/app-shell";
import { Composer } from "@/components/composer";
import { useToast } from "@/components/toast";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { chatEdit, type Proposal } from "@/lib/api";

// Screen 06. Where knowledge goes in, as opposed to the assistant, where it
// comes out. That distinction was the screen's whole problem: it was called
// "talk to the base" and the placeholder was a sentence fragment, so nobody
// could tell the two apart.
//
// Nothing here writes. Every proposal goes to the review queue, and the card
// says so in words next to a link to the queue.

type Turn = { message: string; reply?: string; queued?: Proposal[]; error?: string };

export default function DatabaseScreen() {
  const t = useTranslations("database");
  const toast = useToast();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProjectId(readActiveProject());
    // One conversation is one session, so entries created from it group the way
    // a coder's session does.
    setSessionId(crypto.randomUUID());
  }, []);

  const send = async (said: string) => {
    if (!projectId) return;
    setMessage("");
    setBusy(true);
    const index = turns.length;
    setTurns((prev) => [...prev, { message: said }]);

    const patch = (change: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn, i) => (i === index ? { ...turn, ...change } : turn)));

    try {
      const answer = await chatEdit(projectId, said, sessionId);
      patch({ reply: answer.reply, queued: answer.queued });
      if (answer.queued.length) toast(t("toast"));
    } catch (caught) {
      patch({ error: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
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
          suggestions={turns.length ? [] : [t("suggest1"), t("suggest2"), t("suggest3")]}
        />

        <ul className="flex flex-col gap-9 pt-10">
          {turns.map((turn, i) => (
            <li key={i}>
              <p className="rounded-card bg-plaster-sunk px-6 py-4 text-body font-medium text-ink">
                {turn.message}
              </p>

              {turn.error ? (
                <p className="pt-4 text-body text-iron">{turn.error}</p>
              ) : turn.reply ? (
                <>
                  <p className="pt-4 text-body leading-8 text-ink">{turn.reply}</p>
                  {turn.queued?.length ? (
                    <Queued proposals={turn.queued} />
                  ) : (
                    <div className="pt-4">
                      <EmptyState title={t("nothingProposed")} note={t("nothingProposedNote")} />
                    </div>
                  )}
                </>
              ) : (
                <p className="pt-4 text-body text-ink-3">{t("thinking")}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

// What will be saved, exactly as it will be saved. This is the screen's promise:
// you see the text before it becomes part of the project's memory.
function Queued({ proposals }: { proposals: Proposal[] }) {
  const t = useTranslations("database");
  return (
    <div className="pt-4">
      <p className="pb-2 font-data text-label uppercase tracking-[0.12em] text-ink-3">
        {t("willSave")}
      </p>
      <ul className="flex flex-col gap-3">
        {proposals.map((proposal) => (
          <li key={`${proposal.action}-${proposal.nodeId}`}>
            <Card className="border-ochre/30 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ochre">{t(`action.${proposal.action}`)}</Badge>
                <Badge tone="neutral">{t("awaiting")}</Badge>
              </div>
              <p className="whitespace-pre-wrap pt-3 text-small leading-6 text-ink">
                {proposal.content}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      <Link
        href="/pending"
        className="mt-3 inline-block text-small text-blue underline underline-offset-2"
      >
        {t("queuedLink")}
      </Link>
    </div>
  );
}
