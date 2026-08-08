---
name: Ariadne
register: product
personality: [attributed, deliberate, quiet]
theme: dark-only, four given stones
color:
  plaster:        "#222831"   # app background, the charcoal
  plaster-raised: "#272e38"
  plaster-sunk:   "#1c222a"   # title bar, nav column: the frame recedes
  surface:        "#2e343e"   # cards rise by lightness
  surface-2:      "#393e46"   # hover, the graphite itself
  ink:            "#ede4d3"   # 11.8:1, lightened sand, never #fff
  ink-2:          "#c9bda6"   # 8.0:1
  ink-3:          "#a79d8c"   # 5.5:1 ground / 4.7:1 card, text floor
  edge:           "#737981"   # 3.2:1, control borders
  hairline:       "#393e46"   # the graphite, decoration only
  thread:         "#dfd0b8"   # 9.8:1, the sand: a linen thread on dark cloth
  laurel:         "#a9b388"   # 6.7:1, confirmed, dried laurel
  ochre:          "#d4b483"   # 7.5:1, proposed, sanded gold
  ochre-mark:     "#c0a46f"   # 6.2:1, markers
  iron:           "#ce8f79"   # 5.4:1, contradicted, deletions, errors, fired clay
  stone:          "#a79d8c"   # archived reads as faded text, which is what it is
  canvas:         "#1a1f27"   # the command block sinks below the page
  canvas-ink:     "#ede4d3"
type:
  heading: Playfair Display, latin-ext, variable wght, headline steps only
  prose:   Geist, latin-ext, weights 100-900
  data:    Geist Mono, latin-ext, weights 400/500, machine output only
  scale: 64/34/27/21/17/15/13/11, headline weights 700/600
  measure: 68ch
space: [2, 4, 8, 12, 16, 24, 32, 48, 72, 112]
radius: [0, 3, 6, 8, 999]   # none, label, control, card, dot
motion:
  state:  120ms cubic-bezier(0.22,1,0.36,1)
  enter:  200ms cubic-bezier(0.22,1,0.36,1)
  thread: 420ms cubic-bezier(0.16,1,0.3,1)
  breathe: 2.6s ease-in-out infinite, opacity only, one dot
  library: motion (m + LazyMotion domMax, strict), MotionConfig reducedMotion="user"
a11y: WCAG 2.2 AA, status never colour-only, reduced-motion honoured
---

# Overview

Ariadne is a desktop window over a research archive, kept in the dark: a
charcoal ground built on four given stones (#222831, #393E46, #948979,
#DFD0B8), sand-inked text, a display serif for what is scanned, and a single
sand thread that marks where you are and where the sequence leads. It shows
what a coding agent decided, when, in which files, and whether a human has
vouched for it.

**The Instrument Rule.** Nothing on screen celebrates a number; every number is
a reading you can act on.

**The Attribution Rule.** No statement appears without its source, its date and
its status in the same eyeful.

**The Plain Note Rule.** Every label, empty state and status says in words what
it is and what to do next, so the reader never has to infer meaning from a
colour, an icon or a position.

**The Persistent Shell Rule.** The frame renders once. The six app screens live
in a route group whose layout owns the shell and an AppProvider with the shared
data (projects, active project, review queue, server state). Screens are only
their content; switching projects re-reads state in place. window.location.reload
as an invalidation strategy is banned.

# Colors

**The Four Stones Rule.** The whole palette descends from four given colours:
#222831 is the ground, #393E46 draws the hairlines and hovers, #948979 is what
has faded, #DFD0B8 is the thread. Every other value (raised and sunk grounds,
the ink ladder, the status hues) is derived from them and stays warm-tuned to
them. Pure black and pure white are absent.

**Elevation Is Lightness.** On a dark ground nothing floats on a shadow alone:
the closer a surface sits to the reader, the lighter it is (sunk 1C222A →
ground 222831 → raised 272E38 → card 2E343E → hover 393E46). Shadows are
black and only anchor what genuinely floats.

**The Thread Rule.** The sand is the brand and it only guides: the active
navigation marker's taut left edge, the focused composer's edge, focus rings,
the drawn thread in the tour, the loose end in an empty state, links, and the
primary button - on this palette the strongest action and the thread share the
same fibre.

Statuses: dried laurel is `confirmed`, sanded gold is `proposed`, fired clay is
`contradicted`, and `archived` is the given taupe - faded text, which is what
an archived entry is. The hues stay quiet because the shapes and words carry
the meaning.

# Typography

Three voices, split by what the reader does with the text, and the split is now
enforced by the platform rather than by discipline: `h1` and `h2` take
Playfair Display from a base rule, so a screen cannot forget its own brand
face. (Bodoni Moda held this role for an afternoon; its hairline strokes
dissolved into grey at interface sizes, and a heading you squint at is not a
heading.)

**The Scanned Serif Rule.** Playfair sets only what is scanned: display (46,
weight 700), title (34) and section (27) at weight 600, tracking zero, never
tighter. It never goes below the section step and never sets a sentence
someone reads word by word.

**The Read Sans Rule.** Geist sets everything read: leads, body, small, labels,
dates, metadata. The metadata voice is 13px Geist in sentence case strung with
middle dots - neither the coloured pills of the first build nor the uppercase
mono of the second, which read as debug output.

**The Machine Mono Rule.** Geist Mono appears only where a machine produced the
string: paths, hashes, tokens, the command block. A date is not machine output.

**The Measure Rule.** Body text is 17px/28px in a 68-character column.

# Elevation

Two black shadows anchor what lightness already lifted: the card shadow (1px +
a soft 10px diffusion) and the lifted shadow (10px/28px at 0.5) for things
that genuinely float - a menu, a toast, the composer.

**The Card Is an Action Unit.** A card is for something you can do something
to: an entry with approve and reject under it, a panel with a control in it.
Content you can only read is a section over a hairline. Settings keeps its
cards because every one of them is a form.

**The Composer Is the Hero.** The one typing surface is the most important
object in the product and the one card that floats at rest: focus pulls its
left edge taut in the sand thread. Suggestions under it are lines with a dot
that takes up the thread on hover - never chips.

**The Empty State Has a Loose End.** No dashed wireframe boxes. An empty state
is a centred note under a short loose thread with its end-dot: the sequence has
not started yet, and the words say what starts it.

**The Modal Last Rule.** A modal is the last resort; everything resolves in
place.

# Components

Primitives live in `components/ui.tsx`: Button, IconButton, Input, Textarea,
Card, Meta, Status, EmptyState, PageHeader, SectionHeader, Banner, Field,
Label. Stateful pieces have their own files: AppShell, AppProvider, Composer,
EntryCard, NodeGraph, Toast, ScreenHint, CommandBlock, the motion wrappers.

**The Shape Plus Word Rule.** Every status renders as marker shape plus its
written name: open circle proposed, filled square confirmed, cross
contradicted, dash archived. The same four shapes mark the graph's nodes and
its legend, so greyscale and every colour blindness keep the archive legible.

**The Navigation Is Two Groups.** Work (overview, project, ask, add to memory)
and account (queue, settings) under a hairline. The active row is a surface
card whose left edge is the thread; one layoutId marker glides between rows
because the shell never remounts.

**The Hint Is an Aside.** A screen explains itself once, in one quiet line
under the heading - a thread dot, one sentence, "Rozumiem" in words. It stopped
being a tinted banner that pushed every page's content down a row.

**The Map Shows the Entries.** The entry map is React Flow with real cards as
nodes - status chip, first line, type and date - laid out oldest to newest
along the timeline, alternating above and below it, deterministically. Edges
run older to newer: solid for a shared file (a fact), dashed for similarity
(a guess). No abstract dots: a visualization that shows shapes without words
is banned in this product.

**The Feedback Rule.** Every action that writes says what happened, in a toast,
in the words the reader would use.

**The Two Explanations Rule.** The model is explained once at
`/onboarding-tour` (three vertically centred, display-set steps along the
drawn thread); each screen then explains itself once via ScreenHint.

# Motion

Three durations, one perpetual exception, and nothing else. `state` 120ms for
colour under the pointer, `enter` 200ms for arrival, `thread` 420ms for the one
long move where watching the line get drawn is the point. `breathe` (2.6s,
opacity only) exists for exactly one 6px dot saying the server is alive.

Motion happens where it answers "where did this come from" or "where did it
go": the navigation marker glides between rows; page content fades up 4px
keyed on the pathname; lists cascade in 50ms steps capped at 200ms; sources
grow out of their answer; a settled queue card leaves visibly (AnimatePresence
exit) instead of the list snapping shorter; buttons press down (scale 0.98) on
:active; the tour thread draws itself.

`prefers-reduced-motion` stops all of it - globally in CSS, per-component via
MotionConfig - and every state change still happens, so no information lives in
the movement.

Never: bounce as a default, parallax, glow, page-level slides or zooms, a
duration invented in a component.

# Do's and Don'ts

Do write the reason next to the status. Do state what a toggle does in both
positions. Do use dates a person reads ("26 lip"), not ISO stamps, outside
machine output. Do keep the queue ignorable and say so in words.

Don't gradient text. Don't nest a card in a card. Don't put a card around
something nobody can act on. Don't fill a button with the thread. Don't set a
paragraph in Bodoni or a date in mono. Don't put a pill around a label. Don't
invent a fifth accent for a fifth meaning; add a shape instead. Don't leave a
button click without a sentence saying what happened. Don't write an empty
state that only says a list is empty. Don't explain a screen twice.

**The No Guessing Rule.** If a label, count or state could be misread by
someone who has never seen this app, spell it out in a sentence instead.
