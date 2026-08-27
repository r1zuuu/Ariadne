"use client";

import { m } from "motion/react";

// One knot on the thread, in the three states a step can be in.
//
// Drawn here rather than taken from a component library, and not out of thrift.
// No headless kit ships a stepper at all - Radix, Headless UI and shadcn have
// none - and the ones that do (Material, Mantine, Chakra) arrive with a theme
// engine and a look of their own; dropped between a Playfair heading and a
// parchment palette they read as borrowed from another application. The headless
// packages that do exist hand over step state and no visuals, which is the half
// that was never the problem.
//
// What was the problem: a <span> with border-radius and a 1px border. At 9px
// across, a 1px CSS border lands on fractions of a device pixel and the browser
// rounds each side on its own, so the circle came out visibly lopsided. An SVG
// stroke is drawn from geometry rather than from a box model.
//
// The shapes are static and only their opacity moves. An earlier version drew
// the ring with pathLength and popped the dot with scale, and both failed in the
// same way: transforms on an SVG child need transform-box: fill-box to take
// their origin from the shape, so the dot scaled around the wrong point and the
// ring stopped part-drawn. A marker that is sometimes a broken arc is worse than
// one that does not animate at all.
//
// Three states that differ in kind, not only in fill, so the row reads at a
// glance: a finished step carries a tick, the step you are on wears a ring, one
// still ahead is an outline.

export type StepState = "done" | "current" | "upcoming";

export function StepMarker({
  state,
  ground = "plaster",
}: {
  state: StepState;
  /** What sits behind it, so an unfilled knot hides the thread crossing it. */
  ground?: "plaster" | "plaster-sunk";
}) {
  const behind = ground === "plaster-sunk" ? "var(--color-plaster-sunk)" : "var(--color-plaster)";

  return (
    <m.svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
      initial={false}
      animate={{ opacity: 1 }}
    >
      {/* Opaque under everything: the wizard runs its thread behind this column
          and it showed through as a line across each hollow marker. */}
      <circle cx="12" cy="12" r="11" fill={behind} />

      {state === "upcoming" ? (
        <circle cx="12" cy="12" r="5" fill="none" stroke="var(--color-edge-strong)" strokeWidth="1.5" />
      ) : null}

      {state === "current" ? (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-thread)" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4.5" fill="var(--color-thread)" />
        </m.g>
      ) : null}

      {state === "done" ? (
        <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <circle cx="12" cy="12" r="9" fill="var(--color-thread)" />
          {/* The tick is what makes "finished" different in kind from "here",
              rather than the same dot two pixels smaller. */}
          <path
            d="M8 12.2l2.6 2.6L16 9.4"
            fill="none"
            stroke={behind}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </m.g>
      ) : null}
    </m.svg>
  );
}
