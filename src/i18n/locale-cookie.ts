import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./config";

/** Sets the language cookie read by src/i18n/request.ts. Server actions / route handlers only. */
export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
}
