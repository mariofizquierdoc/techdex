"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePersonAction, setPersonActiveAction } from "./actions";

export function PersonDialog({ person }: { person?: { id: string; name: string; email: string } }) {
  return (
    <ActionDialog
      title={person ? "Edit person" : "Add person"}
      trigger={
        person ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${person.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Add person
          </Button>
        )
      }
      action={savePersonAction.bind(null, person?.id ?? null)}
      submitLabel={person ? "Save" : "Add person"}
    >
      {(s) => (
        <>
          <Field label="Name *" htmlFor="name" error={s.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={person?.name} required autoFocus />
          </Field>
          <Field label="Email *" htmlFor="email" error={s.fieldErrors?.email}>
            <Input id="email" name="email" type="email" defaultValue={person?.email} required />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

export function ToggleActiveButton({ person }: { person: { id: string; name: string; active: boolean } }) {
  return (
    <ConfirmAction
      title={person.active ? `Deactivate ${person.name}?` : `Reactivate ${person.name}?`}
      description={
        person.active
          ? "Inactive people keep their history but can't receive items. Use this when someone leaves."
          : "They will be able to receive items again."
      }
      confirmLabel={person.active ? "Deactivate" : "Reactivate"}
      action={() => setPersonActiveAction(person.id, !person.active)}
      trigger={
        <Button variant="ghost" size="sm">
          {person.active ? "Deactivate" : "Reactivate"}
        </Button>
      }
    />
  );
}
