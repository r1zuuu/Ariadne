"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AppShell, readActiveProject } from "@/components/app-shell";
import { StatusMark } from "@/components/status-mark";
import { Button } from "@/components/ui";
import { chatQuery, type Source } from "@/lib/api";

// Screen 05. Ask about the project's past and get an answer built only from
// what was recorded, with the entries it came from listed underneath.
//
// The sources arrive before the first word and stay on screen while the answer
// writes itself. That order is the point of the screen: the citation is not a
// footnote to the answer, it is the reason to believe it.

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

  useEffect(() => setProjectId(readActiveProject()), []);

  // Follows the answer as it grows. Only while streaming, so a reader scrolling
  // back through an old turn is not yanked to the bottom.
  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    const asked = question.trim();
    if (!asked || !projectId || busy) return;

    setQuestion("");
    setBusy(true);
    const index = turns.length;
    setTurns((prev) => [...prev, { question: asked, sources: [], answer: "", done: false }]);

    // Each chunk patches one turn in place rather than rebuilding the list, so
    // a second question started before the first finished cannot cross wires.
    const patch = (change: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn, i) => (i === index ? { ...turn, ...change } : turn)));

    try {
      for await (const chunk of chatQuery(projectId, asked)) {
        if (chunk.type === "sources") patch({ sources: chunk.sources });
        if (chunk.type === "error") patch({ error: chunk.message });
        if (chunk.type === "delta") {
          setTurns((prev) =>
            prev.map((turn, i) => (i === index ? { ...turn, answer: turn.answer + chunk.text } : turn)),
          );
        }
      }
    } catch (caught) {
      patch({ error: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      patch({ done: true });
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-section">{t("title")}</h1>

        <div className="pt-6">
          {turns.length === 0 ? (
            <p className="max-w-[68ch] text-body text-ink-2">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-9">
              {turns.map((turn, i) => (
                <li key={i}>
                  <p className="text-lead text-ink">{turn.question}</p>

                  {turn.error ? (
                    <p className="pt-4 text-body text-iron">{turn.error}</p>
                  ) : turn.sources.length === 0 && turn.done ? (
                    <p className="pt-4 text-body text-ink-2">{t("nothingRecorded")}</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap pt-4 text-body text-ink">
                        {turn.answer}
                        {/* A caret while the text is still arriving, so a pause
                            between chunks does not read as a finished answer. */}
                        {!turn.done ? <span className="text-ink-3">▍</span> : null}
                      </p>
                      {turn.sources.length ? (
                        <Sources sources={turn.sources} label={t("sources")} />
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div ref={endRef} />
        </div>

        {/* Stuck to the bottom of the scrolling pane rather than fighting the
            answer for height. The negative margin and padding let the page
            background run under it, so text scrolls out of sight behind the
            field instead of colliding with it. */}
        <form
          onSubmit={ask}
          className="sticky bottom-0 -mx-8 -mb-9 mt-7 flex items-end gap-4 border-t border-hairline bg-plaster px-8 py-5"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("placeholder")}
            disabled={!projectId}
            className="flex-1 border-b border-edge bg-transparent pb-2 text-body text-ink outline-none transition-colors placeholder:text-ink-3/55 focus:border-blue"
          />
          <Button type="submit" disabled={busy || !question.trim() || !projectId}>
            {busy ? t("asking") : t("ask")}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

// Numbered to match the [1] markers the model writes into the answer, which is
// the whole mechanism: the number in the prose is a pointer into this list.
function Sources({ sources, label }: { sources: Source[]; label: string }) {
  const t = useTranslations("home");
  return (
    <div className="pt-5">
      <p className="font-data text-label uppercase tracking-[0.12em] text-ink-3">{label}</p>
      <ol className="mt-3 border-t border-hairline">
        {sources.map((source, i) => (
          <li key={source.id} className="flex gap-4 border-b border-hairline py-3">
            <span className="font-data text-data tabular text-ink-3">[{i + 1}]</span>
            <span className="translate-y-[5px]">
              <StatusMark status={source.status} label={t(`status.${source.status}`)} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-small text-ink-2">{source.content}</p>
              <p className="pt-1 font-data text-data text-ink-3">
                {new Date(source.createdAt).toISOString().slice(0, 10)}
                {source.anchors?.length ? ` · ${source.anchors.map((a) => a.path).join(", ")}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
