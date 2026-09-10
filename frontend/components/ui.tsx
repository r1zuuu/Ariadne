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
type ButtonSize = "sm" | "md" | "lg";

// Primary is the thread: the one brand colour belongs to the strongest action on
// the screen and to nothing decorative, which is what keeps it precious.
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-thread text-plaster border border-thread/80 shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-thread-deep hover:border-thread-deep active:bg-thread-press",
  secondary:
    "border border-edge/60 bg-surface/80 text-ink shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-surface hover:border-edge active:bg-plaster-sunk",
  quiet: "border border-transparent text-ink-2 hover:bg-surface/70 hover:text-ink",
  destructive: "border border-iron/40 bg-surface/80 text-iron hover:bg-iron/10 hover:border-iron",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-[30px] px-3.5 text-data",
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
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium leading-none transition-[background-color,border-color,color,scale,box-shadow] duration-state ease-out-quint active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${rest.className ?? ""}`}
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
  icon,
  className = "",
  ...rest
}: {
  label?: string;
  error?: string;
  note?: string;
  id?: string;
  icon?: ReactNode;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="w-full text-left">
      {label ? (
        <label htmlFor={id} className="block pb-2 text-small font-medium text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {icon ? (
          <span className="pointer-events-none absolute left-4 flex items-center text-ink-3">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          {...rest}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : note ? `${id}-note` : undefined}
          // The padding that clears the icon is in brackets on purpose. `pl-10`
          // is not 40px in this app: globals.css remaps Tailwind's spacing keys
          // onto the design scale, where step 10 is 112px - the entry plate. So
          // every field with an icon carried 112px of left padding and its
          // placeholder sat in the middle of the box looking deliberately
          // centred, which is what the search field on the task screen was
          // reported as. 12px of gutter, a 15px mark, 8px of air.
          className={`h-[42px] w-full rounded-control border bg-surface/80 text-left text-body text-ink outline-none transition-all duration-state placeholder:text-left placeholder:text-ink-3 hover:border-edge focus:border-thread focus:bg-surface focus:ring-2 focus:ring-thread/25 ${
            icon ? "pl-[35px] pr-4" : "px-4"
          } ${error ? "border-iron" : "border-edge/60"} ${className}`}
        />
      </div>
      <FieldNote id={id} error={error} note={note} />
    </div>
  );
}

export function Select({
  id,
  label,
  value,
  options,
  error,
  note,
  onChange,
  className = "",
}: {
  id: string;
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  error?: string;
  note?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="block pb-2 text-small font-medium text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-[44px] w-full appearance-none rounded-control border bg-surface/80 px-4 pr-10 text-body text-ink outline-none transition-all duration-state hover:border-edge focus:border-thread focus:bg-surface focus:ring-2 focus:ring-thread/25 ${
            error ? "border-iron" : "border-edge/60"
          } ${className}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface text-ink">
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3.5 flex items-center text-ink-3">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </div>
      </div>
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
  label?: string;
  error?: string;
  note?: string;
  id?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="block pb-2 text-small font-medium text-ink">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : note ? `${id}-note` : undefined}
        className={`w-full resize-y rounded-control border bg-surface/80 px-4 py-3 text-body leading-7 text-ink outline-none transition-all duration-state placeholder:text-ink-3 hover:border-edge focus:border-thread focus:bg-surface focus:ring-2 focus:ring-thread/25 ${
          error ? "border-iron" : "border-edge/60"
        } ${rest.className ?? ""}`}
      />
      <FieldNote id={id} error={error} note={note} />
    </div>
  );
}

// Both carry a measure. They are the last prose in the system that had none, and
// they sit inside a card that is as wide as the screen allows, so a note under a
// field was running to 111 characters while every paragraph beside it held 66.
function FieldNote({ id, error, note }: { id?: string; error?: string; note?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="measure pt-2 text-small text-iron">
        {error}
      </p>
    );
  }
  return note ? (
    <p id={`${id}-note`} className="measure pt-2 text-small text-ink-3">
      {note}
    </p>
  ) : null;
}

// The name of a card, one step above the labels inside it.
export function CardTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-body font-medium text-ink">
      {children}
    </p>
  );
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
      className={`rounded-card border border-edge/40 bg-surface/70 shadow-card backdrop-blur-sm ${
        interactive ? "transition-colors duration-state hover:bg-surface/90 hover:border-edge" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

// Heading of a page: one per screen, sets what this place is and what it is for.
//
// Two sizes, and the split is what the reader does on the screen rather than a
// preference. `display` is a screen you arrive at and read - the overview, the
// project, an archive. `work` is a screen you use: a list you scan, a guide you
// follow. At the display step the title alone is 64px over a two-line lead, so
// on a task screen the tools start below the fold and the button beside it
// aligns with the lead instead of with the name of the page. Same face, two
// steps down, action on the title's own line.
export function PageHeader({
  title,
  lead,
  actions,
  size = "display",
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  size?: "display" | "work";
}) {
  if (size === "work") {
    return (
      <div className="pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="min-w-0 text-title text-ink">{title}</h1>
          {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
        </div>
        {lead ? <p className="measure pt-2 text-small text-ink-2">{lead}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-5 pb-7 pt-6">
      <div className="min-w-0">
        <h1 className="max-w-[14ch] text-display text-ink">{title}</h1>
        {lead ? <p className="measure pt-3 text-body text-ink-2">{lead}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-3 pb-2">{actions}</div> : null}
    </div>
  );
}

// The icon is a finding aid, never the name. It rides beside the heading in the
// metadata tone so the section is locatable on the second visit without the
// mark ever competing with the word it sits next to - and without spending one
// accent on structure, which the accent does not mean. It belongs on
// the screens you scroll looking for one section, and nowhere else; the rule is
// written down in DESIGN.md so the next screen does not decide for itself.
//
// The note is the line that says what the section is for. Three screens were
// hand-rolling the same paragraph under the same heading with a different
// padding each time, one of them cancelling this component's own with a
// negative margin.
export function SectionHeader({
  title,
  count,
  icon,
  note,
  action,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pb-4">
      <div className="flex items-baseline justify-between gap-4">
        {/* The gap between the words and the count is drawn by flex, and CSS gaps
            do not put a space into the accessible name: the heading was computed
            as "Tokeny agentow1". Naming the heading outright is the only way to
            be sure of the separator. */}
        <h2
          aria-label={count !== undefined ? `${title} ${count}` : undefined}
          className="flex items-baseline gap-3 text-section text-ink"
        >
          {icon ? <span className="self-center text-ink-2">{icon}</span> : null}
          {title}
          {count !== undefined ? (
            <span aria-hidden="true" className="font-prose text-data tabular text-ink-3">
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      {note ? <p className="measure pt-2 text-small text-ink-2">{note}</p> : null}
    </div>
  );
}

// Metadata is a voice, not a shape. Type, date, channel, project, technology:
// one quiet line in Geist, strung together with middle dots. Neither the pills
// this replaced two redesigns ago nor the uppercase mono it replaced now: the
// mono read as debug output, and a date is something a person reads.
//
// Falsy items are dropped so a caller can pass a value that may not exist
// without also having to build the separators.
export function Meta({ items }: { items: ReactNode[] }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-data text-ink-3">
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
  proposed: "bg-ochre/12 text-ochre border border-ochre/25",
  confirmed: "bg-laurel/12 text-laurel border border-laurel/25",
  contradicted: "bg-iron/12 text-iron border border-iron/25",
  archived: "bg-stone/12 text-stone border border-stone/25",
  todo: "bg-ochre/12 text-ochre border border-ochre/25",
  in_progress: "bg-aegean/12 text-aegean border border-aegean/25",
  blocked: "bg-iron/12 text-iron border border-iron/25",
  done: "bg-laurel/12 text-laurel border border-laurel/25",
} as const;

// Calm, semantic status mark: clean dots and shapes that read naturally
// on dark surfaces without decorative noise.
export function StatusMark({ tone }: { tone: keyof typeof STATUS_TONES }) {
  const shared = {
    width: 8,
    height: 8,
    viewBox: "0 0 8 8",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: "shrink-0",
  };
  switch (tone) {
    case "proposed":
    case "todo":
      return (
        <svg {...shared}>
          <circle cx="4" cy="4" r="2.8" strokeWidth="1.4" />
        </svg>
      );
    case "in_progress":
      return (
        <svg {...shared}>
          <circle cx="4" cy="4" r="2.8" strokeWidth="1.2" strokeDasharray="4 2" />
          <circle cx="4" cy="4" r="1.2" fill="currentColor" />
        </svg>
      );
    case "confirmed":
    case "done":
      return (
        <svg {...shared}>
          <circle cx="4" cy="4" r="3" fill="currentColor" />
        </svg>
      );
    case "contradicted":
    case "blocked":
      return (
        <svg {...shared}>
          <circle cx="4" cy="4" r="2.8" strokeWidth="1.2" />
          <path d="M2.2 2.2 5.8 5.8" strokeWidth="1.4" />
        </svg>
      );
    case "archived":
      return (
        <svg {...shared}>
          <path d="M1.5 4h5" strokeWidth="1.6" />
        </svg>
      );
  }
}

// A calm, semantic badge in sentence case. No uppercase shouting, no aggressive letter-spacing.
export function Status({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control px-2 py-0.5 text-data font-medium leading-tight ${STATUS_TONES[tone]}`}
    >
      <StatusMark tone={tone} />
      <span>{children}</span>
    </span>
  );
}

export type EmptyStateIllustration = "tasks" | "notifications" | "context" | "pending" | "compact";

const EMPTY_STATE_ILLUSTRATIONS: Record<Exclude<EmptyStateIllustration, "compact">, string> = {
  tasks: "/resources/empty-states/no-tasks.png",
  notifications: "/resources/empty-states/no-notifications.png",
  context: "/resources/empty-states/no-context.png",
  pending: "/resources/empty-states/no-pending-decisions.png",
};

// Says what the emptiness means and what to do about it.
// Integrates high-res friendly fox illustrations with dark graphite glow and clear typography.
export function EmptyState({
  title,
  note,
  action,
  illustration,
}: {
  title: string;
  note: string;
  action?: ReactNode;
  illustration?: EmptyStateIllustration | ReactNode;
}) {
  let imgSrc: string | null = null;
  if (illustration === "tasks") {
    imgSrc = EMPTY_STATE_ILLUSTRATIONS.tasks;
  } else if (illustration === "notifications") {
    imgSrc = EMPTY_STATE_ILLUSTRATIONS.notifications;
  } else if (illustration === "context") {
    imgSrc = EMPTY_STATE_ILLUSTRATIONS.context;
  } else if (illustration === "pending") {
    imgSrc = EMPTY_STATE_ILLUSTRATIONS.pending;
  } else if (illustration === "compact") {
    imgSrc = EMPTY_STATE_ILLUSTRATIONS.context;
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {imgSrc ? (
        <div className="mb-6 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt=""
            width={260}
            height={173}
            className="h-auto max-h-[190px] w-auto max-w-[220px] object-contain select-none sm:max-w-[260px]"
          />
        </div>
      ) : illustration && typeof illustration !== "string" ? (
        <div className="mb-5 flex justify-center text-thread">{illustration}</div>
      ) : null}

      <h3 className="font-heading font-semibold text-lead text-ink tracking-normal sm:text-title">
        {title}
      </h3>
      <p className="mx-auto measure pt-2.5 text-small text-ink-2 leading-relaxed">{note}</p>
      {action ? <div className="flex justify-center pt-6">{action}</div> : null}
    </div>
  );
}

type BannerVariant = "error" | "notice" | "done";

const BANNER_VARIANTS: Record<BannerVariant, string> = {
  error: "border-iron/40 bg-iron/5",
  notice: "border-ochre-mark/40 bg-ochre-mark/5",
  done: "border-aegean/40 bg-aegean/5",
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
        <p className="measure text-small text-ink">{what}</p>
        {means ? <p className="measure pt-1 text-small text-ink-2">{means}</p> : null}
      </div>
      {action ? (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

// Clean semantic label for form elements and groups.
export function Label({
  children,
  htmlFor,
  className = "",
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-small font-medium text-ink ${className}`}
    >
      {children}
    </label>
  );
}

type FieldProps = {
  id: string;
  label: string;
  boxed?: boolean;
  error?: string;
  note?: string;
  /**
   * Aligns the label to the top of the row instead of to the control's baseline.
   *
   * Baseline is right for a one-line input and wrong for anything taller: a
   * textarea's baseline sits at its bottom edge, so the label slid down past the
   * field it names and came to rest between that field and the button under it,
   * reading as a heading for the wrong thing.
   */
  alignTop?: boolean;
  children?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({
  id,
  label,
  boxed = false,
  error,
  note,
  alignTop = false,
  children,
  ...rest
}: FieldProps) {
  const box = boxed
    ? "rounded-control border border-edge/60 bg-surface px-4 py-3"
    : "border-0 bg-transparent px-0 py-3";
  return (
    <div
      className={`grid grid-cols-[132px_1fr] gap-x-6 py-2 ${alignTop ? "items-start" : "items-baseline"}`}
    >
      <div className="pt-4">
        <Label htmlFor={id}>{label}</Label>
      </div>
      <div>
        {/* Full ink-3, not ink-3/70. At seventy percent a placeholder came out at
            2.6:1 against a boxed field, under the 3:1 floor, and in this wizard
            the placeholder is the only example of what the field wants - the
            repository address most of all. Every other input in the app uses the
            solid value; these two were the exceptions. */}
        {children ?? (
          <input
            id={id}
            {...rest}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : note ? `${id}-note` : undefined}
            className={`w-full text-body text-ink outline-none placeholder:text-ink-3 ${box} ${error ? "border-iron" : ""}`}
          />
        )}
        <FieldNote id={id} error={error} note={note} />
      </div>
    </div>
  );
}
