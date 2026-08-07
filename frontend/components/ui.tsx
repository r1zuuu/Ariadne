"use client";

import type { ReactNode } from "react";

// The primitives every screen is built from. One file, because these are small
// and always used together; anything with its own state or data lives on its own.
//
// Two rules hold the system together. Radius comes from the tokens, never from a
// literal, so control and card can never disagree. And a Card is an action unit,
// not a wrapper: something you can decide about gets a card, something you only
// read gets a hairline and some air. Four screens of identical white rectangles
// is what made this app look like every other one.
//
// A warning about the numbers here. globals.css remaps Tailwind's spacing keys
// onto the design system's ten-step scale, so p-5 is 16px and p-6 is 24px, not
// the Tailwind defaults. Steps 1 to 10 are the scale; anything fractional or
// above 10 falls back to rem against a 17px root and lands somewhere arbitrary.
// So padding uses the scale, and every fixed height is written in brackets.

type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";
type ButtonSize = "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue text-white border border-blue hover:bg-blue/90 active:bg-blue",
  secondary: "border border-edge/60 bg-surface text-ink hover:bg-plaster-sunk hover:border-edge",
  quiet: "border border-transparent text-ink-2 hover:bg-plaster-sunk hover:text-ink",
  destructive: "border border-iron/40 bg-surface text-iron hover:bg-iron/8 hover:border-iron",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-[36px] px-5 text-small",
  lg: "h-[44px] px-6 text-body",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables and swaps the label for the caller's busy text. */
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium leading-none transition-colors duration-state ease-out-quint disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`inline-grid h-[36px] w-[36px] place-items-center rounded-control text-ink-2 transition-colors duration-state hover:bg-plaster-sunk hover:text-ink disabled:opacity-40 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

// Label above the field, not beside it. The old two-column grid put a 132px
// monospace column next to every input, which is a database form; a label on top
// reads as a question.
export function Input({
  label,
  error,
  note,
  id,
  ...rest
}: {
  label: string;
  error?: string;
  note?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block pb-2 text-small font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : note ? `${id}-note` : undefined}
        className={`h-[44px] w-full rounded-control border bg-surface px-5 text-body text-ink outline-none transition-colors duration-state placeholder:text-ink-3/60 focus:border-blue focus:ring-2 focus:ring-blue/15 ${
          error ? "border-iron" : "border-edge/60"
        } ${rest.className ?? ""}`}
      />
      <FieldNote id={id} error={error} note={note} />
    </div>
  );
}

export function Textarea({
  label,
  error,
  note,
  id,
  ...rest
}: {
  label: string;
  error?: string;
  note?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="block pb-2 text-small font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : note ? `${id}-note` : undefined}
        className={`w-full resize-y rounded-control border bg-surface px-5 py-4 text-body leading-7 text-ink outline-none transition-colors duration-state placeholder:text-ink-3/60 focus:border-blue focus:ring-2 focus:ring-blue/15 ${
          error ? "border-iron" : "border-edge/60"
        } ${rest.className ?? ""}`}
      />
      <FieldNote id={id} error={error} note={note} />
    </div>
  );
}

function FieldNote({ id, error, note }: { id?: string; error?: string; note?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="pt-2 text-small text-iron">
        {error}
      </p>
    );
  }
  return note ? (
    <p id={`${id}-note`} className="pt-2 text-small text-ink-3">
      {note}
    </p>
  ) : null;
}

export function Card({
  as: Tag = "div",
  interactive = false,
  className = "",
  children,
  ...rest
}: {
  as?: "div" | "section" | "li" | "article";
  /** Adds hover feedback. Only for a card that is itself a control. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      {...rest}
      className={`rounded-card border border-hairline bg-surface shadow-card ${
        interactive ? "transition-colors duration-state hover:bg-surface-2" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

// Heading of a page: one per screen, sets what this place is and what it is for.
export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-5 pb-7">
      <div className="min-w-0">
        <h1 className="text-section text-ink">{title}</h1>
        {lead ? <p className="max-w-[62ch] pt-2 text-body text-ink-2">{lead}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 pb-4">
      <h2 className="flex items-baseline gap-3 text-lead text-ink">
        {title}
        {count !== undefined ? (
          <span className="font-data text-data tabular text-ink-3">{count}</span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}

// Metadata is a voice, not a shape. Type, date, channel, project, technology:
// all of it is the machine's own note about the thing on screen, so it is set in
// uppercase mono and strung together with middle dots. The pills these replaced
// gave four coloured lozenges equal weight to the sentence they described, which
// is the generic AI-tool look and also a lie about the hierarchy.
//
// Falsy items are dropped so a caller can pass a value that may not exist
// without also having to build the separators.
export function Meta({ items }: { items: ReactNode[] }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 font-data text-label uppercase tracking-[0.12em] text-ink-3">
      {shown.map((item, i) => (
        // Index keys: this is a positional list of already-rendered nodes with
        // no identity of their own, and it re-renders whole or not at all.
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 ? (
            <span aria-hidden="true" className="text-ink-3/60">
              ·
            </span>
          ) : null}
          {item}
        </span>
      ))}
    </span>
  );
}

const STATUS_TONES = {
  proposed: "bg-ochre/12 text-ochre",
  confirmed: "bg-blue/10 text-blue",
  contradicted: "bg-iron/10 text-iron",
  archived: "bg-slate/12 text-slate",
} as const;

// The one place a tinted background survives, because a status is the thing the
// reader has to act on and it earns the extra weight the metadata line gives up.
// A small rectangle at 3px, not a pill: the shape says label, not tag.
// Still never colour alone, the word is inside it.
export function Status({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-label px-[6px] py-[2px] font-data text-label uppercase tracking-[0.12em] ${STATUS_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// Says what the emptiness means and what to do about it. An empty state that
// only says "nothing here" leaves the reader wondering whether it is broken.
export function EmptyState({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-edge/40 bg-plaster-sunk/40 px-7 py-9 text-center">
      <p className="text-body font-medium text-ink">{title}</p>
      <p className="mx-auto max-w-[52ch] pt-2 text-small text-ink-2">{note}</p>
      {action ? <div className="flex justify-center pt-5">{action}</div> : null}
    </div>
  );
}

type BannerVariant = "error" | "notice" | "done";

const BANNER_VARIANTS: Record<BannerVariant, string> = {
  error: "border-iron/40 bg-iron/5",
  notice: "border-ochre/40 bg-ochre/5",
  done: "border-blue/40 bg-blue/5",
};

// Always the same three parts in the same order: what happened, what it means
// for you, one action. No warning icon and no apology.
export function Banner({
  variant,
  what,
  means,
  action,
}: {
  variant: BannerVariant;
  what: string;
  means?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-center gap-6 border-b px-8 py-4 ${BANNER_VARIANTS[variant]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-small text-ink">{what}</p>
        {means ? <p className="pt-1 text-small text-ink-2">{means}</p> : null}
      </div>
      {action ? (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

// The old accession-record field: monospace label in a fixed column beside the
// value. Kept for onboarding, which is a record being filled in and reads
// correctly that way. New screens use Input and Textarea.
export function Label({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-data text-label uppercase tracking-[0.12em] text-ink-3"
    >
      {children.length > 24 ? children.slice(0, 24) : children}
    </label>
  );
}

type FieldProps = {
  id: string;
  label: string;
  boxed?: boolean;
  error?: string;
  note?: string;
  children?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({ id, label, boxed = false, error, note, children, ...rest }: FieldProps) {
  const box = boxed
    ? "rounded-control border border-edge/60 bg-surface px-4 py-3"
    : "border-0 bg-transparent px-0 py-3";
  return (
    <div className="grid grid-cols-[132px_1fr] items-baseline gap-x-6 py-2">
      <div className="pt-4">
        <Label htmlFor={id}>{label}</Label>
      </div>
      <div>
        {children ?? (
          <input
            id={id}
            {...rest}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : note ? `${id}-note` : undefined}
            className={`w-full text-body text-ink outline-none placeholder:text-ink-3/70 ${box} ${error ? "border-iron" : ""}`}
          />
        )}
        <FieldNote id={id} error={error} note={note} />
      </div>
    </div>
  );
}
