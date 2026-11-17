"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

type Category = { id: string; name: string };

export function CategoryDialog({ category }: { category?: Category }) {
  return (
    <ActionDialog
      title={category ? "Rename category" : "Add category"}
      trigger={
        category ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Rename ${category.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Add category
          </Button>
        )
      }
      action={saveCategoryAction.bind(null, category?.id ?? null)}
    >
      {(s) => (
        <Field label="Name *" htmlFor="name" error={s.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={category?.name} required autoFocus />
        </Field>
      )}
    </ActionDialog>
  );
}

export function DeleteCategoryButton({ category, disabled }: { category: Category; disabled: boolean }) {
  if (disabled) {
    return (
      <Button variant="ghost" size="icon-sm" disabled title="In use by items">
        <Trash2Icon />
      </Button>
    );
  }
  return (
    <ConfirmAction
      title={`Delete "${category.name}"?`}
      description="This category has no items and will be removed."
      confirmLabel="Delete"
      action={() => deleteCategoryAction(category.id)}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`}>
          <Trash2Icon />
        </Button>
      }
    />
  );
}
