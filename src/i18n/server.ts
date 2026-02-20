import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, type Locale, type Dictionary } from "./types";
import en from "./en.json";
import zh from "./zh.json";

const dictionaries: Record<Locale, Dictionary> = { en, zh };

/** Read locale from cookie — safe for Server Components */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value === "en" || value === "zh") return value;
  return defaultLocale;
}

/** Get the translation dictionary for the current locale */
export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}
