"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { Composer } from "@/components/composer";
import { ConversationList } from "@/components/conversation-list";
import { useFailure } from "@/components/failure";
import { Collapse } from "@/components/motion";
import { Card, EmptyState, Meta } from "@/components/ui";
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
    // this block and lines itself up with the middle of it.
    <div className="relative">
      <ConversationShelf
        conversations={history}
        activeId={conversationId}
        onOpen={(id) => void open(id)}
        onNew={startNew}
      />

      <div className="mx-auto max-w-[760px]">
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
        <div className="pt-8 min-[1180px]:hidden">
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
    </div>
  );
}

// Past conversations, on a shelf beside the question rather than in a block
// under it. Under the field they sat in the way of the thing being written; out
// here they are peripheral vision, which is what a way back should be.
//
// Narrow, with one line per conversation, and it widens under the pointer to
// show the titles in full. Nothing else about it changes: no fade in, no
// shuffling of what is on it, so the row you reached for is the row you get.
//
// Hidden below 1180px, where the margin beside a 760px column stops being wide
// enough to hold anything; the full list under the composer covers that case.
// It opens on focus as well as on hover, because a keyboard cannot hover and a
// row you can reach but not read is not a way back.
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
    <aside className="group absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 min-[1180px]:block">
      <div className="w-[150px] rounded-card border border-transparent bg-transparent p-3 transition-[width,background-color,border-color,box-shadow] duration-enter ease-out-quint group-hover:w-[280px] group-hover:border-hairline group-hover:bg-elevated group-hover:shadow-lifted group-focus-within:w-[280px] group-focus-within:border-hairline group-focus-within:bg-elevated group-focus-within:shadow-lifted">
        <p className="px-2 pb-2 text-label uppercase tracking-[0.12em] text-ink-3">
          {t("historyTitle")}
        </p>
        <ul className="flex flex-col">
          {conversations.slice(0, SHELF_LENGTH).map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onOpen(conversation.id)}
                aria-current={conversation.id === activeId ? "true" : undefined}
                className={`block w-full truncate rounded-control px-2 py-[6px] text-left text-data transition-colors duration-state hover:bg-surface ${
                  conversation.id === activeId ? "text-ink" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {conversation.title}
              </button>
            </li>
          ))}
        </ul>
        {/* Only once the shelf is open: collapsed, it is a list of titles and
            nothing else. */}
        <button
          type="button"
          onClick={onNew}
          className="hidden w-full rounded-control px-2 pt-3 text-left text-data text-thread underline underline-offset-2 group-hover:block group-focus-within:block"
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
