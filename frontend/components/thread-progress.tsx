"use client";

import { m, useReducedMotion } from "motion/react";
import { StepMarker } from "./step-marker";
import { useTranslations } from "next-intl";

// The signature, first of its three places, as a band across the top of the
// screen rather than three markers huddled in a corner.
//
// It used to be four 10px squares joined by a hairline, with the fill animated
// by a CSS scaleX. Squares are what made it read as drawn by hand: nothing else
// in this interface has a hard 10px corner, and the thread this app is named
// after is not square. They are knots on a thread now - round, and the one you
// are on wears a ring so the current step is legible without counting.
//
// The drawing is motion's, not CSS's, for one reason worth the swap: a spring
// arrives, a transition ends. The line reaching the next knot and the knot
// filling are one gesture, and staging that on transition-delay was a pair of
// numbers that had to be kept equal by hand.
//
// The written "step 2 of 4" is the information. The line repeats it, which is
// why reduced motion can drop the drawing without losing anything.

const EASE_THREAD = [0.16, 1, 0.3, 1] as const;

export function ThreadProgress({ step }: { step: number }) {
  const t = useTranslations("onboarding");
  const still = useReducedMotion();
  const labels = [t("steps.profile"), t("steps.key"), t("steps.project"), t("steps.agent")];
  // Counted from the labels rather than kept next to them: the two disagreeing
  // is how "step 4 of 3" gets shipped.
  const TOTAL = labels.length;

  return (
    <div className="border-b border-hairline bg-plaster-sunk px-8 py-5">
      <div className="mx-auto flex max-w-[1180px] items-center gap-8">
        <div className="flex flex-1 items-center">
          {labels.map((label, index) => {
            const number = index + 1;
            const done = number < step;
            const current = number === step;
            const reached = number <= step;

            return (
              <div
                key={label}
                className={index === 0 ? "flex items-center" : "flex flex-1 items-center"}
              >
                {index > 0 ? (
                  <span className="relative mx-4 block h-px flex-1 bg-hairline">
                    {/* Grows from the left, so it reads as being pulled forward
                        rather than appearing. */}
                    <m.span
                      className="absolute inset-0 origin-left bg-thread"
                      initial={false}
                      animate={{ scaleX: reached ? 1 : 0 }}
                      transition={
                        still ? { duration: 0 } : { duration: 0.42, ease: EASE_THREAD }
                      }
                    />
                  </span>
                ) : null}

                <span className="flex items-center gap-3">
                  <StepMarker
                    ground="plaster-sunk"
                    state={done ? "done" : current ? "current" : "upcoming"}
                  />
                  <span
                    className={`text-small font-medium tracking-normal transition-colors duration-state ${
                      reached ? "text-ink" : "text-ink-3"
                    }`}
                  >
                    {label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <span aria-live="polite" className="shrink-0 text-data tabular text-ink-3">
          {t("step", { current: String(step), total: String(TOTAL) })}
        </span>
      </div>
    </div>
  );
}
