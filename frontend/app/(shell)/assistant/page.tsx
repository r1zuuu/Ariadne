"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { ConversationList } from "@/components/conversation-list";
import { Collapse } from "@/components/motion";
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
          <div className="pt-6 text-center">
            <h1 className="mx-auto max-w-[14ch] text-display text-ink">{t("title")}</h1>
            <p className="mx-auto max-w-[62ch] pt-4 text-body text-ink-2">{t("lead")}</p>
          </div>
        ) : null}

        {!empty ? (
          <ul className="flex flex-col gap-8 pb-6">
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
                  <Answer turn={turn} />
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {/* Outside the list: as a flex child it claimed a whole gap slot of
            its own, which read as a hole between the answer and the composer. */}
        <div ref={endRef} aria-hidden="true" />

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

        <div className="pt-8">
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

/** A [1] or [1, 3] the model wrote becomes clickable citation marks. */
function CitationMark({ n, onCite }: { n: number; onCite: (n: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCite(n)}
      aria-label={`[${n}]`}
      className="mx-[2px] inline-flex h-[18px] min-w-[18px] translate-y-[-2px] items-center justify-center rounded-label bg-aegean/20 px-[5px] text-[11px] font-medium leading-none text-aegean transition-colors duration-state hover:bg-aegean/35"
    >
      {n}
    </button>
  );
}

// The answer with its citations made tangible: every [n] the model writes
// renders as a small numbered mark that opens the matching entry below, the
// way a reader expects citations to behave. The prose stays prose; the marks
// are the only interactive thing inside it.
function Answer({ turn }: { turn: Turn }) {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const cite = (n: number) => {
    setOpen(true);
    setActive(n);
  };

  const parts = turn.answer.split(/(\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    const match = /^\[(\d+(?:\s*,\s*\d+)*)\]$/.exec(part);
    if (!match) return <span key={i}>{part}</span>;
    return (
      <span key={i} className="whitespace-nowrap">
        {match[1].split(/\s*,\s*/).map((n) => (
          <CitationMark key={n} n={Number(n)} onCite={cite} />
        ))}
      </span>
    );
  });

  return (
    <>
      <p className="whitespace-pre-wrap pt-5 text-body leading-8 text-ink">
        {parts}
        {!turn.done ? (
          <span className="ml-[3px] inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-ink-3" />
        ) : null}
      </p>
      {turn.sources.length ? (
        <Sources
          sources={turn.sources}
          open={open}
          onToggle={() => setOpen(!open)}
          active={active}
          countLabel={t("sourcesCount", { count: turn.sources.length })}
        />
      ) : null}
    </>
  );
}

// Closed until asked for. The count is the trust signal and stays visible; the
// entries themselves grow out of the answer, which is what says they belong to
// it rather than being a separate panel.
function Sources({
  sources,
  open,
  onToggle,
  active,
  countLabel,
}: {
  sources: Source[];
  open: boolean;
  onToggle: () => void;
  active: number | null;
  countLabel: string;
}) {
  const tHome = useTranslations("home");
  const tEntry = useTranslations("entry");
  const { locale } = useLocale();
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onToggle}
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
        {countLabel}
      </button>

      <Collapse open={open}>
        <ol className="flex flex-col gap-2 pt-3">
          {sources.map((source, i) => (
            <li key={source.id}>
              <Card
                className={`p-4 transition-[border-color] duration-state ${
                  active === i + 1 ? "border-aegean" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* The same mark the answer points with. */}
                  <span className="mt-[2px] inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-label bg-aegean/20 px-[5px] text-[11px] font-medium leading-none text-aegean">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <Meta
                      items={[
                        tEntry(`type.${source.type}`),
                        stamp(source.createdAt),
                        tHome(`status.${source.status}`),
                      ]}
                    />
                    <p className="line-clamp-3 pt-2 text-small leading-6 text-ink-2">
                      {source.content}
                    </p>
                    {source.anchors?.length ? (
                      <p className="truncate pt-2 font-data text-data text-ink-3">
                        {source.anchors.map((a) => a.path).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </Collapse>
    </div>
  );
}
