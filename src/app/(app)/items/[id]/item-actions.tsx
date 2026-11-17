"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ItemStatus } from "@prisma/client";
import {
  ArrowRightLeftIcon,
  PencilIcon,
  StickyNoteIcon,
  Trash2Icon,
  UndoIcon,
  UserCheckIcon,
  WrenchIcon,
} from "lucide-react";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateInput } from "@/lib/format";
import { ITEM_STATUSES } from "@/lib/labels";
import {
  addNoteAction,
  assignItemAction,
  changeStatusAction,
  deleteItemAction,
  recordRepairAction,
  unassignItemAction,
} from "../actions";

type PersonOption = { id: string; name: string; jobTitle: string; location: string };
type ItemSummary = { id: string; assetTag: string; status: ItemStatus; assigneeName: string | null };

const today = () => toDateInput(new Date());

function DateField({ error }: { error?: string[] }) {
  const t = useTranslations("itemActions");
  return (
    <Field label={t("date")} htmlFor="occurredAt" error={error} hint={t("dateHint")}>
      <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today()} required />
    </Field>
  );
}

function NotesField({
  label,
  error,
  required = false,
  placeholder,
}: {
  label?: string;
  error?: string[];
  required?: boolean;
  placeholder?: string;
}) {
  const t = useTranslations("itemActions");
  return (
    <Field label={label ?? t("notes")} htmlFor="notes" error={error}>
      <Textarea id="notes" name="notes" rows={3} required={required} placeholder={placeholder} />
    </Field>
  );
}

function AssignFields({ people, error }: { people: PersonOption[]; error: Record<string, string[] | undefined> }) {
  const t = useTranslations("itemActions");
  const [jobTitle, setJobTitle] = React.useState("");
  const [location, setLocation] = React.useState("");

  return (
    <>
      <Field label={t("person")} htmlFor="personId" error={error.personId}>
        <Select
          name="personId"
          onValueChange={(id) => {
            const p = people.find((x) => x.id === id);
            setJobTitle(p?.jobTitle ?? "");
            setLocation(p?.location ?? "");
          }}
        >
          <SelectTrigger id="personId" className="w-full">
            <SelectValue placeholder={people.length ? t("personPlaceholder") : t("noActivePeople")} />
          </SelectTrigger>
          <SelectContent>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("jobTitle")} htmlFor="jobTitle" error={error.jobTitle}>
          <Input id="jobTitle" name="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder={t("jobTitlePlaceholder")} />
        </Field>
        <Field label={t("location")} htmlFor="location" error={error.location}>
          <Input id="location" name="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("locationPlaceholder")} />
        </Field>
      </div>
      <DateField error={error.occurredAt} />
      <NotesField error={error.notes} />
    </>
  );
}

function StatusSelect({ name, options, error, label }: { name: string; options: readonly ItemStatus[]; error?: string[]; label: string }) {
  const ts = useTranslations("status");
  return (
    <Field label={label} htmlFor={name} error={error}>
      <Select name={name} defaultValue={options[0]}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((st) => (
            <SelectItem key={st} value={st}>
              {ts(st)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ItemActions({ item, people }: { item: ItemSummary; people: PersonOption[] }) {
  const t = useTranslations("itemActions");
  const assigned = !!item.assigneeName;
  const retired = item.status === "RETIRED";
  const statusOptions = ITEM_STATUSES.filter((s) => s !== item.status && (s !== "IN_USE" || assigned));

  return (
    <div className="flex flex-wrap gap-2">
      {!retired && (
        <ActionDialog
          title={assigned ? t("reassignTitle") : t("assignTitle")}
          description={assigned ? t("reassignDescription", { name: item.assigneeName! }) : t("assignDescription")}
          trigger={
            <Button>
              <UserCheckIcon /> {assigned ? t("reassign") : t("assign")}
            </Button>
          }
          action={assignItemAction.bind(null, item.id)}
          submitLabel={t("assign")}
        >
          {(s) => <AssignFields people={people} error={s.fieldErrors ?? {}} />}
        </ActionDialog>
      )}

      {assigned && (
        <ActionDialog
          title={t("returnTitle")}
          description={t("returnDescription", { assetTag: item.assetTag, name: item.assigneeName! })}
          trigger={
            <Button variant="outline">
              <UndoIcon /> {t("return")}
            </Button>
          }
          action={unassignItemAction.bind(null, item.id)}
          submitLabel={t("returnSubmit")}
        >
          {(s) => (
            <>
              <StatusSelect name="toStatus" label={t("moveTo")} options={["IN_STORAGE", "IN_REPAIR", "RETIRED"]} error={s.fieldErrors?.toStatus} />
              <DateField error={s.fieldErrors?.occurredAt} />
              <NotesField error={s.fieldErrors?.notes} placeholder={t("returnPlaceholder")} />
            </>
          )}
        </ActionDialog>
      )}

      {!retired && (
        <ActionDialog
          title={t("repairTitle")}
          description={item.status === "IN_REPAIR" ? t("repairDescription") : undefined}
          trigger={
            <Button variant="outline">
              <WrenchIcon /> {t("repair")}
            </Button>
          }
          action={recordRepairAction.bind(null, item.id)}
          submitLabel={t("repairSubmit")}
        >
          {(s) => (
            <>
              <DateField error={s.fieldErrors?.occurredAt} />
              <NotesField label={t("repairWhat")} required error={s.fieldErrors?.notes} placeholder={t("repairPlaceholder")} />
              <Field label={t("newCondition")} htmlFor="condition" error={s.fieldErrors?.condition} hint={t("newConditionHint")}>
                <Input id="condition" name="condition" placeholder={t("newConditionPlaceholder")} />
              </Field>
            </>
          )}
        </ActionDialog>
      )}

      <ActionDialog
        title={t("noteTitle")}
        trigger={
          <Button variant="outline">
            <StickyNoteIcon /> {t("note")}
          </Button>
        }
        action={addNoteAction.bind(null, item.id)}
        submitLabel={t("noteSubmit")}
      >
        {(s) => (
          <>
            <DateField error={s.fieldErrors?.occurredAt} />
            <NotesField label={t("noteLabel")} required error={s.fieldErrors?.notes} placeholder={t("notePlaceholder")} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="setCondition" defaultChecked className="size-4 accent-primary" />
              {t("setCondition")}
            </label>
          </>
        )}
      </ActionDialog>

      <ActionDialog
        title={t("statusTitle")}
        description={
          assigned ? t("statusDescriptionAssigned", { name: item.assigneeName! }) : t("statusDescriptionUnassigned")
        }
        trigger={
          <Button variant="outline">
            <ArrowRightLeftIcon /> {t("status")}
          </Button>
        }
        action={changeStatusAction.bind(null, item.id)}
        submitLabel={t("statusSubmit")}
      >
        {(s) => (
          <>
            <StatusSelect name="toStatus" label={t("newStatus")} options={statusOptions} error={s.fieldErrors?.toStatus} />
            <DateField error={s.fieldErrors?.occurredAt} />
            <NotesField error={s.fieldErrors?.notes} placeholder={t("reasonPlaceholder")} />
          </>
        )}
      </ActionDialog>

      <Button variant="outline" asChild>
        <Link href={`/items/${item.id}/edit`}>
          <PencilIcon /> {t("edit")}
        </Link>
      </Button>

      <ConfirmAction
        title={t("deleteTitle", { assetTag: item.assetTag })}
        description={t("deleteDescription")}
        action={() => deleteItemAction(item.id)}
        trigger={
          <Button variant="destructive" size="icon" aria-label={t("deleteLabel")} title={t("deleteLabel")}>
            <Trash2Icon />
          </Button>
        }
      />
    </div>
  );
}
