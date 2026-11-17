"use client";

import { useTranslations } from "next-intl";
import { PencilIcon, PlusIcon } from "lucide-react";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePersonAction, setPersonActiveAction } from "./actions";

export function PersonDialog({ person }: { person?: { id: string; name: string; email: string } }) {
  const t = useTranslations("people");
  return (
    <ActionDialog
      title={person ? t("editTitle") : t("addTitle")}
      trigger={
        person ? (
          <Button variant="ghost" size="icon-sm" aria-label={t("editLabel", { name: person.name })}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> {t("add")}
          </Button>
        )
      }
      action={savePersonAction.bind(null, person?.id ?? null)}
      submitLabel={person ? undefined : t("add")}
    >
      {(s) => (
        <>
          <Field label={t("name")} htmlFor="name" error={s.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={person?.name} required autoFocus />
          </Field>
          <Field label={t("email")} htmlFor="email" error={s.fieldErrors?.email}>
            <Input id="email" name="email" type="email" defaultValue={person?.email} required />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function ToggleActiveButton({ person }: { person: { id: string; name: string; active: boolean } }) {
  const t = useTranslations("people");
  return (
    <ConfirmAction
      title={person.active ? t("deactivateTitle", { name: person.name }) : t("reactivateTitle", { name: person.name })}
      description={person.active ? t("deactivateDescription") : t("reactivateDescription")}
      confirmLabel={person.active ? t("deactivate") : t("reactivate")}
      action={() => setPersonActiveAction(person.id, !person.active)}
      trigger={
        <Button variant="ghost" size="sm">
          {person.active ? t("deactivate") : t("reactivate")}
        </Button>
      }
    />
  );
}
