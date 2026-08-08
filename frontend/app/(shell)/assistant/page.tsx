"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { ConversationList } from "@/components/conversation-list";
import { Collapse } from "@/components/motion";
import { ScreenHint } from "@/components/screen-hint";
import { Card, EmptyState, Meta } from "@/components/ui";
import { takePendingQuestion } from "@/lib/handoff";
import {
  chatQuery,
  createConversation,
  getConversation,
  listConversations,
  saveConversation,
  type ConversationMessage,
  type ConversationSummary,
  type Source,
} from "@/lib/api";

// Screen 05. Ask about the project's past and get an answer built only from
// what was recorded.
//
// The conversation is saved as it goes, so closing the screen no longer throws
// it away. The first answer creates the row (the title comes from the question),
// every answer after that rewrites the transcript.
//
// Sources are collapsed behind one line, "based on 3 entries", instead of the
// four open cards this screen used to end every answer with. The count is the
// trust signal and it is always visible; the entries themselves are only in the
// way until someone doubts the answer.

type Turn = {
  question: string;
  sources: Source[];
  answer: string;
  done: boolean;
  error?: string;
};

/** The stored shape is two messages per turn; the screen thinks in turns. */
const toMessages = (turns: Turn[]): ConversationMessage[] =>
  turns.flatMap((turn) => [
    { role: "user" as const, text: turn.question },
    { role: "ariadne" as const, text: turn.answer, sources: turn.sources },
  ]);

function toTurns(messages: ConversationMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({ question: message.text, sources: [], answer: "", done: true });
      continue;
    }
    const last = turns.at(-1);
    if (last) {
      last.answer = message.text;
      last.sources = message.sources ?? [];
    }
  }
  return turns;
}

export default function AssistantScreen() {
  const t = useTranslations("assistant");
  const tHint = useTranslations("hint.assistant");
  const { activeProject } = useApp();

  const projectId = activeProject?.id ?? null;
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Held in a ref as well as state because the streaming loop finishes after the
  // render that would have given it the new id, and it needs the id to save.
  const openId = useRef<string | null>(null);

  const refreshHistory = useCallback((project: string) => {
    void listConversations(project, "ask")
      .then(setHistory)
      .catch(() => {});
  }, []);

  const ask = useCallback(
    async (asked: string, project: string) => {
      setQuestion("");
      setBusy(true);
      const index = turns.length;
      setTurns((prev) => [...prev, { question: asked, sources: [], answer: "", done: false }]);

      // Each chunk patches one turn by index rather than rebuilding the list, so
      // a second question started before the first finished cannot cross wires.
      const patch = (change: Partial<Turn>) =>
        setTurns((prev) => prev.map((turn, i) => (i === index ? { ...turn, ...change } : turn)));

      let answer = "";
      let sources: Source[] = [];

      try {
        for await (const chunk of chatQuery(project, asked)) {
          if (chunk.type === "sources") {
            sources = chunk.sources;
            patch({ sources });
          }
          if (chunk.type === "error") patch({ error: chunk.message });
          if (chunk.type === "delta") {
            answer += chunk.text;
            setTurns((prev) =>
              prev.map((turn, i) =>
                i === index ? { ...turn, answer: turn.answer + chunk.text } : turn,
              ),
            );
          }
        }
      } catch (caught) {
        patch({ error: caught instanceof Error ? caught.message : String(caught) });
      } finally {
        patch({ done: true });
        setBusy(false);
      }

      // Saved from the local copies rather than from state: the setters above
      // have not necessarily flushed by the time this runs.
      const settled: Turn[] = [
        ...turns,
        { question: asked, sources, answer, done: true },
      ];
      try {
        if (openId.current) {
          await saveConversation(openId.current, toMessages(settled));
        } else {
          const created = await createConversation(project, "ask", toMessages(settled));
          openId.current = created.id;
          setConversationId(created.id);
        }
        refreshHistory(project);
      } catch {
        // A failed save leaves the answer on screen. Losing the transcript is
        // bad; replacing a good answer with an error about storage is worse.
      }
    },
    [turns, refreshHistory],
  );

  // Which project the transcript on screen belongs to. Clearing happens only
  // when this actually changes - not on every effect run, because StrictMode
  // double-invokes effects in dev and an unconditional clear wiped the
  // question the dashboard had just handed over.
  const shownFor = useRef<string | null>(null);

  // Without the reload that used to wipe this screen, switching projects must
  // clear the transcript itself. An in-flight answer is safe - ask() closes
  // over the id it started with. The handed-over question from the dashboard
  // still runs itself here, so the handover reads as one action rather than
  // as "now ask it again".
  useEffect(() => {
    if (!projectId || shownFor.current === projectId) return;
    shownFor.current = projectId;
    setTurns([]);
    openId.current = null;
    setConversationId(null);
    refreshHistory(projectId);
    const handed = takePendingQuestion();
    if (handed) void ask(handed, projectId);
    // Only the project change should reset the screen: `ask` changes identity
    // with every turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Follows the answer as it grows, but only while streaming, so a reader
  // scrolling back through an earlier turn is not yanked to the bottom.
  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const open = async (id: string) => {
    const conversation = await getConversation(id);
    setTurns(toTurns(conversation.messages));
    openId.current = id;
    setConversationId(id);
  };

  const startNew = () => {
    setTurns([]);
    openId.current = null;
    setConversationId(null);
    setQuestion("");
  };

  const empty = turns.length === 0;

  return (
    <div className="mx-auto max-w-[760px]">
        {empty ? (
          <div className="pt-2">
            <h1 className="text-title text-ink">{t("title")}</h1>
            <p className="max-w-[62ch] pt-2 text-body text-ink-2">{t("lead")}</p>
            <div className="pt-6">
              <ScreenHint screen="assistant" title={tHint("title")} note={tHint("note")} />
            </div>
          </div>
        ) : null}

        {!empty ? (
          <ul className="flex flex-col gap-10 pb-6">
            {turns.map((turn, i) => (
              <li key={i}>
                {/* The question sits in a tinted block and the answer on the
                    page. Two speakers need to be told apart at a glance, and
                    giving both a card would just be two cards. */}
                <p className="rounded-card bg-plaster-sunk px-6 py-4 text-body font-medium text-ink">
                  {turn.question}
                </p>

                {turn.error ? (
                  <p className="pt-5 text-body text-iron">{turn.error}</p>
                ) : turn.sources.length === 0 && turn.done && !turn.answer ? (
                  <div className="pt-5">
                    <EmptyState title={t("nothingRecorded")} note={t("nothingRecordedNote")} />
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap pt-5 text-body leading-8 text-ink">
                      {turn.answer}
                      {!turn.done ? (
                        <span className="ml-[3px] inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-ink-3" />
                      ) : null}
                    </p>
                    {turn.sources.length ? <Sources sources={turn.sources} /> : null}
                  </>
                )}
              </li>
            ))}
            <div ref={endRef} />
          </ul>
        ) : null}

        <div
          className={
            empty ? "" : "sticky bottom-0 -mx-6 bg-plaster px-6 pb-1 pt-3 lg:-mx-8 lg:px-8"
          }
        >
          <Composer
            value={question}
            onChange={setQuestion}
            onSubmit={(text) => projectId && void ask(text, projectId)}
            placeholder={t("placeholder")}
            submitLabel={t("ask")}
            busyLabel={t("asking")}
            hint={t("hint")}
            busy={busy}
            disabled={!projectId}
            autoFocus={empty}
            rows={empty ? 3 : 2}
            suggestions={empty ? [t("suggest1"), t("suggest2"), t("suggest3")] : []}
          />
        </div>

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

// Closed until asked for. The count is the trust signal and stays visible; the
// entries themselves grow out of the answer, which is what says they belong to
// it rather than being a separate panel.
function Sources({ sources }: { sources: Source[] }) {
  const t = useTranslations("assistant");
  const tHome = useTranslations("home");
  const tEntry = useTranslations("entry");
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-3 rounded-control border border-hairline bg-surface px-4 py-[6px] text-data text-ink-2 transition-colors duration-state hover:border-edge/60 hover:text-ink"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-state ${open ? "rotate-90" : ""}`}
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {t("sourcesCount", { count: sources.length })}
      </button>

      <Collapse open={open}>
        <ol className="flex flex-col gap-2 pt-3">
          {sources.map((source, i) => (
            <li key={source.id}>
              <Card className="p-4">
                {/* The number is the pointer the answer writes as [1]. */}
                <Meta
                  items={[
                    `[${i + 1}]`,
                    tEntry(`type.${source.type}`),
                    new Date(source.createdAt).toISOString().slice(0, 10),
                    tHome(`status.${source.status}`),
                  ]}
                />
                <p className="line-clamp-3 pt-2 text-small leading-6 text-ink-2">{source.content}</p>
                {source.anchors?.length ? (
                  <p className="truncate pt-2 font-data text-data text-ink-3">
                    {source.anchors.map((a) => a.path).join(" · ")}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      </Collapse>
    </div>
  );
}
