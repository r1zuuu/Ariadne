"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

// The one place a person types at Ariadne. Three screens use it: the dashboard
// to start a question, the assistant to continue one, the context screen to
// describe a change.
//
// A textarea in every case, not an input, because two of the three take a
// paragraph and a single-line field silently tells the reader to be brief.
// Enter sends and Shift+Enter breaks the line, which is what a chat does; the
// hint under the field says so rather than leaving it to be discovered.

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  busyLabel,
  hint,
  busy = false,
  disabled = false,
  suggestions = [],
  rows = 3,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Receives the text explicitly, so a suggestion can send without waiting for
      the state it just set to come back round as a prop. */
  onSubmit: (text: string) => void;
  placeholder: string;
  submitLabel: string;
  busyLabel: string;
  hint?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Clicking one fills the field and sends it, so a first question costs one click. */
  suggestions?: string[];
  rows?: number;
  autoFocus?: boolean;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  // Grows with the text up to a ceiling, so a long paragraph is visible while
  // being written but the field never eats the conversation above it.
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    setHeight(Math.min(el.scrollHeight, 220));
  }, [value]);

  const send = (text: string) => {
    if (!text.trim() || busy || disabled) return;
    onSubmit(text.trim());
  };

  return (
    <div>
      {/* The most important object in the product, and the one thing allowed to
          borrow the thread while it is awake: focus pulls the left edge taut
          in madder and lifts the paper. Everything else on screen stays flat. */}
      <div className="group relative rounded-card border border-edge/80 bg-elevated shadow-lifted transition-[border-color,box-shadow] duration-state focus-within:border-thread">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[10px] left-0 top-[10px] w-[2px] origin-top scale-y-0 bg-thread transition-transform duration-enter ease-out-quint group-focus-within:scale-y-100"
        />
        <textarea
          ref={field}
          rows={rows}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(value);
            }
          }}
          placeholder={placeholder}
          style={{ height }}
          className="block w-full resize-none bg-transparent px-6 pt-5 text-body leading-7 text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-4 px-6 pb-4 pt-2">
          <span className="text-data text-ink-2">{hint}</span>
          <Button onClick={() => send(value)} loading={busy} disabled={disabled || !value.trim()}>
            {busy ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>

      {/* Four ways in, for somebody looking at an empty field with nothing to
          ask yet. They were a bulleted list in two ragged columns and read as
          fine print under the composer rather than as things to press.

          Each one repeats the composer's own gesture: a thread drawn taut up
          the left edge, the same 2px thread bar that appears there on focus.
          That is what makes these read as part of the same object rather than
          as a list that happens to sit under it. */}
      {suggestions.length ? (
        <ul className="mx-auto grid max-w-[680px] gap-3 pt-6 sm:grid-cols-2">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion}>
              <m.button
                type="button"
                disabled={disabled || busy}
                onClick={() => send(suggestion)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className="group relative flex h-full w-full items-center gap-3 overflow-hidden rounded-card border border-edge/50 bg-surface px-5 py-4 text-left text-small text-ink-2 transition-colors duration-state hover:border-edge hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  aria-hidden="true"
                  className="absolute bottom-[10px] left-0 top-[10px] w-[2px] origin-top scale-y-0 bg-thread transition-transform duration-enter ease-out-quint group-hover:scale-y-100"
                />
                <span className="min-w-0 flex-1">{suggestion}</span>
                {/* Points where pressing it takes you, and only leans that way
                    once the pointer is on it. */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 text-ink-3 transition-[color,transform] duration-state ease-out-quint group-hover:translate-x-[3px] group-hover:text-thread"
                >
                  <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" />
                </svg>
              </m.button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
