"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Section } from "@/components/app-shell";
import { FadeIn } from "@/components/motion";
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
    // A guide's aside, not a banner: one quiet line under the heading, marked
    // by a thread dot, dismissed in words. It stopped being a tinted box that
    // pushed every page's real content down a row.
    <FadeIn className="pb-6">
      <p className="flex max-w-[74ch] items-baseline gap-3 text-small text-ink-2">
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 translate-y-[-2px] rounded-pill bg-thread" />
        <span className="min-w-0">
          <span className="font-medium text-ink">{title}</span>
          {note ? <> {note}</> : null}{" "}
          <button
            type="button"
            onClick={dismiss}
            className="whitespace-nowrap text-ink-3 underline underline-offset-2 transition-colors duration-state hover:text-ink"
          >
            {t("dismiss")}
          </button>
        </span>
      </p>
    </FadeIn>
  );
}
