"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, readActiveProject } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { chatEdit, type Proposal } from "@/lib/api";

// Screen 06. Talk to the base and it proposes changes instead of making them.
// Nothing here writes: every proposal lands in the review queue, which is the
// same queue a coder's proposals land in, and screen 07 is where they are
// settled. The link at the bottom of a reply is not a courtesy, it is the only
// place the work finishes.

type Turn = { message: string; reply?: string; queued?: Proposal[]; error?: string };

export default function DatabaseScreen() {
  const t = useTranslations("database");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProjectId(readActiveProject());
    // One conversation is one session, so entries created from it group the way
    // a coder's session does. Generated here because the server has no
    // conversation table to look one up in.
    setSessionId(crypto.randomUUID());
  }, []);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const said = message.trim();
    if (!said || !projectId || busy) return;

    setMessage("");
    setBusy(true);
    const index = turns.length;
    setTurns((prev) => [...prev, { message: said }]);

    const patch = (change: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn, i) => (i === index ? { ...turn, ...change } : turn)));

    try {
      const answer = await chatEdit(projectId, said, sessionId);
      patch({ reply: answer.reply, queued: answer.queued });
    } catch (caught) {
      patch({ error: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-section">{t("title")}</h1>
        <p className="max-w-[68ch] pt-3 text-body text-ink-2">{t("note")}</p>

        <div className="pt-7">
          <ul className="flex flex-col gap-9">
            {turns.map((turn, i) => (
              <li key={i}>
                <p className="text-lead text-ink">{turn.message}</p>
                {turn.error ? (
                  <p className="pt-4 text-body text-iron">{turn.error}</p>
                ) : turn.reply ? (
                  <>
                    <p className="pt-4 text-body text-ink">{turn.reply}</p>
                    {turn.queued?.length ? (
                      <Queued proposals={turn.queued} />
                    ) : (
                      <p className="pt-3 text-small text-ink-3">{t("nothingProposed")}</p>
                    )}
                  </>
                ) : (
                  <p className="pt-4 text-body text-ink-3">{t("thinking")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={send}
          className="sticky bottom-0 -mx-8 -mb-9 mt-7 flex items-end gap-4 border-t border-hairline bg-plaster px-8 py-5"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("placeholder")}
            disabled={!projectId}
            className="flex-1 border-b border-edge bg-transparent pb-2 text-body text-ink outline-none transition-colors placeholder:text-ink-3/55 focus:border-blue"
          />
          <Button type="submit" disabled={busy || !message.trim() || !projectId}>
            {busy ? t("sending") : t("send")}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

function Queued({ proposals }: { proposals: Proposal[] }) {
  const t = useTranslations("database");
  return (
    <div className="mt-4 border-l-2 border-ochre pl-5">
      <ul className="flex flex-col gap-3">
        {proposals.map((proposal) => (
          <li key={`${proposal.action}-${proposal.nodeId}`}>
            <p className="font-data text-label uppercase tracking-[0.12em] text-ochre">
              {t(`action.${proposal.action}`)}
            </p>
            <p className="line-clamp-3 pt-1 text-small text-ink-2">{proposal.content}</p>
          </li>
        ))}
      </ul>
      {/* Proposals are inert until settled, so the screen says where that
          happens rather than leaving them looking applied. */}
      <p className="pt-4 text-small text-ink-3">
        {t("queuedNote")}{" "}
        <Link href="/pending" className="text-blue underline underline-offset-2">
          {t("queuedLink")}
        </Link>
      </p>
    </div>
  );
}
