"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { ApiError } from "@/lib/api";

/**
 * What a failed request says to the reader. Three screens ask, so they say the
 * same thing.
 *
 * The backend's own message is used where there is one: it names the field or
 * the rule that was broken, which is more use than a generic apology. The one
 * exception is a missing Gemini key, because that message would arrive in
 * English and, more to the point, the reader needs to be told where to fix it
 * rather than what went wrong.
 */
export function useFailure() {
  const t = useTranslations("common");
  // Stable, so a caller can list it in a dependency array without turning its
  // own memo off.
  return useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError && error.code === "no_gemini_key") return t("noGeminiKey");
      if (error instanceof Error && error.message) return error.message;
      return t("failed");
    },
    [t],
  );
}
