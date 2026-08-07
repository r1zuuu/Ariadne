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
  heading: Marcellus, latin-ext, weight 400 only
  prose:   Geist, latin-ext, weights 100-900
  data:    Martian Mono, latin-ext, weights 400/500
  scale: 43/34/27/21/17/15/13/11, ratio 1.26
  measure: 68ch
space: [2, 4, 8, 12, 16, 24, 32, 48, 72, 112]
radius: [0, 6, 10, 999]   # none, control, card, pill
surface: "#FFFFFF"        # cards sit on plaster as white paper
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

Three families, split by what the reader does with the text. Marcellus sets the
three headline steps, which are scanned to find a place on the screen. Geist
sets every sentence read word by word, including what a person types into a
field. Martian Mono sets everything a machine produced: paths, hashes, dates,
similarity, status names, form labels. Monospace labels are uppercase, tracked
0.12em, capped at 24 characters.

**The Three Voices Rule.** Headings in the serif, prose in the sans, data in the
mono, and never the reverse. The split is by use, not by size: a 21px lead is
prose because it is read, and a 27px section heading is scanned.

**The One Weight Rule.** Marcellus ships a single cut, so the headline steps ask
for 400. A heading never gets bold, because there is no bold to get: the
renderer would smear the regular one.

**The Measure Rule.** Body text is 17px/28px in a 68-character column, because a
4000-character entry is a normal read, not an edge case.

# Elevation

Two shadows. `0 1px 2px / 0 1px 1px oklch(0.26 0.02 250 / ~0.05)` lifts a card off
the tinted background just enough to read as a group. `0 8px 24px oklch(0.26 0.02
250 / 0.14)` is for things that genuinely float: the command palette, a menu, a
toast.

**The Card Rule.** Related content is grouped by a white card on the tinted page:
`--color-surface`, a hairline border, 10px radius, the card shadow. This replaces
the earlier Paper Rule, which forbade radius above 2px and made every screen read
as one undifferentiated form. Hairlines still divide rows *inside* a card; they
are no longer the only grouping device on a screen.

**The Tint Carries the Page.** The app background holds the colour and the card
does not. A card is white, which is what separates it without a border on every
side.

**The Shape Is the Signal.** A pill means a short label about something else on
screen: a status, a type, a count, a technology. Anything you can type into is a
6px control; anything that groups is a 10px card. Nothing else is round.

**The Modal Last Rule.** A modal is the last resort, allowed only for bulk
deletion; everything else resolves in place.

# Components

Primitives live in `components/ui.tsx`: Button, IconButton, Input, Textarea,
Card, Badge, Chip, EmptyState, PageHeader, SectionHeader, Banner, Field, Label.
Anything with state or data of its own is its own file: AppShell (title bar,
column, project switcher), Composer, EntryCard, StatusMark, NodeGraph, Toast.
Each has rest, hover, focus, active, disabled and error where applicable; focus
is always `outline: 2px var(--blue); outline-offset: 2px`, and controls that type
also take `ring-2 ring-blue/15`.

Fixed heights: control 36px, large control and input 44px, title bar 38px.
Written in brackets in the class list, because `globals.css` remaps Tailwind's
spacing keys onto the ten-step scale, so `h-9` is 72px and not 36px.

**The Shape Plus Word Rule.** Every status renders as marker shape plus written
label plus, where it exists, its reason. A badge is the word; the four-shape
marker is for the graph and for lists where colour alone would carry it.

**The One Composer Rule.** There is one place a person types at Ariadne and it
looks the same in all three: dashboard, assistant, add-context. Enter sends,
Shift+Enter breaks the line, and the field says so under itself.

**The Feedback Rule.** Every action that writes says what happened, in a toast,
in the words the reader would use: "entry added to the project context", not
"200 OK".

**The Row Height Rule.** A node row shows one sentence; reading the full entry
happens behind "show more" or in the Reader, never as a wall in the list.

**The Terminal Once Rule.** Dark background plus monospace on a light app is
honest exactly once: the onboarding command block.

# Do's and Don'ts

Do write the reason next to the status: `contradicted by entry 418`, not a red
square. Do state what a toggle does in both positions. Do use exact timestamps.
Do keep the queue ignorable and say so in words.

Don't gradient text. Don't nest a card in a card. Don't use the blue thread as a
divider. Don't congratulate, apologise or exclaim. Don't invent a fifth accent
for a fifth meaning; add a shape instead. Don't mark the current thing with a
line alone: give it a surface. Don't leave a button click without a sentence
saying what happened. Don't write an empty state that only says a list is
empty; say what it means and what to do next.

**The No Guessing Rule.** If a label, count or state could be misread by someone
who has never seen this app, spell it out in a sentence instead.
