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
radius: [0, 3, 6, 8, 999]   # none, label, control, card, dot
surface: "#FFFFFF"          # cards sit on plaster as white paper
motion:
  state:  120ms cubic-bezier(0.22,1,0.36,1)
  enter:  200ms cubic-bezier(0.22,1,0.36,1)
  thread: 420ms cubic-bezier(0.16,1,0.3,1)
  library: motion (m + LazyMotion domMax, strict), MotionConfig reducedMotion="user"
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

**The Metadata Voice Rule.** Type, date, channel, project and technology are one
voice, not one shape each: 11px mono, uppercase, tracked 0.12em, strung together
with a middle dot. `DECYZJA · 26 LIP · AGENT`, no background and no border. This
replaces the pills the app used to put around each of them, which gave four
coloured lozenges the same weight as the sentence they described and made every
screen look like every other AI tool. The one exception is status, below.

# Elevation

Two shadows. `0 1px 2px / 0 1px 1px oklch(0.26 0.02 250 / ~0.05)` lifts a card off
the tinted background just enough to read as a group. `0 8px 24px oklch(0.26 0.02
250 / 0.14)` is for things that genuinely float: the command palette, a menu, a
toast.

**The Card Is an Action Unit.** A card is for something you can do something to:
an entry with approve and reject under it, a panel with a control in it. Content
you can only read is a section, separated by a hairline and some air. Ten white
rectangles in a column is packaging, not structure, and it is most of what made
the app read as generic. A card is `--color-surface`, a hairline border, 8px
radius and the card shadow; the same content without actions is the same text
over `border-b border-hairline` and 24px of space underneath.

**The Tint Carries the Page.** The app background holds the colour and the card
does not. A card is white, which is what separates it without a border on every
side.

**The Radius Scale.** Four steps and all of them small: 3px for a metadata
label, 6px for anything you can type into or click, 8px for anything that
groups, 0 for markers and rules. 999px is not a shape in this system any more,
it survives for the two 6px dots that are actually circles (the toast dot and
the server dot on the login screen). A rounded rectangle at 9999px is the AI/SaaS
house style and it is not this one.

**The Modal Last Rule.** A modal is the last resort, allowed only for bulk
deletion; everything else resolves in place.

# Components

Primitives live in `components/ui.tsx`: Button, IconButton, Input, Textarea,
Card, Meta, Status, EmptyState, PageHeader, SectionHeader, Banner, Field, Label.
Meta and Status replaced Badge and Chip, which were the same pill wearing two
tints. Anything with state or data of its own is its own file: AppShell (title
bar, column, project switcher), Composer, EntryCard, StatusMark, NodeGraph,
Toast, ScreenHint, and the three motion wrappers in `components/motion.tsx`.
Each has rest, hover, focus, active, disabled and error where applicable; focus
is always `outline: 2px var(--blue); outline-offset: 2px`, and controls that type
also take `ring-2 ring-blue/15`.

Fixed heights: control 36px, large control and input 44px, title bar 38px.
Written in brackets in the class list, because `globals.css` remaps Tailwind's
spacing keys onto the ten-step scale, so `h-9` is 72px and not 36px.

**The Shape Plus Word Rule.** Every status renders as marker shape plus written
label plus, where it exists, its reason. Status is the one label that kept a
tinted background, because it is the thing the reader has to act on and it earns
the weight the rest of the metadata gave up; the word is always inside it, so
greyscale still reads. The four-shape marker is for the graph and for lists where
colour alone would carry it.

**The Two Explanations Rule.** The product model is explained once, at
`/onboarding-tour`, in three steps: Ariadne remembers, Ariadne answers, you
decide. Each screen then explains itself once, in one line, the first time it is
opened (`ScreenHint`), and never again. Both are dismissible, both are recallable
from "Oprowadź mnie po Ariadne" in the column, and the tour ends on a real
question rather than a Done button. `/onboarding` is a different thing: the
account wizard, profile and first project and agent token.

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

# Motion

Three durations and two curves, in `globals.css`, and nothing outside them: a
fourth value invented in a component is how a system stops being one. `state`
120ms is a colour or a border changing under the pointer. `enter` 200ms is
something arriving on screen. `thread` 420ms is the one long move, used only
where watching the connection get made is the point. Nothing goes past 450ms.

The library is `motion`, used as `m` inside `LazyMotion`, in strict mode so a
stray `motion` import throws instead of quietly pulling every feature into the
first chunk that touches it. The feature set is `domMax` rather than the smaller
`domAnimation`, because shared-layout animation lives only in `domMax` and the
library does not export the layout feature on its own.
`MotionConfig reducedMotion="user"` wires `prefers-reduced-motion` into every
component at once; `FadeIn` and `Collapse` also ask directly, because height is
not a transform and would otherwise sail through. Under reduced motion nothing
moves and every state still changes, so no information lives in the movement.

Motion happens in exactly four places.

**The navigation marker travels.** One `layoutId` for the whole column, so
changing screen slides the marker from the old row to the new one, at `enter`.
It says where you came from, which a marker that blinks out here and in there
does not. This is the thread inside the app frame and the only thing in the frame
that moves. It runs at `enter` and not `thread` because a frame that takes 420ms
to catch up with the page reads as lag.

**Things that arrive fade up 4px.** `FadeIn`, at `enter`: a message, an answer, a
proposal, a step of the tour, a screen hint. The rise says it came from below
rather than being swapped in place, which is how the reader tells new content
from a re-render.

**Things that belong to something else grow out of it.** `Collapse`, at `enter`:
sources under an answer, past conversations under a heading. Height is the whole
message. A panel that grows out of the answer is part of the answer; the same
panel appearing beside it is a second thing on screen.

**The onboarding thread draws itself.** One `pathLength` stroke down the left of
the three tour steps, at `thread`, in `--color-blue`. It is the brand metaphor
doing an actual job: the reader watches the line reach the step they are on. One
stroke, one screen, nowhere else.

Never: bounce, overshoot, springiness as a default, parallax, pulsing gradients,
glow, page-level slides or zooms, or animating a token you invented on the spot.

# Do's and Don'ts

Do write the reason next to the status: `contradicted by entry 418`, not a red
square. Do state what a toggle does in both positions. Do use exact timestamps.
Do keep the queue ignorable and say so in words.

Don't gradient text. Don't nest a card in a card. Don't put a card around
something nobody can act on. Don't use the blue thread as a divider. Don't put a
pill around a label; set it in the metadata voice, and if it is a status give it
the 3px rectangle. Don't congratulate, apologise or exclaim. Don't invent a fifth
accent for a fifth meaning; add a shape instead. Don't mark the current thing
with a line alone: give it a surface. Don't leave a button click without a
sentence saying what happened. Don't write an empty state that only says a list
is empty; say what it means and what to do next. Don't explain a screen twice:
the hint fires once, then never.

**The No Guessing Rule.** If a label, count or state could be misread by someone
who has never seen this app, spell it out in a sentence instead.
