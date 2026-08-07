"use client";

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
      <div className="rounded-card border border-edge/50 bg-surface shadow-card transition-colors duration-state focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/15">
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
          className="block w-full resize-none bg-transparent px-5 pt-4 text-body leading-7 text-ink outline-none placeholder:text-ink-3/60 disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-2">
          <span className="text-data text-ink-3">{hint}</span>
          <Button onClick={() => send(value)} loading={busy} disabled={disabled || !value.trim()}>
            {busy ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>

      {suggestions.length ? (
        <ul className="flex flex-wrap gap-2 pt-4">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => send(suggestion)}
                className="rounded-control border border-hairline bg-surface px-5 py-[7px] text-small text-ink-2 transition-colors duration-state hover:border-edge/60 hover:text-ink disabled:opacity-40"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
