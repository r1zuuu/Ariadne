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
      {/* The most important object in the product, and the one thing allowed to
          borrow the thread while it is awake: focus pulls the left edge taut
          in madder and lifts the paper. Everything else on screen stays flat. */}
      <div className="group relative rounded-card border border-edge/80 bg-elevated shadow-lifted transition-[border-color,box-shadow] duration-state focus-within:border-aegean">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[10px] left-0 top-[10px] w-[2px] origin-top scale-y-0 bg-aegean transition-transform duration-enter ease-out-quint group-focus-within:scale-y-100"
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

      {/* Questions, not chips: each suggestion reads as a line you could have
          written, marked by the thread taking it up on hover.

          A grid, not wrapped centring. Four centred lines of different lengths
          made two rows that shared no edge with each other and none with the
          composer above them. */}
      {suggestions.length ? (
        <ul className="mx-auto grid max-w-[620px] grid-cols-1 gap-x-8 gap-y-1 pt-4 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => send(suggestion)}
                className="group inline-flex items-center gap-2 py-2 text-small text-ink-2 transition-colors duration-state hover:text-ink disabled:opacity-40"
              >
                <span
                  aria-hidden="true"
                  className="h-[5px] w-[5px] rounded-pill bg-edge/70 transition-colors duration-state group-hover:bg-thread"
                />
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
