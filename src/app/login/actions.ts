"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/locale-cookie";
import { db } from "@/lib/db";

export type LoginError = "wrongCredentials" | "failed" | undefined;

export async function loginAction(_prev: LoginError, formData: FormData): Promise<LoginError> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  try {
    const url = await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
    if (typeof url === "string" && url.includes("error=")) return "wrongCredentials";
  } catch (e) {
    if (e instanceof AuthError) return e.type === "CredentialsSignin" ? "wrongCredentials" : "failed";
    throw e;
  }

  // Signed in: switch to the language saved on the account.
  const user = await db.user.findUnique({ where: { email }, select: { locale: true } });
  if (user && isLocale(user.locale)) await setLocaleCookie(user.locale);
  redirect("/");
}
