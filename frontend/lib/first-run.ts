// What the reader has already been shown, so nothing explains itself twice.
//
// localStorage rather than the account: this is about one person on one machine
// meeting one window, it survives a reload, and putting it on the server would
// mean a migration and a round trip before the first paint. The keys share the
// "ariadne." prefix the rest of the app uses.
//
// Every read is guarded, because the static export is prerendered by Node where
// there is no localStorage, and a screen may call these during that pass.

const TOUR_KEY = "ariadne.tourSeen";
const HINT_PREFIX = "ariadne.hintSeen.";

function read(key: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(key) === "1";
}

function write(key: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, "1");
}

/** False on the very first run and after resetTour(), true forever otherwise. */
export function hasSeenTour(): boolean {
  return read(TOUR_KEY);
}

/** Called when the tour ends and when it is skipped: both mean "shown". */
export function markTourSeen() {
  write(TOUR_KEY);
}

/**
 * Puts the reader back where a new one starts. It clears the per-screen hints
 * too, because someone asking to be shown around again is asking for the whole
 * explanation, not the three slides without the notes.
 */
export function resetTour() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOUR_KEY);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(HINT_PREFIX)) localStorage.removeItem(key);
  }
}

/** One line of context per screen, shown the first time that screen opens. */
export function hasSeenHint(screen: string): boolean {
  return read(HINT_PREFIX + screen);
}

export function markHintSeen(screen: string) {
  write(HINT_PREFIX + screen);
}
