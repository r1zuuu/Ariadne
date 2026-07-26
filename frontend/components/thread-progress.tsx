"use client";

import { useTranslations } from "next-intl";

// The signature, first of its three places. Three 10px markers 60px apart. The
// thread is drawn only as far as the step you are on; past that the line is
// hairline and carries no meaning.
//
// The written "step 2 of 3" is not a caption, it is the information. The line
// only repeats it, which is why reduced motion can drop the drawing entirely
// without anything being lost.

const MARKER = 10;
const GAP = 60;
const TOTAL = 3;

export function ThreadProgress({ step }: { step: 1 | 2 | 3 }) {
  const t = useTranslations("onboarding");
  const labels = [t("steps.profile"), t("steps.project"), t("steps.agent")];

  return (
    <div>
      <div className="flex items-center" role="presentation">
        {labels.map((label, index) => {
          const reached = index + 1 <= step;
          return (
            <div key={label} className="flex items-center">
              <span
                style={{
                  width: MARKER,
                  height: MARKER,
                  // Fills once the segment leading to it has finished drawing.
                  transitionDelay: index + 1 === step && step > 1 ? "var(--duration-thread)" : "0ms",
                }}
                className={`block shrink-0 transition-colors duration-state ease-out-quint ${
                  reached ? "bg-blue" : "border border-edge bg-transparent"
                }`}
              />
              {index < TOTAL - 1 ? (
                <span
                  style={{ width: GAP }}
                  className="relative block h-px shrink-0 bg-hairline"
                >
                  {/* The drawn part of the thread, one pixel, growing from the
                      left so it reads as being pulled forward. */}
                  <span
                    className="absolute inset-0 origin-left bg-blue transition-transform ease-thread"
                    style={{
                      transform: index + 1 < step ? "scaleX(1)" : "scaleX(0)",
                      transitionDuration: "var(--duration-thread)",
                    }}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline" style={{ gap: GAP - 26 }}>
        {labels.map((label, index) => (
          <span
            key={label}
            style={{ minWidth: MARKER + 26 }}
            className={`pt-3 font-data text-label uppercase tracking-[0.12em] ${
              index + 1 <= step ? "text-ink" : "text-ink-3"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Announced, because the step number is the information the line only
          repeats, and a screen reader gets nothing from the line. */}
      <p aria-live="polite" className="pt-3 font-data text-data tabular text-ink-3">
        {t("step", { current: String(step), total: String(TOTAL) })}
      </p>
    </div>
  );
}
