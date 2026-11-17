"use client";

import * as React from "react";
import type { Role } from "@prisma/client";
import { KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserAction, deleteUserAction, resetPasswordAction, setUserRoleAction } from "../actions";

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", VIEWER: "Viewer" };

export function CreateUserDialog() {
  return (
    <ActionDialog
      title="Add user"
      description="Share the password with them securely; they can't change it themselves yet."
      trigger={
        <Button>
          <PlusIcon /> Add user
        </Button>
      }
      action={createUserAction}
      submitLabel="Create user"
    >
      {(s) => (
        <>
          <Field label="Name *" htmlFor="name" error={s.fieldErrors?.name}>
            <Input id="name" name="name" required autoFocus />
          </Field>
          <Field label="Email *" htmlFor="email" error={s.fieldErrors?.email}>
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Role *" htmlFor="role" error={s.fieldErrors?.role}>
            <Select name="role" defaultValue="VIEWER">
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer (read-only)</SelectItem>
                <SelectItem value="ADMIN">Admin (can edit)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Password *" htmlFor="password" error={s.fieldErrors?.password} hint="At least 8 characters">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled: boolean }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const res = await setUserRoleAction(userId, value);
          if (res.error) toast.error(res.error);
          else toast.success(res.message ?? "Role updated");
        })
      }
    >
      <SelectTrigger size="sm" className="w-28" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ResetPasswordDialog({ user }: { user: { id: string; name: string } }) {
  return (
    <ActionDialog
      title={`Reset password for ${user.name}`}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Reset password for ${user.name}`} title="Reset password">
          <KeyRoundIcon />
        </Button>
      }
      action={resetPasswordAction.bind(null, user.id)}
      submitLabel="Reset password"
    >
      {(s) => (
        <Field label="New password *" htmlFor="password" error={s.fieldErrors?.password} hint="At least 8 characters">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus />
        </Field>
      )}
    </ActionDialog>
  );
}

export function DeleteUserButton({ user }: { user: { id: string; name: string } }) {
  return (
    <ConfirmAction
      title={`Delete ${user.name}?`}
      description="They will no longer be able to sign in."
      confirmLabel="Delete"
      action={() => deleteUserAction(user.id)}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${user.name}`} title="Delete user">
          <Trash2Icon />
        </Button>
      }
    />
  );
}
