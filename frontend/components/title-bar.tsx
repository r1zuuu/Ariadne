"use client";

import { useTranslations } from "next-intl";
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
    <header
      data-tauri-drag-region
      className="flex h-[38px] shrink-0 select-none items-center justify-between border-b border-hairline bg-plaster-sunk px-5"
    >
      <div className="flex items-baseline gap-4">
        <span className="font-data text-label uppercase tracking-[0.12em] text-ink">Ariadne</span>
        {project ? <span className="text-small text-ink-2">{project}</span> : null}
      </div>
      {/* Words, not a coloured dot: the reader should not have to learn what
          green means before trusting the app. */}
      {server ? (
        <span className={`font-data text-data ${server === "down" ? "text-iron" : "text-ink-3"}`}>
          {t(server, { url: serverUrl.replace(/^https?:\/\//, "") })}
        </span>
      ) : null}
    </header>
  );
}
