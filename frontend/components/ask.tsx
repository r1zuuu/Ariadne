"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { ConversationList } from "@/components/conversation-list";
import { useFailure } from "@/components/failure";
import { Collapse } from "@/components/motion";
import { lead } from "@/components/entry-card";
import { EmptyState } from "@/components/ui";
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

// The conversation with Ariadne: ask about the project's past, get an answer
// built only from what was recorded. It used to be a screen of its own next to
// the overview, which meant two doors onto one room - you typed a question on
// one screen and were teleported to another to read the answer, with a second
// heading and a second set of suggestions to keep in step. It is a component
// now, and the overview is the only door.
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

export function Ask({
  opening,
  footnote,
}: {
  /** What stands above the field before the first question: the caller owns
      that copy, because the screen around this owns what the place is for. */
  opening?: ReactNode;
  /** One quiet line under the field, same condition. */
  footnote?: ReactNode;
}) {
  const t = useTranslations("assistant");
  const failure = useFailure();
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
        patch({ error: failure(caught) });
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
    [turns, refreshHistory, failure],
  );

  // Which project the transcript on screen belongs to. Clearing happens only
  // when this actually changes - not on every effect run, because StrictMode
  // double-invokes effects in dev and an unconditional clear wiped the
  // question the dashboard had just handed over.
  const shownFor = useRef<string | null>(null);

  // Switching projects clears the transcript: an answer built from one
  // project's entries has no meaning under another project's name. An in-flight
  // answer is safe, since ask() closes over the id it started with.
  useEffect(() => {
    if (!projectId || shownFor.current === projectId) return;
    shownFor.current = projectId;
    setTurns([]);
    openId.current = null;
    setConversationId(null);
    refreshHistory(projectId);
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
    // Relative, because the shelf of past conversations hangs off the right of
    // this column and lines itself up with the middle of it.
    <div className="relative mx-auto max-w-[760px]">
      <ConversationShelf
        conversations={history}
        activeId={conversationId}
        onOpen={(id) => void open(id)}
        onNew={startNew}
      />

      {/* Until the first question, the field is the screen and sits in the
          middle of it. Once there is a transcript the group stops claiming the
          height, the answers push down from the top and the composer sticks to
          the bottom edge, which is where a conversation wants it. */}
      <div className={empty ? "flex screen-opening flex-col justify-center" : ""}>
        {empty && opening ? <div className="pb-7">{opening}</div> : null}

        {!empty ? (
          // The transcript sits in the middle of the window rather than against
          // the title bar. Two turns pinned to the top read as the remains of a
          // page you have scrolled past; this screen is a conversation, and a
          // short one belongs where the eye already is. The block is a window
          // tall, so it stops centring the moment the transcript outgrows it -
          // and the history below it goes under the fold, out of the way of the
          // thing being written.
          <div className="flex screen-content flex-col justify-center">
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
            {/* Outside the list: as a flex child it claimed a whole gap slot of
                its own, which read as a hole between the answer and the
                composer. Inside the centred block, though, because following a
                streaming answer means scrolling to the end of the transcript,
                not to the bottom of the space it is centred in. */}
            <div ref={endRef} aria-hidden="true" />
          </div>
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
            suggestions={empty ? [t("suggest1"), t("suggest2"), t("suggest3"), t("suggest4")] : []}
          />
        </div>
        {empty && footnote ? <div className="pt-5">{footnote}</div> : null}
      </div>

        {/* The full list stays for windows too narrow for the shelf, and for
            anyone reaching it by keyboard: a hover-only way in is no way in. */}
        <div className="pt-8 min-[1280px]:hidden">
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

// Past conversations, beside the question rather than in a block under it.
// Under the field they sat in the way of the thing being written; out here they
// are peripheral vision, which is what a way back should be.
//
// Nothing but text: no card, no border, no shadow. It grows to the right, into
// the empty margin, so opening it never covers a word of the conversation and
// the titles keep their left edge - the line you started reading is the line
// you go on reading.
//
// Hidden below 1280px, where that margin stops being wide enough to grow into;
// the full list under the composer covers that case. It opens on focus as well
// as on hover, because a keyboard cannot hover and a row you can reach but not
// read is not a way back.
function ConversationShelf({
  conversations,
  activeId,
  onOpen,
  onNew,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("assistant");

  if (!conversations.length) return null;

  return (
    <aside className="group absolute left-full top-1/2 z-10 hidden -translate-y-1/2 pl-6 min-[1280px]:block">
      <div className="w-[140px] transition-[width] duration-enter ease-out-quint group-hover:w-[200px] group-focus-within:w-[200px]">
        <p className="pb-2 text-label uppercase tracking-[0.12em] text-ink-3/70">
          {t("historyTitle")}
        </p>
        <ul className="flex flex-col">
          {conversations.slice(0, SHELF_LENGTH).map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onOpen(conversation.id)}
                aria-current={conversation.id === activeId ? "true" : undefined}
                title={conversation.title}
                className={`block w-full truncate py-[5px] text-left text-data transition-colors duration-state ${
                  conversation.id === activeId ? "text-ink-2" : "text-ink-3 hover:text-ink"
                }`}
              >
                {conversation.title}
              </button>
            </li>
          ))}
        </ul>
        {/* Only once it is open: collapsed, this is a list of titles and
            nothing else. */}
        <button
          type="button"
          onClick={onNew}
          className="hidden w-full pt-3 text-left text-data text-thread underline underline-offset-2 group-hover:block group-focus-within:block"
        >
          {t("historyNew")}
        </button>
      </div>
    </aside>
  );
}

/** Five is what fits beside a question without becoming a second column. */
const SHELF_LENGTH = 5;

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
  const [opened, setOpened] = useState<number | null>(null);

  const parts = turn.answer.split(/(\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    const match = /^\[(\d+(?:\s*,\s*\d+)*)\]$/.exec(part);
    if (!match) return <span key={i}>{part}</span>;
    return (
      <span key={i} className="whitespace-nowrap">
        {match[1].split(/\s*,\s*/).map((n) => (
          <CitationMark key={n} n={Number(n)} onCite={setOpened} />
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
      {turn.done && turn.sources.length ? (
        <Cited
          sources={turn.sources}
          answer={turn.answer}
          opened={opened}
          onOpen={(n) => setOpened(opened === n ? null : n)}
        />
      ) : null}
    </>
  );
}

/** The entry numbers the answer actually points at, in the order it uses them. */
function citedIn(answer: string, count: number): number[] {
  const found = [...answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)]
    .flatMap((match) => match[1].split(/\s*,\s*/).map(Number))
    .filter((n) => n >= 1 && n <= count);
  return [...new Set(found)];
}

// What the answer stood on, and nothing else. Retrieval hands over five entries
// on every question; five cards under every answer said "this is about all of
// them", which was both untrue and a screen of clutter. Only the entries the
// answer cites are named here, one quiet line each, and the entry opens under
// its own line for anyone who doubts it.
//
// Uncited entries are not hidden, they are simply not claimed: when the answer
// cites nothing at all the line falls back to naming what was read, because an
// answer with no traceable source at all is the one case worth admitting to.
function Cited({
  sources,
  answer,
  opened,
  onOpen,
}: {
  sources: Source[];
  answer: string;
  /** Which entry is showing its full text, by citation number. */
  opened: number | null;
  onOpen: (n: number) => void;
}) {
  const t = useTranslations("assistant");
  const { locale } = useLocale();
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));

  const cited = citedIn(answer, sources.length);
  const shown = cited.length ? cited : sources.map((_, i) => i + 1);

  return (
    <div className="pt-4">
      {cited.length ? null : (
        <p className="pb-1 text-data text-ink-3">
          {t("sourcesCount", { count: sources.length })}
        </p>
      )}
      <ul className="flex flex-col">
        {shown.map((n) => {
          const source = sources[n - 1];
          const isOpen = opened === n;
          return (
            <li key={source.id}>
              <button
                type="button"
                onClick={() => onOpen(n)}
                aria-expanded={isOpen}
                className="flex w-full items-baseline gap-3 py-[5px] text-left transition-colors duration-state"
              >
                {/* The same mark the answer points with, so the eye can travel
                    from the sentence to the entry it came from. */}
                <span className="inline-flex h-[16px] min-w-[16px] shrink-0 items-center justify-center rounded-label bg-aegean/15 text-[10px] font-medium leading-none text-aegean">
                  {n}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-data transition-colors duration-state ${
                    isOpen ? "text-ink-2" : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {lead(source)}
                </span>
                <span className="shrink-0 text-data text-ink-3/70">{stamp(source.createdAt)}</span>
              </button>

              <Collapse open={isOpen}>
                {/* The entry as recorded, set off by the thread rather than
                    boxed: it belongs to the line above it. */}
                <div className="border-l border-hairline py-2 pl-5">
                  <p className="whitespace-pre-wrap text-small leading-6 text-ink-2">
                    {source.content}
                  </p>
                  {source.anchors?.length ? (
                    <p className="truncate pt-2 font-data text-data text-ink-3">
                      {source.anchors.map((a) => a.path).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </Collapse>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
