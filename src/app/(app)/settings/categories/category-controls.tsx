"use client";

import { useTranslations } from "next-intl";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

type Category = { id: string; name: string };

export function CategoryDialog({ category }: { category?: Category }) {
  const t = useTranslations("categories");
  return (
    <ActionDialog
      title={category ? t("renameTitle") : t("addTitle")}
      trigger={
        category ? (
          <Button variant="ghost" size="icon-sm" aria-label={t("renameLabel", { name: category.name })}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> {t("add")}
          </Button>
        )
      }
      action={saveCategoryAction.bind(null, category?.id ?? null)}
    >
      {(s) => (
        <Field label={t("name")} htmlFor="name" error={s.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={category?.name} required autoFocus />
        </Field>
      )}
    </ActionDialog>
  );
}

export function DeleteCategoryButton({ category, disabled }: { category: Category; disabled: boolean }) {
  const t = useTranslations("categories");
  if (disabled) {
    return (
      <Button variant="ghost" size="icon-sm" disabled title={t("inUse")}>
        <Trash2Icon />
      </Button>
    );
  }
  return (
    <ConfirmAction
      title={t("deleteTitle", { name: category.name })}
      description={t("deleteDescription")}
      action={() => deleteCategoryAction(category.id)}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={t("deleteLabel", { name: category.name })}>
          <Trash2Icon />
        </Button>
      }
    />
  );
}
