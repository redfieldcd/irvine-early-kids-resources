"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "./types";
import { LOCALE_COOKIE } from "./types";

interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}

export function I18nProvider({
  locale: initialLocale,
  dictionary: initialDictionary,
  children,
}: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary);
  const router = useRouter();

  const toggleLocale = useCallback(async () => {
    const newLocale: Locale = locale === "en" ? "zh" : "en";

    // Set cookie so server components pick it up on next render
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

    // Dynamically import the new dictionary
    const mod =
      newLocale === "zh"
        ? await import("./zh.json")
        : await import("./en.json");

    setDictionary(mod.default as Dictionary);
    setLocale(newLocale);

    // Re-render server components with new locale
    router.refresh();
  }, [locale, router]);

  return (
    <I18nContext.Provider value={{ locale, t: dictionary, toggleLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
