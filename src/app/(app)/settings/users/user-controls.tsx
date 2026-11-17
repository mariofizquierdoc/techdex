"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLES } from "@/lib/labels";
import { createUserAction, deleteUserAction, resetPasswordAction, setUserRoleAction } from "../actions";

export function CreateUserDialog() {
  const t = useTranslations();
  return (
    <ActionDialog
      title={t("users.addTitle")}
      description={t("users.addDescription")}
      trigger={
        <Button>
          <PlusIcon /> {t("users.add")}
        </Button>
      }
      action={createUserAction}
      submitLabel={t("users.createSubmit")}
    >
      {(s) => (
        <>
          <Field label={t("users.name")} htmlFor="name" error={s.fieldErrors?.name}>
            <Input id="name" name="name" required autoFocus />
          </Field>
          <Field label={t("users.email")} htmlFor="email" error={s.fieldErrors?.email}>
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label={t("users.role")} htmlFor="role" error={s.fieldErrors?.role}>
            <Select name="role" defaultValue="VIEWER">
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">{t("role.viewerLong")}</SelectItem>
                <SelectItem value="ADMIN">{t("role.adminLong")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("users.password")} htmlFor="password" error={s.fieldErrors?.password} hint={t("users.passwordHint")}>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled: boolean }) {
  const t = useTranslations();
  const [pending, startTransition] = React.useTransition();
  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const res = await setUserRoleAction(userId, value);
          if (res.error) toast.error(res.error);
          else toast.success(res.message ?? t("toast.roleUpdated"));
        })
      }
    >
      <SelectTrigger size="sm" className="w-36" aria-label={t("users.roleCol")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {t(`role.${r}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ResetPasswordDialog({ user }: { user: { id: string; name: string } }) {
  const t = useTranslations("users");
  return (
    <ActionDialog
      title={t("resetTitle", { name: user.name })}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={t("resetLabel")} title={t("resetLabel")}>
          <KeyRoundIcon />
        </Button>
      }
      action={resetPasswordAction.bind(null, user.id)}
      submitLabel={t("resetSubmit")}
    >
      {(s) => (
        <Field label={t("newPassword")} htmlFor="password" error={s.fieldErrors?.password} hint={t("passwordHint")}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus />
        </Field>
      )}
    </ActionDialog>
  );
}

export function DeleteUserButton({ user }: { user: { id: string; name: string } }) {
  const t = useTranslations("users");
  return (
    <ConfirmAction
      title={t("deleteTitle", { name: user.name })}
      description={t("deleteDescription")}
      action={() => deleteUserAction(user.id)}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={t("deleteLabel")} title={t("deleteLabel")}>
          <Trash2Icon />
        </Button>
      }
    />
  );
}
