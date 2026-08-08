// Whether the reader has already been shown the tour, so it never runs twice.
//
// localStorage rather than the account: this is about one person on one machine
// meeting one window, it survives a reload, and putting it on the server would
// mean a migration and a round trip before the first paint. The key shares the
// "ariadne." prefix the rest of the app uses.
//
// Every read is guarded, because the static export is prerendered by Node where
// there is no localStorage, and a screen may call these during that pass.

const TOUR_KEY = "ariadne.tourSeen";

/** False on the very first run and after resetTour(), true forever otherwise. */
export function hasSeenTour(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(TOUR_KEY) === "1";
}

/** Called when the tour ends and when it is skipped: both mean "shown". */
export function markTourSeen() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TOUR_KEY, "1");
}

/** Puts the reader back where a new one starts. */
export function resetTour() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOUR_KEY);
}
