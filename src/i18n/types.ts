import type en from "./en.json";

/** Dictionary type derived from the English translation file (source of truth) */
export type Dictionary = typeof en;

export type Locale = "en" | "zh";

export const defaultLocale: Locale = "en";

export const locales: Locale[] = ["en", "zh"];

export const LOCALE_COOKIE = "iekr_locale";
