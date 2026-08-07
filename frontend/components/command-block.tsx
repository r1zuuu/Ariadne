"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./ui";

// The one place in the product with a dark background besides the graph, and it
// earns it: this really is a terminal command.
//
// The command stays a single line. A backslash continuation would be the obvious
// visible wrap marker, but it only continues a line in bash and zsh; in
// PowerShell, which is where this will actually be pasted on Windows, it breaks
// the command. So the string is one line and only the display wraps, with a
// hanging indent doing the marking. Whatever is selected by hand is still valid.

const RETURN_AFTER = 4000;

type CopyState = "idle" | "copied" | "unavailable";

// The sentences are the caller's, not this component's: the same block carries a
// full command for Claude Code and a bare token for everything else, and those
// need different words above and below.
export function CommandBlock({
  command,
  what,
  where,
}: {
  command: string;
  what: string;
  where: string;
}) {
  const t = useTranslations("onboarding.agent");
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), RETURN_AFTER);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      // Clipboard needs a secure context and user permission. Saying so beats a
      // button that silently does nothing.
      setState("unavailable");
    }
  };

  return (
    <div>
      <p className="max-w-[68ch] text-small text-ink-2">{what}</p>

      <pre
        className="mt-5 overflow-x-auto bg-canvas px-6 py-5 font-data text-canvas-ink"
        style={{
          fontSize: 14,
          lineHeight: "24px",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          // No ligature should fire inside a shell command; every character has to
          // look like exactly what it is.
          fontVariantLigatures: "none",
          fontFeatureSettings: '"liga" 0, "calt" 0',
          // Martian Mono's hyphen fills nearly the whole cell, so two of them touch
          // and read as one long dash. A little tracking keeps --scope legible as
          // two characters.
          letterSpacing: "0.035em",
          // Wrapped remainder sits in from the left, so a wrap is visible without
          // adding a character that would change what gets pasted.
          textIndent: "-2ch",
          paddingLeft: "calc(var(--spacing-6) + 2ch)",
        }}
      >
        {command}
      </pre>

      <div className="flex items-center gap-6 pt-5">
        <Button variant="secondary" onClick={copy} disabled={state === "unavailable"}>
          {state === "copied" ? t("copied") : t("copy")}
        </Button>
        {state === "unavailable" ? (
          <span className="text-small text-ink-2">{t("copyUnavailable")}</span>
        ) : null}
      </div>

      <p className="max-w-[68ch] pt-6 text-small text-ink-2">{where}</p>
      <p className="max-w-[68ch] pt-3 text-small text-ochre">{t("tokenOnce")}</p>
    </div>
  );
}
