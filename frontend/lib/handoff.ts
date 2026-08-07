// The dashboard starts a question and the assistant answers it. sessionStorage
// rather than a query string, because the export is static and a question is a
// paragraph, not something to put in a URL.
//
// Session, not local: an unanswered question is not worth surviving a restart.
export const PENDING_QUESTION = "ariadne.pendingQuestion";

/** Reads the handed-over question and clears it, so a reload does not re-ask. */
export function takePendingQuestion(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const question = sessionStorage.getItem(PENDING_QUESTION);
  if (question) sessionStorage.removeItem(PENDING_QUESTION);
  return question;
}
