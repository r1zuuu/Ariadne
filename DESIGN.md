---
name: Ariadne
register: product
personality: [attributed, deliberate, quiet]
theme: light-only, dark graph canvas
color:
  plaster:        oklch(0.968 0.008 240)   # app background
  plaster-raised: oklch(0.985 0.005 240)   # reading surface
  plaster-sunk:   oklch(0.941 0.010 240)   # rails, hover, data blocks
  ink:            oklch(0.260 0.020 250)   # 14.2:1 on plaster
  ink-2:          oklch(0.450 0.020 250)   # 6.8:1
  ink-3:          oklch(0.530 0.015 250)   # 4.8:1, text floor
  edge:           oklch(0.620 0.015 250)   # 3.3:1, control borders
  hairline:       oklch(0.860 0.010 250)   # 1.4:1, decoration only
  blue:           oklch(0.470 0.120 253)   # 6.0:1, accent, confirmed, thread
  blue-lift:      oklch(0.720 0.120 250)   # 6.0:1 on canvas only
  ochre:          oklch(0.520 0.105 78)    # 4.9:1, proposed text
  ochre-mark:     oklch(0.630 0.130 78)    # 3.2:1, marker fill only
  iron:           oklch(0.505 0.150 27)    # 5.9:1, contradicted, deletions
  slate:          oklch(0.500 0.012 250)   # 5.5:1, archived
  canvas:         oklch(0.220 0.020 250)   # graph only
  canvas-ink:     oklch(0.930 0.010 240)   # 15.8:1 on canvas
type:
  prose: Literata, latin-ext, weights 400/500/600
  data:  Martian Mono, latin-ext, weights 400/500
  scale: 43/34/27/21/17/15/13/11, ratio 1.26
  measure: 68ch
space: [2, 4, 8, 12, 16, 24, 32, 48, 72, 112]
radius: [0, 2]
motion:
  state:  120ms cubic-bezier(0.22,1,0.36,1)
  enter:  200ms cubic-bezier(0.22,1,0.36,1)
  thread: 420ms cubic-bezier(0.16,1,0.3,1)
a11y: WCAG 2.2 AA, status never color-only, reduced-motion honoured
---

# Overview

Ariadne is a desktop window over a research archive, not a dashboard. It shows
what a coding agent decided, when, in which files, and whether a human has
vouched for it. Every screen is a catalogued surface: label on the left, value on
the right, hairline between rows, no boxes around boxes.

**The Instrument Rule.** Nothing on screen celebrates a number; every number is a
reading you can act on.

**The Attribution Rule.** No statement appears without its source, its date and
its status in the same eyeful.

**The Plain Note Rule.** Every label, empty state and status says in words what it
is and what to do next, so the reader never has to infer meaning from a colour,
an icon or a position.

# Colors

Four roles carry meaning and nothing else carries it: blue is the thread and
`confirmed`, ochre is `proposed`, iron is `contradicted`, slate is `archived`.
Neutrals are limestone plaster tinted 0.008 to 0.020 chroma toward the accent.
Pure black and pure white are absent from the palette.

**The Four Roles Rule.** A colour that does not name a status or the thread has no
business being saturated.

**The Marker Floor Rule.** Saturated ochre lives only in 10 px markers at 3.2:1;
any ochre carrying text drops to 4.9:1.

**The One Dark Surface Rule.** The graph canvas is the only dark region in the
product, and it exists because thin lines between forty nodes need it.

# Typography

Literata sets every sentence a human reads; Martian Mono sets everything a
machine produced: paths, hashes, dates, similarity, status names, form labels.
Monospace labels are uppercase, tracked 0.12em, capped at 24 characters.

**The Two Voices Rule.** Prose in the serif, data in the mono, and never the
reverse.

**The Measure Rule.** Body text is 17px/28px in a 68-character column, because a
4000-character entry is a normal read, not an edge case.

# Elevation

There is one shadow in the product: `0 8px 24px oklch(0.26 0.02 250 / 0.14)`, worn
by the command palette and the context menu only. Everything else separates by a
1px border or by background step: plaster, plaster-sunk, plaster-raised.

**The Paper Rule.** Panels are cut paper, not floating cards: a border, a
background step, zero radius above 2px.

**The Modal Last Rule.** A modal is the last resort, allowed only for bulk
deletion; everything else resolves in place.

# Components

Seventeen components: TitleBar, SideRail, CommandPalette, ProjectRow, NodeRow,
Reader, Provenance, StatusChip, Citation, DiffPair, QueueItem, GraphCanvas,
CommandBlock, Banner, EmptyPlate, Field, Button. Each has rest, hover, focus,
active, disabled and error where applicable; focus is always
`outline: 2px var(--blue); outline-offset: 2px`.

**The Shape Plus Word Rule.** Every status renders as marker shape plus written
label plus, where it exists, its reason.

**The Row Height Rule.** A node row is 44px and shows one sentence; reading the
full entry happens in the Reader, never in the list.

**The Terminal Once Rule.** Dark background plus monospace on a light app is
honest exactly once: the onboarding command block.

# Do's and Don'ts

Do write the reason next to the status: `contradicted by entry 418`, not a red
square. Do state what a toggle does in both positions. Do use exact timestamps.
Do keep the queue ignorable and say so in words.

Don't put a coloured bar thicker than 1px on the left of anything. Don't gradient
text. Don't nest a card in a card. Don't use the blue thread as a divider. Don't
congratulate, apologise or exclaim. Don't invent a fifth accent for a fifth
meaning; add a shape instead.

**The No Guessing Rule.** If a label, count or state could be misread by someone
who has never seen this app, spell it out in a sentence instead.
