---
name: Ariadne
register: product
personality: [attributed, deliberate, quiet]
theme: light-only, dark graph canvas
color:
  plaster:        oklch(0.97 0.006 85)     # app background, warm bone
  plaster-raised: oklch(0.984 0.004 85)    # reading surface
  plaster-sunk:   oklch(0.945 0.008 85)    # title bar, nav column, hover, data blocks
  surface:        oklch(0.995 0.002 85)    # card paper, never pure white
  ink:            oklch(0.26 0.015 60)     # 14.3:1 on plaster, warm charcoal
  ink-2:          oklch(0.44 0.015 60)     # 7.2:1
  ink-3:          oklch(0.52 0.012 60)     # 5.1:1, text floor
  edge:           oklch(0.62 0.012 60)     # 3.4:1, control borders
  hairline:       oklch(0.87 0.008 60)     # 1.4:1, decoration only
  thread:         oklch(0.45 0.13 28)      # 7.3:1, madder red, the one brand accent
  thread-lift:    oklch(0.70 0.11 30)      # 6.1:1 on canvas only
  laurel:         oklch(0.46 0.08 135)     # 6.3:1, confirmed
  ochre:          oklch(0.52 0.105 78)     # 5.1:1, proposed text
  ochre-mark:     oklch(0.63 0.13 78)      # 3.3:1, marker fill only
  iron:           oklch(0.505 0.15 27)     # 5.8:1, contradicted, deletions, errors
  stone:          oklch(0.50 0.01 80)      # 5.5:1, archived
  canvas:         oklch(0.23 0.015 60)     # graph only
  canvas-ink:     oklch(0.94 0.006 85)     # 14.2:1 on canvas
type:
  heading: Playfair Display, latin-ext, variable wght, headline steps only
  prose:   Geist, latin-ext, weights 100-900
  data:    Geist Mono, latin-ext, weights 400/500, machine output only
  scale: 46/34/27/21/17/15/13/11, headline weights 700/600
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

Ariadne is a desktop window over a research archive, and it now looks like
one: warm bone paper, an almost-black warm ink, a display serif for what is
scanned, and a single madder-red thread that marks where you are and where the
sequence leads. It shows what a coding agent decided, when, in which files,
and whether a human has vouched for it.

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

The neutrals are warm limestone and bone (hue ~85, chroma 0.002-0.008), the ink
is warm charcoal, and pure black and pure white are absent. Five roles carry
meaning and nothing else is saturated:

**The Thread Rule.** Madder red is the brand and it only guides: the active
navigation marker's taut left edge, the focused composer's edge, focus rings,
the drawn thread in the tour, the loose end in an empty state, links. It never
fills a button. Primary buttons are ink - the thread points, it does not shout.

Statuses: laurel green is `confirmed`, ochre is `proposed`, iron is
`contradicted` (deliberately the thread's family: a contradiction is the thread
cutting across an old decision), stone is `archived`.

**The Marker Floor Rule.** Saturated ochre lives only in markers at 3.3:1; any
ochre carrying text uses the 5.1:1 cut.

**The One Dark Surface Rule.** The command block is the only dark region in
the product, and it earns it: it really is a terminal command. The entry map
lives on light paper like everything else.

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

Two shadows, both tinted with the warm ink so lifted paper still belongs to the
page: the card shadow (1px + a soft 8px diffusion at ~0.05 alpha) and the
lifted shadow (8px/24px at 0.14) for things that genuinely float - a menu, a
toast, the focused composer.

**The Card Is an Action Unit.** A card is for something you can do something
to: an entry with approve and reject under it, a panel with a control in it.
Content you can only read is a section over a hairline. Settings keeps its
cards because every one of them is a form.

**The Composer Is the Hero.** The one typing surface is the most important
object in the product and the only card allowed the lifted shadow while awake:
focus pulls its left edge taut in thread red and lifts the paper. Suggestions
under it are lines with a dot that takes up the thread on hover - never chips.

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
