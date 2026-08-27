// Line icons at 18px, one weight, no fills.
//
// They lived in app-shell.tsx while the navigation column was the only place
// that had any. It is not any more: a settings screen of four identical serif
// headings and a project screen of four identical serif sections both read as
// one undifferentiated wall, and the cheapest way to make a heading findable
// without shouting is a mark beside it.
//
// The rule they follow, and it is not negotiable: an icon never replaces its
// label. Nielsen Norman's icon testing puts numbers on what everyone already
// suspects - outside home, search and print, an icon on its own is a guess -
// so every one of these ships next to words that say the same thing. What the
// icon buys is the second pass, when the reader already knows the screen and
// is looking for the one row they came back for.

const stroke = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// --- The navigation column ---

export function IconHome() {
  return (
    <svg {...stroke}>
      <path d="M2.5 7.2 9 2.5l6.5 4.7V15a.5.5 0 0 1-.5.5h-4v-5H7v5H3a.5.5 0 0 1-.5-.5Z" />
    </svg>
  );
}

export function IconProject() {
  return (
    <svg {...stroke}>
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
      <path d="M2.5 7h13M6 3.5v3.5" />
    </svg>
  );
}

export function IconAdd() {
  return (
    <svg {...stroke}>
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

export function IconQueue() {
  return (
    <svg {...stroke}>
      <path d="M3 5h12M3 9h12M3 13h7" />
    </svg>
  );
}

export function IconTeams() {
  return (
    <svg {...stroke}>
      <circle cx="7" cy="6.5" r="2.6" />
      <path d="M2.5 15c0-2.3 2-3.8 4.5-3.8s4.5 1.5 4.5 3.8" />
      <path d="M12.3 4.4a2.6 2.6 0 0 1 0 4.9M13.5 11.6c1.3.5 2.2 1.7 2.2 3.4" />
    </svg>
  );
}

// A dial rather than the usual cogwheel: the settings here are a handful of
// switches, and a gear promises machinery that is not behind it.
export function IconSettings() {
  return (
    <svg {...stroke}>
      <path d="M2.5 6h9M14 6h1.5M2.5 12h4M9 12h6.5" />
      <circle cx="12.5" cy="6" r="1.6" />
      <circle cx="7.5" cy="12" r="1.6" />
    </svg>
  );
}

export function IconSignOut() {
  return (
    <svg {...stroke}>
      <path d="M11 12.5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M7.5 9h8m0 0-2.5-2.5M15.5 9 13 11.5" />
    </svg>
  );
}

// --- Settings ---

export function IconAccount() {
  return (
    <svg {...stroke}>
      <circle cx="9" cy="6.2" r="2.9" />
      <path d="M3.2 15.2c0-2.7 2.6-4.4 5.8-4.4s5.8 1.7 5.8 4.4" />
    </svg>
  );
}

// The one the reader asked for by name. A key is the rare glyph that survives
// on its own, which is why the Gemini section is the easiest row to find.
export function IconKey() {
  return (
    <svg {...stroke}>
      <circle cx="5.8" cy="9" r="3.3" />
      <path d="M9.1 9h6.4M13.2 9v2.6M15.5 9v2" />
    </svg>
  );
}

// What an agent may do unasked: a boundary with a tick inside it, not a
// padlock. Nothing here is locked, something here is permitted.
export function IconAutoApprove() {
  return (
    <svg {...stroke}>
      <path d="M9 2.3 15 4.4v4.7c0 3.4-2.4 5.8-6 6.6-3.6-.8-6-3.2-6-6.6V4.4Z" />
      <path d="M6.4 8.9 8.3 10.8 11.8 7" />
    </svg>
  );
}

// A token is a plug: one agent, one archive, one cable between them.
export function IconToken() {
  return (
    <svg {...stroke}>
      <path d="M6.6 2.8v3.4M11 2.8v3.4" />
      <path d="M4.4 6.2h9.2v3a4.6 4.6 0 0 1-9.2 0Z" />
      <path d="M9 13.8v2.4" />
    </svg>
  );
}

// --- The project ---

// Where the project is in its life. A flag on the ground it has reached.
export function IconStage() {
  return (
    <svg {...stroke}>
      <path d="M4.5 15.5V2.8M4.5 3.4h9l-2.2 3.2 2.2 3.2h-9" />
    </svg>
  );
}

// The repository address. A branch, because that is what the address points at.
export function IconRepo() {
  return (
    <svg {...stroke}>
      <circle cx="5" cy="4.2" r="1.9" />
      <circle cx="5" cy="13.8" r="1.9" />
      <circle cx="13" cy="4.2" r="1.9" />
      <path d="M5 6.1v5.8M13 6.1v1.3c0 2-1.7 2.6-3.6 3-1.9.4-4.4.9-4.4 3.5" />
    </svg>
  );
}

export function IconStack() {
  return (
    <svg {...stroke}>
      <path d="M9 2.4 16 6l-7 3.6L2 6Z" />
      <path d="M2.6 9.4 9 12.7l6.4-3.3M2.6 12.6 9 15.9l6.4-3.3" />
    </svg>
  );
}

// How many entries the archive holds for this project: leaves in a drawer.
export function IconEntries() {
  return (
    <svg {...stroke}>
      <rect x="2.6" y="3.2" width="12.8" height="11.6" rx="1.5" />
      <path d="M2.6 7h12.8M6.6 10.6h4.8" />
    </svg>
  );
}

// The rules the agent reads before it does anything: a corridor it stays in.
export function IconLimits() {
  return (
    <svg {...stroke}>
      <path d="M3.6 3.6v10.8M14.4 3.6v10.8M3.6 9h10.8" />
    </svg>
  );
}

// Three entries and the thread through them, which is the product in one glyph.
export function IconMap() {
  return (
    <svg {...stroke}>
      <path d="M5.3 11.2 7.7 6.8M10.3 6.8l2.4 4.4" />
      <circle cx="3.6" cy="13" r="2.1" />
      <circle cx="9" cy="4.6" r="2.1" />
      <circle cx="14.4" cy="13" r="2.1" />
    </svg>
  );
}

// --- Teams ---

// The two marks. Drawn at 36 rather than the column's 18, and drawn there
// rather than scaled up from it: a 18-box stretched to 36 takes its 1.5 stroke
// along and lands at 3, which is a heavier hand, not a bigger mark. The
// geometry is doubled and the stroke left alone, so these are the column's
// weight at twice its size.
//
// Deliberately not the same glyph twice: the doors are told apart by silhouette
// before either word is read, so one is a line entering an opening and the
// other is a group of people. An envelope would have been the obvious mark for
// an invitation and is wrong here - nothing in this product sends mail, an
// invitation is a code handed over, and a mark promising a letter would be the
// screen making a promise the backend never keeps.
const doorStroke = { ...stroke, width: 36, height: 36, viewBox: "0 0 36 36" };

export function IconEnter() {
  return (
    <svg {...doorStroke}>
      <path d="M19 6h8a2.5 2.5 0 0 1 2.5 2.5v19a2.5 2.5 0 0 1-2.5 2.5h-8" />
      <path d="M6 18h14M15 13l5 5-5 5" />
    </svg>
  );
}

export function IconGroup() {
  return (
    <svg {...doorStroke}>
      <circle cx="14" cy="13" r="5" />
      <path d="M5 29.8c0-4.5 4-7.5 9-7.5s9 3 9 7.5" />
      <path d="M24.6 8.1a5 5 0 0 1 0 9.8M27 23.2c2.6 1 4.4 3.4 4.4 6.6" />
    </svg>
  );
}
