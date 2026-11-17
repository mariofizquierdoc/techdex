import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { CURRENCY, DEFAULT_LOCALE, LOCALE_COOKIE, MESSAGE_FILE, isLocale } from "./config";

export const formats = {
  dateTime: { short: { dateStyle: "medium" } },
  number: { money: { style: "currency", currency: CURRENCY } },
} as const;

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${MESSAGE_FILE[locale]}.json`)).default,
    // Fixed zone so server and browser render the same dates.
    timeZone: process.env.APP_TIME_ZONE || "America/Mexico_City",
    formats,
  };
});
