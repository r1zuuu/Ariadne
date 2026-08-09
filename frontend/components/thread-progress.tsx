"use client";

import { useTranslations } from "next-intl";

// The signature, first of its three places, as a band across the top of the
// screen rather than three markers huddled in a corner.
//
// DESIGN.md fixes the marker at 10px and the gap at 60px, but the screen sketch
// for step 02 draws the indicator spanning the content width. Those two disagree.
// The marker token wins on size and the sketch wins on span: markers stay 10px,
// the segments stretch. At 60px the whole indicator measured 140px in a 1500px
// window and read as debris rather than as progress.
//
// The written "step 2 of 3" is the information. The line repeats it, which is why
// reduced motion can drop the drawing without losing anything.

export function ThreadProgress({ step }: { step: number }) {
  const t = useTranslations("onboarding");
  const labels = [t("steps.profile"), t("steps.key"), t("steps.project"), t("steps.agent")];
  // Counted from the labels rather than kept next to them: the two disagreeing
  // is how "step 4 of 3" gets shipped.
  const TOTAL = labels.length;

  return (
    <div className="border-b border-hairline bg-plaster-sunk px-8 py-5">
      <div className="mx-auto flex max-w-[1180px] items-center gap-8">
        <div className="flex flex-1 items-center">
          {labels.map((label, index) => {
            const reached = index + 1 <= step;
            return (
              <div key={label} className={index === 0 ? "flex items-center" : "flex flex-1 items-center"}>
                {index > 0 ? (
                  <span className="relative mx-4 block h-px flex-1 bg-hairline">
                    {/* The drawn part of the thread, growing from the left so it
                        reads as being pulled forward. */}
                    <span
                      className="absolute inset-0 origin-left bg-thread transition-transform ease-thread"
                      style={{
                        transform: index + 1 <= step ? "scaleX(1)" : "scaleX(0)",
                        transitionDuration: "var(--duration-thread)",
                      }}
                    />
                  </span>
                ) : null}
                <span className="flex items-center gap-3">
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      // Fills once the segment leading to it has finished drawing.
                      transitionDelay:
                        index + 1 === step && step > 1 ? "var(--duration-thread)" : "0ms",
                    }}
                    className={`block shrink-0 transition-colors duration-state ease-out-quint ${
                      reached ? "bg-thread" : "border border-edge bg-transparent"
                    }`}
                  />
                  <span
                    className={`text-label uppercase tracking-[0.12em] ${
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
