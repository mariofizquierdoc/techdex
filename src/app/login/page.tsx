"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton, useFormAction } from "@/components/form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { loginAction } from "./actions";

export default function LoginPage() {
  const t = useTranslations("auth");
  const { state: error, onSubmit, pending } = useFormAction(loginAction, undefined);

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">techdex</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field label={t("email")} htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </Field>
            <Field label={t("password")} htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <FormError message={error ? t(error) : undefined} />
            <SubmitButton pending={pending} className="w-full">
              {t("signIn")}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
