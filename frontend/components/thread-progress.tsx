"use client";

import { m, useReducedMotion } from "motion/react";
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
                  <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center">
                    {/* The ring belongs to the step you are on and nothing else.
                        Drawn outside the knot so the knot keeps its size and the
                        row keeps its rhythm. */}
                    {current ? (
                      <m.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-pill border border-thread/50"
                        initial={still ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, ease: EASE_THREAD }}
                      />
                    ) : null}
                    <m.span
                      className={`block h-[9px] w-[9px] rounded-pill ${
                        reached ? "bg-thread" : "border border-edge bg-transparent"
                      }`}
                      initial={false}
                      // Waits for the segment before it to finish drawing, so the
                      // line arriving and the knot tying are one movement.
                      animate={{ scale: done || current ? 1 : 0.85 }}
                      transition={
                        still
                          ? { duration: 0 }
                          : { duration: 0.24, ease: EASE_THREAD, delay: current && step > 1 ? 0.34 : 0 }
                      }
                    />
                  </span>
                  <span
                    className={`text-label uppercase tracking-[0.12em] transition-colors duration-state ${
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
