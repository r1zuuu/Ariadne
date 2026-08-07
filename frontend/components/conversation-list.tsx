"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Collapse } from "@/components/motion";
import { Button, EmptyState, Meta } from "@/components/ui";
import type { ConversationSummary } from "@/lib/api";

// Past conversations, for both chats. A flat list of titles newest first, which
// is what Claude does under "Recents"; ChatGPT's Today / Yesterday / Previous 7
// days buckets only start earning their keep once there are more conversations
// than fit on a screen, and there are four.
//
// Collapsed by default once a conversation is open, because at that point the
// list is a way back rather than the thing you came for.

export function ConversationList({
  conversations,
  activeId,
  onOpen,
  onNew,
  collapsible,
  labels,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Open on an empty screen, behind a toggle once a conversation is showing. */
  collapsible: boolean;
  labels: { title: string; newOne: string; empty: string; emptyNote: string };
}) {
  const [open, setOpen] = useState(!collapsible);

  const list = (
    <>
      {conversations.length === 0 ? (
        <EmptyState title={labels.empty} note={labels.emptyNote} />
      ) : (
        <ul className="border-t border-hairline">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onOpen(conversation.id)}
                aria-current={conversation.id === activeId ? "true" : undefined}
                className={`flex w-full flex-col items-start gap-1 border-b border-hairline px-4 py-3 text-left transition-colors duration-state hover:bg-plaster-sunk/60 ${
                  conversation.id === activeId ? "bg-plaster-sunk/60" : ""
                }`}
              >
                <span className="line-clamp-1 text-small text-ink">{conversation.title}</span>
                <Meta items={[new Date(conversation.updatedAt).toISOString().slice(0, 10)]} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 pb-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="text-small text-ink-2 transition-colors duration-state hover:text-ink"
          >
            {labels.title} ({conversations.length})
          </button>
        ) : (
          <h2 className="text-lead text-ink">{labels.title}</h2>
        )}
        <Button variant="quiet" onClick={onNew}>
          {labels.newOne}
        </Button>
      </div>

      {collapsible ? <Collapse open={open}>{list}</Collapse> : list}
    </section>
  );
}
