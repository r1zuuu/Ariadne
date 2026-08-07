"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, useEffect, useState } from "react";
import en from "@/i18n/en.json";
import pl from "@/i18n/pl.json";

// Both bundles ship in the binary: they are a few kilobytes each and the app has
// to switch language with no network. There is no locale in the URL because
// static export forbids middleware, which is what next-intl's routing needs.

export const LOCALES = ["pl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const MESSAGES = { pl, en };
const STORAGE_KEY = "ariadne.locale";
const FALLBACK: Locale = "pl";

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: FALLBACK,
  setLocale: () => {},
});

export const useLocale = () => useContext(LocaleContext);

function isLocale(value: string | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Build-time HTML has to pick something, so it picks the fallback and the
  // effect below corrects it on the first client frame. Nothing below this
  // provider reads the locale during render, so the swap costs one repaint.
  const [locale, setLocale] = useState<Locale>(FALLBACK);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      setLocale(stored);
      return;
    }
    const fromSystem = navigator.language.slice(0, 2);
    if (isLocale(fromSystem)) setLocale(fromSystem);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const choose = (next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocale(next);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale: choose }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Warsaw">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
