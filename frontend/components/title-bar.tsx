"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { serverUrl } from "@/lib/api";

// 38px, plaster-sunk, one hairline underneath. Application name and open project
// on the left, server state in words plus the window controls on the right.
//
// The controls are not rendered outside Tauri: a browser cannot close its own
// window from a button, and a dead control is worse than no control. They arrive
// with the Tauri shell, which also decides their side (right on Windows, left on
// macOS) rather than this component guessing.

export type ServerState = "checking" | "up" | "down";

// Screen 01 puts the server line under the form, where the eye already is when
// the button will not submit, so the bar leaves it out there rather than saying
// the same thing twice on one screen.
export function TitleBar({ project, server }: { project?: string; server?: ServerState }) {
  const t = useTranslations("auth.server");

  return (
    // "deep", not the bare attribute: bare means only direct hits on the header
    // itself drag, so the application name would be a dead spot. Tauri's own
    // handler stops at buttons and links, so the controls stay clickable.
    <header
      data-tauri-drag-region="deep"
      className="flex h-[38px] shrink-0 select-none items-center justify-between border-b border-hairline bg-plaster-sunk px-5"
    >
      <div className="flex items-baseline gap-4">
        {/* The wordmark is the one word in the frame allowed the brand face.
            15px keeps the didone's hairlines alive in a 38px bar. */}
        <span className="display-serif text-[15px] tracking-[0.08em] text-ink">ARIADNE</span>
        {project ? <span className="text-small text-ink-2">{project}</span> : null}
      </div>
      <div className="flex items-center gap-5">
        {/* Words, not a coloured dot: the reader should not have to learn what
            green means before trusting the app. */}
        {server ? (
          <span className={`text-data ${server === "down" ? "text-iron" : "text-ink-3"}`}>
            {t(server, { url: serverUrl.replace(/^https?:\/\//, "") })}
          </span>
        ) : null}
        <WindowControls />
      </div>
    </header>
  );
}

// Windows keeps its controls on the right, which is where this bar puts them.
// macOS keeps them on the left and draws its own; the day this runs there, the
// window keeps its decorations and this returns nothing.
function WindowControls() {
  const t = useTranslations("app.window");
  // Rendered only inside the shell: a browser tab cannot close its own window,
  // and a control that does nothing is worse than no control at all. Read after
  // mount, not during render: the export is prerendered by Node, where there is
  // no shell, so asking during render hands the client different markup.
  const [inShell, setInShell] = useState(false);
  useEffect(() => setInShell(isTauri()), []);

  if (!inShell) return null;

  return (
    <div className="-mr-2 flex items-center">
      <ControlButton label={t("minimize")} onClick={() => getCurrentWindow().minimize()}>
        <line x1="3" y1="8" x2="13" y2="8" />
      </ControlButton>
      <ControlButton label={t("maximize")} onClick={() => getCurrentWindow().toggleMaximize()}>
        <rect x="3.5" y="3.5" width="9" height="9" />
      </ControlButton>
      <ControlButton label={t("close")} onClick={() => getCurrentWindow().close()} danger>
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
        <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-[38px] w-11 place-items-center text-ink-2 transition-colors hover:bg-plaster-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-thread ${
        danger ? "hover:text-iron" : "hover:text-ink"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
