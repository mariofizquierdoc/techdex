/** Full locale codes so dates and numbers follow regional conventions (es-MX, not es-ES). */
export const LOCALES = ["es-MX", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es-MX";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = { "es-MX": "Español", "en-US": "English" };

/** Message catalog file for each locale (messages/<file>.json). */
export const MESSAGE_FILE: Record<Locale, string> = { "es-MX": "es", "en-US": "en" };

export const CURRENCY = "USD";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
