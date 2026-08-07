"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, readActiveProject } from "@/components/app-shell";
import { Composer } from "@/components/composer";
import { Badge, Card, EmptyState } from "@/components/ui";
import { takePendingQuestion } from "@/lib/handoff";
import { chatQuery, type Source } from "@/lib/api";

// Screen 05. Ask about the project's past and get an answer built only from
// what was recorded.
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

export default function AssistantScreen() {
  const t = useTranslations("assistant");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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

      try {
        for await (const chunk of chatQuery(project, asked)) {
          if (chunk.type === "sources") patch({ sources: chunk.sources });
          if (chunk.type === "error") patch({ error: chunk.message });
          if (chunk.type === "delta") {
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
    },
    [turns.length],
  );

  // A question typed on the dashboard arrives here and runs itself, so the
  // handover reads as one action rather than as "now ask it again".
  useEffect(() => {
    const project = readActiveProject();
    setProjectId(project);
    const handed = takePendingQuestion();
    if (handed && project) void ask(handed, project);
    // Once, on mount: `ask` changes identity with every turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follows the answer as it grows, but only while streaming, so a reader
  // scrolling back through an earlier turn is not yanked to the bottom.
  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const empty = turns.length === 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-[760px]">
        {empty ? (
          <div className="pt-6">
            <h1 className="text-title text-ink">{t("title")}</h1>
            <p className="max-w-[62ch] pt-2 text-body text-ink-2">{t("lead")}</p>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-4 pb-2">
            <h1 className="text-lead text-ink">{t("title")}</h1>
            <button
              type="button"
              onClick={() => setTurns([])}
              className="text-small text-blue underline underline-offset-2"
            >
              {t("newQuestion")}
            </button>
          </div>
        )}

        {!empty ? (
          <ul className="flex flex-col gap-10 py-6">
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
                ) : turn.sources.length === 0 && turn.done ? (
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

        <div className={empty ? "pt-8" : "sticky bottom-0 -mx-6 bg-plaster px-6 pb-1 pt-3 lg:-mx-10 lg:px-10"}>
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
            suggestions={
              empty
                ? [
                    t("suggest1"),
                    t("suggest2"),
                    t("suggest3"),
                  ]
                : []
            }
          />
        </div>
      </div>
    </AppShell>
  );
}

// Closed by default, opened by the reader. <details> rather than state, so the
// keyboard and screen-reader behaviour is the browser's and not mine.
function Sources({ sources }: { sources: Source[] }) {
  const t = useTranslations("assistant");
  const tHome = useTranslations("home");
  const tEntry = useTranslations("entry");

  return (
    <details className="group pt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-3 rounded-pill border border-hairline bg-surface px-4 py-[6px] text-data text-ink-2 transition-colors hover:border-edge/60 hover:text-ink">
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="transition-transform duration-state group-open:rotate-90"
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {t("sourcesCount", { count: sources.length })}
      </summary>

      <ol className="flex flex-col gap-2 pt-3">
        {sources.map((source, i) => (
          <li key={source.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* The number is the pointer the answer writes as [1]. */}
                <span className="font-data text-data tabular text-ink-3">[{i + 1}]</span>
                <Badge tone="neutral">{tEntry(`type.${source.type}`)}</Badge>
                <span className="font-data text-data text-ink-3">
                  {new Date(source.createdAt).toISOString().slice(0, 10)}
                </span>
                <span className="font-data text-data text-ink-3">
                  {tHome(`status.${source.status}`)}
                </span>
              </div>
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
    </details>
  );
}
