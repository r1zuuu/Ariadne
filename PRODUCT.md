# Product

## Register

product

## Users

Four audiences read the same archive, and none is optional.

**The coder.** Claude Code, Codex or any other LLM agent, reaching Ariadne over MCP. It arrives with no memory of the last session, has a budget of tokens and attention, and will answer from the code if the archive looks empty. It never sees a screen. What it needs is a boot payload that admits how much more is behind it, proven in step 4: the graph stayed invisible until the boot context started advertising what it held.

**The owner.** Stanislaw, junior frontend developer, learning by building. Works in Polish, writes code in English, distrusts over-engineering. Uses the app between coding sessions: checks what the coder recorded, confirms or rejects it, asks the archive questions. Wants to understand why a thing was built a certain way, not just that it was.

**The teammate.** Someone invited into the same workspace. They did not make the decision they are reading, were not in the room, and their own agent has never seen this project. What the archive owes them is attribution: every entry says who recorded it and, once settled, whose judgement settled it. Anyone in a workspace may confirm, so a status without a name on it would mean only that somebody, once, agreed.

**The non-technical person.** The reason the product exists rather than a config file. Sees only the output of an LLM and has no way to tell it what was already decided. Lives on three screens: the project list, the assistant chat, and talking to the archive. Never touches the graph, never types a uuid, and will abandon setup the moment it asks for an environment variable. Step 4 proved how real that risk is: connecting a coder cost the owner half a day, with a terminal and help at hand.

The job, for all three: stop paying for the same context twice.

## Product Purpose

Ariadne stores the "why" of a project. Decisions, notes and end-of-session summaries, each one a single thought with its provenance attached, retrievable by meaning rather than by keyword, and handed back to whichever agent opens the next session.

It deliberately does not map code. An agent reads the repository for "what and where". Ariadne holds the layer no repository contains: which approaches were rejected and why, which constraints are real, which trap someone already fell into. Graphify draws the map; Ariadne keeps the reasons.

Success is a session that opens knowing where the last one stopped, and a non-technical person who connects a coding tool without asking anyone for help.

## Brand Personality

A research archive crossed with an instrument. Catalogued, dated, attributed. Something a person actually maintains, not a feed that scrolls.

Three words: attributed, deliberate, quiet.

Voice: plain and specific. States what happened and what to do next. Never sells, never congratulates, never apologises. Every record shows where it came from, because a memory you cannot audit is a memory you cannot trust. Emotional goal is confidence with no ceremony: the user should feel the archive is complete and honest, then leave it and go back to work.

The Greek reference is structural, never a prop. Ariadne's thread is what got Theseus out of the labyrinth; the product does the same job for an agent between sessions. So the thread appears where there is genuinely a sequence to follow or a connection to draw, and nowhere else.

## Anti-references

**Generic SaaS dashboard.** No blue accent by default, no grid of identical icon-plus-heading cards, no large number with a small label at the top of a screen. Nothing here is a metric to celebrate.

**Terminal as costume.** No green on black, no fake blinking cursors, no ASCII banners. Hermes Agent earns those because it is a terminal. Ariadne is a desktop window, and pretending otherwise would be visible immediately.

**Wizard pushiness.** No confetti, no mascot, no exclamation marks, no "You're doing great". Onboarding exists to connect a tool and get out of the way.

## Design Principles

**Every record carries its provenance.** Source, date, project and status travel with the content wherever it is shown. A claim the user cannot trace is a claim they will not act on.

**One archive, many readers.** Nothing is stored for the agent only or for the human only. If the coder can record it, the app can show it, edit it and archive it, and the reverse holds too. The archive belongs to a workspace rather than to a person, so the same rule now spans people: what one member records, every member reads, through the app and through their own coder.

**Status is the product.** proposed, confirmed, contradicted and archived is the state machine the whole thing turns on. It has to be legible on every surface, and never by colour alone.

**Disappear after setup.** The measure of onboarding is how fast the user stops looking at it. Fewer steps beats friendlier steps.

**The myth is structure, not decoration.** The thread and the labyrinth may shape sequence, connection and retrieval. They may not become ornament, texture or a font choice that says antiquity.

## Accessibility & Inclusion

WCAG 2.2 AA is the floor, not the goal: 4.5:1 for text, 3:1 for interface elements and graphics. Checked against the real tokens, not asserted.

**Status never relies on colour.** Each of the four node statuses carries a distinct marker shape and a written label alongside any colour. Confusing a confirmed decision with an overturned one is the most expensive mistake this interface can cause, so it must survive greyscale and every form of colour blindness.

**prefers-reduced-motion is respected.** Thread drawing, step transitions and any ambient movement stop when the system asks them to.

**Full keyboard operation.** Every screen is reachable and completable with Tab and Enter, with a focus ring that is visible against every surface it can land on. In a desktop app this is ordinary convenience as much as accessibility.

**Two languages.** Interface copy runs in Polish and English through next-intl. Polish diacritics are a hard typographic constraint: a typeface without the full set is disqualified regardless of how it looks.
