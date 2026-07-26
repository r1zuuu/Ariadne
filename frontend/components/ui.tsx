"use client";

import type { ReactNode } from "react";

// The three primitives every screen needs. Values come from the component
// inventory in design/spec-text.md; nothing here invents a number.
//
// Note on spacing: the design system's ten-step scale is mapped onto Tailwind's
// spacing keys in globals.css, so p-3 is 8px and p-5 is 16px, not the Tailwind
// defaults. Heights that are not on the scale (38px bar, 34px control) stay
// literal.

type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue text-plaster-raised border border-blue hover:bg-blue/90",
  secondary: "border border-edge text-ink hover:bg-plaster-sunk",
  quiet: "border border-transparent text-ink-2 hover:text-ink",
  destructive: "border border-iron text-iron hover:bg-iron/8",
};

export function Button({
  variant = "primary",
  children,
  ...rest
}: { variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`h-[34px] rounded-control px-5 py-3 text-small font-medium transition-colors duration-state ease-out-quint disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_VARIANTS[variant]} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

// A monospace label is capped at 24 characters: tracked caps any longer wrap to
// two lines and stop reading as a label.
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
  /** Boxless in the accession layout of screens 01 and 02b, boxed inside the app. */
  boxed?: boolean;
  /** Written under the field, never signalled by border colour alone. */
  error?: string;
  /** Says in words that the field may stay empty, or that it must not. */
  note?: string;
  children?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({ id, label, boxed = false, error, note, children, ...rest }: FieldProps) {
  const box = boxed
    ? "rounded-control border border-edge bg-plaster-raised px-4 py-3"
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
        {error ? (
          <p id={`${id}-error`} className="pt-2 text-small text-iron">
            {error}
          </p>
        ) : note ? (
          <p id={`${id}-note`} className="pt-2 text-small text-ink-3">
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type BannerVariant = "error" | "notice" | "done";

const BANNER_VARIANTS: Record<BannerVariant, string> = {
  error: "border-iron",
  notice: "border-ochre",
  done: "border-blue",
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
      className={`flex items-center gap-6 border-b bg-plaster-sunk px-8 py-4 ${BANNER_VARIANTS[variant]}`}
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
