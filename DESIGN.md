---
name: Ariadne
register: product
personality: [attributed, deliberate, quiet]
theme: dark-first, always
color:
  plaster:        "#181d24"   # the app ground
  plaster-sunk:   "#222831"   # sidebar, title bar, large structure
  surface:        "#2c323b"   # cards, inputs
  surface-2:      "#393e46"   # hover, elevated
  elevated:       "#393e46"   # composer, menus, toasts
  ink:            "#f0e7d9"   # text primary, parchment, never #fff
  ink-2:          "#c7bba9"   # text secondary
  ink-3:          "#948979"   # text muted: metadata, dates
  edge:           "#4b515a"   # border default
  edge-strong:    "#666a6d"   # border strong
  hairline:       "#353b44"   # border subtle
  thread:         "#c76f4f"   # terracotta, the brand: path, action, guidance
  thread-deep:    "#d78260"   # hover
  thread-press:   "#724536"   # pressed
  thread-soft:    "#3e2d29"   # selected dark fill
  thread-lift:    "#e69a78"   # bright cut: decor lines, map edges
  aegean:         "#67a6a1"   # intelligence: citations, info, context
  aegean-deep:    "#487b78"
  laurel:         "#899a6d"   # success olive, confirmed
  ochre:          "#c3a15a"   # warning antique gold, proposed
  iron:           "#c66b62"   # error oxide, contradicted
  stone:          "#948979"   # archived, faded text
  canvas:         "#14181e"   # the command block, the one well below the ground
  canvas-ink:     "#f0e7d9"
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
  library: motion (m + LazyMotion domMax, strict), MotionConfig reducedMotion="user"
a11y: WCAG 2.2 AA, status never colour-only, reduced-motion honoured
---

# Overview

Ariadne is a desktop window over a research archive, kept in the dark:
parchment text on a charcoal ground, a display serif for what is scanned, a
terracotta thread that marks where you are, and an aegean accent for what
Ariadne knows. It shows what a coding agent decided, when, in which files, and
whether a human has vouched for it.

**The Dark-First Rule.** Ariadne is a dark-first application. Contrast and
hierarchy problems are never solved by converting surfaces to a light theme;
they are solved through controlled luminance differences between the ground
(#181D24), surfaces, borders and typography. Text is parchment, not white.

**The Instrument Rule.** Nothing on screen celebrates a number; every number is
a reading you can act on.

**The Attribution Rule.** No statement appears without its source, its date and
its status in the same eyeful.

**The Plain Note Rule.** Every label, empty state and status says in words what
it is and what to do next, so the reader never has to infer meaning from a
colour, an icon or a position.

**The Persistent Shell Rule.** The frame renders once. The six in-shell screens
live in a route group whose layout owns the shell and an AppProvider with the shared
data (projects, active project, review queue, server state). Screens are only
their content; switching projects re-reads state in place. window.location.reload
as an invalidation strategy is banned.

# Colors

**Elevation Is Luminance.** On a dark ground nothing floats on a shadow alone:
the closer a surface sits to the reader, the lighter it is (ground 181D24 →
structure 222831 → card 2C323B → hover/elevated 393E46). Shadows are black
and only anchor what genuinely floats.

**The Two Accents Rule.** Terracotta is the thread: the user's path, action
and guidance - the nav marker, the focused input, the drawn line, the active
node. It marks the path and never fills a button; primary buttons are ink.
Aegean is intelligence: citations, info states, what Ariadne knows. Neither is
decoration, neither covers a large surface, and together they stay in single
percents of any screen.

Statuses: olive is `confirmed`, antique gold is `proposed`, oxide is
`contradicted`, and `archived` is the muted stone - faded text, which is what
an archived entry is. Badge fills are dark desaturated tints of their hue; the
shapes and words carry the meaning.

# Typography

Three voices, split by what the reader does with the text, and the split is now
enforced by the platform rather than by discipline: `h1` and `h2` take
Playfair Display from a base rule, so a screen cannot forget its own brand
face. (Bodoni Moda held this role for an afternoon; its hairline strokes
dissolved into grey at interface sizes, and a heading you squint at is not a
heading.)

**The Scanned Serif Rule.** Playfair sets only what is scanned: display (64,
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
left edge taut in the thread. Suggestions under it are lines with a dot
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
EntryCard, MemoryGraph, Toast, CommandBlock, the motion wrappers.

**The Shape Plus Word Rule.** Every status renders as marker shape plus its
written name: open circle proposed, filled square confirmed, cross
contradicted, dash archived. The same four shapes mark the graph's nodes, so
greyscale and every colour blindness keep the archive legible.

**The Navigation Is Two Groups.** Work (overview, project, add to memory) and
account (queue, team, settings) under a hairline. Asking is not a row: it lives
on the overview. Login and onboarding stand outside the shell entirely, which is
why this counts six screens where the plan counts seven. The active row is a surface
card whose left edge is the thread; one layoutId marker glides between rows
because the shell never remounts.

**The Hint Is an Aside.** A screen explains itself once, in one quiet line
under the heading - a thread dot, one sentence, "Rozumiem" in words. It stopped
being a tinted banner that pushed every page's content down a row. (Removed from
the build during redesign 2 along with its ScreenHint component; kept here as
the intent for when per-screen help comes back.)

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
drawn thread); a screen that explains itself does it once, as an aside.

# Motion

Three durations and nothing else. `state` 120ms for colour under the pointer,
`enter` 200ms for arrival, `thread` 420ms for the one long move where watching
the line get drawn is the point. A fourth value invented in a component is the
end of the system. (`breathe`, a 2.6s opacity loop, was the one exception; it
existed for a 6px dot reporting the server, and went when that dot left the
title bar.)

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
paragraph in the display serif or a date in mono. Don't put a pill around a label. Don't
invent a fifth accent for a fifth meaning; add a shape instead. Don't leave a
button click without a sentence saying what happened. Don't write an empty
state that only says a list is empty. Don't explain a screen twice.

**The No Guessing Rule.** If a label, count or state could be misread by
someone who has never seen this app, spell it out in a sentence instead.
