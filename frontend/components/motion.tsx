"use client";

import { LazyMotion, MotionConfig, domMax, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Motion in Ariadne says where something came from and what is connected to
// what. Anything that only looks nice is not here.
//
// LazyMotion runs in strict mode, which throws if anyone imports `motion`
// instead of `m`. That is the point of the file: `motion` carries every feature
// on the component itself, so one import of it in one screen re-inflates the
// whole library, while `m` carries nothing and takes its features from here.
// Strict mode is the only thing that keeps that from being undone by accident.
//
// domMax rather than domAnimation, which is the smaller half. The navigation
// marker travels between items with layoutId, the layout projection engine lives
// only in domMax, and the library does not export the layout feature on its own,
// so it is domMax or no shared-layout animation at all.
//
// The feature set is imported statically rather than behind a dynamic import.
// This window loads its bundle off local disk with no network in front of it, so
// a second chunk buys nothing here and costs a boundary to reason about.

// The same three numbers as --duration-state, --duration-enter and
// --duration-thread in globals.css, in the seconds this library wants. JS
// cannot read a CSS custom property without touching the DOM, so the values are
// mirrored here rather than a second scale being invented next to them.
const ENTER = 0.2;
const THREAD = 0.42;
const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;
const EASE_THREAD = [0.16, 1, 0.3, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      {/* "user" wires prefers-reduced-motion into every m component at once, so
          transforms and layout moves stop while opacity still runs. The two
          components below also ask directly, because height is not a transform
          and would otherwise sail through. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/**
 * Something arriving on screen: a message, a proposal, a step of the tour. The
 * 4px rise says it came from below rather than being swapped in place. Under
 * reduced motion it only fades, so nothing that matters depends on the move.
 */
export function FadeIn({ children, className }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return (
    <m.div
      initial={{ opacity: 0, y: still ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ENTER, ease: EASE_OUT_QUINT }}
      className={className}
    >
      {children}
    </m.div>
  );
}

/**
 * Sources under an answer, past conversations under a heading. Height is the
 * whole message here: the panel grows out of the thing above it instead of
 * appearing beside it, which is what tells the reader it belongs to it.
 *
 * `initial={false}` so an already-open panel does not animate on mount.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const still = useReducedMotion();
  return (
    <m.div
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: still ? 0 : ENTER, ease: EASE_OUT_QUINT }}
      style={{ overflow: "hidden" }}
      // Height zero still leaves a button inside reachable by Tab, which is a
      // focus landing on nothing visible. inert takes it out of the tree.
      inert={!open}
    >
      {children}
    </m.div>
  );
}

/**
 * The navigation marker sliding between rows. `enter` and not `thread`: it is
 * the frame reacting to a click, and a frame that takes 420ms to catch up with
 * the page reads as lag rather than as continuity.
 */
export const enterTransition = { duration: ENTER, ease: EASE_OUT_QUINT } as const;

/**
 * The onboarding thread drawing itself. The long one, because here the drawing
 * is the content: the reader is meant to watch the line reach the next step.
 */
export const threadTransition = { duration: THREAD, ease: EASE_THREAD } as const;
