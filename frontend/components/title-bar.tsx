"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 38px, plaster-sunk, one hairline underneath. Application name and open project
// on the left, the window controls on the right.
//
// The controls are not rendered outside Tauri: a browser cannot close its own
// window from a button, and a dead control is worse than no control. They arrive
// with the Tauri shell, which also decides their side (right on Windows, left on
// macOS) rather than this component guessing.
//
// The bar used to carry the server's address and whether it answered. That was
// written when the backend ran on the reader's own machine and starting it was
// something they could do. It is hosted now: the address means nothing to the
// person reading it, and "the server answers" is a sentence nobody needs on a
// working day. The one state worth reporting already has a better home, on the
// main screen, as a banner with a retry button and no hostname in it.
export function TitleBar({
  project,
  navOpen,
  onToggleNav,
}: {
  project?: string;
  navOpen?: boolean;
  onToggleNav?: () => void;
}) {
  const tNav = useTranslations("nav");

  return (
    // "deep", not the bare attribute: bare means only direct hits on the header
    // itself drag, so the application name would be a dead spot. Tauri's own
    // handler stops at buttons and links, so the controls stay clickable.
    <header
      data-tauri-drag-region="deep"
      className="flex h-[38px] shrink-0 select-none items-center justify-between border-b border-hairline bg-plaster-sunk px-5"
    >
      <div className="flex items-center gap-4">
        {/* The column folds away from here rather than from inside itself: a
            handle that goes with what it opens has nowhere to live once it is
            gone. Same glyph both ways, with the state in aria-expanded. */}
        {onToggleNav ? (
          <button
            type="button"
            onClick={onToggleNav}
            aria-expanded={navOpen}
            aria-label={tNav(navOpen ? "hideNav" : "showNav")}
            title={tNav(navOpen ? "hideNav" : "showNav")}
            className="-ml-2 grid h-[26px] w-[26px] place-items-center rounded-control text-ink-2 transition-colors duration-state hover:bg-surface hover:text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M6.5 3v10" />
            </svg>
          </button>
        ) : null}
        {/* The wordmark is the one word in the frame allowed the brand face.
            15px keeps the didone's hairlines alive in a 38px bar. */}
        <span className="display-serif text-[15px] tracking-[0.08em] text-ink">ARIADNE</span>
        {project ? <span className="text-small text-ink-2">{project}</span> : null}
      </div>
      <WindowControls />
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
      className={`grid h-[38px] w-11 place-items-center text-ink-2 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-aegean ${
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
