"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton, useFormAction } from "@/components/form";
import { loginAction } from "./actions";

export default function LoginPage() {
  const { state: error, onSubmit, pending } = useFormAction(loginAction, undefined);

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">techdex</CardTitle>
          <CardDescription>Sign in to manage the tech inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <FormError message={error} />
            <SubmitButton pending={pending} className="w-full">
              Sign in
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
