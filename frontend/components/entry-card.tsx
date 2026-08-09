"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Collapse } from "@/components/motion";
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
// An entry is up to 4000 characters. What the card leads with is the ten words
// the model wrote over it when it was recorded, at reading size, and the text
// the person actually wrote waits behind "show more". Scanning a list is then
// reading ten lines of ten words rather than ten truncated blobs.
//
// Two things can leave an entry without a summary: it was recorded before this
// existed, or the model call failed while the entry was saved anyway. Both fall
// back to the first sentence, which is what the card led with before.

/** The opening sentence, the summary a writer already wrote themselves. */
export function headline(content: string): string {
  const end = /[.!?](\s|$)/.exec(content);
  const first = end ? content.slice(0, end.index + 1) : content;
  return first.length > 140 ? `${first.slice(0, 139)}…` : first;
}

/** What the card says in one line, from the model or from the entry itself. */
export function lead(entry: { summary?: string; content: string }): string {
  return entry.summary?.trim() || headline(entry.content);
}

/**
 * The part of an address before the @. A full address would take most of the
 * metadata line, while the local part is what tells two people on a team
 * apart.
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
  entry: Pick<
    Node,
    "content" | "summary" | "type" | "status" | "createdAt" | "author" | "confirmedBy"
  >;
  /** Date, project, channel. Joined onto the type in the metadata line. */
  meta?: ReactNode;
  actions?: ReactNode;
  showStatus?: boolean;
}) {
  const t = useTranslations("entry");
  const tHome = useTranslations("home");
  const [open, setOpen] = useState(false);
  const line = lead(entry);
  // Nothing to open when the entry is its own lead line, which happens without
  // a summary on a one-sentence entry. A toggle that reveals the same words
  // again is worse than no toggle.
  const more = entry.content.trim() !== line.trim();

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

      {/* The biggest thing on the card, because it is the thing being read. */}
      <p className="pt-3 text-lead text-ink">{line}</p>

      {more ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="pt-3 text-small text-thread underline underline-offset-2"
          >
            {open ? t("showLess") : t("showMore")}
          </button>
          {/* The entry as it was written, in full and unclipped: the summary is
              the model's word for it, this is the record. It grows out of the
              line above rather than replacing it, so the two stay comparable. */}
          <Collapse open={open}>
            <p className="whitespace-pre-wrap pt-3 text-small leading-6 text-ink-2">
              {entry.content}
            </p>
          </Collapse>
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
