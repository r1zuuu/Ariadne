"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Section } from "@/components/app-shell";
import { FadeIn } from "@/components/motion";
import { IconButton } from "@/components/ui";
import { hasSeenHint, markHintSeen } from "@/lib/first-run";

// One sentence saying what this screen is for, the first time it is opened and
// never again. This is the pull half of the onboarding: the tour explains the
// model once, and each screen explains itself when the reader arrives, which is
// the moment the explanation is worth anything.
//
// Placement is the screen's job. Put it directly under the page heading:
//
//   <ScreenHint screen="assistant" title={t("hintTitle")} note={t("hintNote")} />
//
// `screen` is the key it remembers itself by, so it has to match the section
// name. Dismissing it, or opening the screen a second time, is permanent until
// someone asks to be shown around again from the column.

export function ScreenHint({
  screen,
  title,
  note,
}: {
  screen: Section;
  title: string;
  note?: string;
}) {
  const t = useTranslations("hint");
  // Undecided until mounted: the export is prerendered by Node, which has no
  // localStorage, so rendering the hint during that pass would hand the client
  // different markup and flash it at people who already dismissed it.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hasSeenHint(screen)) setShow(true);
  }, [screen]);

  if (!show) return null;

  const dismiss = () => {
    markHintSeen(screen);
    setShow(false);
  };

  return (
    <FadeIn className="pb-6">
      <div className="flex items-start gap-4 border-l-2 border-blue bg-plaster-sunk/50 py-4 pl-5 pr-3">
        <div className="min-w-0 flex-1">
          <p className="text-small font-medium text-ink">{title}</p>
          {note ? <p className="max-w-[68ch] pt-1 text-small text-ink-2">{note}</p> : null}
        </div>
        <IconButton label={t("dismiss")} onClick={dismiss} className="-mt-1 shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </IconButton>
      </div>
    </FadeIn>
  );
}
