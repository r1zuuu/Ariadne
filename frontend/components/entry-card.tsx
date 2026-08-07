"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import type { Node, NodeStatus } from "@/lib/api";

// One recorded entry, shown as a card. Used on the dashboard and in the review
// queue, which is why the actions are a slot rather than a prop: the same entry
// is read-only in one place and decidable in the other.
//
// An entry is up to 4000 characters and its first sentence is written as a
// summary, so the card leads with that sentence and keeps the rest behind
// "show more". The alternative, a truncated blob, makes ten cards unscannable.

const TYPE_TONE = {
  decision: "blue",
  session_summary: "neutral",
  note: "neutral",
} as const;

const STATUS_TONE: Record<NodeStatus, "blue" | "ochre" | "iron" | "slate"> = {
  confirmed: "blue",
  proposed: "ochre",
  contradicted: "iron",
  archived: "slate",
};

/** The opening sentence, which is the headline the writer already wrote. */
export function headline(content: string): string {
  const end = /[.!?](\s|$)/.exec(content);
  const first = end ? content.slice(0, end.index + 1) : content;
  return first.length > 140 ? `${first.slice(0, 139)}…` : first;
}

/** Everything after the headline, or nothing when the entry is one sentence. */
function body(content: string): string {
  const end = /[.!?](\s|$)/.exec(content);
  return end ? content.slice(end.index + 1).trim() : "";
}

export function EntryCard({
  entry,
  meta,
  actions,
  showStatus = true,
}: {
  entry: Pick<Node, "content" | "type" | "status" | "createdAt">;
  /** Project, date, channel. Rendered in mono under the text. */
  meta?: ReactNode;
  actions?: ReactNode;
  showStatus?: boolean;
}) {
  const t = useTranslations("entry");
  const tHome = useTranslations("home");
  const [open, setOpen] = useState(false);
  const rest = body(entry.content);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TYPE_TONE[entry.type] ?? "neutral"}>{t(`type.${entry.type}`)}</Badge>
        {showStatus ? (
          <Badge tone={STATUS_TONE[entry.status]}>{tHome(`status.${entry.status}`)}</Badge>
        ) : null}
      </div>

      <p className="pt-3 text-body font-medium leading-7 text-ink">{headline(entry.content)}</p>

      {rest ? (
        <>
          {/* The clamp class is written out, not interpolated: Tailwind scans
              source text and never sees a class built at runtime. */}
          <p
            className={`whitespace-pre-wrap pt-2 text-small leading-6 text-ink-2 ${
              open ? "" : "line-clamp-3"
            }`}
          >
            {rest}
          </p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="pt-2 text-small text-blue underline underline-offset-2"
          >
            {open ? t("showLess") : t("showMore")}
          </button>
        </>
      ) : null}

      {meta ? <div className="pt-4 font-data text-data text-ink-3">{meta}</div> : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-4">{actions}</div> : null}
    </Card>
  );
}
