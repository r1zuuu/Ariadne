"use client";

import { m, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FadeIn, threadTransition } from "@/components/motion";
import { TitleBar } from "@/components/title-bar";
import { Button } from "@/components/ui";
import { markTourSeen } from "@/lib/first-run";

// The product education, three steps, and not the same thing as /onboarding,
// which is the account wizard (profile, first project, agent token).
//
// Three, because Ariadne's model is unusual enough that a new reader needs it
// and short enough that it fits: you tell it things, you ask it later, and
// nothing is recorded without you. A tooltip tour pointing at the menu would
// teach the buttons and skip the idea, which is the part that is actually hard.
//
// It ends on a real action rather than a Done button. A tutorial that finishes
// by closing itself leaves the reader exactly where they started; this one puts
// them in front of the composer with something to type.

const STEPS = ["remembers", "answers", "youDecide"] as const;

// Rail geometry, fixed rather than measured: three 16px rows 32px apart, so the
// markers sit at 8, 56 and 104, and the thread runs between the outer two.
const RAIL_HEIGHT = 112;
const THREAD_PATH = "M5 8V104";

export default function TourScreen() {
  const t = useTranslations("tour");
  const router = useRouter();
  const still = useReducedMotion();
  const [step, setStep] = useState(0);

  const last = step === STEPS.length - 1;

  const leave = (to: string) => {
    markTourSeen();
    router.push(to);
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-9 lg:px-8">
        <div className="mx-auto flex w-full max-w-[880px] gap-8">
          {/* The thread. One stroke drawing itself down to where the reader is,
              which is the only decoration in the product and the reason it is
              here rather than a row of dots: it is the same line the app claims
              to pull through a project's history. */}
          <ol className="relative flex w-[168px] shrink-0 flex-col gap-7 max-md:hidden">
            <svg
              width="10"
              height={RAIL_HEIGHT}
              viewBox={`0 0 10 ${RAIL_HEIGHT}`}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0"
            >
              <path d={THREAD_PATH} stroke="var(--color-hairline)" strokeWidth="1.5" />
              <m.path
                d={THREAD_PATH}
                stroke="var(--color-thread)"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: step / (STEPS.length - 1) }}
                transition={still ? { duration: 0 } : threadTransition}
              />
            </svg>

            {STEPS.map((name, index) => {
              const reached = index <= step;
              return (
                <li key={name} className="flex h-5 items-center gap-4">
                  {/* Opaque fill on both states, because the thread runs behind
                      the markers and a hollow one would have a line through it. */}
                  <span
                    className={`block h-[10px] w-[10px] shrink-0 transition-colors duration-state ease-out-quint ${
                      reached ? "bg-thread" : "border border-edge bg-plaster"
                    }`}
                  />
                  <span
                    className={`whitespace-nowrap font-data text-label uppercase tracking-[0.12em] ${
                      reached ? "text-ink" : "text-ink-3"
                    }`}
                  >
                    {t(`${name}.label`)}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="min-w-0 flex-1">
            <p
              aria-live="polite"
              className="font-data text-label uppercase tracking-[0.12em] tabular text-ink-3"
            >
              {t("step", { current: String(step + 1), total: String(STEPS.length) })}
            </p>

            {/* Keyed on the step so each one is a fresh mount and fades in. */}
            <FadeIn key={step}>
              <h1 className="display-serif pt-5 text-title text-ink">{t(`${STEPS[step]}.title`)}</h1>
              <p className="max-w-[56ch] pt-5 text-lead text-ink-2">{t(`${STEPS[step]}.body`)}</p>
            </FadeIn>

            <div className="flex flex-wrap items-center gap-4 pt-9">
              <Button variant="quiet" onClick={() => leave("/home")}>
                {t("skip")}
              </Button>
              <div className="ml-auto flex gap-4">
                {step > 0 ? (
                  <Button variant="secondary" onClick={() => setStep(step - 1)}>
                    {t("back")}
                  </Button>
                ) : null}
                <Button onClick={() => (last ? leave("/assistant") : setStep(step + 1))}>
                  {last ? t("start") : t("next")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
