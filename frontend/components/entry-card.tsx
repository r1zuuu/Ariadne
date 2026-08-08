"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Card, Meta, Status } from "@/components/ui";
import type { Node } from "@/lib/api";

// One recorded entry. Used on the dashboard and in the review queue, which is
// why the actions are a slot rather than a prop: the same entry is read-only in
// one place and decidable in the other.
//
// That difference now decides the shape too. With actions it is a card, because
// a card is a thing you do something to. Without them it is a section between
// hairlines, because a list of ten white rectangles you can only read is four
// screens of packaging around text.
//
// An entry is up to 4000 characters and its first sentence is written as a
// summary, so it leads with that sentence and keeps the rest behind "show more".
// The alternative, a truncated blob, makes ten entries unscannable.

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

/**
 * The part of an address before the @. A metadata line runs in uppercase mono
 * and a full address would take most of it, while the local part is what tells
 * two people on a team apart.
 */
function who(email: string): string {
  return email.split("@")[0];
}

export function EntryCard({
  entry,
  meta,
  actions,
  showStatus = true,
}: {
  entry: Pick<Node, "content" | "type" | "status" | "createdAt" | "author" | "confirmedBy">;
  /** Date, project, channel. Joined onto the type in the metadata line. */
  meta?: ReactNode;
  actions?: ReactNode;
  showStatus?: boolean;
}) {
  const t = useTranslations("entry");
  const tHome = useTranslations("home");
  const [open, setOpen] = useState(false);
  const rest = body(entry.content);

  const inner = (
    <>
      {/* Type and provenance in one metadata line, status in the one label that
          still carries colour, because the status is the part you act on. */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Who wrote it, and for a settled entry who settled it. In an archive
            of one that is your own name twice; in a shared one it is the
            difference between your decision and somebody else's. */}
        <Meta
          items={[
            t(`type.${entry.type}`),
            meta,
            entry.author ? who(entry.author) : null,
            entry.status === "confirmed" && entry.confirmedBy
              ? t("confirmedBy", { at: who(entry.confirmedBy) })
              : null,
          ]}
        />
        {showStatus ? (
          <Status tone={entry.status}>{tHome(`status.${entry.status}`)}</Status>
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
            className="pt-2 text-small text-thread underline underline-offset-2"
          >
            {open ? t("showLess") : t("showMore")}
          </button>
        </>
      ) : null}
    </>
  );

  if (!actions) return <div className="border-b border-hairline pb-6">{inner}</div>;

  return (
    <Card className="p-5">
      {inner}
      <div className="flex flex-wrap gap-3 pt-5">{actions}</div>
    </Card>
  );
}
