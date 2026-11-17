"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function loginAction(_prev: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (e) {
    // signIn redirects by throwing; only swallow genuine auth failures.
    if (e instanceof AuthError) {
      return e.type === "CredentialsSignin" ? "Wrong email or password." : "Sign-in failed. Try again.";
    }
    throw e;
  }
}
