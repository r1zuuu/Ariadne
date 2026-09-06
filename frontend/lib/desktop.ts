// The two things that behave differently inside the Tauri window than in a
// browser tab, kept in one place so no screen has to remember which is which.

import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Whether this window is the desktop application rather than a browser tab.
 *
 * Read after mount, never during render of a prerendered page: `npm run build`
 * renders these screens where there is no window at all.
 */
export function inApp(): boolean {
  return typeof window !== "undefined" && "isTauri" in window;
}

/**
 * Open an address in the person's own browser.
 *
 * This exists because `window.open` does nothing here. The webview raises a
 * new-window request and Tauri drops it, silently, with no error anywhere: the
 * call returns, the code carries on, and no browser ever appears. That is what
 * broke signing in through Google and GitHub - the app opened nothing, waited
 * three minutes for a token that could never arrive, and blamed the wait on the
 * server. The two links to the Gemini console were dead the same way.
 *
 * In a browser the plain `window.open` is right and the plugin is not there to
 * be called, so the check is not a nicety: `npm run dev` runs this code too.
 */
export async function openExternal(url: string): Promise<void> {
  if (inApp()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
