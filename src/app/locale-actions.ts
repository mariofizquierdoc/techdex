"use server";

import { isLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/locale-cookie";
import { getCurrentUser } from "@/lib/authz";
import { db } from "@/lib/db";

/** Switches the UI language; also saved on the account when signed in (any role). */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  const user = await getCurrentUser();
  if (user && user.locale !== locale) {
    await db.user.update({ where: { id: user.id }, data: { locale } });
  }
}
